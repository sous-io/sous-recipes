# Builds: Any Tool

What makes a build slow, and when a build should run at all. Tool files: [docker.md](docker.md), [vite.md](vite.md),
[turborepo.md](turborepo.md).

## When a Build Runs

- **Not while the user iterates.** Hot reload is the feedback; rebuilding a library while the user tweaks it in a dev
  server or a component explorer only makes them wait. Rebuild when the user asks to see the change in the consuming
  app.
- **One package, not the repository**, when a consumer needs a fresh build output (for pnpm,
  `pnpm --filter <package> build`).
- **Once at the end**, as part of the full checks, when anything reads the build (a test that reads `dist/`, a type
  check that resolves types from a built package).

## Common Slow Spots

- **Hidden steps.** Package-manager `pre*` and `post*` hooks run silently before and after the script they wrap; they
  are where the hidden clean, code generation and migration steps live. Compare the build script's time with the
  compiler's alone.
- **Cleaning a good output directory.** A flag that deletes the output before every build (or every dev boot) forces a
  full compile each time. One service's boot spent 26 s of 37 s on that.
- **No incremental compile**, or a compile done by a slower tool than needed (a type-checking compiler where a
  transpiler would do, with the typecheck kept as its own gate).
- **Generation on every build.** Code generation (an ORM client, an API client, a schema) rerun when its input did not
  change. Skip it when a stored hash of the input matches; a timestamp comparison misfires in some contexts.
- **Output nobody consumes.** Declaration files for an application, source maps in a release build, coverage
  instrumentation.
- **Rebuilding shared packages in every job.** In CI, each app's build job rebuilding the same shared packages (about
  25 s a job in one monorepo); a build cache or artifacts remove it.

## Caching Builds

A cached build is only as correct as the list of its inputs. A build-cache config (Turborepo, Nx, Bazel and similar)
MUST name everything a build reads: files outside the package, and every build-time environment variable. Listing
every variable is what makes the cache key correct. A strict environment mode, where a task sees only the variables
listed for it, makes an unlisted variable undefined inside the task instead of silently read; the build fails
visibly only if it rejects a missing value, and otherwise it builds without it. Keep one job that builds with no cache, so
something always proves the clean build. See [turborepo.md](turborepo.md).

## Memory

- **Limit build concurrency when builds are memory-heavy.** Two large bundler builds in memory at once ran one CI job
  out of heap; that monorepo builds one package at a time on purpose.
- **When a build runs out of memory, raise the heap first** (`NODE_OPTIONS=--max-old-space-size=4096` for Node). It is
  a one-line fix; restructuring the build is not.
- **Bundle shape affects build memory.** Lazy routes took one app's entry chunk from 11.3 MB to 4.5 MB, and deep
  imports of an icon pack stopped the bundler parsing about 3 MB of icon indexes, which brought the build back under
  Node's default heap limit.

## Development Builds

A development build can skip what only a release needs: minification, full source maps, separate vendor chunks. See
[vite.md](vite.md) for one set of such settings and what each saved.
