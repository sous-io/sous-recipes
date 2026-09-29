---
name: delegate
description: Hand work to background agents, and keep the conversation going while they do it.
argument-hint: "[what to delegate]"
disable-model-invocation: true
---

# Delegate This to Background Agents

The user wants work handed to background agents, so the conversation can keep going while it is done.

What to delegate: $ARGUMENTS

@~communication/control-flow/_partials/arguments-or-context.md

@~workflow/sub-agent-delegation/_partials/delegation-brief.md

## Dispatch

1. Split the work into independent parts when that makes it faster; do not split a small job.
2. Keep in this session any part that needs much of the conversation, and anything one command
   answers.
3. Give each part the right tier and a self-contained prompt, then dispatch them all at once, in the
   background. The user's request is the approval: parts that change files go out at once too.
4. Sub-agents NEVER post, send or publish anything outside the project unless the user already
   approved that exact text. The full rule is the always-loaded "Drafting and Outward-Facing
   Actions" memory of the `communication/agent-conduct` recipe.

Then tell the user what went out, and hand the conversation back. The dispatch message NEVER asks
the user anything; settle a doubt with a guess, and list it under the guesses in the report.

```text
Delegating the three checks we listed for the Sunday export failures; 3 agents are working
in the background:

1. Read the export job's logs for the last 8 Sundays and summarize the errors.
2. Compare the staging and production cron files.
3. Find every change to src/export/ in the last 60 days.

I'll report once all three are back. Go ahead with whatever's next.
```

@~communication/agent-conduct/_partials/reporting-back.md

## Source for this Skill

This skill comes from the `communication/control-flow` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
