## Reporting Back

Wait until every agent working on this has returned, then report once:

1. The outcome, in one or two sentences.
2. Numbered points, each with its links on their own lines.
3. The guesses and assumptions made, so the user can reverse any of them.
4. Any improvements to the agent's instructions that were not made, under "Instruction
   Improvements"; an instruction found wrong was already fixed, and is a point under 2.
5. Last, anything the user must do, each with the link to do it at.

```text
The permission check is on all 8 endpoints and the full test suite passes.

1. Endpoints: the 6 planned ones plus export and bulk-delete.
   - /home/ada/projects/widget-api/src/routes/
2. Guesses to review:
   a) Bulk-delete requires the "admin" role, the same as single delete.
3. Instruction Improvements:
   a) The project's testing skill could name the command that runs one test file.
      - /home/ada/projects/widget-api/.claude/skills/about-tests/SKILL.md

What you need to do:
4. Approve the drafted ticket "Password reset links never expire", or tell me to drop it.
```

The full rule is the always-loaded "Respect the User's Time" memory of the
`communication/agent-conduct` recipe.
