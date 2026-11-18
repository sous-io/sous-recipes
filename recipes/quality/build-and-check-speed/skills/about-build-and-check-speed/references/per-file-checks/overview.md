# Per-File Check Commands

A **per-file check command** takes one or more file paths and runs every check that applies to exactly those files:
lint, typecheck and the tests that cover them. It exists so that an agent (or a person) working on a few files gets
an answer in seconds about the files it touched, instead of waiting minutes for a whole-project run that also
reports failures it did not cause. The full checks still run once, when the work is finished; a per-file command does
not replace them.

In a Node project the conventional name is `check:file`, a package script run as `pnpm check:file <file>...` (or
`npm run check:file -- <file>...`). The idea is not specific to Node: any task runner can offer the same command.

## The Contract

Whatever its implementation, a per-file check command behaves like this:

```text
check:file [options] <file>...
lint:file | typecheck:file | test:file [options] <file>...

Options:
  --fix                 write the linter's and formatter's fixes
  --only=<check>        run one check: lint, typecheck or test
  --no-<check>          skip a check: --no-lint, --no-typecheck, --no-test
  -h, --help            show help
  (a command that keeps a background process adds --status and --stop)
```

- **One or more paths per call**, checked in order.
- **Paths resolve from the directory the command was run in**, not from the repository root. pnpm and npm set
  `INIT_CWD` to that directory; read it, falling back to the current directory. The command then works the same from
  any package directory.
- **`lint:file`, `typecheck:file` and `test:file`** exist as aliases for `--only=<check>`.
- **Exit codes**: `0` when every check passed or was skipped, `1` when at least one check failed, `2` for a usage
  error or a failure of the tool itself.
- **A check that does not apply reports `skip` with the reason**, never a failure and never silence: "not a
  TypeScript source file", "no spec covers this file in services/api", "no linter for .xyz".
- **Compact output made for an agent to read**: one line per check with its status and its wall and CPU time, then
  only the findings, each as `path:line:column` relative to the repository root. Warnings are capped (10 is a good
  number) with a "... N more warning(s)" line. A failing test prints its name trail, the first lines of the message,
  the first stack frame outside the dependency directory, and the first lines of the diff. Console output from tests
  is swallowed.

Example output (the shape is from a working implementation; the numbers are illustrative):

```text
services/api/src/orders/total.ts
  lint      pass  0.4s (cpu 0.3s)
  typecheck FAIL  1.2s (cpu 1.1s)
    tsconfig: services/api/tsconfig.json
    services/api/src/orders/total.ts:42:7 TS2322: Type 'string' is not assignable to type 'number'.
  tests     pass  2.0s (cpu 1.6s)
    project: services/api
    services/api/src/orders/total.spec.ts: 12 passed, 0 failed, 0 skipped (import 0.8s, tests 0.3s)
```

### What each check means for one file

- **lint**: the project's linter with the project's own config. Files the linter ignores, and formats the formatter
  owns (JSON, Markdown, CSS, YAML and so on), get the formatter's check instead. Other file types are skipped with a
  note.
- **typecheck**: the type checker's diagnostics for the file, against the config that owns it. When the file is a
  spec, its subject file is checked too (`total.spec.ts` also checks `total.ts`).
- **test**: the specs that cover the file. In order: the file itself when it is a spec; otherwise a sibling spec with
  the same stem (`total.spec.ts`, `total.test.ts`); otherwise every spec in the same test project that imports the
  file. None found is a `skip`, not a pass.

## The Rule That Makes It Useful

**A per-file check MUST give the same answer the full run gives for that file.** Same config files, same environment
variables, same working directory, same ignore rules. A fast check that disagrees with the full run is worse than none:
agents chase failures that are not real, or trust passes that are not. Every hard-won gotcha in the warm-server
example (environment variables a test runner sets only from its own command line, the working directory tests
expect, one config per test project) is a case where the fast path first disagreed with the real one.

Before trusting a new per-file command, run it and the full checks on a few files, including one with a known lint
error, a known type error and a failing test, and compare.

## Limits Every Implementation Shares

- **A per-file typecheck reports errors inside the checked file.** An edit that breaks a caller in another file
  passes here; the full typecheck at the end catches it. That is the accepted trade.
- **Spec discovery by import is approximate.** Matching import specifiers does not follow re-exports or transitive
  imports. A test runner's own "related" mode (for Vitest, `vitest related --run <file>`; for Jest,
  `--findRelatedTests <file>`) follows the real import graph at the cost of a cold start.
- **A built dependency goes stale.** When one workspace package reads another through its built output (`dist/`), an
  edit to the source package is invisible to the reader until that one package is rebuilt (for pnpm,
  `pnpm --filter <package> build`; never the whole repository). A good per-file command detects this and prints the
  exact command; see [warm-server.md](warm-server.md).
- **Browser and end-to-end suites are not per-file checks.** They build nothing incrementally and take a browser or a
  running system to start; they belong to the full checks.

## Three Ways to Build One

The command's name, flags and output stay the same at every level, so the instructions agents read never change when
the implementation does. The lowest level that is fast enough is the right one.

1. **Pass-through scripts.** The project's existing scripts already accept paths: `"lint": "eslint --max-warnings 0"`
   and `"test": "vitest run"` make `pnpm run lint <paths>` and `pnpm run test <paths>` check only those paths, with
   the typecheck left whole-project. Cost: nothing. Limits: no single command, a cold start every time, and the
   caller has to know which spec covers a file.
2. **A dispatcher script.** One script that, for each file, finds its package, runs the linter on the file, runs the
   specs that cover it (a test runner's "related" mode finds them), and typechecks through a temporary config (below)
   or falls back to the package typecheck. A cold start each time, but one command with the whole contract. A few
   dozen lines.
3. **A warm server.** A background process that keeps the linter, the type checker and the test runner loaded, so
   only the first check pays their start-up cost. Worth building when start-up is most of the wait: in the project the
   example comes from, loading ESLint, TypeScript and Vitest fresh for every file was the cost the server removed.
   [warm-server.md](warm-server.md) describes the design, and [example/](example/) holds a complete implementation for
   one stack.

### A per-file typecheck with no tooling

For TypeScript, `tsc <file>` is the wrong tool: it ignores the project's `tsconfig.json` and checks the file with
default settings and none of the path mappings. A temporary config that extends the project's own is correct:

```bash
dir="$(mktemp -d)"
cat > "$dir/tsconfig.json" <<EOF
{
  "extends": "$PWD/tsconfig.json",
  "compilerOptions": { "noEmit": true, "composite": false, "incremental": false },
  "files": ["$PWD/src/orders/total.ts"],
  "include": []
}
EOF
pnpm exec tsc --noEmit -p "$dir/tsconfig.json"   # run from the package directory
```

It loads only the file's import graph, so it is much faster than the whole project, but it starts cold every time.
A TypeScript `LanguageService` kept in a warm server does the same with a warm cache; see
[warm-server.md](warm-server.md).

Some projects keep the typecheck whole-project on purpose, because a type error is often not in the file that caused
it, and the whole-project typecheck is the same pass the build runs first. That is a reasonable choice when the
whole-project typecheck is fast (an incremental `tsc` that finishes in a few seconds); the per-file typecheck earns
its place when it is not.

## Monorepos

The best form is one command at the repository root that works on any file in any package, with nothing configured
per package. Everything can be discovered from the file's path:

- the lint config: the root config (ESLint 9 reads only the root `eslint.config.js`);
- the type-checker config: the nearest `tsconfig.json` above the file, or the one of its project references that
  includes the file;
- the test project: the nearest test-runner config above the file;
- the workspace dependencies: the nearest `package.json`.

The root `package.json` then holds the scripts and no package needs anything. Because paths resolve from `INIT_CWD`,
`pnpm -w check:file src/total.ts` typed inside a package directory checks that package's file (`-w` runs the
workspace root's script).

When one root command is not practical (packages with different toolchains, for example), every package that can
support the command gets one with the same name, flags, output and exit codes, so the instruction to agents is still
one sentence. A root script can then route: find the file's package and run that package's `check:file`.

## Other Task Runners and Languages

The contract is not specific to Node: one command, file paths in, lint plus typecheck plus tests for those files,
compact output, the three exit codes. Where a language's smallest practical unit is a package rather than a file, the
command still takes a file and maps it to that unit. Examples of the same idea elsewhere (untested sketches, not
collected experience):

- **Python**: `make check-file FILE=src/orders/total.py` or `just check-file src/orders/total.py`, wrapping
  `ruff check`, a type checker and `pytest` on the matching test file. `dmypy` (mypy's daemon) is the warm-server
  idea for a type checker.
- **Go**: `go vet` and `go test` on the file's package.
- **Rust**: `cargo check -p <crate>` and `cargo test -p <crate> <module>`.

## Before Building One, Look for What Exists

- Scripts that already take paths (`eslint <paths>`, `vitest run <paths>`, `pytest <paths>`).
- A `lint-staged` config, which already maps file patterns to commands.
- Editor tasks, a `Makefile` or `justfile`, a project CLI.
- The project's agent instructions, which may already name a per-file command.

## Telling Agents About It

A per-file command helps only if the project's agent instructions name it. Wording that has worked:

```text
After editing files, check them with `pnpm check:file <file>...` (lint, typecheck, tests) and nothing else; one
check alone: `pnpm lint:file`, `pnpm typecheck:file`, `pnpm test:file`. Options: `--fix`, `--only=<check>`,
`--no-<check>`, `--status`, `--stop`. Works on any file in the monorepo. NEVER run `eslint`, `tsc` or `vitest`
directly while working. Full-project checks (`pnpm build`, `pnpm typecheck:all`, `pnpm test`) run once, at the end
of the work. Delegated prompts carry this rule.
```

The parts that matter:

- the one command, and that it is the only check run while working;
- what not to run directly, by name;
- the rebuild step for packages read through their build output, when the repository has any;
- the full-project commands, and that they run once at the end;
- each command's expected time; agents follow a list of commands reliably when the times are stated;
- that delegated prompts carry the rule, because a sub-agent starts with none of it.

## Checklist for a New Per-File Command

1. One command; one or more paths; paths resolve from the caller's directory.
2. Runs lint, typecheck and tests by default; `--only=`, `--no-` and `--fix` work; the three aliases exist.
3. Works from the repository root on any file, or exists with identical behavior in every package.
4. A check that does not apply prints `skip` and a reason.
5. Exit codes 0, 1 and 2 as above.
6. Output: one status line per check with its time, findings as `path:line:column`, capped, no test console noise.
7. Uses the same configs, ignore rules, environment variables and working directory as the full run.
8. Warns when a dependency read through its build output is stale, and prints the one command that fixes it.
9. If it keeps a background process: one instance, one request at a time, an idle exit, a restart when the tool's own
   source changes, `--status` and `--stop`, a log file, state under a gitignored cache directory, normal priority.
10. The project's agent instructions name it, as described above.
11. It has been compared against the full run on a few files: same passes, same failures.
