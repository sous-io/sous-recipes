## Improving the Instructions

Improving the instructions is one of the agent's PRIMARY jobs, on every task, in every session, as
much a part of the work as the work itself. It is NEVER a side task, NEVER optional, and NEVER left
for the user to ask for. This project is OBSESSED with token and time optimization. Every repeated
mistake, every correction the user has to give twice, every fact searched for again from scratch,
every manual step done again by hand, and every token spent loading a stale, wrong or useless
instruction is a DEFECT in the instructions. The agent MUST treat each one as a defect: find it, name
it, and fix it or propose the fix before the work is reported done. An agent that finishes a task and
leaves the instructions no better than it found them has done only part of its job.

The instructions are everything the agent loads to know how to behave: memories, skills, partials,
and the docs they point at. The instruction files (such as `CLAUDE.md` and `AGENTS.md`) are built by
`sous build` from tracked sources, and this project's memories live under `{{ memoryRoot }}`. The
agent MUST NOT edit a built copy; it edits the source, then runs `sous build`. The agent MUST load
`about-agent-memory` before changing a memory, and `about-agent-skills` before changing a skill.

The agent MUST constantly watch for instructions that are:

- **Stale**: shown by the work to be wrong, out of date, or missing something (a new file, a changed
  pattern, a retired approach, a new decision).
- **Failed**: a rule that exists but was not followed. The wording failed: make it more precise,
  broader or firmer, or move it where it will be seen.
- **Missing**: a mistake, a correction from the user, or a dead end that no instruction prevented.
- **Costly**: loaded in every session without earning its tokens. Compress it, move it into a skill
  (loaded only when needed), or remove it. Removing an instruction is an improvement.
- **Repeated**: the same text in several places (make it one partial or one skill), or the same
  manual steps done again (make them a skill, or a script).
- **Unrecorded**: a convention the user asked for that no instruction records yet.

What to do with each find is the "Instruction fixes" rule of the always-loaded "Respect the User's
Time" memory (from the `communication/agent-conduct` recipe), and the report's "Instruction
Improvements" section takes the shape of that recipe's "Reporting Back" partial. This memory adds
three things:

- **Record before continuing** a convention the user just asked for, under
  `{{ conventionsSourceDir }}`.
- **Quote and propose.** Each listed improvement quotes the current text (or says none exists) and
  gives the proposed text in full, with the link to the tracked source it changes.
- **Collect, then ask once.** Collect the improvements while working. NEVER drip them out one at a
  time, and NEVER start one without the user's approval.

```text
1. The rule about migrations was loaded and still not followed (I ran the tests first).
   Current text: "Run migrations before tests."
   Proposed: "Run `npm run db:migrate` before any test run; the tests fail against an old schema
   with errors that do not mention migrations."
   - /home/ada/projects/widget-api/.sous/memories/testing/migrations.md:3
```

The user MAY run `/harvest` to review a whole session, `/reflect` to learn why the agent took an
action, or `/mistake` to fix the instructions behind a mistake; the agent MUST NOT wait for any of
them.
