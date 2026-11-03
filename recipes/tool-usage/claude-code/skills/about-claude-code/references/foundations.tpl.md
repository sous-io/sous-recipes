# Foundations: How Claude Code Works

This branch covers the core model of Claude Code: the agentic loop, where configuration and data live, how the context window and prompt cache behave, memory (CLAUDE.md, AGENTS.md, rules, auto memory), sessions, checkpoints, working practices, large codebases, and terminology. Facts are as of Claude Code 2.1.317. For flags, commands, tools and error messages read `references/reference-and-troubleshooting.md`; for skills, hooks, MCP and subagents read `references/extending.md`; for settings and permission modes read `references/configuring.md`.

## Orientation

- **Overview and install**: Claude Code runs in the terminal, VS Code and JetBrains, a desktop app, the web (claude.ai/code), Slack and CI, all on one engine, so CLAUDE.md, settings and MCP servers work the same everywhere. The native installer auto-updates; Homebrew and WinGet installs do not (Homebrew has a `claude-code` stable cask about a week behind and a `claude-code@latest` cask). Plans now include Ultra alongside Pro, Max, Team and Enterprise. [Overview](https://code.claude.com/docs/en/overview) [Quickstart](https://code.claude.com/docs/en/quickstart)
- **Legal**: consumer plans fall under the Consumer Terms, Team, Enterprise and API use under the Commercial Terms. Products that embed Claude Code must run the unmodified binary, and each end user must authenticate with their own credentials; OAuth subscription login is for ordinary individual use, and anything built on the Agent SDK should use API keys. A BAA covers Claude Code only under the HIPAA configuration or Zero Data Retention, and not cloud sessions or Remote Control. [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)

## The agentic loop

Claude Code is the harness around the model: it supplies tools, manages context and enforces permissions. Every task cycles through gather context, take action and verify results, with each tool result shaping the next step. The user can interrupt at any point.

- **Interrupt and steer**: `Esc` stops the running tool call and keeps work so far. Typing a message and pressing `Enter` while Claude works queues it; Claude reads a queued message as soon as the current tool calls finish, within the same turn, without stopping.
- **Execution environments**: local (the user's machine), cloud (Anthropic-managed VMs or a self-hosted environment) and Remote Control (local execution driven from a browser or phone). The loop is identical in each.
- **Context Claude Code adds on its own**: system reminders carry CLAUDE.md, output style instructions, notices that a previously read file changed on disk, and commit and PR attribution lines. If Claude follows a rule nobody wrote, it probably came from one of these; `attribution` and `includeGitInstructions` control the git ones.
- **Safety mechanisms**: checkpoints undo file edits; permission modes and rules decide what runs without asking. The built-in starting mode for interactive terminal and VS Code sessions is now auto mode (a classifier reviews actions), not Manual. `claude -p` and Agent SDK runs start in Manual (`default`) and deny anything that needs approval unless allow rules, a hook or `--permission-mode auto` cover it. See [Choose a permission mode](https://code.claude.com/docs/en/permission-modes).

[How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)

## Choosing an extension

The decision guide for the whole extension surface. The durable rule is that CLAUDE.md, rules, skills and output styles are instructions Claude may judge inapplicable, while hooks, deny rules and managed settings are enforced by the harness.

- **CLAUDE.md**: always-loaded facts and "always do X" rules. Keep it short.
- **`.claude/rules/`**: like CLAUDE.md but split by topic, optionally gated by `paths:` so it loads only when matching files are touched.
- **Skill**: on-demand knowledge or a `/name` workflow; only its description costs context until used.
- **Output style**: role, tone and format for every response; one active at a time.
- **Subagent**: isolated worker with its own context that returns a summary. A fork inherits the whole conversation instead of starting fresh.
- **Dynamic workflow**: a script Claude writes that fans work out to many subagents in the background and returns one result. Newer than most readers know; see [Dynamic workflows](https://code.claude.com/docs/en/workflows).
- **Cross-session messaging**: one of the user's sessions sends a finding to another mid-task. See [Cross-session messaging](https://code.claude.com/docs/en/cross-session-messaging).
- **Hook**: shell command, HTTP call, MCP tool call, prompt or subagent fired at a lifecycle event; only `command` and `http` hooks are deterministic.
- **MCP, code intelligence, plugins, artifacts**: external tools, language-server navigation, packaging, and publishing session output as a private web page.

Layering rules worth remembering: CLAUDE.md files are additive across levels; skills and subagents override by name; MCP servers override by name (local over project over user); hooks from every source all fire.

[Extend Claude Code](https://code.claude.com/docs/en/features-overview)

## The .claude directory and application data

Project configuration lives in `.claude/` (plus `CLAUDE.md`, `.mcp.json` and `.worktreeinclude` at the repo root); personal configuration lives in `~/.claude/`, or under `CLAUDE_CONFIG_DIR` when set. Notable entries beyond the familiar ones: `workflows/*.js` (saved dynamic workflows, each becomes a `/name` command), `agent-memory/<name>/` (subagent persistent memory), `output-styles/`, `themes/`, `keybindings.json`. App state, account details and personal MCP servers sit in `~/.claude.json`, which is NOT where permissions, hooks or env belong (those go in `~/.claude/settings.json`).

- **Retention sweep**: transcripts, file-history snapshots, plans, debug logs and similar data are deleted after `cleanupPeriodDays` (30 by default). Auto memory files are exempt.
- **Plaintext**: transcripts and history are not encrypted. Anything a tool read, including a `.env` value, lands in the session JSONL. Mitigate with shorter retention, `CLAUDE_CODE_SKIP_PROMPT_HISTORY`, `--no-session-persistence` with `-p`, or `Read` deny rules.
- **Session scratchpad**: a per-session temp directory (under `/tmp/claude-<uid>/...` on Linux) for intermediate files. It exists only for claude.ai logins on the Anthropic API with artifacts enabled.
- **`claude purge [path]`**: deletes one project's transcripts, auto memory, task lists, debug logs, file history and its `~/.claude.json` entry, after showing a plan (`--dry-run`, `--yes`, `--all`). It was `claude project purge` before 2.1.288.
- **Keep**: `.credentials.json`, `agent-memory/`, `jobs/` and `daemon/` (background-session state).

[Explore the .claude directory](https://code.claude.com/docs/en/claude-directory)

## Context window and compaction

What loads before the first prompt: system prompt, CLAUDE.md (or AGENTS.md), auto memory, MCP tool names (schemas are deferred via tool search by default), and skill descriptions. File reads, path-scoped rules and hook output accumulate as Claude works. Most current models have a 1M-token window, so running out is rare; paying for unneeded context is the real cost.

- **What survives compaction**: system prompt, output style, project-root CLAUDE.md, unscoped rules and auto memory are re-injected from disk; skill descriptions are rebuilt; a plan-mode plan is re-injected; up to five recently touched files are re-read; invoked skill bodies come back truncated (start of the file kept). Path-scoped rules and nested CLAUDE.md files are summarized away and reload only when a matching file is touched again, so a rule that must persist should drop its `paths:` or move to the root CLAUDE.md.
- **Controls**: `/compact <focus>`, the rewind menu's "Summarize from here" and "Summarize up to here", `/autocompact <tokens>` to set the threshold, `/clear` between tasks, and subagents for large reads.
- **Thrashing**: if one huge output refills the window right after each compaction, Claude Code stops auto-compacting and shows an error instead of looping.

[Explore the context window](https://code.claude.com/docs/en/context-window)

## Prompt caching

The API caches by exact prefix match, and each request is ordered system prompt (with tool definitions), then project context (CLAUDE.md, memory, unscoped rules), then conversation. A change in an early layer recomputes everything after it, giving one slow, expensive turn.

- **Invalidates the cache**: switching models (each model has its own cache, including `opusplan` toggles and a skill whose frontmatter names another model), changing effort on most models, toggling fast mode, adding MCP tools when tool search is off, denying a whole tool when tool search is off, compaction (conversation layer only), many accumulated images, upgrading Claude Code.
- **Keeps the cache**: editing repo files, editing CLAUDE.md mid-session (which also means the edit does NOT apply until `/clear`, `/compact` or a restart), changing permission mode, switching output style, invoking skills, `/recap`, `/rewind`, spawning a subagent.
- **TTL**: on a Claude subscription within plan usage, the main conversation gets a one-hour TTL; API keys, cloud providers and usage credits get five minutes, as do subagents and workflows by default. Override with `promptCacheTtl` and `subagentPromptCacheTtl` (or their env vars). A long idle session on the one-hour TTL can be compacted automatically before the cache expires (`idleCompaction` turns that off).
- **Check it**: `/usage` shows a `Prompt cache (main)` line with hit ratio and the likely cause of the last miss; status line scripts can read `cache_read_input_tokens` and `cache_creation_input_tokens`.

[How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching)

## Memory: CLAUDE.md, AGENTS.md, rules and auto memory

CLAUDE.md content arrives as a user message after the system prompt, not as part of it, so it is guidance rather than enforcement. For a hard rule, use a `PreToolUse` hook or a deny rule.

- **CLAUDE.md locations**: managed policy (OS path, or the `claudeMd` key in managed settings), `~/.claude/CLAUDE.md`, `./CLAUDE.md` or `./.claude/CLAUDE.md`, and gitignored `./CLAUDE.local.md`. Files from the working directory upward load at launch and concatenate (closest read last); subdirectory files load on demand when Claude touches a file there. Target under 200 lines. `@path` imports organize but do not reduce context cost (four hops deep at most, and imports outside the project trigger a one-time approval). Block HTML comments are stripped before injection.
- **AGENTS.md is read natively (2.1.277 and later)**: by default Claude reads `AGENTS.md` only when no `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` exists in the working directory or above. Adding a personal `CLAUDE.local.md` therefore silently stops AGENTS.md from loading. The **Project instructions** setting in `/config` chooses `claude-md-or-agents-md` (default), `claude-md-and-agents-md`, `claude-md` or `managed-only`. Old workarounds such as a SessionStart hook that prints AGENTS.md now double-load it. `/import` brings in configuration from Codex, Gemini CLI or Cursor.
- **Rules**: `.claude/rules/**/*.md` and `~/.claude/rules/`; `paths` is the only frontmatter field read. A path-scoped rule loads when Claude reads, writes or edits a matching file, including a single-file `cat` or `head` through Bash. On-demand files over a per-file size limit are truncated, with a note telling Claude to read the rest.
- **Auto memory**: on by default locally. Claude writes typed notes (`user`, `feedback`, `project`, `reference`) to `~/.claude/projects/<project>/memory/`, shared by all worktrees of one repo and machine-local. Only the first 200 lines or 25KB of the `MEMORY.md` index load each session; topic files are read on demand. Toggle in `/memory` (`autoMemoryEnabled`) or with `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`; relocate with `autoMemoryDirectory`. Subagents do not get the main auto memory (forks do).
- **Maintenance**: `/init` drafts a CLAUDE.md (`CLAUDE_CODE_NEW_INIT=1` for a multi-phase flow covering skills and hooks). `/doctor` proposes trims of content Claude can derive from code. `/doctor prompt-audit [path]` finds stale, contradictory or old-model instructions across CLAUDE.md, rules, skills, agents and output styles. `claudeMdExcludes` skips other teams' files in a monorepo. The `InstructionsLoaded` hook logs what loaded and why.

[How Claude remembers your project](https://code.claude.com/docs/en/memory)

## Sessions

A session is a conversation tied to a directory, stored as JSONL at `~/.claude/projects/<project>/<session-id>.jsonl`. The entry format is internal and changes between releases; scripts should use `/export`, `claude -p --output-format json`, `claude -p --resume <id>`, the `transcript_path` field hooks receive, or the Agent SDK.

- **Resume**: `claude --continue` (most recent here), `claude --resume [id|name|transcript-path]`, `claude --from-pr <number|url>`, `/resume`. The picker shows the current worktree; `Ctrl+W` widens to all worktrees, `Ctrl+A` to all projects, `Ctrl+B` filters by branch. Sessions from `claude -p`, the Agent SDK, or a first-prompt `/loop` are left out of the picker and `--continue`, but resume by ID.
- **What resume restores**: history (from the last compaction summary on), model, `--agent`, permission mode (with exceptions: `bypassPermissions` is never restored), an active goal, and unexpired session-scoped scheduled tasks. NOT restored: `--mcp-config`, `--settings`, `--plugin-dir`, `--add-dir` and similar launch flags, which must be passed again.
- **Background sessions**: resuming a session that is still running in the background attaches to it (`claude attach`) instead of loading the transcript; see [Agent view](https://code.claude.com/docs/en/agent-view).
- **Naming**: `claude -n <name>`, `/rename`, `Ctrl+R` in the picker, or accept a plan. Unnamed sessions get a generated title that works as a resume handle; the default display name such as `my-app-3f` does not.
- **Branch versus fork**: `/branch [name]` (or `--continue --fork-session`) copies the conversation into a new session ID and switches into it, keeping the original intact. `/fork` is different: it copies the conversation into a new background session while the user keeps working here. Two terminals resuming the same session without forking interleave into one transcript.
- **Context commands**: `/clear [name]` starts fresh (the old session stays resumable), `/compact`, `/context`, `/export [file]`.
- **Storage controls**: `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_PROJECT_DIR_NAME` (fixed project directory name for embedding hosts; requires `CLAUDE_CONFIG_DIR`), `cleanupPeriodDays`, `CLAUDE_CODE_SKIP_PROMPT_HISTORY`.

[Manage sessions](https://code.claude.com/docs/en/sessions)

## Checkpointing and rewind

Every prompt that starts a turn creates a checkpoint of files Claude's edit tools are about to change; the 100 most recent are kept and they survive resume. `/rewind` or `Esc Esc` on an empty prompt opens the menu: restore code and conversation, conversation only, code only, "Summarize from here", or "Summarize up to here" (both summarize options accept optional guidance text).

- **Not tracked**: files changed only by Bash, edits by subagents (except a foreground forked skill), changes outside Claude Code, symlinked or hard-linked files (skipped with a warning), and remote side effects such as deploys or database writes.
- **Gotchas**: rewound messages can reappear if the user exits before sending another prompt; a message queued mid-turn has no checkpoint of its own; after `/clear`, the rewind menu offers the previous session at the top for the rest of that process.
- Checkpoints are not version control. Use git for anything that must last.

[Checkpointing](https://code.claude.com/docs/en/checkpointing)

## Working practices

The current guidance is mostly about what NOT to do anymore. Defaults (auto mode, automatic subagent delegation, automatic compaction, Opus 5.5 at medium effort on most plans) handle most sessions; setup pays off only for knowledge the repo cannot show.

- **Deterministic versus not**: prompt, CLAUDE.md and skills are judged by the model; hooks, deny rules, sandbox strict mode and managed settings are enforced. If a CLAUDE.md line keeps getting missed despite emphasis, it belongs in a hook.
- **Give Claude a check**: a test, build exit code or screenshot comparison lets Claude close the loop. Escalating strictness: ask in the prompt, set `/goal <condition>` (a separate model checks after every turn), add a `Stop` hook that exits 2, or run `/code-review` in a fresh subagent. `/verify` builds and runs the app to observe the change.
- **Write down only what Claude cannot find**: test commands, misleading code, decisions made outside the repo. Do not describe architecture or file layout.
- **Effort, not magic words**: "think hard" and "be thorough" are ordinary text; use `/effort` (`low` through `xhigh`, `max`) or `ultrathink` for one message. "be ambitious" still helps by signalling scope.
- **Stale advice to drop**: aggressive context management, ALL-CAPS emphasis, delegating to a subagent for a better answer, "keep going, don't be lazy".
- **Unattended runs**: answer five questions first: what done looks like, how it checks itself, what it may touch, what stops it (`--max-turns`, `--max-budget-usd`), and who signs off.

A typical scripted loop from the docs:

```bash
claude --bare -p "Migrate $file to the new logger API and commit. Reply OK or FAIL." \
  --allowedTools "Read,Edit,Bash(git add *),Bash(git commit *)" \
  --permission-mode dontAsk \
  --max-turns 20
```

[Best practices for Claude Code](https://code.claude.com/docs/en/best-practices)

- **Common workflows**: prompt recipes for exploring, fixing, refactoring, testing, PRs and images; `@path` includes a file (directories show listings, and `@server:resource` pulls MCP resources). `@` includes bypass `PreToolUse` hooks because no tool call happens, so use `Read` deny rules or `CLAUDE_CODE_DISABLE_FILE_MENTIONS=1` to control them. Scheduling options compared: cloud scheduled tasks (formerly "routines"), desktop scheduled tasks, GitHub Actions and `/loop`. `/powerup` gives interactive feature lessons. [Common workflows](https://code.claude.com/docs/en/common-workflows)
- **Prompt library**: copy-paste prompts plus the patterns behind them: describe the outcome, give a way to check, point at a reference, state a measurable target, hand over the artifact, say the answer format. [Prompt library](https://code.claude.com/docs/en/prompt-library)

## Large codebases and monorepos

Where `claude` is launched decides which CLAUDE.md files load at startup, which files are reachable without a grant, and which `.claude/settings.json` applies. Project settings are NOT inherited from parent directories the way CLAUDE.md is.

- **Layer instructions**: a short root CLAUDE.md plus one per package or subsystem; `claudeMdExcludes` for areas never worked in; path-scoped rules as an alternative.
- **Read less**: `Read(./**/dist/**/*)` style deny rules for checked-in generated or vendored code (searches already respect `.gitignore`), and a code intelligence plugin so symbol lookups replace file scans.
- **Worktrees**: `worktree.sparsePaths` checks out only listed directories (always include `.claude`), and `worktree.symlinkDirectories` links `node_modules` instead of copying it. Both are read from the starting directory before the worktree exists.
- **Cross-package access**: `permissions.additionalDirectories` or `--add-dir`. Only `--add-dir` loads the sibling's skills, and its CLAUDE.md loads only with `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`.
- **Skills at scale**: per-package `.claude/skills/`; with many skills some lose their descriptions, so keep descriptions short and keyword-first. When layering stops scaling, move conventions into plugins owned centrally.

[Set up Claude Code in a monorepo or large codebase](https://code.claude.com/docs/en/large-codebases)

## Glossary highlights

The glossary defines about fifty terms; these are the ones a mid-2026 model may misread. [Glossary](https://code.claude.com/docs/en/glossary)

- **Agentic harness**: the tools, context management and permission layer around the model; Claude Code is the harness.
- **System reminder**: context the harness inserts into the conversation (session start, hook output, file changes); the user never sends one.
- **Bare mode**: `--bare` skips hooks, skills, plugins, MCP, auto memory and CLAUDE.md for reproducible scripted runs.
- **Bundled skills**: prompt-based playbooks shipped with Claude Code, such as `/code-review`, `/loop`, `/debug` and `/doctor`, as opposed to built-in commands with fixed logic.
- **Channel**: an MCP server that pushes events into a running session.
- **Teleport and `--cloud`**: `/teleport` pulls a cloud session into the terminal; `--cloud` (formerly `--remote`) sends a local task to the cloud.
- **Dispatch**: a task sent from the Claude mobile app that spawns a Desktop session.
- **Artifact**: a private interactive web page on claude.ai that a session publishes and can update in place.
- **Turn, transcript, verification loop, worktree isolation, project trust**: one response cycle; the stored session file; giving Claude a runnable check; running in `.claude/worktrees/`; the per-directory dialog accepted before a project's configuration loads.
