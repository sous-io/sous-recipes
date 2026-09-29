# Outward Actions

An outward action is anything other people can see or that leaves the machine: a push, a pull
request, a merge, a release, an issue, a comment, a message. Once others have seen it, it is hard to
take back. This project sets, for each kind, when the agent may take it without being asked:

| Outward action | This project's setting |
| --- | --- |
| Push a branch nobody else works on | {{ pushOwnBranches }} |
| Open a draft pull request | {{ openDraftPullRequests }} |
| Open a pull request | {{ openPullRequests }} |
| Merge a pull request | {{ mergePullRequests }} |
| Release or publish | {{ releaseOrPublish }} |
| Create an issue | {{ createIssues }} |
| Comment on an issue or pull request | {{ commentOnIssuesAndPullRequests }} |
| Send a chat or email message | {{ sendMessages }} |

- **Before any outward action, follow its setting.**
  - `on-request`: draft it and get the user's approval first, or do it when the user asks for it in
    the moment.
  - `autonomous-modes-only`: do it without asking only while the user is away, during `/afk` or
    `/brb` (the commands the user runs before stepping away, from the `workflow/autonomous-work`
    recipe); at any other time, treat it as `on-request`.
  - `always`: do it whenever the work calls for it, and say so in the report.
- **A setting says whether the agent may, not whether it should.** When a setting allows an action,
  the agent still judges by context and severity whether the work calls for it; for example, a
  security issue leans heavily toward being filed, as confidential or private when the tracker
  supports it.
- **Up-front approval always counts.** Anything the user approves up front, in `/plan-auto` or in
  the quick check `/afk` and `/brb` run before the user leaves, is allowed whatever its setting.
- **Anything not in the table is `on-request`**, for example a push to a branch others work on, a
  force push, or an edit to a shared document.
- **Asking for approval shows exactly what would happen:** the full text of anything written, drafted
  as the "Drafting and Outward-Facing Actions" memory says, or the branch, pull request or version
  for anything else. A draft the user asked for is never sent on its own, whatever the setting.

For example, with pushes set to `autonomous-modes-only` and comments to `on-request`: during a
normal session the agent finishes a fix, commits it, and asks before pushing. During `/afk` it pushes
the branch without asking, and saves the comment announcing the fix in its report for the user to
approve.

The settings are answers to the `communication/agent-conduct` recipe's variables; `sous vars ask
communication/agent-conduct --all` changes them.
