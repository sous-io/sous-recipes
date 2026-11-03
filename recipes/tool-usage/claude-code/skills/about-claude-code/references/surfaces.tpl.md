# Where Claude Code Runs: Surfaces, Cloud and Self-Hosted Environments

This branch covers where Claude Code runs and how the user reaches it: the CLI's sibling surfaces
(desktop app, VS Code, JetBrains, mobile), the browser and screen integrations (Chrome, computer use,
the iOS Simulator pane), Slack and Claude Tag, cloud sessions and their environments, and
self-hosted environments where cloud sessions run on the organization's own runners. For pull
request review and CI pipelines read `references/review-and-ci.md`; for scheduled tasks, routines,
Remote Control internals and channels read `references/agents-and-automation.md`; for managed
settings and organization rollout read `references/administration.md`.

## Choosing a surface

Every surface runs the same engine. Local surfaces (CLI, desktop app, VS Code, JetBrains) share
`CLAUDE.md`, `~/.claude/settings.json`, `.mcp.json`, hooks and skills; they differ in UI and in a
few surface-only features. Cloud sessions run elsewhere and do not see the user's local
configuration.

- **CLI**: the most complete surface. Scripting (`-p`), the Agent SDK and third-party providers are
  CLI-first; computer use in the CLI is macOS-only.
- **Desktop app**: graphical sessions, parallel sessions with worktrees, pane layout, app preview,
  diff comments, PR monitoring, SSH and WSL sessions, computer use on macOS and Windows, Dispatch.
- **VS Code and JetBrains**: Claude inside the editor. VS Code has a full graphical panel;
  JetBrains runs the CLI in the IDE terminal and adds diff and selection integration.
- **Cloud (web)**: long tasks that should keep running when the laptop closes; started from
  claude.ai/code, the mobile app, the desktop app or `claude --cloud`.
- **Mobile**: a client only. It starts and steers cloud sessions, drives a local session through
  Remote Control, or messages Dispatch.

Ways to work away from the terminal, by where Claude runs: Dispatch and Remote Control drive the
user's own machine (it must stay on); [Channels](https://code.claude.com/docs/en/channels) push
external events into a local CLI session; Slack and cloud sessions run in Anthropic's cloud;
self-hosted environments run cloud sessions inside the organization's network; scheduled tasks run
in the CLI, the desktop app or the cloud as [routines](https://code.claude.com/docs/en/routines).
[Platforms and integrations](https://code.claude.com/docs/en/platforms)

## Desktop app

The Code tab of the Claude desktop app (which also holds Chat and Cowork). Each conversation is a
session with its own folder, environment, permission mode and model.

- **Versioning gotcha**: the desktop app has its own version line, separate from Claude Code's 2.1.x,
  and the Code tab runs its own bundled Claude Code, which can differ from the terminal `claude`.
  `/status` shows which.
- **Environments**: Local, Cloud, SSH (Desktop installs a helper under `~/.claude/remote/` on the
  host and uses the system `~/.ssh/config`), and WSL on Windows. Saved environments bundle machine,
  folders and variables.
- **Desktop-only features**: parallel sessions with an optional git worktree each, draggable panes
  (chat, diff, terminal, file editor, browser, tasks, plan, iOS Simulator), side chats (`/btw`),
  diff view with line comments, PR monitoring with auto-fix and merge-when-ready, file attachments,
  and Dispatch from the phone (Pro, Max and Ultra only).
- **App preview**: Claude starts dev servers from `.claude/launch.json`, views the running app in the
  Browser pane, and verifies its own edits (auto-verify, off per project with `"autoVerify": false`).
  The Browser pane uses a clean profile without the user's logins; use Chrome when Claude must act
  as the user.
- **Cross-session work**: Claude can list, read, message and archive the user's other Desktop
  sessions (local, SSH and WSL only; not cloud, CLI or VS Code sessions).
- **Moving work**: `/desktop` or `claude --desktop` hands a CLI session to the app; Desktop picks up
  CLI sessions with `/resume`; **Open in > Cloud** sends a local session to the cloud as a summary.
- **Not in Desktop**: `-p` scripting, the Agent SDK, `dontAsk` mode and agent teams. Some settings
  are ignored or behave differently in the Code tab; desktop managed settings live in a different
  file from Claude Code's.
- **Connectors and Cowork**: claude.ai connectors reach Desktop sessions directly, outside
  `managed-mcp.json`. Cowork takes skills, plugins and connectors from the app's Customize config,
  not from `~/.claude`.

[Get started with the desktop app](https://code.claude.com/docs/en/desktop-quickstart) and
[Desktop application](https://code.claude.com/docs/en/desktop)

- **Linux (beta)**: Ubuntu 22.04+ and Debian 12+ via Anthropic's apt repository, x86_64 and arm64.
  Cowork on Linux needs KVM and QEMU. Computer use and dictation are not available on Linux; other
  distributions should use the CLI.
  [Claude Desktop on Linux (beta)](https://code.claude.com/docs/en/desktop-linux)
- **WSL sessions**: pick a WSL 2 distribution in the environment selector so Claude, its tools and
  git run inside Linux (WSL 1 is not supported). Trust is per distribution and folder. Plugins are
  unavailable and the file pane is view-only; the terminal and connectors may be missing,
  always on third-party providers. Managed devices may block WSL sessions.
  [Claude Code Desktop in WSL](https://code.claude.com/docs/en/desktop-wsl)
- **iOS Simulator pane (macOS, public beta)**: when Claude builds, runs or checks an iOS app, the
  pane opens and streams a simulator, one device per session. It drives the simulator directly, so it
  needs no computer use and never takes over the screen. Requires Xcode; local sessions only.
  Consent is once per device; builds and opening URLs follow the permission mode. Admins can block
  it with `disableMobileSimulatorTools`. From the CLI the same task goes through computer use.
  [Test iOS apps in the simulator](https://code.claude.com/docs/en/desktop-ios-simulator)

## IDE extensions

- **VS Code** (extension `anthropic.claude-code`, also on Open VSX for Cursor and other forks): a
  graphical panel with inline diffs (per-change accept or reject), plan review as a commentable
  document, `@`-mentions with line ranges, `@terminal:` and `@browser`, checkpoints with fork and
  rewind, an agent map of subagents and background tasks, and dialogs for MCP, plugins, hooks,
  permissions and memory. Gotchas: the extension bundles a private CLI and does not put `claude` on
  PATH; it does not run in Restricted Mode; settings split between `claudeCode.*` in VS Code and the
  shared `~/.claude/settings.json`. Conversations are shared with `claude --resume`. A terminal
  mode (`useTerminal`) gives the CLI UI inside the editor.
  [Use Claude Code in VS Code](https://code.claude.com/docs/en/vs-code)
- **JetBrains**: a plugin (still labeled beta) that runs the real `claude` CLI in the IDE terminal,
  so the CLI must be installed separately. It opens diffs in the IDE viewer, shares the selection
  and open file, and exposes the IDE's diagnostics through a hidden `ide` MCP server
  (`mcp__ide__getDiagnostics`, the name a `PreToolUse` hook must allow). Connect from an external
  terminal with `/ide`. For Remote Development, install the plugin on the host; WSL2 often needs a
  firewall rule or mirrored networking. [JetBrains IDEs](https://code.claude.com/docs/en/jetbrains)

## Browser, screen and phone

- **Chrome**: the Claude in Chrome extension gives Claude a visible browser that shares the user's
  logins (Chrome, Edge and other Chromium browsers; not WSL). Start with `claude --chrome` or turn on
  **Enabled by default** in `/chrome` (that costs context, since the tools stay loaded). Requires a
  claude.ai `/login`: an API key or a `claude setup-token` token keeps it off, as do third-party
  providers. A project's settings cannot turn it on (`CLAUDE_CODE_ENABLE_CFC` in repository settings
  is ignored). Site permissions come from the extension. Tabs live in a per-session tab group.
  [Use Claude Code with Chrome](https://code.claude.com/docs/en/chrome)
- **Computer use (CLI)**: a built-in `computer-use` MCP server, off by default, enabled per project
  in `/mcp`. Research preview on macOS only, Pro, Max and Ultra only (not Team or Enterprise),
  interactive sessions only. Apps are approved per session; terminals and IDEs are click-only and
  browsers view-only. One session holds the lock until it exits. Claude prefers MCP, then Bash, then
  Chrome, and uses screen control last. Desktop offers the same engine on macOS and Windows.
  [Let Claude use your computer from the CLI](https://code.claude.com/docs/en/computer-use)
- **Mobile**: there is no separate Claude Code app; the Code tab of the Claude app for iOS and
  Android reaches cloud sessions, [projects](https://code.claude.com/docs/en/claude-projects) and
  [Remote Control](https://code.claude.com/docs/en/remote-control) sessions, and Dispatch is a task
  messaged in the app. Requires a claude.ai account. Bypass permissions cannot be selected from the
  phone, and local-only commands such as `/plugin` do not work. `/mobile` shows a QR code for the
  app. [Claude Code on mobile](https://code.claude.com/docs/en/mobile)

## Slack and Claude Tag

Two different products answer `@Claude` in Slack, and the agent should not mix them up.

- **Claude Tag** (Team and Enterprise, public beta): the organization's shared `@Claude` identity in
  channels, threads and DMs, set up once by an Owner (`@Claude connect` pairs the workspace). It runs
  in an ephemeral cloud sandbox, is billed to the organization's usage balance under a spend limit,
  needs no per-user seat for channel work, and gets connectors, plugins and repositories configured
  per Slack, workspace or channel. Its channel sessions use organization-level cloud environments
  only (shared or self-hosted). Its documentation lives on claude.com.
  [Claude Tag](https://code.claude.com/docs/en/claude-tag)
- **Claude Code in Slack** (the earlier app): Pro, Max and Ultra only, and only in workspaces not
  connected to Claude Tag. Each mention starts a cloud session under the mentioning user's own
  account and repositories; a routing mode chooses between code-only and code-plus-chat; channels
  only, GitHub only, one PR per session. In a workspace connected to Claude Tag the earlier bot
  answers with a retirement notice (retired effective October 5, 2026).
  [Claude Code in Slack](https://code.claude.com/docs/en/slack)

## Cloud sessions

A cloud session is Claude Code running on a cloud VM (Anthropic-managed by default) instead of the
user's machine. It keeps running when the user disconnects, persists across devices, and counts
toward normal plan usage. Available on Pro, Max, Ultra and Team, and for Enterprise users with the
right seats; needs a claude.ai account (not Bedrock, Agent Platform or Foundry), and is unavailable
to Zero Data Retention, HIPAA and CMEK organizations. An organization IP allowlist breaks
Anthropic-hosted sessions.

- **GitHub access**: the Claude GitHub App (needed for auto-fix and projects), or `/web-setup`, which
  sends the local `gh` token to the claude.ai account. Repositories elsewhere can be uploaded as a
  bundle, but those sessions cannot push back.
- **From the terminal**: `claude --cloud "task"` starts a new cloud session from the GitHub remote at
  the current branch (push first; `--remote` is the deprecated name).
  `claude -p "message" --cloud <session-id>` queues a follow-up and exits.
  `claude --teleport` pulls a cloud session into the terminal as a local fork. A running terminal
  session cannot be pushed up to the cloud from the CLI.

  ```bash
  git push
  claude --cloud "Fix the flaky auth test and open a PR"
  claude --teleport
  ```

- **Auto-fix PRs**: `/autofix-pr` on a PR branch, or a pasted PR URL, makes a cloud session watch the
  PR and push fixes for CI failures and review comments. Replies post under the user's GitHub
  account, which can trigger comment-driven automation in the repository.
- **Inside a session**: permission modes are Accept edits, Plan and Auto only (no Manual or Bypass);
  only text-output commands work; `/config` opens web settings; sessions can be shared (team or
  public, depending on plan), archived or deleted.
- **What does not carry over**: user-level `~/.claude` content (CLAUDE.md, skills, agents, plugins),
  user-scope MCP servers, and plugins enabled in repository settings. Repository `CLAUDE.md`,
  skills, agents, hooks and `.mcp.json` do load.

[Get started with Claude Code in the cloud](https://code.claude.com/docs/en/web-quickstart) and
[Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web)

## Cloud environments

Every cloud session runs in an environment: Anthropic-hosted (`env_...`) or self-hosted
(`ccpool_...`). The same environments serve every surface, including routines and Claude Tag.
Onboarding creates a **Default** environment with Trusted network access; the CLI picks one with
`/remote-env` (saved as `remote.defaultEnvironmentId`).

- **Network access levels**: None, Trusted (a default allowlist of registries, GitHub and cloud
  SDKs), Full, or Custom domains. GitHub, connectors and the Anthropic API stay reachable.
- **Environment variables** are visible to everyone using the environment, so they are not for
  secrets. **Network secrets** (Anthropic-hosted only) are attached by a proxy to requests for listed
  hosts after they leave the VM, so the key never enters the session.
- **Setup scripts** run as root before Claude starts and are cached as a filesystem snapshot when
  they finish quickly. `SessionStart` hooks are the per-start alternative that also runs locally;
  gate them on `CLAUDE_CODE_REMOTE=true`.
- **GitHub proxy gotcha**: GraphQL is blocked, so `gh pr` and `gh issue` fail; use `gh api` REST
  calls. Tag pushes and branch deletes are rejected, and API access is limited to the session's
  repositories.
- **Organization-shared environments** (Team and Enterprise) are created or shared by an Owner; an
  org default can be set.

[Configure cloud environments](https://code.claude.com/docs/en/cloud-environments)

## Self-hosted environments

Public beta on Team and Enterprise, off until an Owner turns on **Allow self-hosted environments**.
Cloud sessions started from any surface can be routed to an environment whose runners live in the
organization's network, so sessions reach internal services and checkouts stay on owned machines.
The control plane, transcripts and model traffic still go to `api.anthropic.com` (or, optionally,
inference to Bedrock or Agent Platform). All connections are outbound; nothing inbound is needed.
Not for the user who just wants their own always-on machine: that is Remote Control.
[Self-hosted environments](https://code.claude.com/docs/en/self-hosted-environments)

- **Model**: an environment groups runners; a runner (`claude self-hosted-runner`, part of the normal
  binary) polls for sessions, clones the repository, and spawns a child Claude Code per session.
  A runner locks to one owner (a user or a Claude Tag agent) at its first session, so the fleet must
  be at least as large as the number of concurrently active owners. The environment secret is the
  registration credential.
- **Get started**: a guided setup subcommand or manual steps create the environment, start a runner
  with `--environment-secret-file` and a dedicated `--base-dir`, and route a test session.
  [Self-hosted environments quickstart](https://code.claude.com/docs/en/self-hosted-environments-quickstart)
- **Production**: no published runner image (the operator builds one), one ephemeral container per
  session recommended, default-deny egress is the operator's job (Bash is pre-approved), and git
  credentials come from the image, per-session minting, or the Anthropic git proxy (github.com only).
  Anyone in the organization can dispatch to an environment. Also covers Kubernetes and Compose
  recipes, shutdown timing, `doctor`, and known issues.
  [Deploy self-hosted environments to production](https://code.claude.com/docs/en/self-hosted-environments-deploy)
- **Customization**: a wrapper script (`--exec-path`) and runner lifecycle hooks in `--hooks-dir`
  (`checkout`, `command`, `post-session`), separate from Claude Code hooks; an autoscaling
  orchestrator with a `spawn-runner` hook for on-demand runners; MCP sources; permissions.
  The host's `~/.claude/` is snapshotted once at runner startup.
  [Customize sessions in self-hosted environments](https://code.claude.com/docs/en/self-hosted-environments-configuration)
- **CI test loop**: dispatch with `claude -p "..." --environment ccpool_... --output-format json`,
  read replies with a `Stop` hook on a test runner, and follow up with `--cloud <session-id>`.
  [Test self-hosted environments end to end](https://code.claude.com/docs/en/self-hosted-environments-testing)
- **Reference**: runner and orchestrator flags (most mirror `SELF_HOSTED_RUNNER_*` variables, whose
  durations are in milliseconds while flags use minutes or seconds), health endpoints and Prometheus
  metrics. Older names say "pool" for environment.
  [Self-hosted environments reference](https://code.claude.com/docs/en/self-hosted-environments-reference)
- **Session identity**: each session gets a signed JWT in `CLAUDE_CODE_SESSION_ACCESS_TOKEN`
  (prefix `sk-ant-cc-`) that internal services verify against Anthropic's published keys, checking
  the audience against the environment ID. It proves which session and environment, not which
  process presents it, so derived credentials should be scoped to one coding session.
  [Verify session identity in self-hosted environments](https://code.claude.com/docs/en/self-hosted-environments-identity)
