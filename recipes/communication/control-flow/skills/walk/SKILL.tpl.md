---
name: walk
description: Go through everything that still needs the user's input, or a named topic, one item at a time, waiting for the user to move on between items.
argument-hint: "[what to walk through]"
disable-model-invocation: true
---

# Walk Through It, One Item at a Time

The user wants to go through something one item at a time instead of reading it all at once.

What to walk through: $ARGUMENTS

@~communication/control-flow/_partials/arguments-or-context.md
@~communication/plain-speech/_partials/speak-plainly.md
@~communication/agent-conduct/_partials/respect-the-users-time.md
@~communication/agent-conduct/_partials/quote-sources.md

## Build the List

With nothing named above, the material is everything in roughly the last 10 turns that still needs
the user's attention or input, whoever raised it.

Break the material into items. Each item is roughly one question the user needs to answer; split an
item that holds two questions. Name the items 1, 2, 3, and so on; when the items already carry their
own numbers (task files named `0300-...`, for example), use those numbers as the names. Show the
whole list first, names and titles only, and say that the walk waits for "Next" (or a reply that is
only an option number) after each item.
In the same casual sentence or the next, state the walk's action policy (see "Discussion or
Action"):

```text
We'll walk through 5 items. I'll wait for "Next" after each one; a reply that's only an
option number also moves us on. We're just discussing
these; I won't change anything unless you tell me to, now or, more likely, once we've
been through every item.

1. How do we want to store secrets?
2. Who can read the production logs?
3. Do we keep the nightly backup job?
4. What happens to accounts that have not logged in for a year?
5. Which regions do we deploy to?
```

## Discussion or Action

A state-changing action is anything that changes something outside the conversation: editing a
file, committing, pushing, posting a comment, opening an issue. A background agent is a separate
agent session started to do a piece of work while the conversation carries on.

- By default, the walk is discussion only, like `/opine`. The agent MUST NOT take a state-changing
  action during it.
- Research and reads are allowed. Dispatch research to a background agent the moment the need
  appears, and keep the walk going.
- In a discussion-only walk, act after the last item, or earlier only when the user explicitly says
  to act now.
- The user MAY ask for actions after each item, or after each item and each sub-item. Then act
  through background agents as each one is answered, so the walk keeps moving, and report each
  result briefly when it arrives.
- Under a policy that acts after each item (or sub-item), every time the agent asks or reminds the
  user to say "Next", it MUST also say what action it will take, or start, before the next item is
  shown. Name the concrete action, not a generic "actions".
- If the user changes the policy mid-walk, say so in one line and follow the new policy. What
  happens to the items already answered depends on the user's words:
  - When the user limits the change to later items ("from now on", "from here on" or similar), only
    items answered after the change are acted on as they come; the items already answered keep
    waiting for the end of the walk.
  - Otherwise ("let's act after each item", with no such limit), act now on every item already
    answered too, then on each later one as it comes.

  The rule, in the user's words:

  > "If I explicitly indicate that act should only apply "from now on", then do as I say. I mean,
  > that's pretty direct. If I don't explicitly say "from now on" or "from here on" or similar,
  > like if I say "let's act after each item", then the default is to act on all previously
  > answered items."
  >
  >   -- **The user** in an agent session walking an overnight report (2026-09-29)

Other policy lines for the opening list:

```text
As we finish each item, I'll hand it to a background agent to carry out, so we can keep going.
```

```text
I'll act on each item and each sub-item as we finish it, through background agents.
```

A policy change mid-walk, limited by the user to later items ("from here on, act after each
item"):

```text
Got it: from here on, I'll act on each item through a background agent as we finish it.
Items 1 and 2 are still waiting for the end of the walk.
```

A policy change mid-walk with no such limit ("let's act after each item"):

```text
Got it: I'll act on each item through a background agent as we finish it, starting now
with the two you've already answered. One agent is moving the three secrets into the
hosting provider's secrets service (item 1), and another is limiting the production logs
to the on-call engineer (item 2).
```

## Present One Item

- One item per message.
- Title: `Item <name> - <question> (<position>/<total>)`.
- Explain what the user needs to consider in plain English, assuming the user does not know the
  background, and give only the background the decision needs. At most 3 paragraphs or 12
  sentences; aim for 2 paragraphs or 8 sentences.
- Considerations and technical details MAY follow as short bullets, without jargon.
- When there are reasonable options, number them, mark the recommended one, close with one line
  on what the choice costs, and ask "Which option? 1, 2, 3, or something else?"
- NEVER use a structured question tool (in Claude Code, `AskUserQuestion`); the user answers in
  their own words.

```text
Item 1 - How do we want to store secrets? (1/5)

The app needs three secrets to run: the database password, the payment provider's key and
the email service's key. They sit in a plain text file on the server, so anyone who can log
in to the server can read them, and nobody would notice if they were copied. We need one
place to keep them where access is limited and every read is recorded.

Considerations:
- The hosting provider's secrets service costs about $0.40 per secret per month.
- A self-hosted secrets server costs nothing to license, but it is one more server to patch.
- Moving the three secrets takes about an hour, plus one deploy, whichever we pick.

Options:
1. Use the hosting provider's secrets service. (recommended)
2. Use a self-hosted secrets server.
3. Keep the file, but lock it down to the app's own account.

Option 2 adds a server someone must keep patched; the others add no ongoing work.

Which option? 1, 2, 3, or something else?
```

## Move Forward Only When the User Says So

NEVER present the next item until the user's reply is one of these, in any case:

- **"Next".** Only the word "Next" moves the walk on; "ok", "sounds good" or "go on" do not. When
  the same reply also answers the item ("option 2, next"), record the answer and move on.
- **Only an option number**, when the item presents options ("2"). It answers the item and moves
  on.

Any other reply is about the current item, including an option number with anything else besides
"Next" ("2, but check the price first"): respond to it and stay on that item. Accept the number
tentatively, and wait for an explicit "Next" before moving on. The rule, in the user's words:

> "If the walk step presents options and the user replies with only an option number, that counts
> as next. If the user replies with an option number and then says something else besides "next",
> then the user is still discussing this item. Accept the number tentatively, but go back to
> waiting for an explicit "next" before you move on."
>
>   -- **The user** in an agent session walking an overnight report (2026-09-29)

When the reply answers the item without moving on, end the reply by asking for "Next". In a
discussion-only walk, that is all:

```text
Noted: we'll use the hosting provider's secrets service. If that's right, say "Next" to
move on to item 2.
```

Under a policy that acts after each item, also name the action that will start before the next
item is shown:

```text
Noted: we'll use the hosting provider's secrets service. If that's right, say "Next" to
move on to item 2. As you asked, before I show item 2 I'll dispatch a background agent to
move the three secrets into the hosting provider's secrets service.
```

An option number with something else, which the agent accepts tentatively (the user replied "1, but
what does it cost for all three?"):

```text
Option 1 costs about $1.20 a month for the three secrets ($0.40 each). I've noted option 1
for now; say "Next" to move on to item 2, or tell me if the cost changes your mind.
```

A reply that is only an option number (the user replied "1") moves straight on, recording the
answer in one line above the next item:

```text
Noted: we'll use the hosting provider's secrets service.

Item 2 - Who can read the production logs? (2/5)
...
```

Under a policy that acts after each item, that line also names the action just started ("I've
dispatched a background agent to move the three secrets.").

## When the List Changes

- A new item comes up: say so, add it, and give the new total.
- An answer changes a later item: say so, and keep going.
- An item is no longer needed: say so once, skip it, and never mention it again.

```text
Your answer on item 2 means we also need to decide how long logs are kept, so I've added it
as item 6. The list is now 6 items long.

Item 3 is no longer needed: you already answered it in item 2, so we'll skip it.
```

@~communication/control-flow/_partials/walk-splitting.md

The walk is on item 3 of 5, and item 3 turns out to hold three questions:

```text
Item 3 is really three separate questions, so I've split it into items 3-a, 3-b and 3-c,
right after item 3. The list is now 8 items long.

Remaining:

3-a. Do we keep a nightly backup at all?
3-b. How long do we keep each backup?
3-c. Who is told when a backup fails?
4. What happens to accounts that have not logged in for a year?
5. Which regions do we deploy to?

Item 3-a - Do we keep a nightly backup at all? (4/8)

We back up the database every night and keep the copies on a separate server. Nobody has
restored from one in two years, and the job costs about $30 a month to run.

Options:
1. Keep the nightly backup. (recommended)
2. Stop it and rely on the hosting provider's weekly snapshot.

Option 2 saves $30 a month, but a failure could lose up to a week of orders.

Which option? 1, 2, or something else?
```

## Finish

After the last item, give a numbered recap: each item's title and what the user decided, one line
each, with a split item's sub-items listed under it. In a discussion-only walk, then ask whether to
act on the decisions, and take no action until the user says so.

```text
That was the last item. What you decided:

1. Secrets: move them to the hosting provider's secrets service.
2. Production logs: only the on-call engineer can read them.
3. Nightly backup:
   - 3-a. Keep it.
   - 3-b. Keep each backup for 30 days.
   - 3-c. Tell the on-call engineer when one fails.
4. Inactive accounts: lock them after a year, delete them after two.
5. Regions: us-east and eu-west.

Say "go" and I'll carry these out.
```

## Source for this Skill

This skill comes from the `communication/control-flow` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
