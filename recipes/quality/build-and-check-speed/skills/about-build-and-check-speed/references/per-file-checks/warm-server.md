# A Warm-Server Per-File Check Command

This file describes one working implementation of the per-file check command (see [overview.md](overview.md)): a
background server that keeps ESLint, Prettier, TypeScript and Vitest loaded, built for a pnpm monorepo. Its complete
source is in [example/](example/), about 1,200 lines of dependency-free Node ES modules that import only `eslint`,
`prettier`, `typescript` and `vitest`.

It is a worked example for one stack, not a drop-in tool. Versions it was written against: Node 22, ESLint 9,
Prettier 3, TypeScript 5.8, Vitest 2.1. Copying it means adapting it: the paths in `paths.mjs`, the skipped
directories, the file extensions, the test runner, and the Vitest calls (see "Version Notes" below).

## Why a Background Server

Each of the three tools is slow to start and fast once loaded. A cold `tsc` parses the whole program, a cold Vitest
starts Vite and transforms the import graph, and a cold ESLint loads its config and plugins. The server pays that once
and keeps the parsed programs, the transform cache and the lint cache in memory, so the second and later checks cost
only what changed.

## Architecture

```text
pnpm check:file a.ts b.ts
        |
        v
  cli.mjs  (thin client: parse args, make sure a server is running, send one JSON request, print replies)
        |   unix socket: node_modules/.cache/check-file/server.sock   (newline-delimited JSON)
        v
  server.mjs  (long-lived: one request at a time; exits after 15 idle minutes)
        |-- lint.mjs       one ESLint instance plus Prettier, loaded once
        |-- typecheck.mjs  one TypeScript LanguageService per tsconfig.json, kept in memory
        `-- tests.mjs      one Vitest instance per Vitest project, kept in memory
  paths.mjs  (shared: repository root, cache directory, find-up, file walk, tool version)
```

| File | Lines | Job |
| --- | --- | --- |
| [cli.mjs](example/cli.mjs) | about 210 | Argument parsing, server start, request, exit code |
| [server.mjs](example/server.mjs) | about 225 | Socket server, single-instance lock, request queue, idle exit, timing |
| [lint.mjs](example/lint.mjs) | about 120 | ESLint and Prettier for one file |
| [typecheck.mjs](example/typecheck.mjs) | about 240 | Per-tsconfig language services, diagnostics, stale-build warnings |
| [tests.mjs](example/tests.mjs) | about 300 | Spec discovery, warm Vitest instances, compact failure output |
| [paths.mjs](example/paths.mjs) | about 110 | Paths and file helpers |

The `package.json` scripts:

```json
{
  "check:file": "node scripts/check-file/cli.mjs",
  "lint:file": "node scripts/check-file/cli.mjs --only=lint",
  "typecheck:file": "node scripts/check-file/cli.mjs --only=typecheck",
  "test:file": "node scripts/check-file/cli.mjs --only=test"
}
```

## The Client

- Parses arguments; an unknown option or check name is an error that prints the usage text.
- Resolves each file against `process.env.INIT_CWD ?? process.cwd()`.
- Sends `{cmd: "hello"}`. A server that answers with the current tool version is used. One that answers with another
  version is sent `stop`, and a new one is started 300 ms later. No answer starts one.
- Starts the server detached, with its output appended to a log file, and `unref`s it so the client can exit.
- Waits up to 60 seconds for the server to listen, polling every 150 ms. A server that is still shutting down makes a
  new one exit at once (it sees the pid file), so the client spawns again every 3 seconds until one listens.
- Says what is happening on stderr: "starting the background server (first run loads the tools)", "tool source
  changed; restarting the server".
- `--status` and `--stop` never start a server; with none running they print "check:file server is not running".
- Protocol: one JSON object per line. The server streams `{type: "text", text}` lines, printed as they arrive, and
  ends with `{type: "done", ok}`. A connection that closes before `done` is an error that names the log file.

## The Server

- **One instance.** A pid file created with the exclusive flag (`openSync(path, "wx")`). If it exists and its pid is
  alive (`process.kill(pid, 0)`), the new server exits quietly; if the pid is dead, the stale file is removed and
  taken. On shutdown the server removes the pid file and the socket only if the pid file is its own.
- **One request at a time.** Requests chain on a promise queue, for three reasons: the tools share process state (see
  the working directory below), several agents calling at once are served in turn instead of multiplying CPU load,
  and results stream in a stable order.
- **Idle exit.** A 15-minute timer, cleared when a request starts and restarted when it ends. A session that ends
  leaves nothing running for long.
- **Restart on change.** The tool version is the newest modification time among the tool's own `.mjs` files. The
  client compares it on every call, so editing the tool never runs stale code.
- **Timing per check.** Wall seconds and CPU seconds. CPU comes from `/proc/self/stat` (the fields for the process
  and its finished children, so test workers count), with `process.cpuUsage()` as the fallback off Linux.
- **A crashing check is a failed check**, reported with the first 8 lines of the stack; it does not take the server
  down. Unhandled rejections are logged.
- **Everything lives in `node_modules/.cache/check-file/`**: socket, pid file, log, ESLint cache. That directory is
  already gitignored, is removed with `node_modules`, and is separate in each git worktree, so each worktree has its
  own server.
- **`process.title = "check-file-server"`**, so the process can be found and stopped by exact name
  (`pkill -x check-file-server`).
- Stops cleanly on `SIGTERM` and `SIGINT`, closing the Vitest instances first.

## Lint

- One `ESLint` instance for the whole server, created on first use, with `cache: true`, a cache location under the
  cache directory, and `cacheStrategy: "content"`.
- `fix` is passed as a function that reads the current request's `--fix` flag, so one instance serves both modes.
- A file ESLint ignores (`eslint.isPathIgnored`) falls through to Prettier, with a note saying why. In the source
  project the root config ignored specs, tests and stories, so those got formatting only.
- Prettier respects `.prettierignore` and the resolved config (`editorconfig: true`). Without `--fix` an unformatted
  file fails with "not prettier-formatted (rerun with --fix to format)"; with `--fix` it is written and reported as
  formatted.
- Errors fail the check; warnings are shown (the first 10) and do not.

## Typecheck

This part is what makes a one-file typecheck both fast and correct.

- **One TypeScript `LanguageService` per `tsconfig.json`**, kept in a map, all sharing one `DocumentRegistry`, so a
  file parsed for one project is reused by another.
- **Choosing the tsconfig**: the nearest `tsconfig.json` above the file. If it does not include the file, the first of
  its project `references` that does. Otherwise the nearest.
- **Compiler options**: the project's own, with `noEmit: true`, and with `composite`, `incremental` and
  `tsBuildInfoFile` removed (they make no sense for an in-memory check and can produce errors).
- **Tiny root file list**: only the config's ambient `.d.ts` files plus the files checked so far. The program then
  holds just their import graph, not the whole package, which keeps the first check of a package fast. A normal `tsc`
  run loads every file the config includes. This is the key design choice.
- **Change detection without a file watcher**: `getScriptVersion` returns the file's modification time, read at most
  once per request. TypeScript re-parses only files whose version changed.
- **A changed tsconfig rebuilds its project** (the config file's own modification time is compared).
- **What is reported**: syntactic and semantic diagnostics for the file and, for a spec, its subject file. Each is
  `path:line:column TSnnnn: message` plus up to three continuation lines.
- **Stale-build warnings.** For each `workspace:` dependency of the file's package that the program actually reads
  through that dependency's `dist/`, the newest modification time under its `src/` (TypeScript sources, specs
  excluded) is compared with the newest under its `dist/`. If the source is newer:

  ```text
  warning: @acme/core src is newer than its dist, so this check sees the old build. Run: pnpm --filter @acme/core build
  ```

  And when the checked file belongs to a package whose `exports` or `main` point into `dist/`:

  ```text
  note: other packages see changes to @acme/core only after: pnpm --filter @acme/core build
  ```

  This turns a confusing failure (a type that "does not exist" because the build is old) into an instruction.

## Tests

- **Finding the test project**: the nearest directory above the file holding a `vitest.config.{ts,mts,js,mjs}`. A
  config at the repository root does not count; a file with no project config below the root is skipped with a
  reason.
- **Finding the specs**: the file itself when it is a spec; else a sibling spec with the same stem; else every spec in
  the project with an `import ... from` or `import()` whose specifier ends in the file's name (or its directory's
  name, for an `index` file). Relative specifiers are resolved and must point at the file; aliases match on the name
  alone. None found: `skip`, "no spec covers this file in <project>".
- **One warm Vitest instance per project**, created through Vitest's Node API with `run: true`, `watch: false`, one
  worker, coverage off and a custom reporter.
- **Invalidation without a file watcher**: before each run, the instance's Vite module graph is walked and every module
  whose file changed since the last run is marked stale, so Vite transforms it again. Everything else stays cached.
- **A custom reporter** collects results and discards test console output; the tool prints pass, fail and skip
  counts, import and test seconds, and the compact failure block.

Four gotchas, each found the hard way and fixed in the source:

1. **Environment variables.** `vitest run` sets `TEST=true`, `VITEST=true` and `NODE_ENV=test` before creating
   Vitest; the Node API does not. Without them Vite sets `NODE_ENV` to `development` and the test workers inherit
   it, so tests behave differently from a normal run. The tool sets all three itself.
2. **Working directory.** Tests that read `process.cwd()` expect the project directory, as under `vitest run` from
   that directory. The tool changes directory to the project around instance creation and each run, and back
   afterwards. That is safe only because the server handles one request at a time.
3. **One instance per project, with that project's own config** (`config: configPath`, `root: projectDir`). A single
   shared instance for the monorepo did not behave like the per-package runs.
4. **Normal process priority.** The first version ran the server at `nice 19`. Test workers inherit the priority, and
   at `nice 19` on a busy machine, time-bound tests (Testing Library's 1-second `waitFor`, for example) failed where
   `vitest run` passed. The priority was removed.

## What It Does Not Do

- **Config changes other than tsconfig are not detected.** The ESLint instance and each Vitest instance are created
  once. After changing the ESLint config, a Vitest config, or the installed dependencies, run `check:file --stop`.
  (Assumption: neither tool reloads its config inside a live instance; not tested.)
- **Spec discovery is a text match** on import specifiers. It does not follow re-exports or transitive imports, and an
  alias import ending in the same file name can match a different file.
- **Linux and macOS only**: a unix socket and `/proc` for CPU time. Windows needs a named pipe.
- **One server per worktree.** Ten worktrees in use means ten servers, each holding parsed programs in memory until its
  idle exit. `--status` prints each server's memory.
- **Only Vitest, ESLint, Prettier and TypeScript.** Browser and end-to-end tests are not handled.

## Version Notes

The Vitest calls (`createVitest`, `project.createSpec`, `project.isTargetFile`, `vitest.runFiles`,
`vitest.invalidates`, `project.server.moduleGraph.fileToModulesMap`) are Vitest 2.1 internals and semi-public API.
Later major versions renamed some of them. Read the installed version's `vitest/node` exports before copying
`tests.mjs`. A Jest project needs a different `tests.mjs` altogether. (Untested idea: Jest's programmatic `runCLI`
with `findRelatedTests` looks like the closest equivalent; whether it keeps anything warm between calls has to be
measured before it is worth a server.)
