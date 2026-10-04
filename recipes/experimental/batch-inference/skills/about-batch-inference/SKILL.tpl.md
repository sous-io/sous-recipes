---
name: about-batch-inference
description: >
  YOU MUST load this skill when a task needs the same small judgment made about hundreds or
  thousands of items (classifying, filtering, labeling, matching, yes/no decisions), when the
  user asks about batch inference, model fallback chains or cheaper ways to run many model calls,
  or before sending agents to work through a large pile of items one by one.
user-invocable: false
---

# Batch Inference

> **EXPERIMENTAL.** This skill records what one experiment learned. Its scripts are an unfinished
> sketch; expect to modify them heavily before they work for you.

**Batch inference** means making the same small decision about many items by sending them to model
APIs from a script, instead of having an agent session work through them. A decision is one
question with a fixed set of answers asked about one item, for example "Is this support ticket
about billing?" asked about 40,000 tickets. The script sends each item (or a few dozen at a time)
with a short, fixed prompt, and records each answer with the model's confidence.

Use it when the work is many independent, uniform judgments. Do not use it for work that needs
exploration, tools or a long conversation; that is what agent sessions are for.

## Why It Is Cheaper

- **Small, fresh context.** An API call carries only the prompt and the items. An agent harness
  adds its own system prompt, project instructions, loaded skills and the conversation so far to
  every turn, and an agent reads files and writes reports around each judgment. A scripted call
  can be a hundredth of that size.
- **Batch pricing.** Several providers charge less for asynchronous batch requests (often half
  price) and for cached prompt prefixes.
- **Fallback chains.** Most items are easy. A cheap model, with a prompt tuned for it, settles the
  items it is confident about, and only the rest go to more expensive models, then to a person.
  The expensive models see a small fraction of the items.
- **More models.** API access through a provider or gateway reaches hundreds of models, including
  specialized ones (some only classify and charge only for input), which a chat subscription does
  not.

## How It Works

The method has two parts, described in full in the workflow reference below.

1. **Refine one prompt per model** against a person's answers. The person answers a sample of
   items (the answer key), and a second sample nobody tunes on (the held-out set). Agents rewrite
   each model's prompt over a few rounds, scoring every version by how many answers are right,
   unsure (below a confidence threshold) or confidently wrong, repeated several times because
   answers vary between runs.
2. **Run the fallback chain.** Send every item to the cheapest model and keep only its confident
   answers. Send the rest to the next model, and so on up the chain. Whatever no model settles
   goes to a person.

How far the error rate can be pushed down depends on the effort, but in general, the more time
spent refining the prompts, the lower the error rate.

Example of the numbers a refined chain produces, for 1,000 items (fictional):

```text
Step                 Items sent   Settled   Cost (USD)
Classifier model          1,000       610   0.05
Mid-size model              390       270   0.40
Large model                 120        70   0.35
Person                       50
Checked against the held-out set: about 2 confident mistakes per 100 settled items.
```

## Reference Files

The agent MUST read the workflow reference before planning a batch-inference effort.

- [workflows/prompt-refinement-with-model-fallbacks.md](references/workflows/prompt-refinement-with-model-fallbacks.md):
  the method, step by step: answer keys, tuning rounds, scoring, rules that keep the results
  honest, token trimming and the fallback chain.
- [models/](references/models/): what was learned about individual models, per model and per
  version. Read the file for each model being considered.
- [services/](references/services/): how to reach models through each provider (the Anthropic API,
  AWS Bedrock, DigitalOcean): pricing, data handling and setup.
- [scripts/README.md](scripts/README.md): an unfinished evaluation harness that runs prompt
  versions against an answer key, scores them, compares runs and replays fallback chains.

## Source for this Skill

This skill comes from the `experimental/batch-inference` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
