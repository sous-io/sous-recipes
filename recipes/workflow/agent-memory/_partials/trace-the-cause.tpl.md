## Trace the Cause

Something in the agent's context led to each action: an instruction in a memory or a skill, a file
the agent read, a tool result, or an earlier message in this conversation. The main session MUST do
this tracing itself, because only it holds the conversation.

1. Name what led to the action. When several things did, name each one.
2. Quote the relevant text verbatim, with an attribution line under the quote. Words from earlier in
   this conversation are quoted too, never only pointed at.
3. Link the tracked source, never a built copy: its absolute path, `:` and one line number, on its
   own line under the quote. The instruction files the agent reads (such as `CLAUDE.md`, `AGENTS.md`
   and every installed skill) are built by sous. This project's memories are under
   `{{ memoryRoot }}`; a built skill's "Source for this Skill" footer names its source; a recipe's
   source lives in that recipe's repository.
4. When nothing in the context explains the action, say so plainly. NEVER invent a cause.

```text
I ran the migrations before the tests because the testing memory says to:

> "Run `npm run db:migrate` before any test run; the tests fail against an old schema."
>
>   -- widget-api testing memory

- /home/ada/projects/widget-api/.sous/memories/testing/migrations.md:3
```

@~communication/agent-conduct/_partials/quote-sources.md
