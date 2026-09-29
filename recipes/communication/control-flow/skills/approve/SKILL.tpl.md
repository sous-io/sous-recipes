---
name: approve
description: Approve the current plan and instruct Claude to proceed with maximum parallelism.
disable-model-invocation: true
---

Your plan looks good, and I approve.

While executing the plan, maximize parallelism:
- Delegate the steps that have any complexity to background sub-agents, per the sub-agent
  delegation pattern, batching independent
  dispatches into one message.
- Batch independent investigations (searches, file reads, greps, listings) into concurrent tool
  calls whenever practical.
- Keep dependent steps sequential (especially edits, formatting/linting, and tests that rely on
  prior changes).

Use the best-fit tools for the job. If you can't parallelize a step, say why briefly and proceed
sequentially.

## Source for this Skill

This skill comes from the `communication/control-flow` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
