# Typecheck: Any Language

What makes a type check slow, whatever the language. Tool file: [typescript.md](typescript.md).

## Common Slow Spots

- **No typecheck of its own.** When the only way to check types is the full build, every type check also cleans,
  compiles, generates code and writes output. A dedicated check-only command (for TypeScript, `tsc --noEmit`) is
  usually the single largest saving.
- **No incremental state.** Most type checkers can keep what they learned last time (TypeScript's `incremental` and its
  `.tsbuildinfo` file; Python's `dmypy`; Rust's incremental compilation). Without it every run starts from nothing.
- **Output nobody consumes.** Declaration files, source maps, or a whole emit, produced by a step whose only job was to
  check.
- **The whole program for one file.** While working, a per-file typecheck through the project's own config loads only
  the file's import graph (see [../per-file-checks/overview.md](../per-file-checks/overview.md)).

## What a Per-File Typecheck Can and Cannot Prove

A per-file typecheck reports the errors inside the checked file. An edit that breaks a caller somewhere else passes
it, and the whole-project typecheck at the end catches it. Some projects therefore keep the typecheck whole-project
even while working, because a type error is often not in the file that caused it; that is reasonable when the
incremental whole-project check takes a few seconds.

## Types From Built Packages

In a monorepo where one package reads another's types from its built output (`dist/`), the typecheck of the reader
sees the old types until that one package is rebuilt. Locally that shows up as a type that "does not exist"; the fix is
rebuilding the one package, never the repository. In CI it means the typecheck job has to wait for the build of what
it reads.

## In CI

- Run the same typecheck script developers run, so a pass means the same thing in both places.
- A separate typecheck job that repeats the build's first type-checking step can be worth its cost: a type error is
  then reported by a job with that name, instead of as a build failure.
- Restoring a type checker's incremental state between CI runs is a tool cache; see [../ci/general.md](../ci/general.md),
  "Tool Caches in CI".

## Lessons

1. Quote the machine's load with any warm number. One incremental typecheck took 7.4 s on an idle machine and 9 to 13 s
   on the same machine with other work running.
2. A test that only asserts a type error can call the project's typecheck function directly, instead of running the
   whole check command, which is much cheaper in a test suite.
