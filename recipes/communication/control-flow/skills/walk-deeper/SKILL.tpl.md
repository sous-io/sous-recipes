---
name: walk-deeper
description: Inside a walk, split the current item (or a named one) into sub-items and add them to the same walk.
argument-hint: "[item to split, or how to split it]"
disable-model-invocation: true
---

# Split This Item Into Parts

The user is in the middle of a walk (started with `/walk`) and is saying: this item is actually many
items disguised as one; break it into parts.

Item to split, or how to split it: $ARGUMENTS

@~communication/control-flow/_partials/arguments-or-context.md
@~communication/plain-speech/_partials/speak-plainly.md
@~communication/agent-conduct/_partials/respect-the-users-time.md
@~communication/agent-conduct/_partials/quote-sources.md

## Which Item

- With arguments that name an item ("0300", "3-a"), split that item.
- With arguments that say how to split ("separate the cost questions"), split the current item that
  way.
- Without arguments, split the current item.
- Break the item into sub-items, each roughly one question the user needs to answer.

@~communication/control-flow/_partials/walk-splitting.md

## Reply

Present the first sub-item as the walk presents every item: the title
`Item <name> - <question> (<position>/<total>)`, a plain explanation, short bullets for the
considerations, numbered options with the recommended one marked, one line on what the choice
costs, and "Which option? 1, 2, 3, or something else?". Then move on only as the walk does: on
"Next", or on a reply that is only an option number. An option number with anything else besides
"Next" is accepted tentatively, and the walk stays on the sub-item until the user says "Next".

The walk is on task file `0300`, the 3rd of 5, and the user types `/walk-deeper`:

```text
Task file 0300 holds three decisions, so I've split it into 0300-Q1, 0300-Q2 and 0300-Q3,
right after 0300. The list is now 8 items long.

Remaining:

0300-Q1. How far back should the order history go?
0300-Q2. Can customers reorder from the history with one click?
0300-Q3. Do cancelled orders appear in the history?
0400. Email a receipt after each order
0500. Add the admin dashboard

Item 0300-Q1 - How far back should the order history go? (4/8)

Customers will see a list of their past orders on their account page. We need to decide how
far back that list goes.

Considerations:
- The longer the list goes back, the slower the page loads for long-time customers.
- Most reorders happen within a year of the first order.

Options:
1. The last 12 months.
2. The last 3 years.
3. Everything, loaded a page at a time. (recommended)

Option 3 takes about a day longer to build than the other two.

Which option? 1, 2, 3, or something else?
```

Whenever the agent later asks the user to say "Next" on a sub-item, and the walk's policy acts on
that sub-item (or on the parent, once its last sub-item is answered), it MUST also name the action
that will start before the next item is shown. When the user answers the last sub-item under "act
after each item", the reply ends like this:

```text
Noted: cancelled orders stay out of the history. If that's right, say "Next" to move on to
0400. As you asked, before I show 0400 I'll dispatch a background agent to build the order
history for task file 0300, using your answers to 0300-Q1, 0300-Q2 and 0300-Q3.
```

## No Walk Running

With no walk running there is no current item. Start a walk over the parts of whatever the user most
likely meant, and say so in the first line. The walk is discussion only: the agent MUST NOT take a
state-changing action (editing a file, committing, pushing, posting, opening an issue) until the
user says to. Show the whole list first, then present one item per message in the format above,
move on only on "Next" or on a reply that is only an option number, and after the last item give a
numbered recap of what the user decided.

```text
No walk was running, so I'm starting one over the 4 open questions in the migration plan.
We're just discussing these; I won't change anything unless you tell me to.

1. Do we migrate the archive tables too?
2. Which night do we run the migration?
3. Who watches the migration while it runs?
4. How do we roll back if it fails?
```

## Source for this Skill

This skill comes from the `communication/control-flow` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
