---
name: plan-auto
description: Prepare for autonomous work (/afk or /brb) in depth; settle the scope, research, run the blocker checks, and ask the user everything only they can answer, in one message.
argument-hint: "[the work to prepare for]"
disable-model-invocation: true
---

# Prepare for Autonomous Work

What to prepare for: $ARGUMENTS

The user wants to hand the agent a stretch of work to do alone, with `/afk` (a long absence) or
`/brb` (a short one), and wants every blocker cleared first, while they are still here to help. A
blocker is anything that stops the work without the user: a question only they can answer, a
missing permission, an undecided choice. `/afk` and `/brb` run only a quick check before the user
leaves; this is the thorough version, so take the time it needs.

@~communication/control-flow/_partials/arguments-or-context.md

@~communication/agent-conduct/_partials/respect-the-users-time.md

@~workflow/autonomous-work/_partials/questions-worth-asking.md

## 1. Settle the Work

Work out exactly what the autonomous stretch covers, and what it does not: the to-do list, the task
file's remaining work, the agreed next steps. With nothing written after the command, cover all the
work the last 10 or so turns leave unfinished. Decide the scope now, so nothing new turns up while
the user is away.

## 2. Look Before Asking

@~workflow/sub-agent-delegation/_partials/delegation-brief.md

Research with background agents in parallel: the code, docs, tickets and history the work touches.
Every question the research answers is one the user is not asked.

Run each command the work will need once, when it is safe: read-only, or local and easy to undo. A
command that stops at a permission prompt now costs the user seconds; while they are away, it can
stop the whole run. For a command that is not safe to try (a database migration, a long download,
anything outward), check whether it is already allowed, and ask when it is not.

## 3. Run Every Blocker Check

Run every check in this list now, while the user is here. A failed check is either something the
agent fixes itself or a question for step 5. A blocker found in steps 2 to 4 that no check covers
gets a new check, added as the list says.

@~workflow/autonomous-work/_partials/blocker-checks.md

## 4. Find What Only the User Can Settle

@~workflow/autonomous-work/_partials/working-around-blockers.md

Anything those techniques get past is not a question. Beyond the blocker checks, look for:

- decisions nobody has made, where a wrong guess would waste real work;
- permissions the work needs, so no permission prompt stops it;
- access the agent cannot get alone: accounts, credentials, services, machines;
- outward actions the work will take (a push, a pull request, a comment);
- steps outside the agent's reach: a physical action, another person's answer, a paid service.

Each outward action follows the project's setting for it, in the always-loaded "Outward Actions"
memory; when that memory is not loaded, every one is `on-request`. For each outward action the work
needs whose setting is `on-request`, ask whether it may be taken while the user is away. A yes is
up-front approval, good for the whole autonomous stretch, whatever the setting. Actions set to
`autonomous-modes-only` or `always` need no question.

## 5. Ask Once

Put every question in one message, numbered. Give each a title, only the background it needs, short
"Considerations" bullets, numbered options with the recommended one marked, and one line on what the
choice costs. Say what is pushed or hard to undo. NEVER claim how many questions there are. Items of
low to middling impact are not asked; they become guesses in the plan. The user may answer "all
recommended except 2", or type `/walk` to go through the questions one at a time.

The last question is ALWAYS what happens after the answers, even when it is the only one: start
`/afk` or `/brb` the moment the user answers, or wait for the user to start it.

```text
I read the task file, the retry code and the open tickets, and ran the test suite once. The
blocker checks passed except one: `npm run build` and `git push` are not allowed yet. These
need your input before you go.

1. Permissions for the build and the push

The work runs `npm run build` and `git push` to `feature/retry-queue`. Neither is allowed today,
so each would stop the work at a permission prompt.

Considerations:
  - Without them, the work stops at the first build.
  - This project's settings leave pushes to you; allowing it now approves it for this run only.
  - The push reaches only your own feature branch.

Option 1: Allow both now, in Claude Code's `/permissions` (recommended)
Option 2: Allow the build; I leave the push for you.

Option 2 costs you one push when you are back.

2. What happens to a job that fails 10 times

The queue needs a rule for jobs that keep failing, and the rule shapes the database table.

Considerations:
  - Parking keeps the job's data for a person to look at.
  - Deleting keeps the table small, but the job's data is gone for good.

Option 1: Park it (recommended)
Option 2: Delete it.

Changing this later means a table migration, so it is worth deciding now.

3. After you answer

Considerations:
  - You said you are leaving for the night.
  - Waiting means nothing starts until you are back.

Option 1: I start /afk the moment you answer (recommended)
Option 2: I start /brb the moment you answer.
Option 3: I wait for you to start it.

Nothing here is pushed anywhere except the branch in item 1, and only if you allow it. Which
options? Reply "all recommended", or name the ones to change.
```

## 6. Record and Present the Plan

Record the answers in the task file, when the project keeps one, so a long session cannot lose
them. Then present the plan: the work in order, what runs in parallel, the guesses the agent will
make, the risks that remain, and what is out of scope. When the user chose to start at once, start
`/afk` or `/brb` right after the plan, without waiting; otherwise end by asking whether to start it
now.

```text
Ready for autonomous work. Your answers are saved in the task file.
- /home/ada/projects/widget-api/.tasks/feature-retry-queue.md

The work, in order (items 2 and 3 run in parallel)
1. Retry queue and its worker.
2. Back-off, up to 60 seconds between tries.
3. Parking for jobs that fail 10 times.
4. Push to `feature/retry-queue` (you allowed it).

Guesses I'll make
1. Queue names follow the existing `jobs:<name>` pattern.

Risks that remain
1. The staging database may be down; if so, I'll test against recorded responses.

Out of scope: the per-provider limit (WID-212, "Retries hammer the payment provider").

Starting /afk now, as you chose.
```

## Source for this Skill

This skill comes from the `workflow/autonomous-work` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
