# Lint and Format: Any Tool

What makes a linter or a formatter slow, whatever the tool. Tool files: [eslint.md](eslint.md),
[prettier.md](prettier.md).

## The First Question

**What is the linter doing that no rule needs?** The largest lint saving found so far was a linter building a full
type-checker program (five tsconfig globs) for a config that enabled no rule that used types: one file took 280 s
to lint, and 13 s once the program and the build output were removed. Read the config before timing anything else.

## Common Slow Spots

- **Work no rule needs.** Type-aware parsing with no type-aware rules; plugins whose rules are all off; a formatter
  running as a lint rule (the linter formats, diffs and reports every file through its own machinery, which is slower
  than the formatter checking it, and the two caches cannot see each other's inputs).
- **Files nobody meant to lint.** Build output, coverage reports, generated code, vendored code, and tool directories
  inside the repository. Agent tool directories (`.claude/`, worktree folders) can hold whole copies of the source,
  so a linter that walks into them does the work several times over. Ignore them explicitly.
- **No cache.** Most linters and formatters can skip unchanged files (`--cache`). Prefer a content-keyed cache:
  modification times change on every checkout and every worktree switch, so a time-keyed cache misses there.
- **The whole tree when a few files changed.** While working, lint the files being changed (see
  [../per-file-checks/overview.md](../per-file-checks/overview.md)); at the end, lint the changed directories or the
  project, once.

## Correctness Traps That Look Like Speed Settings

- **`--fix` in CI.** A lint script that carries `--fix`, run in CI, fixes violations on the runner and throws the fixes
  away, so the regression passes. Split it: `lint` checks and fails; `lint:fix` writes. CI runs the check.
- **Strictness in the caller.** Put `--max-warnings 0` (or the tool's equivalent) in the script itself, so every
  caller, CI and agents included, gets the same strictness.

## In CI

- A lint job with no type-aware rule needs no program and no build, so it is usually the fastest signal in a pipeline:
  it can start at once and nothing has to wait for it.
- A lint cache can be restored between CI runs (see [../ci/general.md](../ci/general.md), "Tool Caches in CI"); key it
  on the lockfile and the lint config, and use the content strategy, because a fresh checkout resets every
  modification time.

## Agents and Lint Errors in Existing Code

A lint run over a whole directory reports problems in code the agent did not touch. Those are reported to the user,
not fixed as a side effect; a per-file run keeps this small, because it reports only the files being worked on.
