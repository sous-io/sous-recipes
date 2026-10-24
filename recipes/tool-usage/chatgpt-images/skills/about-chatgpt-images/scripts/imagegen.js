#!/usr/bin/env node
// Command line for the image selection server and the image archive.
//
//   node imagegen.js serve      [--session DIR] [--archive DIR] [--port N] [--model M] [--size S]
//                               [--quality Q] [--count N] [--concurrency N] [--fresh]
//   node imagegen.js add        [--session DIR] (--prompt TEXT | --prompt-file FILE) [--count N]
//                               [--title T] [--request TEXT] [--purpose TEXT] [--project DIR]
//                               [--ref IMAGE]... (up to 4) [--variants-file FILE]
//                               [--mode single|spread] [--model M] [--size S] [--quality Q]
//                               [--edit-of LABEL_OR_FILE]
//   node imagegen.js watch      [--session DIR] [--after SEQ]
//   node imagegen.js state      [--session DIR]
//   node imagegen.js stop       [--session DIR]
//   node imagegen.js record-use --image FILE --where PATH_OR_URL [--how TEXT]
//   node imagegen.js note       --image FILE --text TEXT
//
// The API key is read from OPENAI_API_KEY, or else from the nearest
// .sous/.env.local or .sous/.env above the current directory, where sous keeps
// the recipe's answer. The archive defaults to generated-images in SOUS_HOME
// (~/.sous). The session directory, which holds the server's state and event
// log, defaults to IMAGEGEN_SESSION, then to one folder per working directory
// under the archive's .sessions folder, so every command run from the same
// project finds the same server.

import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve } from './lib/server.js';
import { recordPath, updateRecord } from './lib/record.js';

const REPEATABLE = new Set(['ref']);
const [command, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);
const archiveDir = path.resolve(args.archive || path.join(sousHome(), 'generated-images'));
const sessionDir = path.resolve(args.session || process.env.IMAGEGEN_SESSION || defaultSession());

const commands = {
  async serve() {
    const apiKey = findApiKey();
    if (!apiKey) fail('No OpenAI API key: set OPENAI_API_KEY, or answer the recipe variable with sous vars');
    const running = runningServer();
    if (running) fail(`A server for this session is already running at ${running.url}`);
    // --fresh starts an empty picker; the images already archived are kept.
    if (args.fresh) {
      for (const f of ['state.json', 'events.jsonl', 'server.json']) fs.rmSync(path.join(sessionDir, f), { force: true });
    }
    fs.mkdirSync(sessionDir, { recursive: true });
    const info = await serve({
      sessionDir,
      archiveDir,
      apiKey,
      host: args.host || '127.0.0.1',
      port: Number(args.port ?? 7766),
      concurrency: Number(args.concurrency ?? 4),
      defaults: {
        model: args.model || 'gpt-image-2',
        size: args.size || '1024x1024',
        quality: args.quality || 'auto',
        count: Number(args.count ?? 3),
      },
    });
    console.log(`Image selection UI: ${info.url}`);
    console.log(`Session: ${sessionDir}`);
    console.log(`Archive: ${info.archiveDir}`);
  },

  async add() {
    const prompt = args['prompt-file'] ? fs.readFileSync(args['prompt-file'], 'utf8') : args.prompt;
    if (!prompt) fail('add needs --prompt or --prompt-file');
    const references = (args.ref ?? []).map((r) => path.resolve(r));
    if (references.length > 4) fail('At most 4 reference images are allowed');
    const body = {
      prompt,
      title: args.title,
      request: args.request,
      purpose: args.purpose,
      project: args.project ? path.resolve(args.project) : process.cwd(),
      references,
      mode: args.mode,
      editOf: args['edit-of'],
      model: args.model,
      size: args.size,
      quality: args.quality,
    };
    if (args.count != null) body.count = Number(args.count);
    // A JSON array of { prompt, note }, one per image; it sets the count.
    if (args['variants-file']) body.variants = JSON.parse(fs.readFileSync(args['variants-file'], 'utf8'));
    console.log(JSON.stringify(await api('POST', '/api/sets', body)));
  },

  async state() {
    const state = await api('GET', '/api/state');
    for (const set of state.sets) {
      const imgs = set.images.map((i) => `${set.id}.${i.index}:${i.verdict || i.status}`).join(' ');
      console.log(`set ${set.id}${set.closed ? ' (closed)' : ''} "${set.title}" ${imgs}`);
    }
    console.log(`open sets: ${state.openSets.join(', ') || 'none'}; generating: ${state.generating}`);
  },

  async stop() {
    await api('POST', '/api/shutdown');
    console.log('stopped');
  },

  // Records where an archived image was used, in its markdown record.
  async 'record-use'() {
    if (!args.image || !args.where) fail('record-use needs --image and --where');
    const file = recordPath(path.resolve(args.image));
    updateRecord(file, (m) => {
      m.usedIn = m.usedIn || [];
      m.usedIn.push({ where: args.where, how: args.how || null, at: new Date().toISOString() });
    });
    console.log(file);
  },

  async note() {
    if (!args.image || !args.text) fail('note needs --image and --text');
    const file = recordPath(path.resolve(args.image));
    updateRecord(file, (m) => {
      m.notes = m.notes || [];
      m.notes.push({ text: args.text, at: new Date().toISOString() });
    });
    console.log(file);
  },

  // Prints every event after --after, then follows the file, one JSON line per
  // event, so a monitor can turn each line into a notification.
  async watch() {
    const file = path.join(sessionDir, 'events.jsonl');
    let after = Number(args.after ?? 0);
    let offset = 0;
    let partial = '';
    const read = () => {
      let size;
      try {
        size = fs.statSync(file).size;
      } catch {
        return;
      }
      if (size < offset) offset = 0;
      if (size === offset) return;
      const fd = fs.openSync(file, 'r');
      const buf = Buffer.alloc(size - offset);
      fs.readSync(fd, buf, 0, buf.length, offset);
      fs.closeSync(fd);
      offset = size;
      const lines = (partial + buf.toString('utf8')).split('\n');
      partial = lines.pop();
      for (const line of lines) {
        if (!line) continue;
        const ev = JSON.parse(line);
        if (ev.seq <= after) continue;
        after = ev.seq;
        process.stdout.write(line + '\n');
      }
    };
    read();
    setInterval(read, 250);
  },
};

if (!commands[command]) fail(`Unknown command "${command ?? ''}". Use ${Object.keys(commands).join(', ')}.`);
await commands[command]();

async function api(method, route, body) {
  let info;
  try {
    info = JSON.parse(fs.readFileSync(path.join(sessionDir, 'server.json'), 'utf8'));
  } catch {
    fail(`No server has started in ${sessionDir}`);
  }
  const res = await fetch(new URL(route, info.url), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => fail(`The server at ${info.url} is not answering`));
  const json = await res.json();
  if (!res.ok) fail(json.error || `HTTP ${res.status}`);
  return json;
}

function defaultSession() {
  const cwd = process.cwd();
  const slug = path.basename(cwd).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root';
  const hash = crypto.createHash('sha256').update(cwd).digest('hex').slice(0, 8);
  return path.join(archiveDir, '.sessions', `${slug}-${hash}`);
}

// The server recorded in server.json, if its process is still alive.
function runningServer() {
  try {
    const info = JSON.parse(fs.readFileSync(path.join(sessionDir, 'server.json'), 'utf8'));
    process.kill(info.pid, 0);
    return info;
  } catch {
    return null;
  }
}

function findApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
    for (const name of ['.env.local', '.env']) {
      const value = readEnvValue(path.join(dir, '.sous', name), 'OPENAI_API_KEY');
      if (value) return value;
    }
    if (path.dirname(dir) === dir) return null;
  }
}

// Reads one KEY=value line from a dotenv file, unquoting the value.
function readEnvValue(file, key) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  for (const line of text.split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m || m[1] !== key) continue;
    let value = m[2].trim();
    const q = value[0];
    if ((q === '"' || q === "'") && value.lastIndexOf(q) > 0) value = value.slice(1, value.lastIndexOf(q));
    else value = value.replace(/\s+#.*$/, '');
    if (q === '"') value = value.replace(/\\n/g, '\n').replace(/\\(["\\])/g, (_, c) => c);
    return value || null;
  }
  return null;
}

// Where sous keeps its per-user files: SOUS_HOME, or ~/.sous.
function sousHome() {
  const value = process.env.SOUS_HOME?.trim();
  if (!value) return path.join(os.homedir(), '.sous');
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return path.resolve(value);
}

function parseArgs(list) {
  const out = {};
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a.startsWith('--')) fail(`Unexpected argument ${a}`);
    const key = a.slice(2);
    const next = list[i + 1];
    const value = next === undefined || next.startsWith('--') ? true : list[++i];
    if (REPEATABLE.has(key)) (out[key] ??= []).push(value);
    else out[key] = value;
  }
  return out;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
