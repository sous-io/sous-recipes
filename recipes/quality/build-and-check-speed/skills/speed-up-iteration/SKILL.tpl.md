---
name: speed-up-iteration
description: Measure everything developers and agents wait on in a project (checks, builds, CI, the dev loop), then propose and carry out the fixes with the user.
argument-hint: "[project, area or wait to focus on]"
disable-model-invocation: true
---

# Speed Up Iteration

What to focus on: $ARGUMENTS

If nothing is named above, the target is the whole project in the current working directory: every area listed in the
method. Name the target in the first line of the reply. If something is named (a repository, an area such as "CI", or
one wait such as "the unit tests"), focus the pass there, and still note any much larger wait seen on the way.

The agent performing this command MUST load `about-build-and-check-speed` first and follow
`references/method.md` there. That skill describes; this command is the instruction to act on it. In this command the
agent digs in, researches, proposes and, once the user approves, implements.

## Steps

1. **Read the project.** Find the stack, the areas that apply, and the tool files whose signals are present (the table
   in `references/method.md`). Read the project's agent instructions for check commands, rulings and anything already
   decided about checks, builds or CI. Say which areas and tool files apply, and which areas the project does not have.
2. **Track the pass.** If the project keeps task files, open one for this pass before measuring; open a ticket only
   where the project's rules allow creating one.
3. **Baseline.** Measure every area in scope, by background agents in parallel when the agent can delegate, each
   given the rules for measuring agents and the tool files for its area. Measure what agents actually run while
   working, too: whether the project has per-file check commands, and whether its instructions name them. A tool with
   no file in the skill is investigated under its area's `general.md` anyway.
4. **Consolidate** the reports into one ranked list in three tiers, with disagreements marked "re-measure after the
   cheap fix".
5. **Propose.** Every finding goes on the list, including ones the skill describes as optional. In particular:
   - **No per-file check command:** propose adding one, at the lowest level that is fast enough (see
     `references/per-file-checks/overview.md`), and propose the instruction that tells agents to use it.
   - **A per-file check command that agents are not told about:** propose the instruction.
6. **Walk the findings with the user**, one per message, in the form `references/method.md` shows. Record each decision
   in the user's words in the task file or ticket, if there is one.
7. **Implement** the approved items in the grouped changes the method describes. Take outward actions (pushes, pull
   requests, merges, releases) only as far as the project's rules allow.
8. **Re-measure** every row of the baseline and record before and after, with conditions.
9. **Record what was learned.**
   - In the project's own instructions: the per-file check commands and each check command's expected time, the full
     checks for the end of the work, and that delegated prompts carry the check scope.
   - Upstream, for anything that would help any project: draft the additions to `about-build-and-check-speed` as
     `references/contributing.md` describes, show them to the user, and propose them only with the user's approval.

## Report

The report opens with what changed and the before-and-after table, then anything the user must still decide, then the
drafted upstream improvements, if any, awaiting approval.

```text
The pull request's CI now takes about 2 minutes, down from 21. Two items need your decision, and I've drafted
one addition to the speed-up skill for your approval.

| Wait                       | Before   | After   | Measured on              |
| -------------------------- | -------- | ------- | ------------------------ |
| Pull request CI            | 21 min   | 2 min   | the last 3 runs          |
| Local lint, warm           | 28 s     | 2 s     | this machine, idle       |
| Unit suite, warm           | 61 s     | 18 s    | this machine, idle       |
| check:file on one file     | (none)   | 1 to 3 s| this machine, warm server|

Needs your decision:
1. Shard the end-to-end suite? It now takes 103 s in CI and runs beside the unit job, so it is no longer the slowest.
2. The lint job now runs the formatter too; keep the formatter check in the build job as well?

Drafted for upstream (nothing sent): a new slow spot for the speed-up skill's builds/docker.md, a BuildKit cache
mount for the package store, with the 40 s it saved here per image build. Say "send it" and I'll propose it.
```

## Source for this Skill

This skill comes from the `quality/build-and-check-speed` recipe, installed by sous from a recipe repository. It was
compiled from a template, so edit the source, never this output file. To change it, run
`sous repo contribute quality/build-and-check-speed`.

- Source Path: {{ sousTemplatePath }}
