# Parallel Agents, Background Sessions and Automation

This branch covers every way Claude Code runs more than one agent at a time or runs without the user driving each turn: subagents (from the orchestration angle), agent view and background sessions, agent teams, cross-session messaging, dynamic workflows, worktrees, `/loop` and other schedulers, `/goal`, headless `-p` runs, deep links, Remote Control and Projects. The subagent definition format (frontmatter fields, scopes, tool lists) lives in `references/extending.md`. Cloud sessions themselves and the desktop app are in `references/surfaces.md`; CI integrations such as GitHub Actions are in `references/review-and-ci.md`; the Agent SDK packages are in `references/agent-sdk.md`. Facts are as of Claude Code 2.1.317.

## The landscape

Claude Code has five ways to work on several tasks at once, which differ in who coordinates and where the work runs: subagents, agent view, agent teams, dynamic workflows and Projects. Worktrees and cross-session messaging support them without being a way to run agents. Every worker is a Claude session; to involve another tool, expose it as an MCP server. Parallel work multiplies token usage. [Run agents in parallel](https://code.claude.com/docs/en/agents)

How to check on running work, by kind:

- `claude agents` (shell) opens agent view for background sessions.
- `/tasks` lists everything running in the background of the current session (subagents, shell commands, monitors) and lets the user attach to or stop each item.
- `/workflows` lists dynamic workflow runs and their phases.
- `/agents` (slash command) now only prints where subagent files live; it is not the old interactive manager, and it is unrelated to `claude agents`.

### Choosing between

- **Subagent**: a side task inside the current session whose output would flood the context; the result comes back as a summary to the conversation that spawned it. Cheapest option.
- **Background session (agent view)**: several independent tasks the user hands off and checks later; each is a full session on the local machine that reports only to the user, survives closing the terminal, and moves into its own worktree before editing.
- **Agent team**: Claude splits one project into pieces, assigns them and keeps peers in sync through a shared task list and direct messages. Experimental, off by default, highest token cost.
- **Dynamic workflow**: a job too big for a handful of subagents (dozens to hundreds of agents) or one that needs findings cross-checked; a script, not Claude's turn-by-turn judgment, holds the plan, and the run is resumable and saveable as a command.
- **Session-scoped scheduled task (`/loop`, cron tools)**: re-run a prompt on an interval or once later while a session stays open on the user's machine; expires after seven days.
- **Desktop scheduled task**: recurring local work that needs local files and tools, without an open CLI session; the desktop app must be running and the machine awake.
- **Cloud scheduled task (formerly routine)**: unattended work that must run with the machine off, or that starts from an HTTP call or a GitHub event; runs on a fresh clone in the cloud.
- **Project**: an ongoing stream of related tasks over days or weeks; Claude itself starts and tracks parallel cloud threads from one conversation (claude.ai/code, desktop or mobile only).
- **`/goal`**: keep one session working turn after turn until a condition holds, rather than on a schedule.

## Subagents as an orchestration tool

The definition format is in `references/extending.md`; these are the runtime behaviors that changed recently. [Create custom subagents](https://code.claude.com/docs/en/sub-agents)

- **Background by default**: with nothing configured, a subagent Claude spawns from the main conversation starts in the background, and its result arrives later as a completion notification. In an interactive terminal, VS Code or desktop session, Claude cannot choose to wait for a subagent while fork mode is on (the default); set `CLAUDE_CODE_FORK_SUBAGENT` to `0` in settings `env` to let it wait. `claude -p` and the SDK can wait. Background subagents get a smaller built-in tool set and surface their permission prompts in the main session; a "for the rest of the session" answer applies to the whole session.
- **Forks**: a fork is a subagent that inherits the whole conversation, system prompt, tools and model, and shares the parent's prompt cache, so it is cheaper than a fresh subagent that needs the same context. The user starts one with `/subtask <task>`; Claude starts them on its own while fork mode is on (deny `Agent(fork)` to stop that). A fork cannot spawn forks. Note the naming: `/fork` copies the whole session into a new background session in agent view; only with agent view turned off does `/fork` start a forked subagent.
- **Nesting**: subagents can spawn their own subagents, by default up to three layers below the main conversation (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`; `1` disables nesting). Omit `Agent` from a subagent's tools to keep it from delegating.
- **Concurrency**: a session refuses new Agent-tool spawns while too many are running (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`); there is no limit on the total over a session, and sessions with ultracode on are exempt. Workflow agents and teammates have their own limits.
- **Resume and messaging**: each invocation is a new instance; to continue one, Claude calls `SendMessage` with the agent's ID or name, and the subagent resumes in the background with its full history. This does not need agent teams. Explore and Plan are one-shot and cannot be resumed. A subagent the user stopped from `/tasks` does not auto-resume.
- **Isolation**: `isolation: worktree` in frontmatter, or `isolation: "worktree"` on the call, gives a subagent its own temporary worktree.
- **Safety framing**: Claude Code scans subagent reports for text imitating harness output and marks reports as subagent words; no agent message counts as user approval or can change permissions, `CLAUDE.md` or configuration.
- **Named subagents and teams interact**: with agent teams enabled, a subagent Claude spawns with a `name` launches as a teammate instead, and Claude may name subagents on its own, so teams can form unasked.

## Agent view and background sessions

Agent view (`claude agents`, research preview) is one terminal screen listing every background session across all projects, grouped as Ready for review, Needs input, Working and Completed, with a model-written one-line summary per row and a linked PR or MR label colored by CI and review status. Each background session is a full Claude Code conversation that keeps running with no terminal attached. [Manage multiple agents with agent view](https://code.claude.com/docs/en/agent-view)

Ways to create one:

- Type a prompt in agent view's dispatch input. Every prompt starts a new session, not a follow-up. A first word or `@name` matching a custom subagent runs that subagent as the main agent; `@<repo>` targets a child repository; `!` runs a plain shell job (PTY-backed, output kept in memory only, cleaned up about five minutes after exit).
- From the shell: `claude --bg "<prompt>"`, optionally with `--agent`, `--name`, `--model`, `--resume <id>` or `--exec '<command>'`. `--bg` cannot be combined with `-p`.
- From inside a session: `/background` (alias `/bg`) or `←` on an empty prompt moves the current conversation to the background; `/fork` copies it into a new background session while the original keeps going. Exiting with background work running offers "Move to background and exit".

```bash
claude --bg --name "flaky-test-fix" "investigate the flaky SettingsChangeDetector test"
claude attach flaky-test-fix
claude logs 7c5dcf5d
claude stop 7c5dcf5d
```

Key behaviors and gotchas:

- **Peek, attach, detach**: `Space` peeks and lets the user reply in place; `Enter` or `→` attaches as a full fullscreen session; `←` on an empty prompt or `/exit` detaches. Detaching never stops the session; `/stop` or `Ctrl+X` does. A permission prompt or dialog cannot be answered from peek, only by attaching.
- **File isolation**: a dispatched or `--bg` session moves into its own git worktree under `.claude/worktrees/` before its first edit, and is told to commit and push its work (never to main, never force-push). A session backgrounded with `←` or `/bg` keeps editing where it was. `worktree.bgIsolation: "none"` turns isolation off.
- **Deleting**: `Ctrl+X` twice in agent view deletes the session and its Claude-created worktree, including uncommitted changes; `claude rm <id>` keeps a worktree that has uncommitted changes, and both refuse when commits are unpushed until the user pushes or deletes again. Transcripts stay available to `claude --resume`.
- **Other shell commands**: `claude respawn <id>` or `--all` restarts sessions (for example onto a new binary); `claude agents --json --all` is the supported way for a script or another session to read state (`working`, `blocked`, `done`, `failed`, `stopped`). Do not parse `~/.claude/jobs/`. Each session gets `$CLAUDE_JOB_DIR/tmp` as a no-prompt scratch directory.
- **What carries over when backgrounding**: background shell commands, background subagents and `/loop` tasks carry over; a running dynamic workflow continues only when Claude relaunches it (the user asks); running Monitor watches stop.
- **Dispatch defaults**: `claude agents --permission-mode plan --model opus --effort high` (also `--agent`, `--restricted`) sets defaults for sessions dispatched from that view; `/model`, `/effort` and `/fast` typed in the dispatch input do the same for that window only.

### The supervisor and environment variables

A supervisor process (`claude daemon status`, `claude daemon logs`, `claude daemon stop --any [--keep-workers]`) hosts background sessions. It stops the process of a session that is finished or waiting and unattached for about an hour; the conversation stays on disk and resumes on attach or reply. Pinning (`Ctrl+T`) keeps a session's process running. Sessions survive sleep and auto-updates but stop on shutdown; if the supervisor itself dies, sessions stop unless a new one starts (run `claude agents`) within about a minute.

A background session reads settings from the directory it runs in and inherits `PATH` and cloud-provider selection from the shell it was dispatched from, but an `ANTHROPIC_BASE_URL` gateway and its headers and credential exported only in a shell reach it only in narrow cases (the supervisor was started from a shell with the same gateway, and the session runs in the directory being dispatched from). That is why gateway, proxy and similar network variables belong in a settings file's `env` block, which every background session and respawn reads:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://llm-gateway.example.com"
  }
}
```

The symptoms of getting this wrong are a `No LLM gateway` row or `Could not resolve authentication method` on dispatch. Turn agent view off with `disableAgentView` or `CLAUDE_CODE_DISABLE_AGENT_VIEW`.

## Agent teams

An agent team is one lead session plus teammate sessions, each with its own context window, coordinating through a shared task list (pending, in progress, completed, with dependencies and file-locked claiming) and a mailbox. Teammates message each other directly, and the user can talk to any teammate. Enable with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`; teams need an interactive session (a named subagent in `-p` or the SDK stays an ordinary subagent). [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams)

- **Display**: in-process by default (agent panel below the prompt; arrows and `Enter` to view a teammate), or split panes with `teammateMode` (`auto`, `tmux`, `iterm2`), which need tmux or iTerm2 with the `it2` CLI.
- **Roles**: reference a subagent definition by name when spawning; its `tools`, `model` and body apply, but its `skills` never apply and some fields differ between in-process and split-pane teammates. The team config under `~/.claude/teams/` is runtime state; do not author it.
- **Permissions**: teammates start in the lead's permission mode (except `dontAsk`) and their prompts surface in the lead. Pre-approve common tools before spawning.
- **Quality gates**: `TeammateIdle`, `TaskCreated` and `TaskCompleted` hooks can exit 2 to push back.
- **Limits**: one team per session, no nested teams, the lead is fixed, `/resume` and `/rewind` do not restore in-process teammates, in-process teammates cannot run background subagents, and teammates are not isolated in worktrees, so partition files. Start with three to five teammates.
- **Gotcha**: if Claude spawns teammates when the user wanted subagents, set the variable to `0`; it applies to the next spawn without restarting.

## Cross-session messaging

Claude can list the user's other Claude Code sessions with `ListAgents` and send one plain-text message with `SendMessage`; it may do so unasked when its work affects another session. The user can name a target with an `@session-name` mention, and `/list-agents` (alias `/peers`) shows what is reachable: subagents, teammates, other local sessions (including background and long-running `-p` sessions), and, while this session is connected to Remote Control, cloud sessions and Remote Control sessions on other machines. On by default from v2.1.224 on macOS and Linux. [Message your other Claude Code sessions](https://code.claude.com/docs/en/cross-session-messaging)

- **Delivery**: the receiver reads a message between tool calls, or a new turn starts if it is idle. Same-machine messages use a per-session socket (`CLAUDE_CODE_MESSAGING_SOCKET`, which hooks and scripts can also post to) and never touch Anthropic servers; cross-machine and cloud messages go through Anthropic servers over Remote Control.
- **Remote Control routing gotchas**: without a Remote Control connection, a message to another machine carries no reply address; a cloud session can never reply with `SendMessage`; an `offline` target receives the message when it reconnects. `isolatePeerMachines: true` requires approval before any message leaves the machine.
- **`notify_when_idle`**: Claude can subscribe to one notice when a local session next goes idle or exits, without spending tokens there; the subscription lapses after 12 hours.
- **Trust**: an incoming message never counts as the user's approval, cannot change configuration, and slash commands in it do not run.
- **`crossSessionInbound`**: `accept`, `hold` or `refuse`. With no value, delivery depends on the two sessions' permission-mode classes (a session that bypasses prompts holds messages from prompting sessions for approval). A `-p` worker that should take messages unattended needs `accept` in its `--settings`. `--bare` sessions bind no inbox. Deny `SendMessage` and `ListAgents` to stop sending (this also blocks subagent and teammate messaging).

## Dynamic workflows

A dynamic workflow is a JavaScript script that Claude writes (or a saved one) and a runtime executes in the background, calling `agent()`, `parallel()`, `pipeline()`, `phase()` and `log()`. Intermediate results stay in script variables, so Claude's context holds only the final answer, and the script can apply quality patterns such as adversarial verification of each finding. Available on paid plans, the API and cloud providers; on Pro, turn it on in `/config`. [Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows)

- **Starting one**: include the keyword `ultracode` in a typed prompt, or ask for "a workflow" in plain words; or set `/effort ultracode` (or `claude --effort ultracode`, or the `ultracode` setting) so Claude plans a workflow for every substantive task. The keyword does nothing in `-p` prompts, scheduled-task prompts or relayed webhook text. `/deep-research <question>` is the bundled workflow.
- **The Workflow tool and approval**: interactive runs show a plan prompt (every run in Manual mode, first launch only in auto mode, never in bypass). In `-p` and the SDK there is no prompt; allow `Workflow` or `Workflow(<name>)`, use auto or bypass mode, or approve via a hook or `--permission-prompt-tool`.
- **Watching and saving**: `/workflows` shows phases and agents (`p` pause, `x` stop, `r` restart an agent, `s` save). Saved scripts go to `.claude/workflows/` or `~/.claude/workflows/` and run as `/<name>` with an `args` input; plugins can ship them. Load the `/workflow-authoring` skill before editing a script.
- **Runtime constraints**: no mid-run user input, no filesystem or shell access from the script itself (agents do the work), no `import()`, and `Date.now()` and `Math.random()` throw so relaunches replay deterministically. Concurrency defaults to 16 agents and a run caps at 1,000 agents.
- **Resume**: within the same session, a relaunch returns saved results for completed agents up to the first changed or failed one, and reruns everything after it. Backgrounding or exiting stops the run until Claude relaunches it.
- **Size guideline**: `workflowSizeGuideline` (`small` fewer than 5 agents, `medium` fewer than 10, `large` fewer than 50, `unrestricted`) is advice to Claude, not a cap; the default is `medium` (`small` on Pro). A `Large workflow` warning appears past 25 agents or a large projected token total. Try a run on a small slice first.
- **Turning off**: `disableWorkflows` or `CLAUDE_CODE_DISABLE_WORKFLOWS=1`, which also removes ultracode.

## Worktrees

A git worktree gives a session its own files and branch on shared history. `claude --worktree <name>` (or `-w`) creates `.claude/worktrees/<name>/` on branch `worktree-<name>`, branched from the remote default branch unless `worktree.baseRef` is `"head"`; `--worktree "#1234"` or a PR or MR URL branches from that change. Claude can also enter one mid-session with `EnterWorktree`. [Run parallel sessions with worktrees](https://code.claude.com/docs/en/worktrees)

- **Enforced isolation**: while a session (or any subagent it spawns) is isolated in a worktree, Claude Code blocks edits to the main checkout, commands whose working directory is the main checkout, and git redirected into it; it does not track arbitrary writes such as `cp`.
- **Environment**: a worktree is a fresh checkout, so list gitignored files to copy (such as `.env`) in `.worktreeinclude`. Project plugins, "don't ask again" approvals, and untracked skills, agents and commands are shared from the main checkout. Hook `${CLAUDE_PROJECT_DIR}` stays at the original root; read `cwd` from hook input for the worktree path.
- **Cleanup**: on exit, clean unnamed worktrees are removed automatically and others prompt; `-p` runs never clean up. A periodic sweep removes old subagent and background-session worktrees that hold no work. `git worktree remove` (after `git worktree unlock` if needed) handles the rest.
- **Non-git VCS**: `WorktreeCreate` and `WorktreeRemove` hooks replace the git logic, and also let `/batch` run outside git.
- **Gotcha**: `permissions.blockWritesOutsideWorkingDirectories` removes the worktree tools; start with `claude --worktree` (or `--bg --worktree`) instead.

## In-session automation

- **`/loop` and cron tools**: `/loop 5m <prompt>` runs on a fixed cron interval; `/loop <prompt>` lets Claude pick each delay (one minute to one hour, via `ScheduleWakeup`); bare `/loop` runs a built-in maintenance prompt or `.claude/loop.md`. Natural language ("remind me at 3pm") creates one-shot tasks via `CronCreate`, `CronList`, `CronDelete`. Tasks fire only while the session runs and is idle, use local time, get jitter (schedule off `:00` and `:30` when timing matters), and recurring ones expire after seven days. `Esc` stops only a self-paced loop; ask Claude to cancel a fixed one. Backgrounding carries loops over; `CLAUDE_CODE_DISABLE_CRON=1` turns it all off. [Run prompts on a schedule](https://code.claude.com/docs/en/scheduled-tasks)
- **Monitor tool**: runs a script (or opens a WebSocket) in the background and feeds each output line to Claude as an event, often better than polling with `/loop`. Every watch has a deadline: 5 minutes by default, at most 30 minutes, and at most 10 minutes in a single-prompt `-p` run. At the deadline the watch ends and Claude gets one notice, so the agent MUST re-arm the watch itself if it is still needed. Monitor follows Bash permission rules, stops with the subagent that started it, and does not survive backgrounding a session. [Tools reference](https://code.claude.com/docs/en/tools-reference)
- **`/goal <condition>`**: after each turn a small fast model judges whether the condition holds, and if not Claude starts another turn; the goal clears when met, judged impossible, or on errors the user must fix (auth, credits, unrecoverable context overflow, unavailable model). One goal per session, restored on resume. The evaluator cannot run commands, so write a condition Claude's own output can prove ("`npm test` exits 0") and add a turn bound ("or stop after 20 turns"). It does not change the permission mode; pair it with auto mode for unattended turns. Background work defers evaluation, with periodic check-ins. `/goal` is a session-scoped prompt-based Stop hook, so it is unavailable when hooks are disabled or the folder is untrusted. [Keep Claude working toward a goal](https://code.claude.com/docs/en/goal)

## Headless and programmatic runs

`claude -p "<prompt>"` runs non-interactively and exits 0 on success; failures inside the run print as the result on stdout. `--output-format` is `text`, `json` (result, `session_id`, cost) or `stream-json` (add `--verbose`, and `--include-partial-messages` for token deltas); `--json-schema` puts schema-conforming output in `structured_output`, which may be absent. Continue with `--continue` or `--resume <session_id>`. [Run Claude Code programmatically](https://code.claude.com/docs/en/headless)

- **`--bare`**: skips discovery of hooks, skills, subagents, plugins, MCP servers, auto memory and `CLAUDE.md`, sends no system reminders, disables background tasks, and never reads OAuth or the keychain (needs `ANTHROPIC_API_KEY` or an `apiKeyHelper`). Recommended for CI and scripts, and slated to become the `-p` default. Without it, `-p` runs a repository's hooks and `.mcp.json` servers even in an untrusted folder, with no trust dialog.
- **Permissions in unattended runs**: in Manual mode, a call that needs approval is denied unless something approves it. Use `--allowedTools`, or `--permission-mode auto`, `dontAsk` or `acceptEdits`. `--permission-prompts none` stops the run from waiting on a permission host (an SDK `canUseTool` callback or `--permission-prompt-tool`), removes `AskUserQuestion`, and tells Claude not to retry denials, which appear as `permission_denials` in the result.
- **Exit behavior**: a `-p` run waits for background subagents, workflows and pending `/loop` wakeups, and for Monitor watches up to a 10-minute idle cap (`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`). SIGTERM exits 143 without finishing the turn; SIGINT ends the turn first.
- **Commands in `-p`**: user skills (`/skill-name` in the prompt) work; terminal-only built-ins do not; `/config key=value` changes settings.

```bash
claude -p "Update the dependency pins and run the tests" \
  --permission-mode auto \
  --permission-prompts none \
  --output-format json
```

## Deep links

A `claude-cli://open` URL opens a new terminal window running Claude Code with a working directory (`cwd`, absolute path, or `repo=owner/name`, resolved to the clone where the user last ran `claude`) and a pre-filled prompt (`q`, URL-encoded). The prompt is never sent until the user presses Enter, and a `Prompt from an external link` warning shows. The handler registers itself the first time the user sends a prompt in an interactive session (or opens agent view); `disableDeepLinkRegistration` prevents it. GitHub-rendered Markdown strips the scheme, so put such links in code blocks there. Use them in runbooks, alerts and dashboards. [Launch sessions from links](https://code.claude.com/docs/en/deep-links)

## Scheduling outside a session

- **Cloud scheduled tasks (formerly routines)**: a saved prompt plus repositories, connectors and a cloud environment that runs as a full cloud session, with schedule triggers (presets or cron, at most hourly, cron hours in UTC unless `CRON_TZ=` is given; also one-off runs), API triggers (POST to a per-task `/fire` URL with a bearer token and an optional `text` body) and GitHub triggers (pull request, release, issue events; needs the Claude GitHub App). Create with `/schedule` (alias `/routines`) or at claude.ai/code/routines; `/schedule list`, `update`, `run`, and questions about run history work from the CLI. Runs start in auto mode, clone each repository fresh, push to `claude/` branches by default, act as the user's GitHub identity and connectors, and count against the user's plan plus hourly run caps. Locally added MCP servers are not available; use claude.ai connectors or a committed `.mcp.json`. The old name still appears in URLs, the API and some app labels. [Automate work with scheduled tasks](https://code.claude.com/docs/en/routines)
- **Desktop scheduled tasks**: local tasks in the desktop app's Scheduled page that start a fresh session in a chosen folder, with their own permission mode and model, optional per-run worktree, and a prompt stored at `~/.claude/scheduled-tasks/<name>/SKILL.md`. They fire only while the app is open and the machine awake, with one catch-up run for missed times in the last seven days, so prompts SHOULD guard against running at an unexpected hour. Run a task once with **Run now** and "always allow" its prompts to avoid stalled runs. [Schedule recurring tasks in Claude Code Desktop](https://code.claude.com/docs/en/desktop-scheduled-tasks)

## Remote Control and Projects

- **Remote Control**: drives a session running on the user's machine from claude.ai/code or the Claude mobile app; execution and files stay local, the transcript syncs through Anthropic. Start with `claude remote-control` (server mode, many sessions; `--spawn worktree` gives each its own worktree; `--capacity`), `claude --remote-control` (`--rc`) for an interactive session, or `/remote-control` (`/rc`) inside an existing one; `remoteControlAtStartup` auto-connects. Requires a claude.ai subscription login; it is unavailable with API keys, Amazon Bedrock, Google Cloud's Agent Platform, Microsoft Foundry, a non-Anthropic `ANTHROPIC_BASE_URL`, or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`. It also carries cross-machine session messages and enables mobile push notifications. Some commands (such as `/plugin`, `/resume`) are local-only. Stopped server sessions can be brought back for about four hours. [Continue local sessions from any device with Remote Control](https://code.claude.com/docs/en/remote-control)
- **Projects**: one long-running coordinator conversation at claude.ai/code, the desktop app or the mobile app (not the CLI or IDE plugins) that starts parallel threads, usually cloud sessions, each on its own branch with its own PR, and an Overview pane showing what needs the user. Threads share project instructions, project memory, repositories, uploaded files and a cloud environment. Cloud threads load each repository's root `CLAUDE.md` and `.claude/rules/` but not its skills, agents, `.mcp.json`, hooks, permission rules or `env`; use claude.ai skills, connectors and Project settings plugins instead, or ask Claude to run a thread on the user's computer through Remote Control ("Work locally"). Threads run in auto mode, and approvals must be given inside the thread. Public beta on Pro, Max and Ultra only; a project belongs to one user. [Let Claude coordinate ongoing work with Projects](https://code.claude.com/docs/en/claude-projects)
