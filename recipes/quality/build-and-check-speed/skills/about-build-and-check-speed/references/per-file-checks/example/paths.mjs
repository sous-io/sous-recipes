// Shared paths and file helpers for `pnpm check:file`.
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path of the monorepo root (this file lives in <root>/scripts/check-file/). */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Directory holding the server's socket, pid file, log and tool caches. */
export const CACHE_DIR = join(REPO_ROOT, "node_modules/.cache/check-file");

/** Unix socket the server listens on. */
export const SOCKET_PATH = join(CACHE_DIR, "server.sock");

/** Pid file that makes the server a single instance. */
export const PID_PATH = join(CACHE_DIR, "server.pid");

/** Server log file. */
export const LOG_PATH = join(CACHE_DIR, "server.log");

/** Directory of this tool's source files. */
export const TOOL_DIR = dirname(fileURLToPath(import.meta.url));

const SKIPPED_DIRS = new Set([
  ".git",
  ".sst",
  ".turbo",
  ".coverage",
  "cdk.out",
  "coverage",
  "dist",
  "node_modules",
]);

/**
 * Returns a version string for this tool's source: the newest mtime of its files. The CLI restarts a server whose
 * version differs, so an edited tool never runs stale code.
 */
export function getToolVersion() {
  const mtimes = readdirSync(TOOL_DIR)
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => statSync(join(TOOL_DIR, name)).mtimeMs);
  return String(Math.max(...mtimes));
}

/**
 * Walks up from `startDir` (inclusive) to the repo root and returns the first directory containing one of `names`,
 * as `{ dir, path }`, or `undefined`.
 */
export function findUp(startDir, names) {
  let dir = startDir;
  while (dir.startsWith(REPO_ROOT)) {
    for (const name of names) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) {
        return { dir, path: candidate };
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return undefined;
}

/**
 * Lists every file under `dir` for which `accept(path)` is true, skipping build output and dependency directories.
 */
export function walkFiles(dir, accept) {
  const found = [];
  const pending = [dir];
  while (pending.length) {
    const current = pending.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) {
          pending.push(path);
        }
      } else if (accept(path)) {
        found.push(path);
      }
    }
  }
  return found;
}

/**
 * Returns the newest mtime (ms) of the files under `dir` that `accept` admits, or 0 when there are none.
 */
export function newestMtime(dir, accept = () => true) {
  let newest = 0;
  for (const path of walkFiles(dir, accept)) {
    newest = Math.max(newest, statSync(path).mtimeMs);
  }
  return newest;
}

/** Formats an absolute path relative to the repo root for output. */
export function displayPath(path) {
  return relative(REPO_ROOT, path) || ".";
}
