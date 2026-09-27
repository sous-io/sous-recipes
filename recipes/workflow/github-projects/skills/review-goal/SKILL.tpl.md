---
name: review-goal
description: >
  YOU MUST load this skill when the user asks how a goal is going, wants a goal checked, tidied
  or closed, or asks for an overview of the open goals; including "review goal #60", "is this
  goal done?", "where are we on our goals?".
argument-hint: "[goal number]"
license: Apache-2.0
compatibility:
  - claude
  - codex
metadata:
  version: 1.0.0
  tags: [github, issues, goals, project-management]
---

Review a goal in `{{ githubRepo }}`. Treat any text after `/review-goal` as the goal's number.
A review never changes what a goal asks for; when the user wants that, YOU MUST load
`amend-goal` instead.

Every agent taking part MUST load `about-goals`; the agent executing GitHub commands MUST also
load `about-github-projects`.

## Without a Goal Number

A Sonnet sub-agent lists the open goals and, for each, how many members are closed out of the
total and which coverage items still name a gap. The orchestrator presents that overview and
asks which goal to review, if any.

## Steps

### 1. Gather (delegate, Opus)

A sub-agent reads the goal, every member (state, and whether it closed as completed or as not
planned), and every open issue that is not a member, and returns:

- **Progress**: each coverage item, the members serving it, and whether it now appears met,
  with the evidence.
- **Drift**: members closed as not planned that left a coverage item uncovered; a coverage map
  that names an issue the dependencies do not, or the reverse; a missing `goal` label or
  `[Goal] ` prefix; a member that no longer serves any coverage item.
- **New findings**: open issues outside the goal that contribute or conflict (the full sweep
  from `about-goals`), leaving out anything recorded under Accepted Tensions.

### 2. Report and Propose (orchestrator, with the user)

Present the progress, then the fixes:

- **Tidying** that only restores what the goal already says (a label, a prefix, a dependency the
  coverage map names) is listed once and applied when the user approves the list.
- **Anything that needs judgment** is asked one question at a time, as Turning Findings into
  Decisions in `about-goals` describes.
- **A fix that changes what the goal asks for, or adds a member**, is an amendment: hand it to
  `amend-goal` rather than applying it here.

When every coverage item appears met, propose closing the goal, showing how each item was met.

### 3. Execute (delegate, Opus)

With the user's approval, a sub-agent applies the approved tidying and, if the user consented,
closes the goal with a comment summarizing how each coverage item was met. It returns what it
changed.

## Source for this Skill

This skill was compiled from a template and the output file should not be edited directly.

- Source Path: {{ sousTemplatePath }}
