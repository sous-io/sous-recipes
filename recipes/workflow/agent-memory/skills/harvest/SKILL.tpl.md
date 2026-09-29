---
name: harvest
description: Scan the session for what went wrong, what was learned and what was wasted, and propose changes to the memories, skills and scripts so similar work goes faster and cheaper next time; writes only what the user approves.
argument-hint: "[topic to focus on]"
disable-model-invocation: true
---

# Harvest the Session

The user wants the session scanned for what it taught: what went wrong, what was learned, and what
was wasted. Each finding becomes a proposed change to the instructions (memories, skills, partials,
recipes, scripts), so that similar work goes faster, costs fewer tokens and makes fewer mistakes next
time. Nothing is written until the user approves it.

Topic to focus on: $ARGUMENTS

@~communication/control-flow/_partials/arguments-or-context.md

For this command, a bare `/harvest` covers the whole session, not only the last 10 turns. With a
topic ("how we used sub-agents", "the database work"), look only at what concerns it. Scan this
session only; records of earlier sessions (task files, session summaries) are not read for findings.

@~communication/agent-conduct/_partials/rulings-and-provenance.tpl.md

Load `about-agent-memory`, `about-agent-skills` and `about-sous` before planning, and
`about-liquid-templates` before writing any `.tpl.` file.

## Where Sources Live

Compiled memories and skills are build output; edit only their sources.

- **Memories:** `{{ memoryRoot }}/`
- **This project's own skills:** the directory the `about-sous` skill names for them.
- **Skills and memories from a subscribed recipe:** the recipe's repository, so every project that
  installs the recipe gets the change. `sous repo contribute <recipe>` starts a change there; never
  edit the compiled copy.

## Phase 1: Scan

The main session MUST do this itself, because background agents cannot see the conversation.

Scan for:

1. **Mistakes:** errors, wrong assumptions, dead ends, and what fixed them.
2. **Corrections from the user:** "no, do it this way", "don't do X".
3. **Discoveries:** gotchas, undocumented behavior, surprising responses.
4. **Workflow insights:** steps that worked, ordering that matters, tools that helped.
5. **User preferences:** how the user likes to work, communicate or structure things.
6. **Project facts:** decisions, constraints, deadlines.
7. **External references:** URLs, dashboards, system names, where information lives.
8. **Patterns established:** conventions adopted during the session.
9. **Waste:** steps repeated, files read more than once, long outputs nobody needed, work the main
   session did that a background agent could have done, time the user spent waiting.
10. **Work a script could do:** anything collected or repeated by hand that a small script would do
    without spending tokens.
11. **Costly instructions:** loaded in every session but rarely needed, duplicated, stale or wrong.
    Removing an instruction is a valid finding.

Several findings of one kind often share one cause: say what they share, and propose fixing the
cause.

Summarize each finding in one sentence that a future agent with no memory of this session would
understand, with its kind. Quote the user's words where a finding rests on them. Do not ask about the
findings yet: they are shown in Phase 3, together with the plan for each, so the user answers once.
If the session produced nothing worth keeping, say so and stop; NEVER invent findings.

## Phase 2: Survey What Exists

@~workflow/sub-agent-delegation/_partials/delegation-brief.tpl.md

Reading every memory and skill in the main session is expensive, so background agents do it in
parallel:

- one reads the memory files under `{{ memoryRoot }}/` and reports which topics each covers, with
  its path;
- one reads the compiled skills (the directories under `recipeOutputs.skills`, `.claude/skills` by
  default) and reports what each covers, which have a `references/` or `scripts/` directory, and each
  one's source path from its "Source for this Skill" footer.

Then classify each finding as one or more of: update a memory, create a memory, update a skill,
add a reference file to a skill, create a skill, add a script, move or remove an instruction, or no
action (already covered, or derivable from the code or git history).

## Phase 3: Present the Findings and the Plan

@~workflow/agent-memory/_partials/improve-the-instructions.tpl.md

Weigh what sous offers, not only rewording:

- a memory (always loaded), a skill (loaded for one kind of work), or a partial (repeated in the
  commands that need it); a rule agents keep breaking MAY go in more than one;
- a better skill `description`, when a skill that covers the work did not load;
- a fix in the shared recipe's repository, so every project that installs the recipe gets it;
- a recipe variable, when the right behavior differs by project;
- a script, a hook or a template tag that does the work, instead of words that describe it.

Ask once. Present every finding, numbered, with its kind and the plan for it right under it: each
action it needs, naming each target file and what changes in it (the current text quoted, and the
new text in full). A finding that needs no action says why. Mark any finding the agent is unsure is
already covered, and let the user decide. Then ask which to make; the user approves findings and
their plans together, in one answer.

```text
Findings from the whole session, each with what I'd change. Nothing is changed yet.

1. [mistake] The deploy step needs the branch ID returned by the create call, not the
   default branch ID.
   No action: the deploy skill already says so; I skipped that line this time.
2. [correction] Related changes go in one bundled pull request. You said:

   > "put the schema change and the migration in the same PR"

   Update a memory: one new line in the pull request memory.
   Proposed: "Related changes, such as a schema change and its migration, go in one pull
   request."
   - /home/ada/projects/widget-api/.sous/memories/pull-requests.md
3. [waste] I read the 900-line schema file four times to find table names.
   Add a script that prints the table names, and point the database skill at it.
   Proposed: "To list the tables, run `scripts/tables.sh`; never read the schema file for them."
   - /home/ada/projects/widget-api/.sous/skills/about-database/scripts/tables.sh
   - /home/ada/projects/widget-api/.sous/skills/about-database/SKILL.tpl.md
4. [costly instruction] The 40-line deploy checklist loads in every session, and we
   deployed once this month.
   Move it from a memory into a new skill that loads only when deploying; remove the memory.
   - /home/ada/projects/widget-api/.sous/memories/deploy-checklist.md
   - /home/ada/projects/widget-api/.sous/skills/deploy/SKILL.tpl.md
5. [discovery] The payment sandbox resets every night at 02:00 UTC.
   Update a skill: one new line in the payments skill.
   Proposed: "The payment sandbox resets every night at 02:00 UTC; recreate test data after it."
   - /home/ada/projects/widget-api/.sous/skills/about-payments/SKILL.tpl.md

Which should I make? The numbers ("2, 3, 4"), "all", "all except 5", or "none".
```

The agent MUST NOT change any file until the user approves the plan; the user may change it first.

## Phase 4: Apply and Report

Hand the approved changes to background agents, one per target file or group, each with the exact
change and its source path. Each loads `about-agent-memory`, `about-agent-skills` and
`about-liquid-templates` itself, and follows them: memories are plain Markdown fragments with no
frontmatter, one topic per file; skills follow `about-agent-skills` (frontmatter, naming, the source
footer). One of them runs `sous build`, unless `sous build --watch` is running.

Afterwards, run `git status` in each repository touched to confirm that only the intended files
changed, and check that each built instruction file carries its change.

@~communication/agent-conduct/_partials/reporting-back.tpl.md

```text
Made 2, 3 and 4, and rebuilt. Skipped 5, as you asked.

2. The pull request memory says related changes go in one pull request.
   - /home/ada/projects/widget-api/.sous/memories/pull-requests.md:9
3. New script that prints the table names, and the database skill points at it.
   - /home/ada/projects/widget-api/.sous/skills/about-database/scripts/tables.sh
   - /home/ada/projects/widget-api/.sous/skills/about-database/SKILL.tpl.md:22
4. The deploy checklist is now a skill; the memory is gone.
   - /home/ada/projects/widget-api/.sous/skills/deploy/SKILL.tpl.md
```

## Source for this Skill

This skill comes from the `workflow/agent-memory` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
