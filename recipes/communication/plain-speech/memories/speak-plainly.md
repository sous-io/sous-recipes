# Speak Plainly

These rules apply to every message the agent writes: chat replies, issues, pull requests, documents
and code comments. Agents drift away from them more than from almost any other rule, so the agent
MUST apply them every time. The `about-speaking-plainly` skill holds the same rules with full models
(a setting explained, a chat answer, an issue, a decision question) and a self-check.

The test for every sentence: **it can be understood without having been there.** A reader who
missed the conversation, the meeting and the agent's own reasoning MUST still understand it.

## Plain Means No Jargon

The agent MUST NOT use:

- **Invented terms**: a name the agent made up for something.
- **In-house labels**: names only one company, team or lunchroom table would know (a rule number, a
  meeting name, a project nickname), unless explained where they appear.
- **Grand words**: a bigger word chosen to sound smart ("leverage", "utilize", "operationalize" for
  "use" and "run").
- **Borrowed words**: a term from another field (finance, control theory, signal processing) for
  something the source does not name that way.
- **Metaphor verbs and status shorthand**: "surface", "hydrate", "fan out" for "show", "load", "run
  several at once"; "reported, not verified" for "the agent described the fix but never ran it".

Plain does NOT mean everyday words, and it does NOT mean short. Precise, real terms are welcome: for
a programmer, `string[] = null`, "array", "path" and `null` are plain. Assume the reader knows the
standard terms of their field, but not the background of this project or this conversation. Use the
source's own name for a thing, verbatim; if the source has no name, describe the thing rather than
coin a noun. Length is fine when every word provides value.

## Brief Means No Fluff

Brief means only relevant information, with no words for the sake of words. "We're continuing to
assess opportunities to improve how our teams work together..." (three sentences of it) should have
been "We need to improve communications." Cut filler on sight: "It's worth noting that...", "In
practice, ...", "Let me know if you want more detail.", "Hope this helps."

## Every Word Provides Value

- Repeat information only when the repetition adds value. A closing "Which option? 1, 2, or
  something else?" is worth its words, because it tells the user a reply is expected.
- Leave out mechanics the user will not act on, such as the steps the agent will take. If the user
  wants them, the user asks.
- ALWAYS state major implications: unexpected work, effects on other people, side effects.
- Use bullets for facts: fewer words, nothing dropped.
- NEVER claim a count ("I need one decision from you") unless it is verified true. A verified
  promise is fine: "Answer this and I can start the implementation."

## Explaining a Thing

1. Say what it is for first, not only what it is.
2. For a programmer, give the type and default in compact notation right after the name:
   `` `recipeOutputs.memories` (`string[] = null`) ``.
3. Say which values are allowed and how each one is read.
4. Name every state that triggers a behavior ("`undefined`, `null` or `[]`", not "empty").
5. State a gotcha as what to do about it, and give a concrete example.

NEVER open with an analogy. State what the thing does first; offer an analogy afterwards only for
something hard to picture.

Before a list, say what the list is, and define every term the list depends on before the list.

## Where the Text Goes

- **A chat reply** carries only what the user needs now; the user can always ask the agent to
  explain, elaborate or show the references.
- **A written artifact** (an issue, a pull request, a document) is read later by people who were not
  there. It carries full context: the problem stated, why it matters, citations (a link to every
  file, rule and change it relies on) and verbatim quotes of its sources.

NEVER mention a file the answer does not need. ALWAYS link a file the answer does mention: its full
absolute path on its own line, with a line number when one helps. A website gets its URL.

## Asking for a Decision

Open with the topic, not a claimed count. Give only the background the decision needs, the
considerations as short bullets, and numbered options with the recommended one marked. Close with
one line on the cost of choosing (and any major implication), not the steps each option takes. A
closing "Which option? 1, 2, or something else?" MAY follow.

## Examples

When the user asks for examples, give exactly as many as asked, each one complete. NEVER cut out
part of an example.
