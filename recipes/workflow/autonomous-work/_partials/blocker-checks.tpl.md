## Blocker Checks

Run every check below before autonomous work starts. Turn each one that fails into a question or a
permission request for the user, asked before the user leaves.

1. **The code host's command-line tool is signed in.** The tool for the project's code host (for
   example `gh auth status`) reports a signed-in account with the scopes the work needs.
2. **Branch protection allows the planned pushes.** Each branch the work will push to has no
   protection, or its protection allows this push.
3. **Every remote accepts a push.** A dry-run push (`git push --dry-run`) to each remote the work
   will push to succeeds.
4. **No command will stop at a permission prompt.** Every command the work needs has already run
   once without a permission prompt; the user allows any that has not, now.
5. **Every triggered run is confirmed to start.** When the work relies on a run that a push or a
   merge starts (a release, a deploy), the plan checks that the run appears within a few minutes
   (for example `gh run list`), and names the command the run would have executed, to be run by
   hand from a clean checkout if the run never starts. A code host can drop the event that starts a
   run.

This list grows. When autonomous work hits a blocker that no check here caught, add one check that
would have caught it: one numbered line, phrased for any project, naming the command that tests it.
Add it to this partial's source in the `workflow/autonomous-work` recipe's repository, NEVER to a
compiled copy. When that repository is not linked into the project as a working copy, put the check
in the report instead, for the user to add.
