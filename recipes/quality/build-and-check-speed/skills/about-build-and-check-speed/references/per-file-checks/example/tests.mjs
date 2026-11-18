// Tests: one warm Vitest instance per Vitest project, so the Vite transform cache survives between requests.
//
// Uses Vitest 2.1 Node API calls (createVitest, project.createSpec, project.isTargetFile, vitest.runFiles,
// vitest.invalidates, project.server.moduleGraph.fileToModulesMap). Later major versions renamed some of them;
// read the installed version's `vitest/node` exports before copying.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { REPO_ROOT, displayPath, findUp, walkFiles } from "./paths.mjs";

const SPEC_PATTERN = /\.(spec|test)\.[cm]?[jt]sx?$/;
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs"];
const VITEST_CONFIGS = [
  "vitest.config.ts",
  "vitest.config.mts",
  "vitest.config.js",
  "vitest.config.mjs",
];
const MAX_MESSAGE_LINES = 12;
const STACK_LOCATION = /((?:file:\/\/)?\/[^():\s]+):(\d+):(\d+)/;

/** project dir -> { vitest, reporter, lastRunAt } (as a promise while starting) */
const instances = new Map();

/** Collects results of one run into compact lines. */
class CompactReporter {
  constructor() {
    this.reset();
  }

  /** Clears the previous run's results. */
  reset() {
    this.files = [];
    this.errors = [];
  }

  /** Vitest hook: called once per run with every test file's results. */
  onFinished(files = [], errors = []) {
    this.files = files;
    this.errors = errors;
  }

  /** Vitest hook: swallow console output from tests. */
  onUserConsoleLog() {}
}

function stripSourceExtension(path) {
  const extension = extname(path);
  return SOURCE_EXTENSIONS.includes(extension) ? path.slice(0, -extension.length) : path;
}

/**
 * Returns the spec files that cover `file`: the file itself if it is a spec; else a sibling
 * `<name>.spec|test.<ext>`; else specs in the same Vitest project whose imports name the file.
 */
function findSpecs(file, projectDir) {
  if (SPEC_PATTERN.test(file)) {
    return [file];
  }
  const stem = stripSourceExtension(file);
  for (const kind of ["spec", "test"]) {
    for (const extension of SOURCE_EXTENSIONS) {
      const sibling = `${stem}.${kind}${extension}`;
      if (existsSync(sibling)) {
        return [sibling];
      }
    }
  }
  const isIndex = basename(stem) === "index";
  const name = isIndex ? basename(dirname(stem)) : basename(stem);
  const importPattern = new RegExp(
    `from\\s+["']([^"']*/${name}(?:/index)?(?:\\.[cm]?[jt]sx?)?)["']|import\\(\\s*["']([^"']*/${name}(?:/index)?(?:\\.[cm]?[jt]sx?)?)["']`,
    "g",
  );
  const target = isIndex ? dirname(stem) : stem;
  const specs = walkFiles(projectDir, (path) => SPEC_PATTERN.test(path));
  return specs.filter((spec) => {
    const source = readFileSync(spec, "utf8");
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1] ?? match[2];
      if (!specifier.startsWith(".")) {
        return true;
      }
      const resolved = stripSourceExtension(resolve(dirname(spec), specifier)).replace(
        /\/index$/,
        "",
      );
      if (resolved === target || resolved === stem) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Runs `action` with the process working directory set to `projectDir`, as `vitest run` from that directory has it.
 * Test forks inherit the directory when they spawn, so a test reading `process.cwd()` sees the project directory.
 * Requests are served one at a time, so changing the process-wide directory does not race another request.
 */
async function inProjectDir(projectDir, action) {
  const previousDir = process.cwd();
  process.chdir(projectDir);
  try {
    return await action();
  } finally {
    process.chdir(previousDir);
  }
}

async function startInstance(projectDir, configPath) {
  const require = createRequire(join(projectDir, "package.json"));
  const { createVitest } = await import(pathToFileURL(require.resolve("vitest/node")).href);
  // `vitest run` sets these before creating Vitest; createVitest does not. Without them Vite sets NODE_ENV to
  // "development", and the test forks inherit it.
  process.env.TEST = "true";
  process.env.VITEST = "true";
  process.env.NODE_ENV ??= "test";
  const reporter = new CompactReporter();
  const vitest = await inProjectDir(projectDir, () =>
    createVitest(
      "test",
      {
        root: projectDir,
        config: configPath,
        run: true,
        watch: false,
        maxWorkers: 1,
        minWorkers: 1,
        reporters: [reporter],
        coverage: { enabled: false },
      },
      { logLevel: "error", clearScreen: false },
    ),
  );
  return { vitest, reporter, lastRunAt: Date.now() };
}

function getInstance(projectDir, configPath) {
  let instance = instances.get(projectDir);
  if (!instance) {
    instance = startInstance(projectDir, configPath);
    instances.set(projectDir, instance);
    instance.catch(() => instances.delete(projectDir));
  }
  return instance;
}

/**
 * Marks every module a project has loaded whose file changed since the last run as stale, so Vite re-transforms
 * it. The server has no file watcher, so this stat pass replaces one.
 */
function invalidateChangedModules(instance) {
  const since = instance.lastRunAt;
  let count = 0;
  for (const project of instance.vitest.projects) {
    const graph = project.server.moduleGraph;
    for (const [path, modules] of graph.fileToModulesMap) {
      let mtime;
      try {
        mtime = statSync(path).mtimeMs;
      } catch {
        mtime = Infinity;
      }
      if (mtime >= since) {
        modules.forEach((module) => graph.invalidateModule(module));
        instance.vitest.invalidates.add(path);
        count += 1;
      }
    }
  }
  return count;
}

function collectFailures(task, lines, trail = []) {
  const path = task.type === "file" ? [] : [...trail, task.name];
  for (const error of task.result?.errors ?? []) {
    const title = path.length
      ? path.join(" > ")
      : `${displayPath(task.filepath ?? "")} (file-level error)`;
    lines.push(`FAIL ${title}`);
    const message = String(error.message ?? error)
      .split("\n")
      .slice(0, MAX_MESSAGE_LINES);
    lines.push(...message.map((line) => `      ${line}`));
    const frame = String(error.stack ?? "")
      .split("\n")
      .map((line) => STACK_LOCATION.exec(line))
      .find((match) => match && !match[1].includes("/node_modules/"));
    if (frame) {
      lines.push(
        `      at ${displayPath(frame[1].replace(/^file:\/\//, ""))}:${frame[2]}:${frame[3]}`,
      );
    }
    if (error.diff) {
      lines.push(
        ...error.diff
          .split("\n")
          .slice(0, MAX_MESSAGE_LINES)
          .map((line) => `      ${line}`),
      );
    }
  }
  for (const child of task.tasks ?? []) {
    collectFailures(child, lines, path);
  }
}

function countTests(task, counts) {
  if (task.type === "test" || task.type === "custom") {
    const state = task.result?.state ?? task.mode;
    if (state === "pass") {
      counts.passed += 1;
    } else if (state === "fail") {
      counts.failed += 1;
    } else {
      counts.skipped += 1;
    }
  }
  for (const child of task.tasks ?? []) {
    countTests(child, counts);
  }
}

/**
 * Runs the specs that cover one file. Returns `{ status: "pass" | "fail" | "skip", lines: string[] }`.
 */
export async function testFile(file) {
  const project = findUp(dirname(file), VITEST_CONFIGS);
  const isWorkspaceRoot = !project || project.dir === REPO_ROOT;
  if (isWorkspaceRoot) {
    return {
      status: "skip",
      lines: ["not inside a Vitest project (no vitest.config.* below the repo root)"],
    };
  }
  const specs = findSpecs(file, project.dir);
  if (!specs.length) {
    return { status: "skip", lines: [`no spec covers this file in ${displayPath(project.dir)}`] };
  }
  const instance = await getInstance(project.dir, project.path);
  const { vitest, reporter } = instance;
  const specifications = [];
  for (const spec of specs) {
    for (const workspaceProject of vitest.projects) {
      if (await workspaceProject.isTargetFile(spec)) {
        specifications.push(workspaceProject.createSpec(spec, workspaceProject.config.pool));
      }
    }
  }
  if (!specifications.length) {
    return {
      status: "skip",
      lines: [`specs not matched by the project's include patterns: ${specs.map(displayPath)}`],
    };
  }
  const runStartedAt = Date.now();
  invalidateChangedModules(instance);
  reporter.reset();
  await inProjectDir(project.dir, () => vitest.runFiles(specifications, false));
  instance.lastRunAt = runStartedAt;

  const counts = { passed: 0, failed: 0, skipped: 0 };
  const lines = [`project: ${displayPath(project.dir)}`];
  const failureLines = [];
  let importSeconds = 0;
  let testSeconds = 0;
  for (const result of reporter.files) {
    importSeconds += (result.collectDuration ?? 0) / 1000;
    testSeconds += (result.result?.duration ?? 0) / 1000;
    countTests(result, counts);
    collectFailures(result, failureLines);
  }
  for (const error of reporter.errors) {
    failureLines.push(`unhandled error: ${String(error?.message ?? error).split("\n")[0]}`);
  }
  const isFailed = failureLines.length > 0 || counts.failed > 0;
  lines.push(
    `${specs.map((spec) => displayPath(spec)).join(", ")}: ${counts.passed} passed, ${counts.failed} failed, ${counts.skipped} skipped ` +
      `(import ${importSeconds.toFixed(1)}s, tests ${testSeconds.toFixed(1)}s)`,
    ...failureLines,
  );
  return { status: isFailed ? "fail" : "pass", lines };
}

/** Lists the Vitest projects with a warm instance. */
export function testProjects() {
  return [...instances.keys()].map(displayPath);
}

/** Closes every Vitest instance. */
export async function closeTests() {
  for (const instance of instances.values()) {
    try {
      const { vitest } = await instance;
      await vitest.close();
    } catch {
      // A failed start has nothing to close.
    }
  }
}
