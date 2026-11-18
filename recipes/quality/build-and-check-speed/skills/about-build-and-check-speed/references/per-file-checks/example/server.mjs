// Background server for `pnpm check:file`: keeps ESLint, TypeScript and Vitest warm between requests.
// Started by cli.mjs; listens on a unix socket; one request at a time; exits after 15 idle minutes.
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { createServer } from "node:net";
import { performance } from "node:perf_hooks";

import { lintFile } from "./lint.mjs";
import { CACHE_DIR, PID_PATH, SOCKET_PATH, displayPath, getToolVersion } from "./paths.mjs";
import { closeTests, testFile, testProjects } from "./tests.mjs";
import { typecheckFile, typecheckProjects } from "./typecheck.mjs";

const IDLE_EXIT_MS = 15 * 60 * 1000;
const CLOCK_TICKS_PER_SECOND = 100;
const TOOL_VERSION = getToolVersion();
const STARTED_AT = Date.now();

let idleTimer;
let socketServer;
let queue = Promise.resolve();

function log(message) {
  process.stdout.write(`${new Date().toISOString()} ${message}\n`);
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Takes the pid file, or returns false when another live server holds it. */
function acquireLock() {
  mkdirSync(CACHE_DIR, { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = openSync(PID_PATH, "wx");
      writeSync(fd, String(process.pid));
      closeSync(fd);
      return true;
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
      const pid = Number(readFileSync(PID_PATH, "utf8"));
      if (pid && isAlive(pid)) {
        return false;
      }
      unlinkSync(PID_PATH);
    }
  }
  return false;
}

function releaseLock() {
  try {
    const isOurs = Number(readFileSync(PID_PATH, "utf8")) === process.pid;
    if (isOurs) {
      unlinkSync(PID_PATH);
      if (existsSync(SOCKET_PATH)) {
        unlinkSync(SOCKET_PATH);
      }
    }
  } catch {
    // Already gone.
  }
}

async function shutdown(reason) {
  log(`shutting down: ${reason}`);
  socketServer?.close();
  await closeTests();
  releaseLock();
  process.exit(0);
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => shutdown("idle for 15 minutes"), IDLE_EXIT_MS);
}

/** CPU seconds used by this process and its finished children (Vitest workers), from /proc. */
function cpuSeconds() {
  try {
    const fields = readFileSync("/proc/self/stat", "utf8").split(") ")[1].split(" ");
    const ticks = [11, 12, 13, 14].reduce((sum, index) => sum + Number(fields[index]), 0);
    return ticks / CLOCK_TICKS_PER_SECOND;
  } catch {
    const usage = process.cpuUsage();
    return (usage.user + usage.system) / 1e6;
  }
}

async function runCheck(name, check, send) {
  const wallStart = performance.now();
  const cpuStart = cpuSeconds();
  let result;
  try {
    result = await check();
  } catch (error) {
    result = {
      status: "fail",
      lines: [`${name} crashed: ${error?.stack ?? error}`.split("\n").slice(0, 8).join("\n")],
    };
  }
  const wall = ((performance.now() - wallStart) / 1000).toFixed(1);
  const cpu = (cpuSeconds() - cpuStart).toFixed(1);
  const label = result.status === "fail" ? "FAIL" : result.status;
  send(`  ${name.padEnd(10)}${label.padEnd(6)}${wall}s (cpu ${cpu}s)\n`);
  for (const line of result.lines) {
    send(`    ${line}\n`);
  }
  return result.status !== "fail";
}

async function handleCheck(request, send) {
  let isOk = true;
  for (const file of request.files) {
    send(`${displayPath(file)}\n`);
    if (!existsSync(file)) {
      send("  FAIL  file not found\n");
      isOk = false;
      continue;
    }
    const checks = [
      ["lint", () => lintFile(file, { fix: request.fix })],
      ["typecheck", () => typecheckFile(file)],
      ["tests", () => testFile(file)],
    ].filter(([name]) => !request.skip.includes(name));
    for (const [name, check] of checks) {
      isOk = (await runCheck(name, check, send)) && isOk;
    }
  }
  process.exitCode = 0;
  return isOk;
}

function statusText() {
  const uptime = Math.round((Date.now() - STARTED_AT) / 1000);
  const memory = Math.round(process.memoryUsage().rss / 1024 / 1024);
  return [
    `check:file server pid ${process.pid}, up ${uptime}s, rss ${memory} MB`,
    `  typecheck: ${typecheckProjects().join(", ") || "(none warm)"}`,
    `  tests:     ${testProjects().join(", ") || "(none warm)"}`,
    "",
  ].join("\n");
}

function handleConnection(socket) {
  let buffer = "";
  socket.setEncoding("utf8");
  socket.on("error", () => undefined);
  socket.on("data", (chunk) => {
    buffer += chunk;
    const newline = buffer.indexOf("\n");
    if (newline === -1) {
      return;
    }
    const request = JSON.parse(buffer.slice(0, newline));
    buffer = "";
    const send = (text) => socket.write(`${JSON.stringify({ type: "text", text })}\n`);
    const finish = (isOk) => socket.end(`${JSON.stringify({ type: "done", ok: isOk })}\n`);
    if (request.cmd === "hello") {
      socket.end(`${JSON.stringify({ type: "hello", version: TOOL_VERSION, pid: process.pid })}\n`);
      return;
    }
    if (request.cmd === "status") {
      send(statusText());
      finish(true);
      return;
    }
    if (request.cmd === "stop") {
      queue = queue.then(() => {
        send(`stopped check:file server pid ${process.pid}\n`);
        finish(true);
        socket.on("close", () => shutdown("stop requested"));
      });
      return;
    }
    queue = queue.then(async () => {
      clearTimeout(idleTimer);
      log(`check ${request.files.map(displayPath).join(" ")}`);
      try {
        finish(await handleCheck(request, send));
      } catch (error) {
        send(`check:file server error: ${error?.stack ?? error}\n`);
        finish(false);
      }
      resetIdleTimer();
    });
  });
}

function main() {
  if (!acquireLock()) {
    log("another check:file server holds the pid file; exiting");
    process.exit(0);
  }
  // No lowered priority (nice): test forks inherit it, and at nice 19 on a busy machine time-bound tests (for example
  // Testing Library's 1-second `waitFor`) fail where `vitest run` passes.
  process.title = "check-file-srv";
  if (existsSync(SOCKET_PATH)) {
    unlinkSync(SOCKET_PATH);
  }
  socketServer = createServer(handleConnection);
  socketServer.listen(SOCKET_PATH, () => {
    log(`listening on ${SOCKET_PATH} (pid ${process.pid})`);
  });
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (error) => log(`unhandled rejection: ${error?.stack ?? error}`));
  resetIdleTimer();
}

main();
