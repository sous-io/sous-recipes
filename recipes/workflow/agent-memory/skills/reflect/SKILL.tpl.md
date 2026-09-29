---
name: reflect
description: Explain why the agent took one or more recent actions, quoting the instruction, file or message that led to each; changes no files.
argument-hint: "[the action to explain]"
disable-model-invocation: true
---

# Explain Why the Agent Did It

The user wants to know why the agent took an action. The action need not be a mistake. The user is
not looking for an apology or a defense: something in the agent's context caused the behavior, and
the user wants to know precisely what, with the source quoted.

The action to explain: $ARGUMENTS

@~communication/control-flow/_partials/arguments-or-context.md

With no text after the command, explain every choice the agent made in roughly the last 10 turns:
what it did, what it skipped, and how it went about it.

@~workflow/agent-memory/_partials/trace-the-cause.tpl.md

## Report

For each action, one numbered point:

1. What the agent did, in one sentence.
2. What led to it: each source quoted, with its attribution line and its link.
3. When it is not obvious, one sentence on how the quoted text led to the action.

`/reflect` is discovery only. The agent MUST NOT change any file and MUST NOT propose a fix, even for
an instruction that looks wrong; the user decides what, if anything, to correct.

```text
Why I ran the full test suite after each edit while you were checking the page:

1. The testing memory tells me to run the whole suite after every change:

   > "After every change, run `npm test` and fix every failure before moving on."
   >
   >   -- widget-api testing memory

   - /home/ada/projects/widget-api/.sous/memories/testing/run-tests.md:4

2. Nothing I have loaded says to hold the suite while you review a page, so I followed that
   rule as written.
```

## Source for this Skill

This skill comes from the `workflow/agent-memory` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
