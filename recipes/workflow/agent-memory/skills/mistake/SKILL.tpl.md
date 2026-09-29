---
name: mistake
description: The agent just made one or more mistakes; trace each to the instruction that failed or was missing, propose a fix, and make the fixes the user approves.
argument-hint: "[the mistake]"
disable-model-invocation: true
---

# Fix the Instructions Behind a Mistake

Pause the current work. The agent just made one or more mistakes or errors. The user is not looking
for an apology: a mistake the instructions allowed will happen again, in this session or someone
else's, until the instructions change. Find what failed, and fix it now.

The mistake: $ARGUMENTS

@~communication/control-flow/_partials/arguments-or-context.md

With text after the command, look only at the mistake it names. Other mistakes the agent notices go,
one line each, under "Instruction Improvements" at the end of the reply. With no text, look at
roughly the last 10 turns and take every mistake in them, including ones the user did not point out.

@~communication/agent-conduct/_partials/rulings-and-provenance.tpl.md

## 1. Name Each Mistake

List each mistake, and quote what the user said about it, word for word. Without arguments, a
mistake is also: a command or tool call that failed, anything the user corrected, a wrong
assumption, work that took far more steps or time than it should have, and a tool call the user
interrupted.

## 2. Trace Each One

@~workflow/agent-memory/_partials/trace-the-cause.tpl.md

Then name the kind of cause:

- **Missing**: no memory or skill covers it.
- **Badly worded**: an instruction covers it, but its words allow the mistake.
- **Under-emphasized**: the instruction is right, but buried or worded too softly to be followed.
- **Trigger failed**: the skill that covers it never loaded. Compare its `description` with the
  user's words; check that `disable-model-invocation: true` is not hiding it, that its frontmatter
  parses, and that no other skill's description claims the request more strongly.
- **Conflict**: two instructions disagree, and the agent followed the wrong one.
- **Wrong**: the instruction itself says to do the wrong thing.

## 3. Propose the Smallest Fix

@~workflow/agent-memory/_partials/improve-the-instructions.tpl.md

Show each fix in full, with its source path. Weigh what sous offers, not only rewording:

- a memory (always loaded), a skill (loaded for one kind of work), or a partial (repeated in the
  commands that need it); a rule agents keep breaking MAY go in more than one;
- a better skill `description`, when the skill did not load;
- a fix in the shared recipe's repository (`sous repo contribute <recipe>` starts one), so every
  project that installs the recipe gets it;
- a recipe variable, when the right behavior differs by project;
- a script or a hook that makes the mistake impossible.

```text
The mistake, and a fix for it. Nothing is changed yet.

1. I ran the full test suite after each edit while you were checking the page.

   You said:

   > "stop running the whole suite, I'm just looking at the page"

   Cause: under-emphasized. The rule exists, but it is the last of eight points, and I read
   "hold ... full test suites" as being about commits:

   > "Keep a live review loop fast. While the user reviews changes on a hot-reloading server,
   > make the edits and check only the changed files; hold commits, pushes and full test
   > suites until the user signs off, then run them once."
   >
   >   -- `team/conduct` recipe, "Interaction Style" memory

   - /home/ada/.sous/repos/example/team-recipes/recipes/team/conduct/memories/interaction-style.md:19

   Fix: this rule comes from the shared `team/conduct` recipe, so the fix goes in its
   repository. Make it the first point, and reword it:

   > "Live review: while the user checks changes on a running server, run NO test suite,
   > commit or push until the user signs off. Check only the changed files."

Should I make this fix? Yes, no, or a change to it?
```

## 4. Ask, Then Wait

The agent MUST ALWAYS ask the user to approve the fixes before it makes any of them, and MUST NOT
change any file until the user approves, changes or drops each one. This holds even for an
instruction that is plainly wrong.

## 5. Apply, Then Resume

@~workflow/sub-agent-delegation/_partials/delegation-brief.tpl.md

Hand the approved fixes to a background agent, with the exact new wording and each source path. It
edits the tracked sources and runs `sous build` (unless `sous build --watch` is running). Check that
each built instruction file carries its change, list what changed with links, and return to the
paused work.

```text
The fix is made and built.

1. The live-review rule is now the first point, reworded, on branch `ada/live-review-rule` of
   team-recipes.
   - /home/ada/.sous/repos/example/team-recipes/recipes/team/conduct/memories/interaction-style.md:3

Back to the checkout page.
```

## Source for this Skill

This skill comes from the `workflow/agent-memory` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
