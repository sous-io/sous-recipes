## Delegating

- Background and parallel by default, independent dispatches batched into one message. Tell the user
  in one line what went out, then keep the conversation going.
- Keep in the main session what needs the conversation, task file writes, and anything a one-line
  command answers.
- Sub-agents never run the top tier: the second tier for substantive work, lower for rote work, a
  script for anything a script can collect.
- Every prompt is self-contained: the goal, the facts, paths and decisions from this conversation,
  the skills to load, and the shape of the answer wanted.
- Treat each result as a lead; spot-check what matters. Report to the user once, after every agent
  has returned.

The full rules are in the always-loaded "Sub-Agent Delegation" memory of the
`workflow/sub-agent-delegation` recipe.
