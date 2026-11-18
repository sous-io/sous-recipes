# Node.js

Load when the repository has a `package.json`.
This file covers the package manager, package scripts and their `pre*` and `post*` hooks, installs (including
one per git worktree), and a project CLI wrapper if one exists.

## What to Measure

| Item                                                             | Note                                       |
| ---------------------------------------------------------------- | ------------------------------------------ |
| Dependency install, cold (scratch copy of manifest and lockfile) | Report the store hit rate                  |
| Dependency install, warm (dependencies already match)            |                                            |
| Install in a fresh git worktree                                  | Where the package store lives matters      |
| Every script a developer or agent runs, cold and warm            | Read `scripts` and note pre and post hooks |
| Any project CLI wrapper's own startup                            | Run a no-op command through it             |

Inventory `pre*` and `post*` hooks. They run silently before or after the script they wrap, and on one service
they were where the hidden generate, clean and migrate steps lived.

## Known Slow Spots

**Install is often fine.** On one service, with a shared store, install took 7.6 s cold and 3 s warm. The CI store
cache showed hitting in the logs, 167 MB restored in 6 to 8 s. A cache that the logs show hitting needs no change.

**Install per git worktree.** Each worktree with its own package store downloaded about 700 MB on first install.
A shared store with hard links removes most of that. One project kept per-repository stores on purpose, because a
shared one once let another checkout's state leak in. Install time per worktree is a cost worth measuring, and
the reason a store sits where it does is worth recording next to the setting.

**Nothing scoped to one file.** Agents mid-task ran whole-repository checks when nothing smaller was documented.
Per-file scripts and the check command that runs them are described in
[../per-file-checks/overview.md](../per-file-checks/overview.md). The other scripts in the set measured on one
service were:

| Script         | Does                                                | Expected warm time         |
| -------------- | --------------------------------------------------- | -------------------------- |
| `typecheck`    | Whole project, incremental                          | 7 s idle, 9 to 13 s loaded |
| `test:changed` | Specs touched by the branch (idea)                  | depends on the diff        |
| `check`        | Lint, format, typecheck, changed tests, in parallel (idea) | about 20 s          |

`test:changed` and `check` are ideas that were estimated, not measured as a finished script. Agents follow listed
commands reliably when the project's instructions state each one's expected time.

**Package manager blocks install scripts by default.** pnpm 10 denies dependency post-install scripts unless they
are listed. On one first pass that silently skipped the ORM client generation, so a fresh clone failed on first
start. The packages that need their scripts go under the package manager's allow key.

**Test scripts across a workspace.** A root `test` script with `--workspace-concurrency=1` was used on one
monorepo because running six packages' suites at once made an existing vitest worker-IPC flake more likely.
See [../tests/vitest.md](../tests/vitest.md) and [../machine-load.md](../machine-load.md).

**The CLI wrapper recompiled itself on every call.** A project CLI ran through a TypeScript runner over 127
source files: 4.7 s per invocation, 30 to 100 times a day, while a compiled output from months earlier sat
unused. A compiled entry point and a rule for when to rebuild fixed it.

**Resolving paths from the caller's directory.** pnpm and npm set `INIT_CWD` to the directory where the user ran
the command, so a root script can resolve relative paths from there instead of from the package root.

**Secret resolution and client code generation were cheap.** On the same service they took 0.9 s and 6 s, the
latter roughly never run. Recording that a suspect step was measured and cheap keeps the next reader from
spending time there.

## Traps

**`pnpm <script> -- --flag`.** pnpm forwards the `--` literally, so Prettier reads it as a file name and fails.
The flag is passed without the separator.

**A half-installed dependency directory.** It can be present with no `.bin`, so the TypeScript runner is missing
and every command fails with `tsx: not found`. On one machine it looked like a problem with the cluster the
command talks to. A reinstall relinked it in 2 s. Checking the wrapper comes before blaming what it calls.

**A committed `node_modules` symlink.** One checkout carried `node_modules` as a committed symlink pointing at
another machine's home directory, so the CLI did not run at all on a fresh clone. This is worth fixing before
measuring anything.

**An unfinished allow-list placeholder in the workspace file.** It warns on every install.

**oclif's `ignoreManifest` option.** It is unreachable from the programmatic `run()`. The manifest is either
committed or generated at build time.

## Lessons From Implementation

1. The wrapper went from 3.22 s to 0.23 s on `--help`, and from 4.2 s to 2.1 s on a real command, where the rest
   is the tool it shells out to. Its own build went from 14 s to 6 s.
1. Three separate wins were all needed: a compiled entry point instead of the TypeScript runner, a lazy command
   registry so a passthrough command loads only its own module, and a committed command manifest. Without the
   manifest, oclif imports every command module on every start, which undoes most of the first two.
1. Staleness can be a small shell script: compare the source files against a build stamp with `find -newer` and
   rebuild when they are newer. The wrapper scripts themselves live in the repository and get installed to the
   user's local bin directory atomically, so a half-written wrapper is never on the path.
1. A schema extraction script that transpiled on every run moved under the source tree and now runs
   `nest build && node dist/scripts/extract-schema.js`: 8.2 s to 5.6 s, with the same command typed. Its compiled
   form requires a development dependency, which is fine because it only runs in a checkout with the full tree.
