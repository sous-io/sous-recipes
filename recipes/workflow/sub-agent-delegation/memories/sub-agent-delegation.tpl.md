# Sub-Agent Delegation

Several shared skills say work is "delegated" and cite the sub-agent delegation pattern. This is
that pattern. Subscribe a project to `workflow/sub-agent-delegation` to place this memory in that
project's agent context, so the agent follows the pattern by default. A recipe that only needs to
quote or include the text declares `workflow/sub-agent-delegation` under `depends` and writes
`@~workflow/sub-agent-delegation/memories/sub-agent-delegation.md`.

The **main session** is the one the user talks to. It is the **orchestrator**: it does the
reasoning, the decisions, and all interaction with the user, and it delegates execution to
sub-agents (agent sessions). Delegate as much as possible. The point is not only cost: the user
should never have to stop and wait while work or research finishes. Guard the main session's flow
greedily, so the user can keep directing.

**Orchestrator-only:** planning, decisions, anything that needs the user (questions, approvals,
drafts), writing task files (the main session holds the context a task file records), work that
needs much of the conversation's context (briefing an agent on it would cost more than doing it),
and very small actions where delegating costs more than doing it (a quick file read, a one-line
edit).

**Delegated:** anything with real work in it, including research, code changes, doc writing, and
multi-step lookups.

## Model Tiers

Rank the models available to the agent tool by capability alone: the top tier is the most capable,
then the second tier, and so on. NEVER assume the main session's own model is the top tier; it often
is not. NEVER name a model or a provider in instructions; name the tier.

- Sub-agents never run the top tier, whatever model the main session runs.
- Substantive work (writing code or docs, research, anything outward-facing): the second tier.
- Rote, mechanical work (listing, extracting, reformatting): the third tier or lower.
- **The cheapest model is code.** NEVER have an agent collect what a short script can: counts, file
  lists, test output. Run the command. A one-command script runs in the main session; a script that
  takes writing and debugging is delegated to a sub-agent, which writes and runs it.

A **low-key agent** is the cheapest possible check: the lowest tier that can do it, in the
background, one narrow question, a one-line answer.

## Rules

- Run sub-agents in the background and in parallel by default; batch independent dispatches into one
  message. Go synchronous only when the result blocks the very next step.
- Prompts must be self-contained. Sub-agents start with fresh context and cannot see the
  conversation, so state every fact, path, ID, and decision they need, and name the skills they
  should load. Anything the sub-agent can gather itself (branch name, commits, test output) should
  be left to it.
- Sub-agents cannot talk to the user. Questions and user-facing messages go back to the orchestrator
  to relay.
- Every sub-agent reports a concise summary of what it did or found, not a file dump.
- The orchestrator spot-checks the results that matter most (code diffs, outward-facing writes) in a cheap,
  targeted way; it does not re-read everything.
- Never fabricate or predict a pending sub-agent's result. Wait for it.
- Research is never a to-do. The moment the agent realizes something needs researching, it
  dispatches a background agent to research it, and keeps going.
- When several agents work on one objective, report to the user once, after all of them return.

```text
The user asks: "Why do the nightly exports fail on Sundays?"

- Read the export job's logs for the last 8 Sundays and summarize the errors: second tier.
- List every file under src/export/ that mentions "weekday": a script (one grep), no agent.
- Check whether the staging cron file matches production: a low-key agent, third tier.
```
