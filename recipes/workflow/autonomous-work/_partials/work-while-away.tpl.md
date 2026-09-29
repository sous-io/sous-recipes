The user is about to be away, or will be busy with other sessions and not watching this one. Work
through as much of the active to-do list as possible without the user: the session's to-do list, the
task file's remaining work, and everything the conversation lined up in roughly the last 10 turns.
The user cannot unblock the agent, so route around blockers rather than stopping at them.

@~communication/control-flow/_partials/arguments-or-context.md

@~communication/agent-conduct/_partials/respect-the-users-time.md

@~workflow/autonomous-work/_partials/questions-worth-asking.md

## 1. Before the User Leaves: Ask Now, Briefly

The user is in a hurry. Run every check below, take one quick look for other blockers that a
question would clear, and ask everything in one message. Delay the user as little as possible.

@~workflow/autonomous-work/_partials/blocker-checks.md

- **Permissions.** Predict the commands and tools the work will run. Ask the user to allow any that
  would stop the work at a permission prompt. Coming back to find all work halted at a prompt is the
  outcome the user most wants to avoid.
- **Outward actions.** Each outward action follows the project's setting for it, in the
  always-loaded "Outward Actions" memory; when that memory is not loaded, every one is
  `on-request`. For each outward action the work will need whose setting is `on-request`, ask
  whether it may be taken while the user is away. A yes is up-front approval, good for this absence.
  Actions set to `autonomous-modes-only` or `always` need no question. Without a yes, prepare the
  action and leave it for approval.
- Anything else: only if it is very important and cannot be researched.

When there are questions, ask them and wait. When there are none, say so in one line and start.

```text
I ran the 4 blocker checks: `gh` is signed in with the scopes the work needs,
`feature/retry-queue` has no branch protection, and a dry-run push to origin works. The
fourth, whether the work's commands run without a permission prompt, failed; it is item 1.

Three things before you go. I'll start the moment you answer; everything else I'll decide
myself and list for you when you're back.

1. Permissions. The work will run `npm test`, `npm run build` and `git push` to the branch
   `feature/retry-queue`. None of these is allowed yet, so each would stop me at a prompt.
   Allow them now (in Claude Code, with `/permissions`), or tell me to skip the push.
2. Outward actions. This project's settings leave pushes and draft pull requests to you.
   May I push `feature/retry-queue` and open a draft pull request? Without a yes, I'll
   commit locally and save the pull request description for you.
3. The spec says failed jobs "back off" but not for how long. My guess: the longest wait is
   60 seconds, which is one line to change later. Say "fine", or give me a number.
```

## 2. Work

@~workflow/autonomous-work/_partials/working-around-blockers.md

- Delegate to background agents in parallel wherever the work allows.
- Commit as the work goes. When the project keeps a task file, record progress in it after each
  finished item, so nothing is lost if the session runs out of room.
- Keep going until every item is done or blocked. Do not stop to report progress.
- **Every unexpected blocker becomes a check.** When a blocker was not caught by the blocker checks,
  write one check that would have caught it and add it as the Blocker Checks section above says.
  Name it in the report, with a link to the changed file.

## 3. Report

@~communication/agent-conduct/_partials/reporting-back.md

Write one report, for the moment the user returns, numbered straight through, in this order: what
was done, the guesses made (each with where to undo it), what is not done, the checks added for next
time, and last, the blockers that need the user, each with exactly what to do and a link. The first
line also says how many blockers need the user, so it is seen even if nothing else is read.

````text
While you were away (about 3 hours): 6 of 7 items done. One blocker needs you (item 7).

Done
1. Retry queue and its worker; all 48 tests pass.
   - /home/ada/projects/widget-api/src/retry/queue.ts
2. Failed jobs now back off, up to 60 seconds between tries.
   - /home/ada/projects/widget-api/src/retry/backoff.ts
3. Pushed to `feature/retry-queue` and opened a draft pull request, as you approved before
   you left; nothing was merged.
   - https://github.com/example/widget-api/pull/57

Guesses (each one is easy to undo)
4. Longest wait between tries is 60 seconds; one line to change.
   - /home/ada/projects/widget-api/src/retry/config.ts:12
     ```ts
     export const MAX_BACKOFF_MS = 60_000;
     ```

Not done
5. The dashboard panel for queue depth. It needs item 7.

Checks added for next time
6. No check caught the staging database refusing my login, so I added one; the next quick
   check tests it before any work starts: "Every database role the work uses can read
   every schema it touches."
   - /home/ada/src/sous-recipes/recipes/workflow/autonomous-work/_partials/blocker-checks.tpl.md:14

Blockers that need you
7. The staging database refused my login ("permission denied for schema metrics"). I did
   not try any other credential. Give the `widget_ci` role read access to `metrics`, then
   say "go" and I'll build the panel.
   - https://console.example.com/databases/staging/roles
````
