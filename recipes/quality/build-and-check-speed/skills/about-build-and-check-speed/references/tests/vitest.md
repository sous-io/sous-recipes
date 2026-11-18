# Vitest

Load when the repository has a `vitest.config.*` file or `vitest` in its dependencies. Covers worker start-up,
monorepo concurrency, per-file runs, and Vite's config loader in long-lived processes.

## What to Measure

| Command | Note |
| --- | --- |
| The suite, cold and warm | Cold means an empty Vite cache; CI is cold unless the cache is restored |
| The suite with the CI settings (coverage, reporters) | |
| Per-file times | `--reporter=json --outputFile=<path>`; report the slowest ten |
| `vitest related --run <file>` for a typical file | The cold per-file cost |
| The whole monorepo's test script | Note its workspace concurrency |

Inventory: `pool` and its options, `maxWorkers` and `minWorkers`, `testTimeout`, setup files, `globalSetup`,
coverage settings, reporters, and in a monorepo whether there is one config per package or a workspace file.

## Known Slow Spots

**Every worker started up front.** The `forks` pool starts one fork per CPU (minus one) before any test is queued. On a
machine where several agents run tests, that is dozens of idle worker processes. One monorepo's root config:

```ts
// Start one fork and add more only as test files queue up; the default starts nproc - 1 forks up front.
poolOptions: { forks: { minForks: 1 } },
```

**Packages' suites in parallel.** One monorepo's root `test` script runs packages one at a time with pnpm's
`--workspace-concurrency=1`, because running six packages' suites at once made an existing worker IPC flake more
likely. Parallel is faster only while it is reliable.

**Cold start per file.** `vitest related --run <file>` follows the real import graph but starts Vite every time. A warm
Vitest instance kept in a background process removes that; see
[../per-file-checks/warm-server.md](../per-file-checks/warm-server.md).

**Slow test files.** One test file went from 125 to 163 s locally (76 to 95 s after) and from 108 s to 70 s in CI by
calling the function under test directly in cases that only asserted its result, folding a case into another that
paid for the same setup, and reusing an expensive build inside the file through a test-only mock keyed by a SHA-256
of the build's inputs. Splitting the file across two processes was proposed and set aside until those were measured.

## Traps

**Vite's config loader leaks in a long-lived process.** With Vite's default `bundle` config loader, each in-process
build kept about 210 MB alive, because Node never unloads ES modules: four builds in one process held 873 MB with
`bundle` and 247 MB with `configLoader: "runner"`, with byte-identical output. Anything that runs several builds or
Vitest instances in one process (a test file that builds, a warm server) needs `runner`. See
[../builds/vite.md](../builds/vite.md).

**The Node API is not `vitest run`.** Creating Vitest through `createVitest` skips what the command line sets up:
`TEST=true`, `VITEST=true` and `NODE_ENV=test`. Without them Vite sets `NODE_ENV` to `development`, and the workers
inherit it. The working directory also differs. See
[../per-file-checks/warm-server.md](../per-file-checks/warm-server.md), "Tests".

**Timeouts under load.** Testing Library's waits and the default 5-second timeout fail at random on a loaded machine.
Rerun a file once with `--maxWorkers=1 --testTimeout=30000` before judging; see [general.md](general.md).
