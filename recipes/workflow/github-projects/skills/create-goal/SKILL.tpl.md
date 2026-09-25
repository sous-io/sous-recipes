---
name: create-goal
description: >
  YOU MUST load this skill when the user wants to create, define or state a new goal; including
  "create a goal", "make this a goal", "turn this into a goal", or naming a larger outcome that
  several issues should work toward.
argument-hint: "[the goal, or an issue to turn into one]"
license: Apache-2.0
compatibility:
  - claude
  - codex
metadata:
  version: 1.0.0
  tags: [github, issues, goals, project-management]
---

Create a goal in `{{ githubRepo }}`. Treat any text after `/create-goal` as the goal to start
from, or as an existing issue to turn into a goal.

Every agent taking part MUST load `about-goals`, which defines what a goal is, how it is
recorded, the goal body, and the conflict checks; the agent executing GitHub commands MUST also
load `about-github-projects`. Creating a goal is a planning session: the steps below are
worked through with the user, and nothing is written to GitHub until step 6.

## Steps

### 1. State the Goal (orchestrator, with the user)

Agree on the outcome in one or two sentences, then draft its criteria: the **coverage** items
some issue must deliver, and the **constraints** no issue may violate. Draft only constraints
the goal's own work could break, and only scope the user asked for; see The Goal Body in
`about-goals`. When turning an existing
issue into a goal, read it first; it may be a list of loosely related work rather than one
goal, and splitting it into several goals is a legitimate answer to raise with the user.
When several goals come out of one session, draft them all before sweeping, so each sweep can
see the others.

### 2. Prepare (delegate)

A sub-agent ensures the `goal` label exists and returns the open goals and the open issues, as
numbers and titles, so the orchestrator can size the sweep.

### 3. Sweep (delegate, Opus)

Run the full sweep from `about-goals`, briefed with its sweep brief
(`about-goals/references/sweep.md`) and the drafted goal verbatim. For several drafted goals, run
one sweep per goal in parallel. Findings come back to the orchestrator.

### 4. Decide (orchestrator, with the user)

Turn the findings into decisions exactly as Turning Findings into Decisions in `about-goals`
describes: apply the consequences, and ask only the judgment calls, one per message. What the
sweep settles, whether by consequence or by the user's answers:

1. **Wording**: the statement and criteria, revised from what the sweep found, including any
   constraint the code already violates.
2. **Members and order**: which issues join, which coverage items each serves, what each needs
   amended (an out-of-date member included), and each real dependency edge. A preferred order
   is not an edge, and a loop means a missing bridge.
3. **Gaps**: for each coverage item nothing serves, a bridge issue, an amendment to an existing
   issue, or narrowing the goal.
4. **Conflicts**: each one, with the options from `about-goals`.

### 5. Draft (orchestrator)

Unless the user has said to skip drafts, draft and present together for approval:

- the goal's title (`[Goal] ` plus a short name) and body, in the structure from `about-goals`,
  with a placeholder where each bridge issue's number will go;
- each bridge issue, shaped per `create-issue`;
- each amended issue's new body, or the exact edit;
- the dependency edges to add.

### 6. Execute (delegate, Opus)

Follow the writing rules under Who Executes What in `about-github-projects` (body files, the
original posted as a comment before a body is replaced, a read-back after every write). Run it
in two phases, because the amendments cite numbers the first phase creates:

1. **One Opus sub-agent**, in this order: creates each bridge issue and each issue split out of
   the goal, on the board with status Backlog per `create-issue` step 5; creates the goal (or,
   when converting an existing issue, posts its original body as a comment, then retitles,
   labels and rewrites it) with the `goal` label and `--blocked-by` every member, on the board
   with no Status; adds each ordering edge; returns every number it created.
2. **Opus sub-agents in parallel**, one per group of related issues: each applies its approved
   amendments as minimal edits (a stale name fixed, a contradicting line removed) plus a
   `## Goal Notes` section at the end, and never touches titles, labels, status or
   dependencies. Each reports exactly what it removed or replaced.

### 7. Finalize (orchestrator)

Share the goal's ticket ID ({{ ticketPrefix }}<number>) and link, its members, the bridges, any
tensions recorded, and the short list of consequences applied without asking.
Read the sub-agents' reports for text left awkward by a removal (a pronoun that lost its
referent, for example) and fix it. If the goal replaced an existing issue that is not the goal itself,
offer to close that issue with a comment pointing at the goal.

## Source for this Skill

This skill was compiled from a template and the output file should not be edited directly.

- Source Path: {{ sousTemplatePath }}
