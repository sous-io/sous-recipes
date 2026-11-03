---
name: about-claude-code
description: >
  YOU MUST load this skill when the work involves Claude Code itself: choosing or using a Claude
  Code feature (skills, subagents, hooks, MCP, plugins, mods, background sessions, agent teams,
  workflows, scheduled tasks, headless runs, the Agent SDK), configuring its settings, permissions
  or models, or answering what Claude Code can do. It maps every feature to its documentation page.
user-invocable: false
---

# About Claude Code

Claude Code is Anthropic's agentic coding tool: a harness around a Claude model that supplies
tools, manages context and enforces permissions, in the terminal, IDEs, a desktop app, the web,
Slack and CI. This skill is a local map of its features, so the agent can learn quickly what
exists, how the features fit together, and which documentation page holds the details, without
fetching anything first.

## Freshness

This skill was written against **Claude Code 2.1.317** on **2026-11-03**. Claude Code ships about
one release a day, so details drift quickly. Before relying on anything specific here, the agent
MUST run `claude --version` and compare:

- **Up to about 30 releases or 30 days behind**: trust the map and the concepts; check the linked
  page before using a flag, setting key, limit or default.
- **30 to 90 behind**: treat every specific as possibly changed; read the linked page before acting
  on it.
- **More than 90 releases or 90 days behind**: treat this skill as an index of links only, read the
  docs for everything, and tell the user that this skill needs a refresh.

## How to Use This Skill

1. Find the branch for the work in the map below and read only that reference file. Each entry
   there says what a feature is, when to use it, its main gotcha, and links its documentation page.
2. For exact flags, setting keys, field names, limits or prices, fetch the linked page. Appending
   `.md` to any documentation URL returns plain Markdown (for example
   `https://code.claude.com/docs/en/hooks.md`), and the full page index is at
   `https://code.claude.com/docs/llms.txt`.
3. For a question this skill and one page do not settle, delegate it to the built-in
   `claude-code-guide` agent, which searches the live documentation.

The agent's own training knowledge of Claude Code is older than this skill. Where the two
disagree, this skill and the live documentation win.

## Things That Changed

Each item below is something an agent trained around mid-2026 is likely to believe that is no
longer true. If the agent remembers otherwise, its memory is out of date.

- **Permission modes**: interactive terminal and VS Code sessions with no configured mode start in
  auto mode. The ask-first mode is now called Manual (its config value is still `default`, and
  `manual` is accepted). `claude -p` and Agent SDK runs start in Manual and deny any call that
  needs approval unless allow rules, a hook or `--permission-mode auto` cover it.
  [Choose a permission mode](https://code.claude.com/docs/en/permission-modes)
- **Project settings are restricted**: many keys are ignored in a committed
  `.claude/settings.json`, including `defaultMode: "bypassPermissions"`, auto mode rules and
  several environment variables. Each key's allowed scopes are listed in the settings reference.
  [All settings](https://code.claude.com/docs/en/settings-reference)
- **Subagents run in the background**: a subagent spawned from the main conversation starts in the
  background, and its result arrives later as a notification. Subagents can spawn their own, up to
  three layers deep by default. The `/agents` creation wizard is gone; subagents are defined by
  asking Claude or by editing `.claude/agents/` directly.
  [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- **Sessions**: `/branch` copies the conversation into a new session and switches to it; `/fork`
  copies it into a new background session while the current one continues. `claude agents` opens
  agent view, the dashboard for background sessions.
  [Manage sessions](https://code.claude.com/docs/en/sessions)
- **Tools**: TaskOutput is removed (read a background task's output file with Read). The
  task-tracking tools are offered only on older models unless `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` is
  set. Glob and Grep are absent by default on macOS, Linux and WSL, where Claude searches with
  `find` and `grep` through Bash. Every Monitor watch has a deadline (at most 30 minutes) and must
  be restarted when it ends. [Tools reference](https://code.claude.com/docs/en/tools-reference)
- **MCP tools are deferred**: only tool names and server instructions load at startup; Claude loads
  a tool's schema with ToolSearch before calling it. A permission rule `mcp__name` matches only the
  server called exactly `name`; use `mcp__name__*` for all of its tools.
  [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)
- **Commands are skills**: `.claude/commands/` files and skills share one namespace, and a skill
  wins over a command of the same name. A skill with `context: fork` runs in a fresh subagent with
  no conversation history, in the background unless it sets `background: false`.
  [Extend Claude with skills](https://code.claude.com/docs/en/skills)
- **Hooks**: there are five handler types (`command`, `http`, `mcp_tool`, `prompt` and `agent`).
  A hook that crashes, times out or exits with an unexpected code lets the action through unless
  the hook sets `"onFailure": "block"`. [Hooks reference](https://code.claude.com/docs/en/hooks)
- **Mods**: plugins can now run JavaScript or TypeScript inside Claude Code, drawing panes and
  reacting to events in-process. They are not sandboxed, and permission rules do not cover their
  file, process or network calls. [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview)
- **Review commands**: `/review` is an alias of `/code-review`, which finds bugs (`--fix` applies
  fixes). `/simplify` is a cleanup-only review. Ultraplan was removed; use plan mode.
  [Review locally with /code-review](https://code.claude.com/docs/en/code-review-local)
- **Dynamic workflows**: the trigger keyword is `ultracode` (plain "workflow" no longer triggers
  one), and `/effort ultracode` turns workflows on for every substantive task, separately from the
  effort level. [Dynamic workflows](https://code.claude.com/docs/en/workflows)
- **Agent teams**: TeamCreate and TeamDelete are removed; with agent teams enabled, each session
  has one implicit team and teammates are spawned through the Agent tool.
  [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams)
- **AGENTS.md**: Claude Code reads AGENTS.md natively, but only when the project has no CLAUDE.md,
  `.claude/CLAUDE.md` or CLAUDE.local.md; otherwise CLAUDE.md must import it with `@AGENTS.md`.
  [How Claude remembers your project](https://code.claude.com/docs/en/memory)
- **Permission rule paths**: path rules written as `Write(...)` never match; use `Edit(...)`. A
  `.claudeignore` file has no effect. [Configure permissions](https://code.claude.com/docs/en/permissions)
- **Cloud sessions**: `claude --cloud` starts one (`--remote` is a deprecated alias).
  [Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web)

## The Map

Each reference file covers one branch of Claude Code. Read the one whose trigger matches the work.

- [references/foundations.md](references/foundations.md): Read when the work involves how the
  agentic loop, context window, compaction or prompt cache behave; where configuration and session
  data live; CLAUDE.md, AGENTS.md, rules or auto memory; resuming, branching or forking sessions;
  checkpoints and rewind; working practices; monorepos; or Claude Code terminology.
- [references/reference-and-troubleshooting.md](references/reference-and-troubleshooting.md): Read
  when the work involves choosing a `claude` subcommand or flag, finding a slash command, looking up
  environment variables, what a built-in tool does or why it is missing, interactive keys, or
  diagnosing install, login, configuration or runtime errors.
- [references/extending.md](references/extending.md): Read when the work involves choosing between,
  writing or debugging a skill, custom subagent, settings hook, MCP server or claude.ai connector,
  output style, artifact or channel.
- [references/plugins-and-mods.md](references/plugins-and-mods.md): Read when the work involves
  installing, building, testing, publishing or measuring a plugin; running a marketplace;
  organization plugin or mod policy; or writing a mod.
- [references/agents-and-automation.md](references/agents-and-automation.md): Read when the work
  involves agents running in parallel or without the user driving each turn: subagent
  orchestration, agent view and background sessions, agent teams, cross-session messaging, dynamic
  workflows, worktrees, `/loop` and Monitor, `/goal`, headless runs, deep links, scheduled tasks,
  Remote Control or Projects.
- [references/configuring.md](references/configuring.md): Read when the work involves settings
  files and scopes (including why a key is ignored), permission rules and modes, auto mode,
  sandboxing, model, effort, ultracode, context and compaction settings, fast mode, the advisor
  tool, or terminal interface setup.
- [references/surfaces.md](references/surfaces.md): Read when the work involves a surface other
  than the bare terminal (desktop app, VS Code, JetBrains, mobile, Chrome, computer use, Slack and
  Claude Tag), or cloud sessions, cloud environments and self-hosted runners.
- [references/review-and-ci.md](references/review-and-ci.md): Read when the work involves code
  review (`/code-review`, ultrareview, the managed Code Review service), security scanning, GitHub
  Enterprise Server, or Claude in GitHub Actions or GitLab CI/CD.
- [references/administration.md](references/administration.md): Read when the work involves
  organization-wide setup: managed settings, third-party providers (Amazon Bedrock, Claude Platform
  on AWS, Google Cloud, Microsoft Foundry) and the features they lack, network and proxy
  configuration, gateways, telemetry and costs, security, data usage or compliance.
- [references/agent-sdk.md](references/agent-sdk.md): Read when the work involves embedding Claude
  Code's agent loop in a Python or TypeScript program with the Claude Agent SDK, or choosing the
  SDK over `claude -p`.

## Keeping Up With Changes

- [Claude Code changelog](https://code.claude.com/docs/en/changelog): every release, newest first.
  It is very large; fetch it with an offset, or read
  `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md` and search it.
- [What's new](https://code.claude.com/docs/en/whats-new/index): weekly digests of the larger
  changes.

Example: the agent finds this skill written against 2.1.317 while `claude --version` reports
2.1.380. That is more than 60 releases behind, so the agent reads the linked page before using any
flag named here, and scans the changelog entries after 2.1.317 for the branch it is working in.

## Source for this Skill

This skill comes from the `tool-usage/claude-code` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
