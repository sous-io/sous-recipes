# How Agents Use Checks

The most expensive habit found across several projects was an agent running whole-project checks (a full build, a full
typecheck, a full test suite) after every small edit, and several agents doing it at once: one user described waiting
"20 minutes for every agent". Every practice in this file is a form of one idea: **the scope of a check matches what
just changed and what is about to happen.**

## The Three Moments

| Moment | What runs | Why |
| --- | --- | --- |
| The user is iterating live (watching a hot-reloading server, steering each edit) | Nothing; edit and report | The user is the check; every run costs minutes and blocks them |
| An agent working alone reaches a natural stopping point (a file or a small set of files is done) | Per-file checks on exactly those files | Seconds, and the failures are the agent's own |
| The work is finished: before the final commit, a push, a pull request, or when several authors' changes come together | The full checks, once | Only the full run proves the whole; a green subset does not |

Builds count as checks: rebuilding a library while the user tweaks it in a dev server only makes them wait. A batch of
work is one unit: when several sub-agents build parts of one objective, the full checks and any real-browser look run
once, after all of them return.

The always-loaded rule that binds agents to these moments lives in the `communication/agent-conduct` recipe, for
projects that subscribe to it. This file explains the practice around it.

## Per-File Checks While Working

- Use the project's per-file check command(s) when it has any (see
  [per-file-checks/overview.md](per-file-checks/overview.md)). Where the project's instructions name them as the only
  checks to run while working, do not run the underlying tools (`eslint`, `tsc`, `vitest`) directly.
- Without one, use the narrowest commands that take paths (`eslint <files>`, `vitest run <spec>`), and never sweep a
  directory or a whole package while working.
- A dependency read through its build output goes stale: after editing a workspace package that others read through
  `dist/`, rebuild that one package before checking its consumers.

## The Full Checks at the End

- **Cheapest first**, so the fastest signal arrives first, while respecting real dependencies (a test that reads
  `dist/` needs the build first). For example: lint, then the build (which typechecks first), then tests, then
  browser suites.
- **All of it.** A green subset does not stand in for a green run, and neither does a green set of per-file checks.
- **What CI does not check falls to this run.** Find out what CI skips; see [ci/general.md](ci/general.md).
- **May be delegated** to a background agent. Full checks can take several minutes: give each command a long enough
  timeout, and wait for it.
- **Once per objective.** When several agents work on one objective, the full checks run once, after all of them
  return.

## Delegated Prompts Carry the Scope

A sub-agent starts with none of the project's rules, so each prompt that hands it work states the check scope.
Without it, every sub-agent runs the full suite on its own, at the same time as the others. Wording that works:

```text
Checks: while working, run only `pnpm check:file <files you edited>` (or, if the project has none, the narrowest
per-file lint and test commands). Run no whole-project build, typecheck, lint or test suite; the full checks run
once, after all agents return. If a per-file check fails on a problem you did not cause, report it and do not fix it.
```

## Failures the Agent Did Not Cause

- **Errors in existing code are reported, not fixed.** Lint or type errors in code the agent did not change go to the
  user with options; the agent does not fix them as a side effect or widen the change. A per-file check keeps this
  rare, because it reports only the files being worked on.
- **A timeout under load is not yet a failure.** Rerun the file once with fewer workers and a longer timeout before
  judging; see [machine-load.md](machine-load.md).
- **Reproduce a CI failure locally** with the command the job runs, before changing anything.
- **Run the same command on the main branch** before blaming a change for a local failure.

## Commits During Live Iteration

Commits are held while the user iterates on one concept, and a finished concept is committed locally when the work
moves on to the next one, without waiting for the full checks.
