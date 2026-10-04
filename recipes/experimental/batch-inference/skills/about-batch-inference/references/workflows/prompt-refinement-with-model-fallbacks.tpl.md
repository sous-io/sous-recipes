# Workflow: Prompt Refinement With Model Fallbacks

> **EXPERIMENTAL.** This workflow comes from one experiment: a yes/no decision about a few
> thousand short text items, judged by four models against 35 answers from one person. Treat its
> numbers as one data point, not as rules.

This workflow turns a large decision task into a chain of models, each with a prompt refined for
it, that settles most items automatically and sends the rest to a person. It has two parts: refine
a prompt for each model, then run the items through the chain from the cheapest model to the most
expensive.

Terms used throughout:

- **Item:** one thing to decide about, such as one support ticket.
- **Decision:** the question asked about every item, with a fixed set of answers. This workflow
  uses yes/no decisions; one yes/no question per model call is the simplest form to score.
- **Confidence:** a number from 0 to 100 the model returns with each answer. A classifier model
  that returns probabilities gives it directly.
- **Threshold:** the confidence below which an answer counts as **unsure**. This experiment used 75.
- **Answer key:** items a person has decided, used to score prompts.
- **Held-out set:** a second group of person-decided items that no prompt is ever tuned on, used
  only to check finished prompts.
- **Confident mistake:** a wrong answer at or above the threshold. It is the worst outcome,
  because nothing downstream checks it. An unsure answer is not a mistake; it costs one more call
  further up the chain.

## Part 1: Refine the Prompts

### 1. Define the decision and the output

Write the decision as one question with a yes/no answer, and ask the models for nothing but
`{ "decision": true|false, "confidence": 0-100 }` per item. Do not ask for reasoning, a list of
findings or a rewrite of the item: they cost output tokens and nobody reads them. If a later step
needs more (for example, a summary of the item for the team it goes to), make that a separate job
for the items that need it.

### 2. Build the answer key and the held-out set

The person decides two samples of items drawn at random from the real data:

- **Answer key:** 20 items is enough to start. Tuning runs against it.
- **Held-out set:** at least 15 more. Check its balance: if most items have the same answer, a
  model that always gives that answer scores well on it, so make sure the minority answer has
  several items.

Make deciding fast. Show the person one item at a time, and wherever the decision can be shown as
two short contrasting examples (one where the answer is yes, one where it is no), show those
instead of explaining in prose. People judge examples much faster than descriptions.

Record the person's words on every hard case, verbatim. Their reasoning on borderline items
becomes the most valuable part of the prompts: the **tie-breakers** that decide close cases. A
person may also change an answer after seeing what a model said; record both the old and the new
answer.

### 3. Write a brief for the tuning agents

Tuning is done by sub-agents at the main session's tier, one per model, running in parallel. They
start with fresh context, so everything they need goes in one brief file:

- what the items are, what the decision is for, and how it will be used;
- the scoring rules and the threshold;
- the definition the prompts use, and every tie-breaker with the person's own words;
- the rules in step 5;
- how to run the evaluation scripts, and which folders each agent may write to, so parallel
  agents never touch each other's files.

### 4. Give the models context

A bare item and a one-line question score badly. In this experiment a classifier model given only
the item and "does this cover more than one topic?" treated it like a grammar exercise. The
request needs:

- what the items are and where they came from;
- what the decision is for and what happens to each answer;
- the definition and the tie-breakers;
- small fields of metadata about each item that a script can attach, such as its source's title.

### 5. Rules that keep the results honest

Every tuning agent follows these. Breaking one makes its score meaningless.

1. **Never use an answer-key item, or a near copy of one, as an example in a prompt.** Examples
   are made up. In this experiment a prompt scored 10 of 10 on its tuning set partly because one
   example nearly copied a test item, then managed 3 confident answers out of 10 on new items. The
   first tie-breaker examples, taken from items the person had decided, leaked the same way.
2. **Never inflate confidence.** Do not tell a model to be more confident or to avoid low
   numbers. Asking for an honest probability is fine. This wording worked and was approved by the
   person: "If you give 4 answers at 75, expect one of them to be wrong. Give your honest answer; a
   higher confidence is not necessarily better. Lower your confidence only for questions these
   steps don't answer; an objection a step already settles is not doubt."
3. **Never read or use the held-out set** while tuning.
4. **Tune only on the assigned items.**
5. **Keep everything.** Every prompt version, run and result is kept, never overwritten.
6. **Added evidence must be computed by code** from data that already exists. Never write extra
   context by hand or with a model; that costs more than the decision it supports.

### 6. Run the tuning rounds

Each round, every agent tunes its own model's prompt for a fixed number of iterations (5 in the
first rounds, 3 later). One iteration is one prompt version evaluated on the answer key. Each
version runs 3 times with the response cache bypassed and is judged by its worst run: the same
prompt moved answers by up to 10 confidence points between runs, and a single good run misled
several agents. Between iterations the agent studies the unsure and wrong items and changes the
reasoning in the prompt, never wording aimed at one item.

At the end of a round each agent writes what it learned. The orchestrating agent merges the
lessons into one file, and the next round starts from each model's best version plus the merged
lessons.

The rounds this experiment ran:

1. Each model alone on half the answer key.
2. The same, with the merged lessons from round 1.
3. One shared prompt for all models. It worked for some models and hurt others, so the plan
   changed to one prompt per model: each model in a fallback chain only needs its own prompt.
4. Each model on the whole answer key.
5. Token trimming (step 8).
6. A final check on the held-out set.

### 7. Lessons that held across models

- **Fix conflicts between instructions instead of adding instructions.** Unsure answers came
  mostly from two instructions pulling opposite ways. Every added rule lowered confidence on some
  item it was not written for.
- **Order the rules and say which one wins.** A flat list of tie-breakers let them fight; numbered
  steps with explicit overrides got every model leaning the right way.
- **Avoid tests that almost anything passes.** A test of the form "could the parts of this item be
  handled separately?" is true of nearly every multi-part item, so it fought the other rules.
- **Define rules by the reasoning behind them, not by surface words.** A rule triggered by "names
  a specific tool or place" caught items that merely mentioned their own location. Saying what
  each rule does not cover raised those items by 10 to 20 points.
- **Say what the model cannot know.** Some decisions depend on facts outside the item. Stating the
  assumption ("treat any account the item names as already verified") settled items that no
  wording of the rules could.
- **Define what the confidence number means.** "How likely the person would agree, applying these
  rules" worked better than "lower it when the item could be read either way", which invited doubt
  on every multi-part item.
- **Ask a classifier model a direct question.** Asking whether an item needs more than one follow-up,
  instead of asking it to count the topics in it, raised one classifier's score from 4 to 7 right out of 10.
- **Examples need a one-line reason** so the model matches the principle, not the wording.
- **Fewer, longer examples beat many short ones**, and extra examples spread doubt to items nobody
  touched.

### 8. Trim tokens

Once a prompt is good, try removing what does not earn its tokens, with the same scoring and
quality bar. In this experiment:

- Dropping metadata fields the model did not use saved 11 to 12 percent of input tokens for two
  models with no loss, and slightly improved one.
- Cutting or merging prompt sentences failed for every model: each cut moved a few answers below
  the threshold. Wording that looks redundant often settles one kind of item.

### 9. Check on the held-out set

Run every model's final prompt on the held-out set, 3 times. Expect it to do worse than on the
answer key: about a third of answers fell below the threshold on new items. Look at every
confident mistake. In this experiment almost all of them came from two items, one of which the
person had predicted would be hard because it needed outside knowledge.

After this check the held-out set has been seen. Before tuning further, the person decides a fresh
held-out set.

## Part 2: The Fallback Chain

Order the models from cheapest to most expensive. Each step receives the items the steps before it
did not settle:

1. The first step, usually a classifier model, answers every item. Keep only the answers its
   acceptance rule allows, and send the rest on.
2. Each later step answers the items it receives. Keep its confident answers, and send the unsure
   ones on.
3. Items still unsettled after the last model go to a person.

The acceptance rule can differ by step. In this experiment the first step's confident "no" was
accepted but its confident "yes" was not, because a "yes" item needed a writing model for its next
job anyway. Accept an answer only on the side where that model's confident mistakes are rare.

Before running the chain on the real items, replay it on the held-out answers already recorded
(the scripts include a replay tool). It shows, for each chain order, how many items each step
settles, how many end up right, wrong or with the person, and what it costs. In this experiment:

```text
Chain (per 15 held-out items, mean of 3 runs)   Right   Wrong   To person
Classifier, then mid-size model                  10.0     0.7     4.3
Classifier, then large model                     10.3     0.7     4.0
Classifier, mid-size, large                      10.3     1.3     3.3
Large model alone                                 9.3     0.7     5.0
```

Each extra model settles a few more items but brings its own confident mistakes, so a longer chain
trades items left for the person against items decided wrongly. Putting the classifier first cut
every chain's cost by about 40 percent.

Run the chain on the real items one step at a time, saving each step's settled items and the items
it passed on, so a step can be rerun without repeating the steps before it. Pause after the last
model and review the totals with the person before anything goes to them: how many items each step
settled, the cost, and how many are left.

How far the error rate can be pushed down depends on the effort, but in general, the more time
spent refining the prompts, the lower the error rate.

## Example: Planning a Run

A fictional team needs to tag 40,000 support tickets as "about billing" or not.

```text
1. Decision: "Is this ticket about billing?" Output: decision, confidence.
2. A support lead decides 20 tickets (answer key) and 20 more (held-out set, 6 of them billing).
3. Brief written: what tickets are, why they are tagged, the lead's tie-breakers in their words
   ("a refund question is billing; a question about a plan's features is not").
4. Three agents tune prompts in parallel, one each for a classifier, a mid-size and a large model.
5. Two rounds, merged lessons, token trimming, held-out check.
6. Chain replayed on the held-out answers; the lead picks: classifier (confident "no" only), then
   the mid-size model, then the large model.
7. Chain run on 40,000 tickets; totals reviewed with the lead before the remaining tickets go to
   the support team.
```
