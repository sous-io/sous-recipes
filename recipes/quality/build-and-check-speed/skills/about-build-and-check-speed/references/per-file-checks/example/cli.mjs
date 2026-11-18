#!/usr/bin/env node
// `pnpm check:file <file>...`: lint, typecheck and test the given files through a warm background server.
//
// A worked example for one stack (Node 22, ESLint 9, Prettier 3, TypeScript 5.8, Vitest 2.1, pnpm monorepo).
// Adapt it to the project; see ../warm-server.md.
import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { connect } from "node:net";
import { join, resolve } from "node:path";

import { CACHE_DIR, LOG_PATH, SOCKET_PATH, TOOL_DIR, getToolVersion } from "./paths.mjs";

const START_TIMEOUT_MS = 60_000;
const RESPAWN_INTERVAL_MS = 3_000;
const USAGE = `Usage: pnpm check:file [options] <file>...
       pnpm lint:file | typecheck:file | test:file [options] <file>...

Runs, for each file in any package of the monorepo:
  lint       ESLint with the root eslint.config.js; prettier for files ESLint ignores and for json/md/css/yaml
  typecheck  TypeScript, against the nearest tsconfig.json, for the file (and a spec's subject file)
  test       the Vitest specs that cover the file (itself, a sibling spec, or specs importing it), in its project
A background server keeps the tools warm; it exits after 15 idle minutes.

Options:
  --fix                 write ESLint and prettier fixes
  --only=<check>        run one check: lint, typecheck or test (what lint:file, typecheck:file, test:file do)
  --no-<check>          skip a check: --no-lint, --no-typecheck, --no-test
  --status              show the server's state
  --stop                stop the server (it restarts on the next check)
  -h, --help            show this help

Log: ${LOG_PATH}
`;

const CHECKS = ["lint", "typecheck", "tests"];

function checkName(name) {
  const normalized = name === "test" ? "tests" : name;
  if (!CHECKS.includes(normalized)) {
    throw new Error(`unknown check "${name}"; expected one of: lint, typecheck, test\n\n${USAGE}`);
  }
  return normalized;
}

function parseArgs(argv) {
  const options = { files: [], fix: false, skip: [], cmd: "check" };
  let only;
  for (const arg of argv) {
    if (arg === "--") {
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      options.cmd = "help";
    } else if (arg === "--status" || arg === "--stop") {
      options.cmd = arg.slice(2);
    } else if (arg === "--fix") {
      options.fix = true;
    } else if (arg.startsWith("--only=")) {
      only = checkName(arg.slice("--only=".length));
    } else if (arg.startsWith("--no-")) {
      options.skip.push(checkName(arg.slice("--no-".length)));
    } else if (arg.startsWith("-")) {
      throw new Error(`unknown option ${arg}\n\n${USAGE}`);
    } else {
      options.files.push(resolve(process.env.INIT_CWD ?? process.cwd(), arg));
    }
  }
  if (only) {
    options.skip = CHECKS.filter((name) => name !== only);
  }
  return options;
}

/** Sends one request and calls `onMessage` for each reply line. Rejects when the socket cannot connect. */
function request(payload, onMessage) {
  return new Promise((resolvePromise, reject) => {
    const socket = connect(SOCKET_PATH);
    let buffer = "";
    let isConnected = false;
    let isDone = false;
    socket.setEncoding("utf8");
    socket.on("connect", () => {
      isConnected = true;
      socket.write(`${JSON.stringify(payload)}\n`);
    });
    socket.on("data", (chunk) => {
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const message = JSON.parse(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        if (message.type !== "text") {
          isDone = true;
        }
        onMessage(message);
        newline = buffer.indexOf("\n");
      }
    });
    socket.on("error", (error) => {
      if (!isConnected) {
        reject(error);
      }
    });
    socket.on("close", () => {
      if (isConnected && !isDone) {
        reject(new Error(`check:file server closed the connection mid-request; see ${LOG_PATH}`));
        return;
      }
      resolvePromise();
    });
  });
}

async function hello() {
  let reply;
  await request({ cmd: "hello" }, (message) => {
    reply = message;
  });
  return reply;
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function spawnServer() {
  mkdirSync(CACHE_DIR, { recursive: true });
  const logFd = openSync(LOG_PATH, "a");
  const child = spawn(process.execPath, [join(TOOL_DIR, "server.mjs")], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();
}

/** Connects to a server running the current tool version, starting one when needed. */
async function ensureServer() {
  const version = getToolVersion();
  try {
    const reply = await hello();
    if (reply?.version === version) {
      return;
    }
    process.stderr.write("check:file: tool source changed; restarting the server\n");
    await request({ cmd: "stop" }, () => undefined);
    await sleep(300);
  } catch {
    // No server yet.
  }
  process.stderr.write("check:file: starting the background server (first run loads the tools)\n");
  spawnServer();
  let lastSpawnAt = Date.now();
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(150);
    // A server that is still shutting down makes the new one exit at once; spawn again until one listens.
    if (Date.now() - lastSpawnAt > RESPAWN_INTERVAL_MS) {
      spawnServer();
      lastSpawnAt = Date.now();
    }
    try {
      await hello();
      return;
    } catch {
      // Not listening yet.
    }
  }
  throw new Error(
    `check:file server did not start within ${START_TIMEOUT_MS / 1000}s; see ${LOG_PATH}`,
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.cmd === "help") {
    process.stdout.write(USAGE);
    return 0;
  }
  if (options.cmd === "check" && !options.files.length) {
    process.stderr.write(USAGE);
    return 2;
  }
  if (options.cmd === "stop" || options.cmd === "status") {
    try {
      await hello();
    } catch {
      process.stdout.write("check:file server is not running\n");
      return 0;
    }
  } else {
    await ensureServer();
  }
  let isOk = false;
  await request(options, (message) => {
    if (message.type === "text") {
      process.stdout.write(message.text);
    } else if (message.type === "done") {
      isOk = message.ok;
    }
  });
  return isOk ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    process.stderr.write(`check:file: ${error?.message ?? error}\n`);
    process.exit(2);
  },
);
