---
name: about-build-and-check-speed
description: >
  YOU MUST load this skill when the work is making a project's checks, builds, CI or local dev loop faster:
  diagnosing why lint, a typecheck, a test suite, a build, an image build or a CI pipeline is slow; building,
  changing or repairing a per-file check command (such as `check:file`); measuring wait times; and when
  /speed-up-iteration runs.
user-invocable: false
---

# About Build and Check Speed

This skill is the knowledge for making developer iteration faster: the time developers and agents spend waiting on
checks (lint, format, typecheck, tests), the local dev loop, builds (container images included), and CI on pull
requests and merges, up to the hand-off to deployment. Deployment itself (rollout, hosting, orchestration) is out of
scope.

Every project differs in stack and in the trade-offs it makes, so this skill describes what has worked, what it cost
and when it applies; the agent decides with the user what fits the project in front of it. It describes; it does not
ask the agent to change the project. Proposing changes is the job of the `/speed-up-iteration` command.

## What Usually Turns Out to Be Slow

On every pass so far, almost every wait came from a missing cache or one config line, not from slow code:

- **Work nobody needs.** A linter building a type-checker program no rule uses (one file: 280 s to lint, 13 s
  without it). A test transformer type-checking every import graph (a unit suite: 190 s to 26 s cold with one
  setting). Coverage nothing reads. A debug line that forks a container's layer cache.
- **No cache, or a cache keyed wrong.** Linters, formatters and type checkers re-reading every file; CI runners that
  start empty; a cache keyed on modification times in a fresh checkout.
- **Checks that are too wide for the moment.** Whole-project runs after every small edit, by several agents at once.
- **Jobs that wait for things they do not read**, and pipelines nobody looks at.

## Principles

1. **Measure first.** Nothing changes until every wait has a number: cold and warm, how often it happens, and the
   conditions it was measured under.
2. **Rank by minutes per day.** A 5-second saving that happens 100 times a day beats a 2-minute saving once a week.
3. **Prefer the config line over the rewrite**, and re-measure after each cheap fix before any expensive one; the
   expensive one is often no longer needed.
4. **A run beats a grep.** A claim about speed or behavior is verified by running it.
5. **A fast check MUST agree with the full one.** A per-file check, a cached check or a filtered pipeline is useful
   only while a pass or fail means what the full, clean run would mean.
6. **Caches are weighed per project and per tool.** A stale cache can pass what a clean run would fail; how much that
   matters depends on how critical the project's stability is, and what each tool's invalidation misses.
7. **Answer "will developers have to remember this?" with a script.** The command people already type does the new
   thing.

## Matching the Check to the Moment

While the user iterates live, nothing runs. An agent working alone runs per-file checks on the files it just finished.
The full checks run once, when the work is finished. [references/agents-and-checks.md](references/agents-and-checks.md)
explains the practice, including the wording delegated prompts carry.

## Per-File Check Commands

A **per-file check command** (conventionally `check:file`, with `lint:file`, `typecheck:file` and `test:file`) takes
file paths and runs lint, typecheck and the covering tests on exactly those files, in seconds. It can be as small as
the project's existing path-taking scripts, a dispatcher script of a few dozen lines, or a background server that keeps
the tools loaded. [references/per-file-checks/overview.md](references/per-file-checks/overview.md) holds the contract,
the three ways to build one, monorepos, other languages, and how to tell agents about it;
[references/per-file-checks/warm-server.md](references/per-file-checks/warm-server.md) describes a complete warm-server
implementation for one Node stack, whose source is in `references/per-file-checks/example/`.

## References

The references are in levels: a `general.md` per area, true of any tool, then one file per tool with known slow spots,
fixes, example numbers and traps. Load only what the work needs; [references/method.md](references/method.md) has the
table of which tool file each repository signal calls for.

- [references/method.md](references/method.md): the full speed-up pass (baseline, consolidate, walk, implement,
  re-measure), the rules for measuring agents, and the tool-file table.
- [references/agents-and-checks.md](references/agents-and-checks.md): check scope by moment, per-file checks while
  working, the full checks at the end, delegated prompts, failures the agent did not cause.
- [references/per-file-checks/](references/per-file-checks/overview.md): per-file check commands.
- [references/lint/](references/lint/general.md): ESLint, Prettier.
- [references/typecheck/](references/typecheck/general.md): TypeScript.
- [references/tests/](references/tests/general.md): Jest, Vitest.
- [references/builds/](references/builds/general.md): Docker image builds, Vite, Turborepo.
- [references/ci/](references/ci/general.md): GitHub Actions, GitLab CI, tool caches in CI.
- [references/dev-loop/](references/dev-loop/general.md): NestJS, Prisma, OpenTelemetry, Docker Compose.
- [references/scripts-and-installs/](references/scripts-and-installs/general.md): Node and pnpm, project CLI
  wrappers.
- [references/machine-load.md](references/machine-load.md): several agents on one machine, process priority, leaked
  helper processes.
- [references/contributing.md](references/contributing.md): improving this skill upstream, with the user's
  permission.

## Improving This Skill

Every tool file here is what one project learned. When the agent learns something that would help any project (a slow
spot not described, a number that proved wrong, a tool with no file), it drafts the addition and offers it to the user
as an upstream improvement; it proposes nothing without the user's approval, and strips every private detail first.
[references/contributing.md](references/contributing.md) says how.

## Source for this Skill

This skill comes from the `quality/build-and-check-speed` recipe, installed by sous from a recipe repository. It was
compiled from a template, so edit the source, never this output file. To change it, run
`sous repo contribute quality/build-and-check-speed`.

- Source Path: {{ sousTemplatePath }}
