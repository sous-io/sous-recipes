# ESLint

Load when the repository has an ESLint config file or `eslint` in its dependencies.
This file covers caching, the parser setting, rules that cost more than they return, and what the lint script
should and should not do in CI.

## What to Measure

| Command                                           | Note                                                      |
| ------------------------------------------------- | --------------------------------------------------------- |
| The lint script as shipped                        | Note whether it carries `--fix` and `--max-warnings`      |
| The linter with `--cache`, cold then warm         | The warm number is the target                             |
| The linter with the project parser option removed | Compare CPU time, not wall time                           |
| The linter on one file                            | Shows whether startup, not the file, is the cost          |

Inventory: whether any rule in the config is type-aware, whether the formatter runs as a lint rule, whether
`--fix` runs in CI, how many files the glob covers, and which directories the config ignores.

## Known Slow Spots

**No cache.** Every run lints every file again. On one TypeScript service with 672 files, `--cache` with the cache
location under the dependency directory took a local lint from 28 s to 2 s warm.

**The cache keyed on modification times.** The default cache strategy compares modification times. Those change on
every checkout and every switch between git worktrees, so the cache misses even when no file changed. Use
`cacheStrategy: "content"` (`--cache-strategy content` on the command line), locally as well as in CI.

**No cache in CI either.** The cache file can be restored with the CI system's cache action, keyed on the lockfile
and the lint config, together with the content strategy. The linter stores a hash of its config and version per
file, so config changes invalidate correctly. Plugin upgrades with an unchanged config do not, and the lockfile in
the key covers that. Fixed files are never cached. On the same service the lint job was not on the CI critical
path, so caching saved about 25 s of runner time and no waiting.

**Type-aware parser, no type-aware rules.** A config that sets `parserOptions.project` (or `projectService`) makes
the linter build the whole TypeScript program before linting anything, even when no rule needs types.
- On the TypeScript service above, the preset in use was the non-type-checked one; removing the setting saved 13 s
  of CPU per cold lint.
- On a monorepo, an unused `languageOptions.parserOptions.project` listing five tsconfig globs, combined with
  ignoring build output, took a one-file lint from 280 s to 13 s.

Whether a rule needs types can be read from the rule's documentation ("requires type information"), and the
presets named "type-checked" or "recommended-type-checked" turn such rules on.

**Linting output and tool directories.** A glob that reaches `dist`, `.turbo`, coverage output, `cdk.out` or
similar walks generated code, which is large and fails rules. The same holds for any agent or tool directory
inside the repository, such as `.claude/`, which can hold whole copies of the source in git worktrees. Ignore
these explicitly in the config's ignore list.

**The formatter running as a lint rule.** On the TypeScript service, about 25 of 59 CPU seconds per cold lint went
to running Prettier inside the linter. Drop the formatter plugin, keep the config package that only disables
conflicting rules, and run the formatter as its own cached step. See [prettier.md](prettier.md).

**`--fix` in CI.** When the only lint script carries `--fix` and CI runs it, fixable violations are fixed on the
runner and thrown away, so a regression passes CI. Splitting into `lint` (checks, fails on violations) and
`lint:fix` fixes correctness, not seconds.

**Strictness kept outside the script.** Warnings that CI treats as failures but a local run ignores show up
late. Putting the strictness in the script, as in `"lint": "eslint --max-warnings 0"`, gives every caller the
same result. Passing paths after the script name scopes the run to those files.

**Lint placed late in a pipeline.** A lint job with no type-aware rule needs no TypeScript program, so it is the
fastest signal a CI pipeline can give. It can run first and in parallel with the slower jobs. See
[../ci/general.md](../ci/general.md).

## Traps

**`consistent-type-imports` and decorators.** `@typescript-eslint/consistent-type-imports` is what keeps
type-only imports marked as such, which matters when a transpiler such as swc keeps the imports that tsc would
remove (see [../typecheck/typescript.md](../typecheck/typescript.md)). It has two traps:
- Without `parserOptions.project`, the parser options have to state `emitDecoratorMetadata` and
  `experimentalDecorators` explicitly. Otherwise the rule's autofix rewrites injected constructor parameters into
  type imports and dependency injection breaks at runtime.
- The rule has to be off for files where its autofix undoes an `import type` that the compile needs (controller
  files in a NestJS service). Setting `disallowTypeAnnotations: false` is also needed.

**Autofix output the formatter disagrees with.** `lint:fix` can write code the formatter would change. Run the
fixer first and the formatter second, or the next check fails on formatting instead.

## Lessons From Implementation

1. Measured after the first pass on the TypeScript service: 17.2 s cold, 2.0 s warm. The linter does not get under
   a second on a tree of that size, even fully cached.
1. Turning on `consistent-type-imports` produced 728 errors in one pass. The autofix is mechanical but enormous;
   it reads best as its own commit, so a reviewer can skip that diff, and the lint and combined check scripts stay
   red until it lands.
1. On that service the first-pass totals were: local lint, warm, 28 s to 2 s; CI lint job, about 58 s (readings of
   59 s and 57 s) to about 20 s.
1. One-file lint on a large monorepo is dominated by startup work (the program build and the directories walked),
   not by the file. Measuring one file against the whole tree shows which kind of cost is present.
