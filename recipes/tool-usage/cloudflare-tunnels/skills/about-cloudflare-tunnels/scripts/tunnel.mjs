#!/usr/bin/env node
// Opens, lists and stops Cloudflare quick tunnels: temporary public URLs
// (https://<random>.trycloudflare.com) that forward to a port on this machine.
//
//   node tunnel.mjs start <port | url> [--host-header <host>] [--allowed-mail <emails>]
//   node tunnel.mjs list
//   node tunnel.mjs stop <id | port | all>
//
// No packages and no Cloudflare account are needed. cloudflared is taken from
// the PATH, or downloaded once from its GitHub releases into the sous home
// (SOUS_HOME, or ~/.sous). Running tunnels are recorded there too, so list and
// stop work from any session.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const SOUS_HOME = process.env.SOUS_HOME || path.join(os.homedir(), '.sous');
const BASE_DIR = path.join(SOUS_HOME, 'cloudflare-tunnels');
const BIN_DIR = path.join(BASE_DIR, 'bin');
const STATE_DIR = path.join(BASE_DIR, 'tunnels');
const IS_WINDOWS = process.platform === 'win32';
const BIN_NAME = IS_WINDOWS ? 'cloudflared.exe' : 'cloudflared';
const RELEASES = 'https://github.com/cloudflare/cloudflared/releases/latest/download';

// The tunnel's own address; api. and login. are Cloudflare's services, which
// can appear in cloudflared's messages too.
const URL_PATTERN = /https:\/\/(?!api\.|login\.)[-a-z0-9]+\.trycloudflare\.com/;
const CONNECTED_PATTERN = /Registered tunnel connection/;

// ---------------------------------------------------------------- helpers

function fail(message) {
  console.error(message);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function age(iso) {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 90) return `${seconds}s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function tail(file, lines = 15) {
  try {
    return fs.readFileSync(file, 'utf8').trimEnd().split('\n').slice(-lines).join('\n');
  } catch {
    return '(no log)';
  }
}

// ---------------------------------------------------------------- cloudflared

function findOnPath() {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, BIN_NAME);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {}
  }
  return null;
}

// The release asset for this OS and CPU. macOS builds come as a .tgz holding
// one file; the others are the bare binary.
function releaseAsset() {
  const arch = { x64: 'amd64', arm64: 'arm64', arm: 'arm', ia32: '386' }[process.arch];
  const assets = {
    linux: { amd64: 'cloudflared-linux-amd64', arm64: 'cloudflared-linux-arm64', arm: 'cloudflared-linux-arm', 386: 'cloudflared-linux-386' },
    darwin: { amd64: 'cloudflared-darwin-amd64.tgz', arm64: 'cloudflared-darwin-arm64.tgz' },
    // Windows on ARM runs the x64 build under emulation.
    win32: { amd64: 'cloudflared-windows-amd64.exe', arm64: 'cloudflared-windows-amd64.exe', 386: 'cloudflared-windows-386.exe' },
  };
  return assets[process.platform]?.[arch] ?? null;
}

async function download() {
  const asset = releaseAsset();
  if (!asset) {
    fail(
      `No cloudflared download is known for ${process.platform}/${process.arch}. ` +
        'Install cloudflared yourself (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) and run this again.',
    );
  }
  console.log(`cloudflared is not on the PATH; downloading ${asset} into ${BIN_DIR} ...`);
  fs.mkdirSync(BIN_DIR, { recursive: true });
  const response = await fetch(`${RELEASES}/${asset}`, { signal: AbortSignal.timeout(180_000) });
  if (!response.ok) fail(`Downloading ${RELEASES}/${asset} failed: HTTP ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const target = path.join(BIN_DIR, BIN_NAME);
  const partial = `${target}.${process.pid}.partial`;

  if (asset.endsWith('.tgz')) {
    const archive = `${partial}.tgz`;
    const unpackDir = `${partial}.d`;
    fs.writeFileSync(archive, bytes);
    fs.mkdirSync(unpackDir, { recursive: true });
    const result = spawnSync('tar', ['-xzf', archive, '-C', unpackDir], { stdio: 'inherit' });
    if (result.status !== 0) fail(`Unpacking ${archive} with tar failed.`);
    fs.renameSync(path.join(unpackDir, 'cloudflared'), partial);
    fs.rmSync(archive, { force: true });
    fs.rmSync(unpackDir, { recursive: true, force: true });
  } else {
    fs.writeFileSync(partial, bytes);
  }
  fs.chmodSync(partial, 0o755);
  fs.renameSync(partial, target);
  return target;
}

async function cloudflared() {
  const onPath = findOnPath();
  if (onPath) return onPath;
  const cached = path.join(BIN_DIR, BIN_NAME);
  if (fs.existsSync(cached)) return cached;
  const fresh = await download();
  const version = spawnSync(fresh, ['--version'], { encoding: 'utf8' });
  if (version.status !== 0) fail(`The downloaded ${fresh} does not run: ${version.stderr || version.error}`);
  console.log(`Installed ${version.stdout.trim()}`);
  return fresh;
}

// ---------------------------------------------------------------- state

function stateFile(id) {
  return path.join(STATE_DIR, `${id}.json`);
}

function isRunning(record) {
  try {
    process.kill(record.pid, 0);
  } catch (error) {
    if (error.code !== 'EPERM') return false;
  }
  // Guard against a reused process ID where the OS can tell us the command.
  try {
    const cmdline = fs.readFileSync(`/proc/${record.pid}/cmdline`, 'utf8');
    return cmdline.includes('cloudflared');
  } catch {
    return true;
  }
}

function forget(record) {
  fs.rmSync(stateFile(record.id), { force: true });
  fs.rmSync(record.log, { force: true });
}

// Every recorded tunnel whose process is still alive. Records of tunnels that
// died on their own (a reboot, a killed terminal) are cleaned up here.
function liveTunnels() {
  let names = [];
  try {
    names = fs.readdirSync(STATE_DIR).filter((name) => name.endsWith('.json'));
  } catch {}
  const live = [];
  for (const name of names) {
    let record;
    try {
      record = JSON.parse(fs.readFileSync(path.join(STATE_DIR, name), 'utf8'));
    } catch {
      continue;
    }
    if (isRunning(record)) live.push(record);
    else forget(record);
  }
  return live.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

// ---------------------------------------------------------------- the origin

function parseTarget(arg) {
  if (/^\d+$/.test(arg)) {
    const port = Number(arg);
    if (port < 1 || port > 65535) fail(`${arg} is not a port number (1 to 65535).`);
    return { scheme: 'http', host: null, port };
  }
  let url;
  try {
    url = new URL(arg.includes('://') ? arg : `http://${arg}`);
  } catch {
    fail(`"${arg}" is neither a port number nor a URL.`);
  }
  const scheme = url.protocol.replace(':', '');
  if (scheme !== 'http' && scheme !== 'https') fail(`Only http and https servers can be tunneled, not ${scheme}.`);
  const port = Number(url.port) || (scheme === 'https' ? 443 : 80);
  return { scheme, host: url.hostname.replace(/^\[|\]$/g, ''), port };
}

function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(2000, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

// The address the server really listens on. "localhost" can mean 127.0.0.1 or
// ::1, and a dev server often listens on only one of them.
async function originUrl(target) {
  const hosts = target.host && target.host !== 'localhost' ? [target.host] : ['127.0.0.1', '::1'];
  for (const host of hosts) {
    if (await canConnect(host, target.port)) {
      const shown = host.includes(':') ? `[${host}]` : host;
      return `${target.scheme}://${shown}:${target.port}`;
    }
  }
  fail(
    `Nothing is listening on ${target.host || 'localhost'}:${target.port}. ` +
      'Start the server first, then open the tunnel.',
  );
}

// ---------------------------------------------------------------- checking the URL

// Bodies that dev servers send when they refuse an unknown Host header, and
// the setting that fixes each. Order matters: the first match wins.
const HOST_CHECKS = [
  {
    match: /Blocked request\. This host/i,
    server: 'Vite',
    fix: "add the tunnel's host to server.allowedHosts in the Vite config (\".trycloudflare.com\" allows every quick tunnel), then restart the dev server",
  },
  {
    match: /Invalid Host header/i,
    server: 'webpack-dev-server (also used by Create React App, Vue CLI and older Angular CLI)',
    fix: "set devServer.allowedHosts to \"all\" (or [\".trycloudflare.com\"]), or pass --allowed-hosts all, then restart the dev server",
  },
  {
    match: /^Invalid host\b/i,
    server: 'Storybook',
    fix: "set core.allowedHosts to [\".trycloudflare.com\"] in .storybook/main, or start Storybook with --host 0.0.0.0 (which also opens it to the local network), then restart it",
  },
];

function diagnose(status, body) {
  if (status !== 403 && status !== 400) return null;
  const text = body.trim().slice(0, 2000);
  for (const check of HOST_CHECKS) {
    if (check.match.test(text)) return check;
  }
  if (/host/i.test(text)) {
    return { server: 'The dev server', fix: 'allow the tunnel host in its host check (often called allowedHosts), then restart it' };
  }
  return null;
}

// Requests the public URL until it answers. A brand-new quick tunnel can take
// several seconds before its name resolves and Cloudflare routes it.
async function probe(url) {
  const deadline = Date.now() + 45_000;
  let last = 'no answer';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
      const body = await response.text();
      // 530 (and Cloudflare's 1033 error page) means the edge cannot reach the tunnel yet.
      if (response.status === 530 || /error code: 1033/i.test(body)) {
        last = `HTTP ${response.status} from Cloudflare (tunnel not routed yet)`;
      } else {
        return { status: response.status, headers: response.headers, body };
      }
    } catch (error) {
      last = error.cause?.code || error.name || String(error);
    }
    await sleep(2000);
  }
  return { status: null, last };
}

// ---------------------------------------------------------------- commands

// The value after a --flag, or null when the flag is absent.
function option(args, flag, example) {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) fail(`${flag} needs a value, such as ${example}.`);
  return value;
}

async function start(args) {
  const hostHeader = option(args, '--host-header', 'localhost');
  const allowedMail = option(args, '--allowed-mail', 'ada@example.com');
  const optionValues = new Set([hostHeader, allowedMail]);
  const targetArg = args.find((arg) => !arg.startsWith('--') && !optionValues.has(arg));
  if (!targetArg) fail(USAGE);

  const target = parseTarget(targetArg);
  const origin = await originUrl(target);
  const bin = await cloudflared();

  fs.mkdirSync(STATE_DIR, { recursive: true });
  const id = randomBytes(2).toString('hex');
  const log = path.join(STATE_DIR, `${id}.log`);
  const logFd = fs.openSync(log, 'a');

  const cfArgs = ['tunnel', '--no-autoupdate', '--url', origin];
  if (target.scheme === 'https') cfArgs.push('--no-tls-verify');
  if (hostHeader) cfArgs.push('--http-host-header', hostHeader);
  if (allowedMail) cfArgs.push('--allowed-mail', allowedMail);

  const child = spawn(bin, cfArgs, { detached: true, stdio: ['ignore', logFd, logFd], windowsHide: true });
  fs.closeSync(logFd);
  let exited = null;
  child.once('exit', (code) => (exited = code ?? 'signal'));
  child.unref();

  // Wait for cloudflared to print the URL and register a connection.
  let url = null;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline && exited === null) {
    const text = fs.readFileSync(log, 'utf8');
    url ??= text.match(URL_PATTERN)?.[0] ?? null;
    if (url && CONNECTED_PATTERN.test(text)) break;
    await sleep(250);
  }
  if (!url || exited !== null) {
    try {
      process.kill(child.pid);
    } catch {}
    const reason = exited !== null ? `cloudflared exited (${exited})` : 'cloudflared printed no URL within 60 seconds';
    const end = tail(log);
    fs.rmSync(log, { force: true });
    fail(`Could not open a tunnel: ${reason}. The end of its log:\n\n${end}`);
  }

  const record = {
    id,
    pid: child.pid,
    port: target.port,
    origin,
    url,
    hostHeader,
    allowedMail,
    cwd: process.cwd(),
    startedAt: new Date().toISOString(),
    log,
  };
  fs.writeFileSync(stateFile(id), `${JSON.stringify(record, null, 2)}\n`);

  console.log(`Tunnel ${id} is open: ${url} -> ${origin}${hostHeader ? ` (Host: ${hostHeader})` : ''}`);
  if (allowedMail) {
    console.log(`Visitors must first sign in with Cloudflare's email login as one of: ${allowedMail}.`);
  } else {
    console.log('Anyone who has this URL can open it until the tunnel is stopped.');
  }

  const result = await probe(url);
  const location = result.status ? result.headers.get('location') || '' : '';
  if (result.status === null) {
    console.log(`Check: this machine could not load the URL yet (${result.last}).`);
    console.log('A new quick tunnel can take a minute to resolve everywhere; it may already work from another machine.');
  } else if (/^https:\/\/login\.trycloudflare\.com\//.test(location)) {
    console.log("Check: the URL answers with Cloudflare's email login, so the server behind it cannot be checked from here.");
  } else {
    const refusal = diagnose(result.status, result.body);
    if (refusal) {
      console.log(`Check: HTTP ${result.status}, "${result.body.trim().split('\n')[0].slice(0, 160)}"`);
      console.log(`${refusal.server} refused the tunnel's host name. To fix it, ${refusal.fix}.`);
      if (!hostHeader) {
        console.log(
          `Or, without touching the server: stop this tunnel and run "start ${targetArg} --host-header localhost" ` +
            '(pages load; a server that also checks the live-reload connection may still refuse that).',
        );
      }
    } else if (result.status >= 500) {
      console.log(`Check: HTTP ${result.status}. The tunnel works, but the server behind it answered with an error.`);
    } else {
      console.log(`Check: HTTP ${result.status}. The URL answers.`);
    }
  }
  console.log(`Stop it with: tunnel.mjs stop ${id}`);
}

function list() {
  const tunnels = liveTunnels();
  if (tunnels.length === 0) {
    console.log('No tunnels are running.');
    return;
  }
  for (const t of tunnels) {
    const host = t.hostHeader ? ` (Host: ${t.hostHeader})` : '';
    const login = t.allowedMail ? `  email login: ${t.allowedMail}` : '';
    console.log(`${t.id}  ${t.url} -> ${t.origin}${host}  up ${age(t.startedAt)}${login}  pid ${t.pid}  from ${t.cwd}`);
  }
}

async function stop(args) {
  const which = args[0];
  if (!which) fail('Usage: tunnel.mjs stop <id | port | all>');
  const tunnels = liveTunnels();
  const chosen = which === 'all' ? tunnels : tunnels.filter((t) => t.id === which || String(t.port) === which);
  if (chosen.length === 0) {
    if (which === 'all') {
      console.log('No tunnels are running.');
      return;
    }
    fail(`No running tunnel matches "${which}". Run "tunnel.mjs list" to see them.`);
  }
  for (const t of chosen) {
    try {
      process.kill(t.pid, 'SIGTERM');
    } catch {}
    for (let i = 0; i < 20 && isRunning(t); i++) await sleep(250);
    if (isRunning(t)) {
      try {
        process.kill(t.pid, 'SIGKILL');
      } catch {}
    }
    forget(t);
    console.log(`Stopped tunnel ${t.id} (${t.url}).`);
  }
}

const USAGE = [
  'Usage:',
  '  tunnel.mjs start <port | url> [--host-header <host>] [--allowed-mail <emails>]',
  '  tunnel.mjs list',
  '  tunnel.mjs stop <id | port | all>',
].join('\n');

const [command, ...rest] = process.argv.slice(2);
if (command === 'start') await start(rest);
else if (command === 'list') list();
else if (command === 'stop') await stop(rest);
else fail(USAGE);
