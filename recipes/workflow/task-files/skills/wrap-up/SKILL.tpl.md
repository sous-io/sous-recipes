---
name: wrap-up
description: Bring this session to a clean stopping point, and set up the next sessions to continue the work.
argument-hint: "[how to wrap up]"
disable-model-invocation: true
---

# Wrap Up This Session

The user wants to end this session and continue the work in one or more new ones. This is a goal, not
an order to stop mid-edit: find the best way to stop.

How to wrap up: $ARGUMENTS

@~communication/control-flow/_partials/arguments-or-context.md

@~communication/agent-conduct/_partials/respect-the-users-time.md

The user usually wraps up because the session keeps growing, because the work could run in parallel
sessions, or because they are tired. If nothing says which, name the one assumed in the first line
of the plan. When the user is tired, keep the plan short: favor "for now" and "next sessions" over
"finish now".

## 1. Survey

List everything still open: unfinished items, half-done edits, open questions, and decisions made in
this session that are not written down anywhere yet. The main session does this itself; it rests on
the conversation. An open question that research can answer is not an item: dispatch a background
agent to answer it now, and put the answer into the plan.

## 2. Propose One Plan

Put every open item in exactly one bucket, numbered, in one message:

- **Finish now**: small, and needed so the next session does not start on a broken tree.
- **For now**: a compromise good enough to stop on, named as such.
- **Next sessions**: grouped into new sessions, each marked "can start now" or "waits for ...".
  Sessions that run at once MUST NOT edit the same files; suggest a separate git worktree for each.
- **Tickets**: new ones, with the full drafted title and body, or existing ones, by ID and title,
  with the full text of any comment to add.
- **Drop**: not worth carrying forward.

The plan is complete. Nothing turns up after it.

````text
Here's how I'd wrap up, assuming the session has grown too long rather than that you're
tired. 9 open items; nothing else is pending.

Finish now:
1. Revert the half-done rename in src/export/format.ts, so the tests pass again.

For now:
2. Keep the archive job at 02:00, and retry the export once on a lock timeout. The real
   fix (moving the archive job) is item 5.

Next sessions:
3. Session A: add the retry, with tests. (Can start now.)
4. Session B: rename the export format module, including item 1's revert. (Can start now,
   in its own worktree; it touches different files from A.)
5. Session C: move the archive job to 04:00. (Waits for A to merge.)

Tickets:
6. New ticket, drafted:
   ```
   Title: Export and archive jobs contend for the exports table

   Every Sunday at 02:00 UTC the weekly archive job locks the exports table, and the
   nightly export fails with "lock wait timeout". The export now retries once (WID-212),
   which hides the failure but not the contention. Move the archive job to 04:00, when
   nothing else runs.
   ```
7. Add this comment to WID-212 (Retry delay ignores the config file):
   ```
   The nightly export now retries once on a lock wait timeout; the delay still comes
   from the hard-coded default, not the config file.
   ```

Drop:
8. The idea of splitting the exports table; nothing we found needs it.
9. The logging clean-up in src/export/log.ts; cosmetic.

Tell me what to change, or "go".
````

Then wait for the user. This is the one stop in the command.

## 3. Carry It Out

1. Finish or revert the "finish now" items.
2. File the approved tickets and comments. "Go" on a plan that shows the full text of a ticket or a
   comment approves exactly that text, and nothing else:

   > "Approval is per artifact and does not carry forward. "Post that one" does not authorize the
   > next."
   >
   >   -- "Drafting and Outward-Facing Actions" memory, `communication/agent-conduct` recipe

   A ticket or comment the plan did not show in full is drafted and shown first, then filed only
   once the user approves it.
3. When a next session needs its own branch, create it and give it a new task file, in the shape of
   steps 3 and 4 of `continue-task-in-new-branch` (the new task file, and a "Work Continuation"
   note in the old one). Do not load that skill; its first step expects the old branch to have
   merged.
4. Update the task file last: load `update-task-file` and record what it asks for, plus this plan
   and every starting prompt below, including those for sessions that wait. The main session writes
   the task file itself. The skill's "STOP immediately" means no further work; the hand-off message
   is still sent.

## 4. Hand Off

Show the user what was done, with links; then one ready-to-paste starting prompt per next session,
each in its own code block and marked "can start now" or "waits for ...".

````text
Done. The tree is clean, the task file is up to date, and WID-231 (Export and archive
jobs contend for the exports table) is filed.

- /home/ada/projects/widget-api/.sous/tasks/wid-212-retry-export.md:1
- https://tracker.example.com/browse/WID-231

Starting prompts:

Session A (can start now):
```
On branch wid-212-retry-export, resume the task file and add a single retry to the
nightly export when it hits a lock wait timeout, with tests. The plan is in the task
file under "Wrap-Up, 2026-09-28".
```

Session B (can start now, in its own worktree):
```
Create a worktree on a new branch wid-233-rename-export-format and rename
src/export/format.ts as described in WID-233 (Rename the export format module).
```

Session C (waits for session A to merge):
```
On a new branch wid-231-move-archive-job from main, move the weekly archive job from
02:00 to 04:00 UTC as described in WID-231 (Export and archive jobs contend for the
exports table), and confirm nothing else runs at 04:00.
```
````

Then stop.

## Source for this Skill

This skill comes from the `workflow/task-files` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
