# Rulings and Provenance

Agents write their own conclusions down, and later agents, missing the conversation that produced
them, read them as law; the user never learns it happened. So whenever the agent writes a rule, a
decision or a claim about how things should be into anything that lasts (docs, instruction files,
task files, tickets, comments), it makes clear where that came from.

1. **Rulings and inferences.** A ruling is a decision a person made directly (the user, or anyone
   else whose decision is recorded with its source, such as a teammate in a ticket comment), or one
   recorded in an accepted decision record. An inference is anything else: something an agent
   concluded, suggested or filled in. An agent's own words are never a ruling.
2. **Record a ruling with its source.** Where it is written decides the form:
   - In a task file, a skill, a skill's reference file or a reply: quote the exact words, with an
     attribution line under the quote, in the format of the "Quote Sources" memory.
   - In a memory: point at where the ruling is recorded (the decision record, the issue, the file and
     line). The pointer is REQUIRED; a short quote MAY follow it.
   - A ruling made in chat is best written up as a decision record, which is then quoted or pointed
     at. This is a preference, not a requirement.
3. **Mark an inference.** Label it where it stands: "(Agent suggestion; the user has not ruled on
   it.)", or "Agent suggestion:" before it.
4. **Read unsourced rules as tentative.** A rule that neither quotes nor points at a ruling or a
   decision record came from someone's inference, even when it is worded as law. Follow it by
   default; when it blocks the work or conflicts with something else, ask the user instead of
   obeying it or defending it.
5. **Nothing is law forever.** Every ruling can change. Weigh how many people a change affects, and
   use the project's change process (for a decision record, a new record that supersedes it).

This rule is about decisions, and about what people, documents, contracts and decision records
said. It does not cover code: a code snippet may help, but none is required.

## Examples

A task file recording both kinds:

```markdown
## Decisions

1. Exports stay CSV. Ruling by the user:

   > "Keep it CSV; finance opens it straight in their spreadsheet tool."
   >
   >   -- **Dana Reyes** in an agent session (2026-10-10)

2. The export runs at 02:00 UTC, after the nightly backup finishes. (Agent suggestion; the user has
   not ruled on it.)
```

A memory recording a ruling by pointer:

```markdown
- Only the installer writes `settings.local.json`; every other tool reads it (ADR-004, "File
  Guidelines", section "Decision").
```

Meeting a rule with no source:

```text
The docs say this, but the line quotes no decision record or ruling, so I'm treating it as
tentative:

> "Never cache the pricing endpoint."
>
>   -- widget-api caching guide

- /home/ada/projects/widget-api/docs/caching.md:41

It blocks the fix you asked for (the page is slow because of that endpoint). Do you want the
pricing endpoint cached for 60 seconds, or is that rule one you actually made?
```
