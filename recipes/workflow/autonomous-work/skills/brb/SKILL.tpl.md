---
name: brb
description: The user is stepping away for a short time; work through the to-do list without them, then report.
argument-hint: "[how long, or what to focus on]"
disable-model-invocation: true
---

# Back Soon

How long, or what to focus on: $ARGUMENTS

The user expects to be away for a short time. Work around blockers that hold up a lot of work; for
a small one, move on to the next item and list it for the user, who will be back soon.

@~workflow/autonomous-work/_partials/work-while-away.md

## Source for this Skill

This skill comes from the `workflow/autonomous-work` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
