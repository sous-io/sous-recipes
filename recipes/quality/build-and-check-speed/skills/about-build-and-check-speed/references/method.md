# The Speed-Up Pass

A full pass over everything a project's developers and agents wait on: measure it all first, rank the findings, walk
them with the user, implement the approved ones in a few grouped changes, re-measure, and record what was learned. On
one TypeScript service it took a pull request's CI from 21 minutes to under 2. Almost every wait came from a missing
cache or one config line, not from slow code.

This file describes the pass. The agent runs it only when `/speed-up-iteration` runs or the user asks for a pass;
loaded for any other reason, it is reference.

The steps, in order:

1. **Baseline.** Measure every wait and write the numbers down. Nothing changes until this is done.
2. **Consolidate.** One ranked list, in tiers by effort. The per-area reports stay as evidence.
3. **Walk the findings** with the user, one per message, and record each decision in the user's words.
4. **Implement** the approved items in a few grouped changes that verify themselves.
5. **Re-measure**, record before and after, and record what was learned.

## 1. Baseline

### The areas

Split the work into areas and measure each one separately (in parallel, by background agents, when the agent can
delegate). Skip an area the project does not have, and say so.

| Area | What it covers | References |
| --- | --- | --- |
| Static checks | Lint, format, typecheck, commit hooks | [lint/](lint/general.md), [typecheck/](typecheck/general.md) |
| Tests | Unit and end-to-end suites | [tests/](tests/general.md) |
| Per-file checks | Whether a per-file check command exists, and what agents actually run while working | [per-file-checks/](per-file-checks/overview.md) |
| CI | Every workflow or pipeline and the shared ones it calls, on pull requests and merges, up to the hand-off to deployment | [ci/](ci/general.md) |
| Builds | Local builds, container image builds, build caches | [builds/](builds/general.md) |
| Dev loop | Dev server boot, rebuild after a save, local services, generation, local migrations | [dev-loop/](dev-loop/general.md) |
| Scripts and installs | Package scripts and their hooks, installs, a project CLI wrapper | [scripts-and-installs/](scripts-and-installs/general.md) |
| Machine load | Concurrency, leaked processes, worktrees | [machine-load.md](machine-load.md) |

Deployment itself (rollout, hosting, orchestration) is out of scope; the CI jobs and image builds leading up to it are
in.

### Which tool files to load

Each folder has a `general.md` that applies to any tool, plus one file per tool with known slow spots. Load a tool file
only when its signal is in the repository:

| Signal in the repository | Load |
| --- | --- |
| `package.json` | [scripts-and-installs/node.md](scripts-and-installs/node.md) |
| An ESLint config, or `eslint` in dependencies | [lint/eslint.md](lint/eslint.md) |
| A Prettier config, or `prettier` in dependencies | [lint/prettier.md](lint/prettier.md) |
| `tsconfig.json`, or TypeScript in dependencies | [typecheck/typescript.md](typecheck/typescript.md) |
| A Jest config, or `jest` in dependencies | [tests/jest.md](tests/jest.md) |
| A Vitest config, or `vitest` in dependencies | [tests/vitest.md](tests/vitest.md) |
| A Vite config, or `vite` in dependencies | [builds/vite.md](builds/vite.md) |
| `turbo.json`, or `turbo` in dependencies | [builds/turborepo.md](builds/turborepo.md) |
| Any `Dockerfile*` | [builds/docker.md](builds/docker.md) |
| `.github/workflows/` | [ci/github-actions.md](ci/github-actions.md) |
| `.gitlab-ci.yml` | [ci/gitlab-ci.md](ci/gitlab-ci.md) |
| `@nestjs/core` in dependencies, or `nest-cli.json` | [dev-loop/nestjs.md](dev-loop/nestjs.md) |
| `prisma/schema.prisma`, or `@prisma/client` in dependencies | [dev-loop/prisma.md](dev-loop/prisma.md) |
| `@opentelemetry/*` in dependencies | [dev-loop/opentelemetry.md](dev-loop/opentelemetry.md) |
| `docker-compose.yml`, `docker-compose.yaml`, `compose.yml` or `compose.yaml` | [dev-loop/docker-compose.md](dev-loop/docker-compose.md) |

A tool with no file is still measured under its folder's `general.md`. What was learned about it is worth a new file;
see [contributing.md](contributing.md).

### Rules for every measuring agent

- **Read-only on the repository.** No edits, no commits, no installs into the real checkout. Running lint, typecheck,
  tests and builds is fine. A cold install is measured in a scratch directory holding a copy of the manifest and the
  lockfile, never by deleting the real dependency directory.
- **Every timing twice; report the faster.** Say whether other work was loading the machine, and report CPU time
  alongside wall time when it was; CPU time is the stable figure.
- **Never start a second dev server**, and never stop or restart anything that is running.
- **Never touch secrets.** A committed credential goes in the report as a finding and nowhere else.
- **Expect false failures from concurrent agents.** One agent's build deletes the output directory under another's
  test run. Rerun before believing a failure.
- **Check every package a recommendation names against its registry.** One report recommended a framework plugin by
  name that did not exist.
- **Stop on an authentication or permission failure** and report it. Never work around one by changing a credential or
  a permission; one release failure that looked like it needed a new role was fixed by one workflow line.

### What each report holds

1. A baseline table: the command or stage, its cold time, its warm time, and how often it happens per day.
2. Findings, each with its evidence: a log line, a timing, a config value.
3. Recommendations ranked by seconds saved per occurrence times occurrences per day, each with its effort and a
   before-and-after estimate.

### How to measure

- **Locally:** `time` on the command. Cold means an empty cache; warm means the second run.
- **CI:** the provider's API, not the workflow files; see [ci/general.md](ci/general.md).
- **Image builds:** one release's build log: context size and send time, cached steps, each build and push.
- **Growth:** plot the longest CI job over the last ten weeks; a job growing linearly passes a threshold on a
  predictable date, and the report says when.

## 2. Consolidate

One ranked list, in three tiers:

- **Tier 1, config only.** Caches, flags, one-line deletions. They land together, first.
- **Tier 2, small code changes.** Guards, script splits, spec clean-ups, a per-file check command at its simplest
  level.
- **Tier 3, bigger.** Re-measure after tiers 1 and 2 before starting any of these; several will have become
  unnecessary. On one pass, one config line in the test transformer made sharding, a bigger runner and a faster
  transformer all moot.

When two measurements disagree, say so and mark the item "re-measure after the cheap fix". On each pass so far, the
measurement taken after the cheap fix was the right one.

## 3. Walk the Findings

One finding per message. Each gets: what it is, in two or three sentences; its effort; and a table of what gets faster,
the time now, and the time after. Say how many items remain. A question from the user gets an answer, not the next
item. Record each decision in the user's words.

Findings that are not speed items are still presented: a check that auto-fixes and throws the fix away in CI, a test
suite that writes into the developer's database, a committed credential. A committed credential gets its own ticket and
is never fixed as part of the speed work.

Expect the walk to change the plan: on one pass it merged items, split a side note into its own item, changed the form
of three and narrowed one. Do not implement before the walk.

```text
Item 4 of 11 - Cache ESLint locally and in CI

The lint script re-lints all 672 files on every run. `--cache` with the content strategy skips unchanged files; in CI
the cache file is restored between runs, keyed on the lockfile and the ESLint config. Effort: config only.

| What gets faster      | Now  | After |
| --------------------- | ---- | ----- |
| Local lint, warm      | 28 s | 2 s   |
| CI lint job           | 58 s | 20 s  |

The CI lint job is not on the critical path, so the CI half saves runner time, not anyone's wait.
```

## 4. Implement

Group the approved items into a few changes, each verified by something that runs anyway:

1. **Checks and tests**, verified by the change's own CI run.
2. **CI and image builds**, verified by one run of the pipeline the change touches (for a release pipeline, one
   release). Build and run any changed image locally before merging.
3. **The dev loop and scripts**, verified locally.
4. **A project CLI wrapper** in its own repository, if it is in scope.

One release verifies a whole set of release-pipeline changes. If it fails there are several changes to suspect, and the
local image build is what catches most of that first. A failed release is fixed by an ordinary change through the same
review path, never by patching what was deployed by hand. Keep a running list of problems and lessons while
implementing.

When other agents share the branch, commit with explicit paths as
[machine-load.md](machine-load.md), "Concurrent Agents in One Checkout", describes.

## 5. Re-Measure and Record

Re-run every row of the baseline table and record before and after, with the conditions (machine, load, cold or
warm, which run). Then record what was learned, in two places:

- **The project's own instructions** get what is specific to the project: its per-file check command and each check
  command's expected time, the full-check commands for the end of the work, and anything agents must now do
  differently.
- **This skill** gets what would help any project: a wait not described here, a number that proved wrong, a tool with
  no file yet. That goes upstream, only with the user's permission; see [contributing.md](contributing.md).

## Rules That Held

- **Count causes, not symptoms.** Nine affected specs and 1,708 error lines had one cause. A mechanical rewrite
  predicted at 64 sites in 37 files with 12 special cases was 63 in 36 with none. Estimates from reading run high; do
  one instance and re-count.
- **Say what was not verified.** A landed change is not a verified one.
- **Quote a range, not one run.** A pull request's CI time moves with the size of the change.
