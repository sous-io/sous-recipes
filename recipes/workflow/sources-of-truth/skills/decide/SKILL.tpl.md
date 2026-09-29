---
name: decide
description: Record a decision the user has made in every place it belongs; issues, docs, agent instructions and decision records.
argument-hint: "[the decision]"
disable-model-invocation: true
---

# Record a Ruling

The user has made a decision: $ARGUMENTS

With no text after the command, the rulings are every decision the user stated in roughly the last
10 turns that is not yet recorded. Take all of them; never ask which one was meant.

@~communication/control-flow/_partials/arguments-or-context.md

@~communication/agent-conduct/_partials/rulings-and-provenance.tpl.md

@~communication/agent-conduct/_partials/quote-sources.md

The ruling is the new law, as of now. The user has already weighed its consequences. Everything that
contradicts it is wrong and gets changed. The agent MUST NOT argue, ask whether the user is sure,
offer alternatives, or comment on consequences.

## 1. Find Every Place

Dispatch parallel background agents, one per kind of place. Each gets the ruling, quoted verbatim
with its date, and changes nothing:

1. Issues and tickets ({{ issueTracker }}) that propose, discuss or depend on the old position.
2. Docs in `{{ docsDir }}`, and anywhere else a rule is written down, task files and code comments
   included.
3. Agent instructions: the tracked sources of memories, skills and instruction files; never their
   compiled copies.
4. Draft decision records in `{{ adrDir }}`, which are edited in place.
5. Accepted decision records in `{{ adrDir }}` that the ruling contradicts. They are not rewritten;
   a new record supersedes them. Change an old record's status line only when earlier superseded
   records in the project show that the project does.

Each agent returns, for each place: its location (an absolute path with a line number, or a URL),
the exact current text, and the exact text that replaces it. For the new decision record, one agent
first reads the existing records and follows their numbering, template and status values (accepted
when there are none), and quotes the ruling in the record, with its attribution line.

@~workflow/sub-agent-delegation/_partials/delegation-brief.tpl.md

## 2. List Every Change

The list quotes everything that will change and states what it becomes, and nothing else: no
reasons, no consequences, no commentary.

1. The first line quotes the ruling with its date; with several rulings, one line each.
2. Then "N places change:", and one numbered item per place.
3. Each item names the place, with its location on its own line under the name, then "Now:" with
   the exact current text and "Becomes:" with the exact new text, each as a quote block.
4. A new file has only "Becomes:", with its full text.
5. A ticket has "Now: open." and "Becomes: closed, with this comment:" with the exact comment, or
   whatever else changes about it, stated the same way.
6. The last line is "Approve all, exclude some, add more, or discuss any item?".

```text
Ruling by Mara Lindqvist, 2026-11-04: "Order line items get their own table. No more JSON column on orders."

4 places change:

1. ADR-0019 "Store Order Line Items" (new file, superseding ADR-0007)
   - /home/mara/projects/harbor-web/docs/adrs/0019-store-order-line-items.md

   Becomes:

   > # ADR-0019: Store Order Line Items
   >
   > Status: Accepted (2026-11-04). Supersedes ADR-0007, "Order Line Items as JSON".
   >
   > ## Decision
   >
   > > "Order line items get their own table. No more JSON column on orders."
   > >
   > >   -- **Mara Lindqvist** in an agent session (2026-11-04)
   >
   > Each line item is a row in the `order_line_items` table, keyed by `order_id`. The
   > `orders.items` column is removed.

2. The data-model doc
   - /home/mara/projects/harbor-web/docs/data-model.md:52

   Now:

   > "Line items are stored as a JSON array in the `orders.items` column."

   Becomes:

   > "Line items are stored in the `order_line_items` table, one row per item, keyed by
   > `order_id` (ADR-0019)."

3. The `about-orders` skill
   - /home/mara/projects/harbor-web/.sous/skills/about-orders/SKILL.tpl.md:18

   Now:

   > "Read an order's line items from `orders.items`; never query them one at a time."

   Becomes:

   > "Read an order's line items from the `order_line_items` table, joined on `order_id`."

4. HARBOR-418 "Add a JSON index on orders.items"
   - https://tracker.example.com/browse/HARBOR-418

   Now: open.

   Becomes: closed, with this comment:

   > "Closing: order line items move out of `orders.items` into their own table, so this index
   > is no longer needed. Ruling by Mara Lindqvist on 2026-11-04, recorded in ADR-0019."

Approve all, exclude some, add more, or discuss any item?
```

## 3. Align

Wait. The user approves all, excludes some, adds more, or discusses any item; show each changed item
again in the same shape. Change nothing until the user approves.

Closing a ticket or posting a comment is an outward action: follow this project's setting for it in
the always-loaded "Outward Actions" memory of the `communication/agent-conduct` recipe. The user's
approval of the list is the approval for every change in it, the exact comment text included.

## 4. Apply

Dispatch parallel background agents to make every approved change, exactly as listed. Each gets its
items and the quoted ruling. Edit instruction sources, then rebuild their compiled copies the way
the project does.

## 5. Report

@~communication/agent-conduct/_partials/reporting-back.tpl.md

```text
All 4 changes are made.

1. ADR-0019 "Store Order Line Items" is created and supersedes ADR-0007.
   - /home/mara/projects/harbor-web/docs/adrs/0019-store-order-line-items.md
2. The data-model doc names the `order_line_items` table.
   - /home/mara/projects/harbor-web/docs/data-model.md:52
3. The `about-orders` skill reads from the `order_line_items` table, and the skills were rebuilt.
   - /home/mara/projects/harbor-web/.sous/skills/about-orders/SKILL.tpl.md:18
4. HARBOR-418 "Add a JSON index on orders.items" is closed, with the comment posted.
   - https://tracker.example.com/browse/HARBOR-418
```

## Source for this Skill

This skill comes from the `workflow/sources-of-truth` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
