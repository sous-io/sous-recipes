---
name: about-goals
description: >
  YOU MUST load this skill when creating, amending, reviewing or closing a goal (an issue labeled
  `goal`), when picking up or creating an issue that may contribute to or conflict with a goal, or
  when an issue being worked blocks an issue labeled `goal`.
user-invocable: false
license: Apache-2.0
compatibility:
  - claude
  - codex
metadata:
  version: 1.0.0
  tags: [github, projects, issues, goals, project-management]
---

A **goal** is a larger outcome that a collection of ordinary issues works toward. It is itself a
GitHub issue in `{{ githubRepo }}`, and it exists so that everything in the tracker keeps flowing
toward every known goal rather than drifting away from one unnoticed.

The agent executing any GitHub command here MUST also load `about-github-projects`; it covers the
CLI, board operations and the delegation rules this skill builds on.

## What a Goal Is, and Is Not

- **A goal does not own its members.** Its members are ordinary, granular issues that stay
  scoped to themselves and workable on their own terms. A goal gathers the issues that are
  prerequisites for it; it never turns them into its parts.
- **Membership is many-to-many.** One issue may contribute to several goals at once. That is the
  difference from an epic or a sub-issue parent, which GitHub limits to one per issue; never use
  sub-issues to express goal membership.
- **Closing every member does not meet a goal.** Members may deliberately stop short of the
  goal. Whatever no member covers is a gap, closed by a **bridge** issue created for that
  purpose, which then becomes a member like any other.
- **A goal influences its members without binding them.** Each member must not work against any
  goal it belongs to, and is designed with those goals in mind; it is not obliged to fulfill
  them.

## How a Goal Is Recorded

| Fact | Where it lives |
|------|----------------|
| This issue is a goal | The `goal` label. This is the fact agents check. |
| Display name | A title prefixed `[Goal] `. Display only; a missing prefix is cosmetic drift. |
| Membership | The goal is **blocked by** each member (a native GitHub dependency). |
| Order among members | A member is blocked by another member, only where one is a real prerequisite of the other. A preferred order is not a dependency. |
| Why a member is shaped as it is | A `## Goal Notes` section at the end of the member's body: one bullet per design choice a goal caused, each citing the goal as `#<goal>`. |

Never copy a goal's text into a member. A mention that only says "part of #60" duplicates the
dependency and adds nothing; a mention that explains a design choice ("loading stays
config-driven so #60 can rewrite it") is the member's own reasoning and belongs there.

Issue types are deliberately not used: they exist only for organizations, and a goal must work
the same way on a personal account's repository.

## The Goal Body

Every goal body has these sections, in this order:

1. **Opening line**: the goal, stated as an outcome in one or two sentences.
2. **`## Criteria`**, split in two:
   - **`### Coverage`**: what some issue must deliver before the goal is met. Each item names
     the issue or issues that cover it (`#48`), or says plainly that it is a gap.
   - **`### Constraints`**: what no issue may violate, whether or not it is a member. These are
     what a conflict sweep checks every open issue against.

   A constraint belongs in a goal only when the goal's own work could plausibly break it. A
   rule that holds across the whole project (its trust model, its writing standards, its CLI
   conventions) is not restated in a goal just because the goal's work touches that area;
   restating it makes every goal carry every rule, and makes each sweep audit the whole
   project instead of the goal.

   Scope comes from the user. An item the agent thought of (a feature, a mechanism, a third
   goal) is offered as a suggestion and enters the draft only once the user agrees; it is never
   written in as though the user had asked for it.
3. **`## Accepted Tensions`** (only when there are any): each conflict the user reviewed and
   chose to live with, with the issue and one sentence on the decision. Reviews never raise a
   recorded tension again unless something about it has changed.

The body carries no member list beyond the coverage map (the dependencies are the list), no
restated member summaries (GitHub renders `#48` live), and no history.

## Conflict Checks

Two checks keep issues and goals aligned. Both report findings to the user, who decides; an
agent never resolves a conflict on its own.

**The full sweep** runs whenever a goal is created or amended. It reads:

- **Every open issue**, classifying each as contributing (a candidate member, and which
  coverage items it serves), conflicting (which constraint or coverage item it threatens, and
  why), or unrelated.
- **Every other open goal**, looking for criteria that pull against this goal's criteria.

- **The code and the documentation**, looking for a constraint that is already violated today.
  A constraint the code already breaks becomes a coverage item (something must fix it) or an
  accepted tension; it never stays a constraint that is silently false.

Every sweep is given the same brief, [The Sweep Brief](references/sweep.md), which fixes what the
sub-agent is told and the order its report comes back in. Judging a conflict is substantive work,
so the sweep runs on Opus; on a large backlog, split the open issues into batches across
parallel sub-agents.

When several goals are drafted in one session, each goal's sweep treats the other drafts as open
goals. Settle first the goal that depends least on the others' decisions.

### Turning Findings into Decisions

A sweep returns a lot, and almost all of it follows from what the user already said.

Report what the code or an issue *does* as a fact, and a judgment about it as a judgment. Call
something a bug or a violation only when a rule the project states says so, and name that rule;
otherwise say what happens and ask whether it is a problem. A problem found outside the goal's
scope becomes an issue *for consideration*: it describes the current behavior, why it might
matter and why it might not, and the options, and it asks for a decision rather than presuming
one. Never hand
the user the whole list. Instead:

1. **Sort every finding into two piles.** A *consequence* follows from the goal as stated or from
   a decision already made: an obvious member, an edge an issue's own text declares, an
   amendment that only stops an issue from contradicting the goal, a stale name in an issue. A
   *judgment call* is a real choice between outcomes the user could reasonably want: changing
   what the goal promises, a conflict with no clear winner, sequencing that trades one piece of
   work against another, anything that narrows or widens scope.
2. **Apply the consequences yourself.** Do not ask about them. List them briefly in the final
   report so the user can object after the fact.
3. **Ask the judgment calls one at a time**, one question per message, and wait for the answer
   before asking the next. Keep it to the few that matter; if there are more than about five,
   the goal is probably too broad, and saying so is the first question.
4. **Ask each question in plain language.** Say what happens today, why it matters, the options
   with what each one costs, and your recommendation. Name a file, function or setting only
   after saying what it is. The user should never need to open the code to answer.

Settle judgment calls in this order, because later ones depend on earlier ones: the goal's
wording, then members and order, then gaps, then conflicts.

A dependency loop between members almost always means a prerequisite that has no issue yet (a
design record both sides wait on, for example). Propose it as a bridge that blocks both, rather
than choosing a direction for the loop.

**The light check** runs when an issue is created or picked up: that one issue against every
open goal it blocks, and, for a new issue, against every open goal. It asks the same two
questions (does it contribute, does it conflict) and is cheap enough to run inline.

For each conflict, present the facts and the options, then wait for the user's decision:

- amend the issue so it no longer conflicts,
- amend the goal,
- close the issue,
- move the problem out of the goal into a separate issue of its own, which the goal then lists
  under Accepted Tensions,
- or accept the tension knowingly, recorded under Accepted Tensions.

A constraint that the code or a decided-elsewhere issue already breaks is worded so it stays
true ("no *new* answer source outside the ladder"), with the existing breach under Accepted
Tensions pointing at where it is decided.

## Picking Up a Member

When work starts on an issue, list the goals it blocks (see Commands below). For each open one,
read its body and confirm the issue's current design still honors every constraint and does not
undercut its coverage items. A goal may have changed since the issue was shaped, so this runs on
every pickup, not only the first. Report any conflict to the user before starting work.

## Closing a Goal

A goal is never closed automatically, and never just because its members closed. When every
coverage item appears met, an agent proposes closing it, showing how each item was met. Only
with the user's consent does it close the goal, with a comment that summarizes that evidence.

Agents keep goals tidy as they go: a closed-as-not-planned member that left a coverage item
uncovered, a missing prefix or label, or a dependency that no longer matches the coverage map
are all worth raising when noticed.

## The Board

A goal is added to the board like any issue, but it does not move through the Status flow; it
is not work anyone picks up. Leave its Status empty. A board view filtered with `label:goal`
shows the goals, and `-label:goal` keeps them out of the working views. Views are created by
hand in the GitHub web interface; there is no command for them.

## Commands

**Ensure the label exists** (once per repository):
```bash
gh label list --repo {{ githubRepo }} --search goal --json name -q '.[].name' | grep -qx goal \
  || gh label create goal --repo {{ githubRepo }} --color 5319E7 \
       --description "A larger outcome that other issues work toward"
```

**List the open goals:**
```bash
gh issue list --repo {{ githubRepo }} --label goal --state open --limit 100 \
  --json number,title,url
```

**Read a goal's members:**
```bash
gh issue view 60 --repo {{ githubRepo }} --json title,body,blockedBy
```

**List the goals an issue belongs to** (what it blocks, narrowed to open goals):
```bash
comm -12 \
  <(gh issue view 47 --repo {{ githubRepo }} --json blocking -q '.blocking.nodes[].number' | sort) \
  <(gh issue list --repo {{ githubRepo }} --label goal --state open --limit 100 \
      --json number -q '.[].number' | sort)
```

**Create a goal with its members** (heredoc pattern from `about-github-projects`):
```bash
cat <<'MD' | gh issue create --repo {{ githubRepo }} \
  --title "[Goal] A short name" --label goal --blocked-by 48,9,49 --body-file -
The goal, as an outcome.

## Criteria

### Coverage
- The first thing that must exist (#48)
- Something no member covers yet: **gap**

### Constraints
- What no issue may violate.
MD
```

**Add or remove members, or an order between members:**
```bash
gh issue edit 60 --repo {{ githubRepo }} --add-blocked-by 50 --remove-blocked-by 53
gh issue edit 9 --repo {{ githubRepo }} --add-blocked-by 48
```

## Source for this Skill

This skill was compiled from a template and the output file should not be edited directly.

- Source Path: {{ sousTemplatePath }}
