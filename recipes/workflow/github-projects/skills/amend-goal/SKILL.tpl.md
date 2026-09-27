---
name: amend-goal
description: >
  YOU MUST load this skill when the user wants to change an existing goal; including adding or
  removing a criterion, adding or removing a member issue, rewording the goal, or "amend goal
  #60".
argument-hint: "[goal number] [what changes]"
license: Apache-2.0
compatibility:
  - claude
  - codex
metadata:
  version: 1.0.0
  tags: [github, issues, goals, project-management]
---

Amend a goal in `{{ githubRepo }}`. Treat any text after `/amend-goal` as the goal's number and
the change to make; ask for whichever is missing.

Every agent taking part MUST load `about-goals`; the agent executing GitHub commands MUST also
load `about-github-projects`. An amendment changes what a goal asks for, so it gets the same
care as creating one, applied to the change: nothing is written to GitHub until step 5.

## Steps

### 1. Read the Goal (delegate)

A sub-agent returns the goal's title, body and members (`blockedBy`), each member's state, and
the goal's comments.

### 2. State the Change (orchestrator, with the user)

Agree on exactly what changes: criteria added, removed or reworded; members added or removed;
the goal statement itself. Most amendments are additions, but removals count too.

### 3. Sweep (delegate, Opus)

Run the full sweep from `about-goals`, briefed with its sweep brief
(`about-goals/references/sweep.md`), against the changed criteria only. Pass the whole goal and
the change verbatim. For a removal, the sweep also reports which members still serve some
remaining coverage item, and which issue designs relied on what was removed (look for
`#<goal>` mentions).

### 4. Decide and Draft (orchestrator, with the user)

Turn the findings into decisions as `create-goal` step 4 does (consequences applied, judgment
calls asked one per message), starting with the wording of the change itself, but only for what
the change touches. A member that no longer
serves any coverage item leaves the goal. Tensions already recorded under Accepted Tensions are not raised
again unless the change affects them.

Then, unless the user has said to skip drafts, draft and present together for approval: the goal's new body, any bridge issues, any
amended issues, and the dependency edges to add or remove.

### 5. Execute (delegate, Opus)

Execute in the same two phases as `create-goal` step 6: first the bridge issues, the goal's new
body and its `blocked-by` edges; then the amendments to other issues, in parallel. It returns
everything it changed.

### 6. Finalize (orchestrator)

Summarize what changed about the goal, its members, and any other issue, with links.

## Source for this Skill

This skill was compiled from a template and the output file should not be edited directly.

- Source Path: {{ sousTemplatePath }}
