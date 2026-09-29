---
name: create-reply
description: Draft one or more replies to questions other people asked, quoting each question before answering it.
argument-hint: "[what to reply to, and your answers]"
disable-model-invocation: true
---

# Draft a Reply

The user wants help drafting one or more replies to what other people wrote.

What to reply to, and anything the user already said about the answers: $ARGUMENTS

With no text after the command, take the broadest reasonable reading of roughly the last 10 turns:
here, every message someone sent that still needs a reply. Name what was taken in the first line of
the response, so the user can narrow it.

@~communication/plain-speech/_partials/speak-plainly.md
@~communication/agent-conduct/_partials/quote-sources.md

## 1. Read the Source Itself

Read what is being replied to: pasted text, a link (read it with whatever tool can reach it, without
changing anything), or the recent conversation. If it cannot be reached, ask the user to paste it.
NEVER draft a reply to a paraphrase.

## 2. Find Every Question

Split the source into the questions and comments that need an answer. Keep the source's own numbers
or labels.

## 3. Find the User's Position

Take each answer from the arguments, the conversation, or the project's docs and decision records.
Where the user has not said what they think, draft the position that fits best, and list it after
the draft as the agent's own. A wrong guess costs one correction, since nothing is sent before the
user approves it.

## 4. Write It

@~communication/agent-conduct/_partials/reply-format.md

Use the formatting the destination shows correctly. One draft per destination; several questions to
the same person in the same place go in one draft.

## 5. Show It, and Stop

Put each draft in its own fenced block, so it copies cleanly. After the drafts, number every position
the agent filled in itself. NEVER post, send or comment anything until the user says to; approval
covers only the draft it was given for. The full rule is the always-loaded "Drafting and
Outward-Facing Actions" memory of the `communication/agent-conduct` recipe.

For example, after `/create-reply Marco's question on #88; I want to keep 503 only`:

~~~text
Here is the draft reply to Marco's question on pull request #88 ("Retry failed payment calls").

```markdown
> "Why not retry on every 5xx instead of only 503?"
>
>   -- **Marco Silva** in a review of [#88](https://git.example.com/acme/widget-api/pull/88) (2026-04-02)

I think retrying only on 503 is the safer default.

Rationale:
- A 503 says the server is busy and the request never ran, so sending it again is harmless. A 500 can come after the payment was already taken, and a retry could charge the customer twice.
- The retry setting is per client, so a team that knows its endpoints are safe to repeat can widen it.
```

Positions I filled in (you have not said these; check them before sending):
1. The first rationale bullet is my reasoning, not yours.
2. The second rationale bullet is my reasoning too: the retry setting is per client, set in
   src/http/retry.ts:14.
~~~

## Source for this Skill

This skill comes from the `communication/agent-conduct` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
