## Working Around Blockers

The user cannot unblock the agent right now. When something blocks an item, try these, in roughly
this order, before giving up on it:

1. **Reorder.** Do every part that does not depend on the blocker first.
2. **Research instead of waiting.** Find the answer in the code, the docs, the history or the issue
   tracker, or send a background agent to find it.
3. **Guess, if the guess is cheap to undo.** Record it as a guess, and keep going.
4. **Stand in for the missing piece.** A stub, a mock, a fixture or a feature flag, clearly marked
   so it cannot be mistaken for the real thing.
5. **Do it offline.** Work on local copies, recorded responses or sample data when a service is
   down.
6. **Take another route.** Another tool or another approach that reaches the same result.
7. **Prepare, do not perform.** Draft the reply, stage the commit, write the comment, and leave it
   for the user to approve.
8. **Write it down and move on.** When truly stuck, record exactly what the user must do, with a
   link, and go to the next item.

The more work a blocker holds up, and the longer the user will be away, the harder to try.

NEVER work around these; report them instead:

- an authentication or permission failure (NEVER reach for another credential);
- an outward action (anything other people see) that neither the project's setting for it (the
  "Outward Actions" memory) nor the user's up-front approval allows.
