EXPERIMENTAL: this code is an unfinished sketch from one experiment. Expect to modify it heavily before it works for you.

# Batch inference evaluation harness

These scripts test prompts for a yes/no decision task across several models and score the answers
against a human answer key. They were written for one experiment and generalized afterwards; they
have not been used in their generic form beyond the offline checks described at the end. Read the
code before you rely on it.

What the harness does:

- Sends each item to every model a spec lists: Anthropic models through the Messages API (several
  items per request, structured output with a plain-JSON fallback) and TypeSafe AI's Jev through
  DigitalOcean's System One API (one item per request, one yes/no question).
- Caches every response by the hash of its request, so a repeated request is free.
- Can repeat every request to measure how stable a model's answers are.
- Scores each answer as right, unsure or wrong against the answer key, at a confidence threshold.
- Writes everything a run did into its own directory, with Markdown tables.
- Compares runs side by side (`compare.ts`).
- Replays recorded answers through fallback chains of models, to estimate what a chain would
  settle, get wrong, leave for a human and cost (`simulate-chain.ts`).

## Requirements

- Node 22.18 or newer, which strips TypeScript types natively. There are no npm packages to
  install; the scripts use only `node:` built-ins and `fetch`. The `package.json` here only marks the
  files as ES modules.
- Credentials, read from the environment only:
  - `ANTHROPIC_API_KEY` for Anthropic models;
  - `DO_MODEL_ACCESS_KEY` for Jev (a DigitalOcean model access key).

  A dry run needs neither, and neither is needed when every answer comes from the cache.

## Files

| File | Purpose |
|---|---|
| `run.ts` | Runs one spec. |
| `compare.ts` | Combines several runs into one scores table and one item table. |
| `simulate-chain.ts` | Replays recorded answers through fallback chains. |
| `lib/spec.ts` | Spec format and validation. |
| `lib/data.ts` | Items, answer key, context fields, prompt templates, item selection. |
| `lib/cache.ts`, `lib/files.ts` | Response cache, cost log, atomic writes. |
| `lib/report.ts` | Verdicts, tallies and Markdown tables. |
| `providers/anthropic.ts`, `providers/jev.ts` | API clients, with list prices. |
| `tasks/` | Task registry; `decision.ts` is the yes/no task. |
| `examples/` | A fictional spec: is a support ticket about billing? |

## Data

**Items** are a JSONL file, one object per line: `{ "id", "text", ...context fields }`. `id` and
`text` are required; every other property is a context field a spec can choose to send. An optional
`group` (a string) splits the scores per group and keeps batches within one group; items without
one are in group `all`.

```json
{"id": "t-001", "text": "I was charged twice for my March invoice.", "channel": "email", "plan": "team", "group": "tuning"}
```

**The answer key** is a JSONL file of `{ "id", "answer": true|false, "note"? }`. An item without an
entry is scored "no key". Two entries for one id that disagree stop the run.

**Notices in data files.** JSON and JSONL cannot hold comments. The loaders skip a JSONL line whose
only key is `_experimental`, and they accept an `_experimental` key at the top of a spec and of a Jev
prompt file, so the example files carry the experimental notice that way. The files a run writes
carry no notice.

## Write a spec

A spec is one JSON file, the only input of a run. Unknown keys are refused, so a typo never falls
back to a default silently. The example `examples/billing-tickets.json`:

```json
{
  "_experimental": "EXPERIMENTAL: ...",
  "name": "billing-tickets",
  "task": "decision",
  "notes": "Fictional example: is each support ticket about billing?",
  "models": [
    "jev",
    "claude-sonnet-5-5",
    { "model": "claude-opus-5-5", "context": [] }
  ],
  "prompts": { "anthropic": "billing.md", "jev": "billing-jev.json" },
  "prompts_dir": "prompts",
  "context": ["channel", { "name": "customer_plan", "path": "plan", "default": "unknown" }],
  "with_confidence": true,
  "threshold": 0.75,
  "batch_size": 4,
  "max_tokens": 2048,
  "items": { "file": "items.jsonl" },
  "answer_key": { "file": "answer-key.jsonl" },
  "concurrency": 4
}
```

| Key | Meaning | Default |
|---|---|---|
| `name` | Names the run directory. Lower-case letters, digits, `.`, `_`, `-`. | required |
| `task` | Task module from `tasks/` (today `decision`). | required |
| `notes` | Free text, copied into the run's `table.md`. | none |
| `models` | Model names or model entries (below). `"jev"` is Jev; a name starting with `claude-` is an Anthropic model. | required |
| `prompts.anthropic` | Prompt template for Anthropic models, relative to the prompts directory. | none |
| `prompts.jev` | Jev prompt file, relative to the prompts directory. | none |
| `context` | Item fields sent beside each item's text, in this order. `[]` sends none. | `[]` |
| `with_confidence` | Ask Anthropic models for a 0 to 100 confidence. Without it, every answer counts as confident. | `true` |
| `threshold` | Answers below this confidence (0 to 1) are "unsure". | `0.75` |
| `batch_size` | Items per request for Anthropic models. | `10` |
| `max_tokens` | `max_tokens` for Anthropic models. | `4096` |
| `items` | Which items to run (below). | required |
| `answer_key.file` | The answer key file. | none (everything is "no key") |
| `prompts_dir` | Where prompt files are looked up. | the spec's directory |
| `cache_dir` | The shared response cache. | `eval-data/cache` in the current directory |
| `output_dir` | Where run directories go. | `eval-data/runs` in the current directory |
| `concurrency` | Requests in flight at once, across all models of the run. | `4` |
| `repeats` | How many times each request is sent. Above 1 needs `"cache": "bypass"`. | `1` |
| `cache` | `"use"` reads and writes the cache; `"bypass"` neither reads nor writes it. | `"use"` |

**Paths.** Paths in a spec (`items.file`, `answer_key.file`, `prompts_dir`, `cache_dir`,
`output_dir`) resolve against the spec file's directory. Command-line flags override them and resolve
against the current directory: `--items`, `--answer-key`, `--prompts-dir`, `--cache-dir`,
`--output-dir`. The defaults for `cache_dir` and `output_dir` resolve against the current directory.

**Item selection.** `items` takes `file` (the items file) and any of these filters, applied in this
order: `ids` (these items, in this order; otherwise every item in file order), `groups` (only these
groups), `only_keyed` or `exclude_keyed` (only items with, or without, an answer key entry), and
`sample: { "n": 20, "seed": 7 }` (a seeded random sample of what is left; the same seed gives the
same items).

**Model entries.** A model can be an object instead of a name, to override shared settings for it:
`model`, `label`, `prompt`, `context`, `with_confidence`, `threshold`, `batch_size`, `max_tokens`,
and for Jev `decision_question` (the noul question whose probability is the answer; default
`decision`) and `jev_model` (default `typesafe-jev-1.13.0`). The label names the model's results
file and table column; it defaults to the model name. To run one model with two prompts, list it
twice; the labels then get the prompt added (`claude-opus-5-5@billing-v2`), or set `label` yourself.

**Context fields.** A string names an item property (a dotted path reaches into nested objects) and
sends it under that name; `{ "name", "path", "default" }` sends the value at `path` under `name`,
with `default` when the item lacks it. They go into a `context` object beside the item's text.

## Prompts

- **Anthropic templates** are text files that become the system prompt. The user message is
  `Items:` followed by a JSON array of `{ "id", "text", "context"? }`. The model returns
  `{ "results": [{ "id", "decision": true|false, "confidence": 0-100 }] }`, asked for with a JSON
  Schema (structured output). If the API refuses the schema, the client appends it to the system
  prompt and asks for plain JSON instead.

  Template syntax: `{{! comment }}` is dropped (with its line break), `{{#if with_confidence}}...{{/if}}`
  keeps its text only when the flag is on, `{{#unless with_confidence}}...{{/unless}}` only when it
  is off; blocks may nest. The file's final newline is not part of the prompt.
- **Jev prompt files** are JSON: `state` (fields Jev sees, such as a task description and examples)
  and `questions`, which must include a `noul` question named by `decision_question`. The item's
  text is added to the state as `item`, and its context fields as `context`. Jev's probability of
  "yes" decides: at least 0.5 is `true`, and the confidence is the larger of p and 1 minus p.

Treat prompt files as versioned: never change one a run has used; add a new file instead, so every
earlier run stays reproducible and the cache stays meaningful.

## Run a spec

```sh
node run.ts examples/billing-tickets.json
node run.ts --dry-run examples/billing-tickets.json
node run.ts --output-dir /tmp/eval-runs --cache-dir /tmp/eval-cache path/to/spec.json
```

`--dry-run` resolves the spec, builds every request and writes the run directory up to
`requests.jsonl` (with each request's cache key), then reports per model how many requests there are
and how many are already in the cache. It calls no API and needs no credentials.

Each run gets `<output dir>/<spec name>/<run id>/`, where the run id is a UTC timestamp plus a random
suffix, and the directory is created exclusively, so any number of runs (even of the same spec) can
go at once without sharing a file.

| File | Holds |
|---|---|
| `spec.json` | The spec exactly as given. |
| `resolved.json` | The spec with defaults filled in: paths, model plans, the selected items. |
| `requests.jsonl` | Every request, fully resolved, with its cache key. |
| `responses.jsonl` | Every response: raw reply, usage, cost, cache key, cached flag, timing, error. |
| `results/<label>.jsonl` | One line per item: the item, answer, confidence, verdict, the key's answer, usage, cost, cached flag. |
| `scores.json` | Right, unsure, wrong, no key and errors, per model and per group, plus totals. |
| `table.md` | A scores table and an item table (each item's text, the key's answer, each model's answer, confidence and verdict mark). |
| `cost.jsonl` | One line per paid call of this run (also appended to `<output dir>/cost-log.jsonl`). |
| `run.json` | Status, timings, totals and environment (Node version, host, process). |

**Scoring.** An answer at or above the threshold is `right` or `wrong` against the answer key; below
it, `unsure` (neither, though `correct` in the results still records which way it leaned). An item
without a key entry is `no-key`; an item without an answer is `error`.

**Cost.** List prices sit in `providers/anthropic.ts` (`PRICES`) and `providers/jev.ts`; check them
against the providers' current price lists. A cached answer costs 0 in the run, while its list cost
is still recorded so later analysis (for example the chain simulation) can price it. A model without
a known price records its tokens and a null cost, never 0, and totals that include it show "unknown".

**Cache.** Responses are stored under `<cache dir>/anthropic/` and `<cache dir>/jev/`, one file per
request, named by the sha256 of the request. Entries are written to a temporary file and renamed into
place, so parallel runs never see a partial entry; an unreadable entry counts as a miss. Changing any
byte of a request (prompt, context, schema, model, max tokens) gives a new key.

## Repeats

```json
{ "repeats": 3, "cache": "bypass" }
```

sends every request three times, unchanged, and never reads the cache. Bypassed answers are not
written to the cache either, so they never replace an entry other runs rely on; they are kept only in
the run directory, and their costs are logged with `"cache": "bypass"`. Each repeat is scored under
its own label, `<label>.r1`, `<label>.r2` and so on. `scores.json` gains `repeats`: per model, the
score of each repeat, the mean, the worst repeat (fewest right, then most wrong), how many items every
repeat answered the same way, and each item's answers. `table.md` gains a Repeats section with the
items the repeats disagree on. `"cache": "bypass"` with `repeats` 1 gives one fresh answer.

## Compare runs

```sh
node compare.ts <run dir> <run dir>...
node compare.ts --out comparison.md <run dir> <run dir>
```

Prints one scores table and one item table across the runs, and writes them to
`<output dir>/_comparisons/<UTC stamp>-<random>.md` (the output directory of the first run) or to
`--out`. A comparison never overwrites a file.

## Simulate a fallback chain

A cheap model can settle the easy items and pass the rest on: for example, accept the first model's
answer only when it is a confident `false`, accept any confident answer from the second model, and
leave the rest for a human. `simulate-chain.ts` replays the answers recorded in run directories to
show what such a chain would do, without calling any API.

```sh
node simulate-chain.ts \
  --chain "jev:false,claude-sonnet-5-5" \
  --chain "jev:false,claude-sonnet-5-5,claude-opus-5-5" \
  --chain "claude-opus-5-5:any@0.9" \
  --scale 1000 \
  <run dir>...
```

A chain is a comma-separated list of steps, each `<label>[:<rule>[@<threshold>]]`:

- `label`: a model label in one of the run directories (for a run with repeats, the base label,
  without `.r1`). When two runs have the same label, write `<run id>/<label>`.
- `rule`: `any` (the default) accepts a confident answer either way; `true` accepts only a confident
  `true`; `false` accepts only a confident `false`.
- `threshold`: the confidence (0 to 1) an answer needs to count as confident here; by default, the
  threshold the run recorded. It is written only after a rule, because labels may contain `@`.

Each item goes to the first step. An answer the step accepts settles the item; anything else (an
answer the rule does not accept, an unsure answer, an error, a missing answer) goes to the next step.
After the last step, the item is left for a human. The items are those the first step's model
answered.

The report gives, per chain, how many items were settled right, settled wrong, settled without a key
entry and left for a human, and the cost; and, per step, how many items reached it, how many it
settled, and how many of those were right or wrong. With repeats, each repeat is simulated on its own
(repeat k of every model together) and the figures are means; a model with fewer repeats than another
in the chain cycles through its own. Cost is each item's share of its request at list price (cached
or not), summed over every step the item reached; a step with an unknown price adds "unknown".
`--scale <n>` adds the cost extrapolated to n items, and `--out <file.md>` also writes the report.

Treat the cost of later steps as an estimate: a real chain would send a later model only the items
that reach it, in different batches, so its requests (and their shared prompt tokens) differ from the
recorded ones. With a small item set, a difference of one item between chains is noise.

## Add a task

Write `tasks/<name>.ts` implementing `Task` from `tasks/types.ts` (how to build the Anthropic request
and the Jev state, how to read the answers, what an answer key entry means) and register it in
`tasks/index.ts`. Scoring, batching, caching and reports are shared.

## Running several experiments at once

- Give every experiment its own spec `name`, so its runs land in their own directories; prompt files
  and specs a run has used are never edited, only added.
- The only shared state is the response cache (atomic writes) and the shared cost log (one whole line
  per write). Two runs that miss the cache on the same request both pay for it once.
- Keep `concurrency` modest (4 or so per run) when several runs go at once; the clients retry on rate
  limits and server errors.
- Keep a held-out set of items (for example a `holdout` group) that nobody tunes prompts on, and run
  it only to judge finished prompts, so its score stays an honest measure.

## What was checked, and what is rough

Checked offline only: the example spec with `--dry-run`; a full run answered entirely from a cache
seeded with made-up responses; `compare.ts` and `simulate-chain.ts` on that run and on a hand-made
run directory with repeats; spec validation; the structured-output fallback and retry against a
mocked `fetch`. Never run against the live APIs in this form.

Rough edges:

- The model list is narrow: `jev`, or names starting with `claude-`. Another provider needs a client
  in `providers/` and a branch in `lib/spec.ts` and `run.ts`.
- Prices are a hand-kept table and go stale.
- Jev's response format (`answers.<question>.noul`) is taken from one API version.
- Errors surface as Node stack traces.
- There are no automated tests.
