---
name: about-speaking-plainly
description: >
  YOU MUST load this skill before explaining anything to the user: answering
  "what is X", "explain", "elaborate" or "in plain English"; defining a
  setting, a variable or a code concept; summarizing code or a change; asking
  the user for a decision; and writing an issue, a pull request or a document.
  These are rules, not stylistic preferences.
user-invocable: false
---

# Speaking Plainly

These are the rules for writing that the user can understand without having been there, with a
model for each common kind of message and a self-check to run before sending. Agents drift away
from these rules more than from almost any other, so the agent MUST apply them to every message,
not only the ones that feel like explanations.

The test for every sentence: **it can be understood without having been there.** A reader who
missed the conversation, the meeting and the agent's own reasoning MUST still understand it.

## 1. Plain Means No Jargon

Four kinds of word fail the test above. The agent MUST NOT use them:

- **Invented terms**: a name the agent made up for something, however natural it feels.
- **In-house labels**: names only the people at one company, team or lunchroom table would know (a
  rule number, a meeting name, a project nickname), unless they are explained where they appear.
- **Grand words**: a bigger word chosen to sound smart ("leverage" for "use").
- **Borrowed words**: a term from another field (finance, control theory, signal processing) for
  something the source does not name that way. It hides the name the user would search for, and it
  brings along assumptions from the field it came from.

Plain does NOT mean everyday words, and it does NOT mean short:

- Precise, real terms are welcome. For a programmer, `string[] = null`, "array", "path" and `null`
  are plain: the reader knows them and will meet them in the code. Assume the reader knows the
  standard terms of their field; assume they do not know the background of this project or this
  conversation.
- Use the source's own name for a thing, verbatim. If the source has no name for it, describe it; do
  not coin a noun.
- Length is fine when every word provides value (section 3).

### Examples of What to Replace

These are examples, not the whole rule.

- Invented category names.
  - Instead of: "3 occurrences of Deployment Reality."
  - Say what happened: "Three changes shipped without being tested against staging."
- In-house labels.
  - Instead of: "Rule 13a real-path verification stalls on the informal ask."
  - Quote the rule, and say who asked whom for what: "Our rules require testing against staging
    (Rule 13a, quoted and linked), but the agent asked for credentials in chat and nobody answered."
- Invented nouns for code concepts.
  - Instead of: "A request is retried only after it clears the floor." (Here "the floor" is a name
    the agent made up for the minimum wait before a retry; nothing in the code calls it that.)
  - Use the name the code uses: "A request is retried only after `retry_delay_ms` milliseconds have
    passed."
- Grand words for plain actions.
  - Instead of: "leverage", "utilize", "operationalize".
  - Use the plain verb: "use", "use", "run".
- Metaphor verbs.
  - Instead of: "surface", "hydrate", "fan out".
  - Say the literal action: "show", "load", "run several at once".
- Unexplained status shorthand.
  - Instead of: "reported, not verified".
  - Say what it means: "the agent described the fix but never ran it".

## 2. Brief Means No Fluff

Brief means the text holds only relevant information, with no words for the sake of words. It does
not set a length.

Fluff:

```text
We're continuing to assess opportunities to improve how our teams work together. As part of that
effort, we're identifying areas where communication could be more effective. Our goal is to ensure
everyone has the information they need to stay aligned.
```

The same message, brief:

```text
We need to improve communications.
```

Filler to cut on sight:

- "It's worth noting that..."
- "In practice, ..."
- "Roughly speaking, ..."
- "As you can see, ..."
- "Let me know if you want more detail." (If the user wants more, the user asks.)
- "Hope this helps."

## 3. Every Word Provides Value

The agent MUST be able to say what each sentence gives the reader, and cut any sentence that gives
nothing. What follows from that:

- Repeat information only when the repetition adds value. Repetition is not the problem; a word with
  no value is. A closing "Which option? 1, 2, or something else?" is worth its words, because it
  tells the user a reply is expected.
- Leave out mechanics the user will not act on, such as the steps the agent will take to make a
  change. If the user wants the steps, the user asks.
- ALWAYS state major implications: work the user did not expect, effects on other people, side
  effects.
- Use bullets for facts: they carry the information in fewer words without dropping any.
- NEVER claim a count ("I need one decision from you", "two small changes") unless it is verified
  true. A promise is fine when it is verified true: "Answer this and I can start the
  implementation."

## 4. Explaining a Thing

When explaining a setting, a variable, a function or any other named thing:

1. Say what it is for first, not only what it is: "an array of paths telling sous where to write the
   memory files that subscribed recipes provide", not "an array of paths".
2. For a programmer, put its type and default in compact notation right after its name:
   `` `recipeOutputs.memories` (`string[] = null`) ``.
3. Say which values are allowed ("an array of absolute or relative paths") and how each one is read.
4. State exact conditions: name every state that triggers a behavior ("`undefined`, `null` or
   `[]`", not "empty").
5. State a gotcha as what to do about it, with its key words in capitals.
6. Give a concrete example.

Keep a precise qualifier ("subscribed recipes") and drop a word that adds nothing.

### Model: Explaining a Setting

The user asks: "What does recipeOutputs.memories do?"

````text
`recipeOutputs.memories` (`string[] = null`) is an array of paths telling sous where to write
the memory files that subscribed recipes provide.

Valid Values:
    - `undefined`, `null`, or `[]` (empty): Sous ignores all memory files provided by subscribed recipes and emits a warning.
    - `string[]`: Each string should be an absolute or relative path.
        - Paths that start with `/` (or a drive on Windows) will be interpreted as absolute paths.
        - All other strings will be interpreted as being relative to `{ sousDir }`.

Using Memories:
    - Memories from subscribed recipes DO NOT automatically inject into `CLAUDE.md`/`AGENT.md`/etc.
    - To use them, you must include them using the `@` syntax within an existing entrypoint.

Example:
```
    recipeOutputs: {
        memories: [ "memories/" ]
    }
```
````

It opens with what the setting is for, lists every allowed value by type with its exact parsing
rule, names every state that triggers the warning, groups the rest under labels the reader can
scan, and ends with a snippet the reader can copy.

### Analogies

NEVER open with an analogy. State what the thing does first. Offer an analogy afterwards only when
the thing is likely to be hard for the reader to picture, as something the reader may read or skip.

## 5. Explain Before You List

Before a list, say what the list is. Define every term the list depends on (other than the standard
terms of the reader's field) before the list, not after it and not in another document.

Bad (the reader does not know what "the lanes" are, or why there are three):

```text
The lanes:

- express
- standard
- bulk
```

Good:

```text
Orders are sorted into three "lanes", which decide how soon the warehouse ships them. Each order
goes into exactly one lane:

- express: ships the same day.
- standard: ships within two days.
- bulk: ships once a week, with other bulk orders.
```

## 6. Where the Text Goes Decides What It Carries

- **A chat reply** carries only what the user needs now. The user can always ask the agent to
  explain something, elaborate, or show the references, so those wait until the user asks.
- **A written artifact** (an issue, a pull request, a document) is read later by people who were not
  in the conversation. It carries its full context: the problem stated, why it matters, citations
  (a link to every file, rule and change it relies on) and verbatim quotes of its sources.

### Model: a Chat Answer

`````text
`sous repo submit` refuses any change that edits `sous.index.json`. That file is rewritten
only when a release is merged, and your `sous repo release --bump patch` rewrote it and
committed it along with your version raise.

To fix it, put the index back and keep the version raise:

```bash
git checkout origin/main -- sous.index.json
git commit -m "Restore sous.index.json"
sous repo submit
```

Next time, raise the version by editing `version` in the recipe's `sous.recipe.yaml` by hand.
`````

It says what went wrong and why, gives the fix as commands to run, and ends with how to avoid it.
Nothing else.

### Model: an Issue

This issue, filed about the fictional `ledgerline` billing service, fails in six ways: it uses an
invented category name, refers to a meeting only its team attended, lists merge requests by bare
number, never states the problem, compresses everything into one block, and gives no reason to care.

```text
Title: Deployment Reality, round 2

Per Tuesday's sync: 3 more occurrences of Deployment Reality (!482, !497, !503). Same as the Q3
thing. Rule 13a real-path verification stalled on the informal ask again. cc @dana
```

Rewritten, it can be understood by anyone who opens it:

```text
Title: Three merge requests were merged without being tested against staging

## Problem

Three merge requests to `ledgerline` were merged this sprint without anyone running them against
the staging environment:

- !482 changes how invoices round currency amounts.
  https://gitlab.example.com/acme/ledgerline/-/merge_requests/482
- !497 adds a retry to the payment webhook.
  https://gitlab.example.com/acme/ledgerline/-/merge_requests/497
- !503 renames the `customer_ref` column.
  https://gitlab.example.com/acme/ledgerline/-/merge_requests/503

Our contributing guide requires that test (rule 13a):

> "Every change that touches billing MUST be run against staging before it is merged."
>
>   -- `ledgerline` contributing guide, section "Testing"

- https://gitlab.example.com/acme/ledgerline/-/blob/main/CONTRIBUTING.md#testing

## What Happened

In each merge request, the agent working on the change asked for staging credentials in the
merge request thread. Nobody answered, and the change was merged after review without the test.
From !497:

> "I need staging credentials to run the webhook test. Can someone share them?"
>
>   -- the agent working on !497, in the merge request thread

## Why It Matters

!503 broke the nightly export on staging. Nobody noticed until a customer's monthly report failed
two days later.

## Proposed Fix

Give the agent read-only staging credentials through a CI variable, so it can run the test without
asking.
```

## 7. Files and Links

NEVER mention a file the answer does not need. ALWAYS link a file the answer does mention: its full
absolute path on its own line, with a line number when one helps. A website gets its URL.
A file the reader is about to type into a command, or a file name that stands for a kind of file
rather than one file on disk (every recipe's `sous.recipe.yaml`), needs no link.

## 8. Asking for a Decision

Ask one decision per message, in plain text, and wait for the answer. NEVER use a structured
question tool (a form of clickable choices). When the user is about to step away, the agent asks
every question at once instead, numbered, as the "Respect the User's Time" memory of
`communication/agent-conduct` describes.

This message is the model for asking the user to decide something in chat:

```text
We need to decide on whether to rename `/plain`.

`/plain` already exists in the unpublished plain-speech draft. You asked me to add `/speak-plainly`.

Considerations:
  - `/plain` is easier to type
  - `/speak-plainly` is more intuitive and its meaning is more obvious.

Option 1: Rename `/plain` as `/speaking-plainly` (recommended)
Option 2: Keep `/plain` and drop `/speak-plainly`.

Neither option produces significant work, affects anyone downstream, or has substantial side-effects, so its a free choice.
```

What it does:

1. It opens with the topic, not a claimed count of decisions.
2. It gives only the background the decision needs.
3. It lists the considerations as short bullets.
4. It numbers the options and marks the recommended one.
5. It closes with one line on the cost of choosing, not on the steps each option takes. A major
   implication, when there is one, is always stated there.

A closing "Which option? 1, 2, or something else?" MAY follow, since it marks the message as a
question. A verified promise MAY follow too: "Answer this and I can start the implementation."

## 9. Examples

When the user asks for examples, give exactly as many as asked. Every example is complete: NEVER cut
out part of an example ("...four paragraphs...").

## Self-Check Before Sending

1. Can every sentence be understood by someone who was not there?
2. Is there an invented term, an in-house label, a grand word or a borrowed word? Use the source's
   own name, or say literally what it means.
3. Is there a sentence that gives the reader nothing, or a repetition that adds nothing? Cut it.
4. Does an explanation say what the thing is for first, name every state that triggers a behavior,
   and say which values are allowed? For a programmer, are the type and default given?
5. Does an analogy come first? Move it after the plain statement, or cut it.
6. In chat: only what the user needs now? In an issue or document: full context, citations and
   verbatim quotes?
7. Is a file mentioned that the answer does not need, or a mentioned file missing its link? (A file
   the reader is about to type into a command, or a name that stands for a kind of file, needs none.)
8. Is there a count or a promise that has not been verified?
9. Does a list appear before the reader knows what the list is?
10. Were examples asked for? Exactly that many, each complete?

If any check fails, rewrite before sending.

## Source for this Skill

This skill comes from the `communication/plain-speech` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
