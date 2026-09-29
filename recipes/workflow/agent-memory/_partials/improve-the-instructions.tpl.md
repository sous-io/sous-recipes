Load `about-agent-memory` and `about-agent-skills` before changing any instruction. Then, for each
instruction that needs a change, take these four steps:

1. **Find the source.** Name the instruction that caused the behavior, or confirm that none covers
   it. Quote it verbatim, with the absolute path and line of its tracked source, never the built
   copy (a built skill's "Source for this Skill" footer names its source; a recipe's source lives in
   that recipe's repository).
2. **Choose the smallest fix** that stops a recurrence: add, reword or strengthen, move (between a
   memory, a skill and a partial), or remove. Consider what sous offers: a partial instead of a copy,
   a recipe variable instead of a hard-coded path, a sharper skill description.
3. **Weigh the cost.** A memory loads in every session; a rule needed only for specific work belongs
   in a skill. Prefer the fix that costs the fewest tokens over time.
4. **Propose, then apply.** List the changes numbered under "Instruction Improvements", each with the
   current text quoted and the proposed text in full. Apply only what the user approves, then run
   `sous build`.

```text
Instruction Improvements

1. The rule was there but too soft to hold.
   Current text: "Prefer small commits."
   Proposed: "Commit after each passing test run; never batch unrelated changes into one commit."
   - /home/ada/projects/widget-api/.sous/memories/git/commits.md:2

Which should I apply? The numbers, "all", or "none".
```

The standing rule is the always-loaded "Improving the Instructions" memory of the
`workflow/agent-memory` recipe; the report around the list follows the "Respect the User's Time"
memory of `communication/agent-conduct`.
