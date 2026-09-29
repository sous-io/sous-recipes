The main session performs this work itself and MUST load `about-task-files`.

**CRITICAL: Do NOTHING ELSE. Update the task file IMMEDIATELY. Use as few edits as possible.**

## Who Writes It

Per the sub-agent delegation pattern, writing a task file is orchestrator-only: the main session
edits the file itself, and no sub-agent does. The main session holds the facts and decisions the
file records; a sub-agent cannot see the conversation. A background sub-agent MAY still collect
what the main session does not hold (commit list, changed files, test or build output) and report
it back.

## What to Include

Update the task file with all of the following:

1. **Progress since last update** — what was completed, what is in progress, current status
2. **Decisions made** — technical approach chosen, alternatives considered and rejected
3. **Remaining work** — everything still needed, prioritized next steps, known dependencies
4. **Pending issues** — unresolved problems, blockers, questions needing answers
5. **Learnings** — insights, patterns discovered, things to remember
6. **Commits made** — commit IDs and brief description of each
7. **Testing URLs** — web URLs currently in use, database query results referenced
8. **Files changed** — absolute paths with line numbers, what was done and why
9. **Unresolved errors** — test failures, build errors, TypeScript errors — with paths and line numbers

## Checklist Management

- Mark completed items `[x]`
- Add `[ ]` for newly identified tasks
- Remove or condense sections no longer relevant

## Consistency Check

Scan the existing file for contradictions or outdated information. Correct before saving.

## After Update

**STOP immediately.** Do not:
- Continue working on the task
- Start new work
- Make additional changes

The main session then waits; the user will end the session and start a new one.
