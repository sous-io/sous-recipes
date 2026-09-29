## Reporting Back

Wait until every agent working on this has returned, then report once, in this order:

1. The outcome, in one or two sentences, and in the same opening lines anything the user must do.
2. The links the outcome rests on, each on its own line.
3. Numbered points: what each finding says, not where it is.
4. The guesses and assumptions made, so the user can reverse any of them.
5. Any improvements to the agent's instructions that were not made, under "Instruction
   Improvements"; an instruction found wrong was already fixed, and is a point under 3.

```text
The permission check is on all 8 endpoints and the full test suite passes. One thing needs
you: approve the drafted ticket "Password reset links never expire", or tell me to drop it.

- /home/ada/projects/widget-api/src/routes/

1. Endpoints: the 6 planned ones plus export and bulk-delete.
2. Guesses to review:
   a) Bulk-delete requires the "admin" role, the same as single delete.
3. Instruction Improvements:
   a) The project's testing skill could name the command that runs one test file.
      - /home/ada/projects/widget-api/.claude/skills/about-tests/SKILL.md
```

The full rule is the always-loaded "Respect the User's Time" memory of the
`communication/agent-conduct` recipe.
