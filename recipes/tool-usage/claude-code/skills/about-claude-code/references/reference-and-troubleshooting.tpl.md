# CLI, Commands, Tools and Troubleshooting

This branch maps the command-line interface, the in-session slash commands, environment variables, the built-in tools an agent calls directly, interactive keys, and where to look when something fails. Facts are as of Claude Code 2.1.317. Every list here is a guide to the shape of the surface, not an exhaustive copy; fetch the linked page for exact flags and values. For concepts (sessions, memory, caching) read `references/foundations.md`; for settings files and permission modes read `references/configuring.md`; for background sessions and headless automation read `references/agents-and-automation.md`.

## CLI shape

`claude` starts an interactive session; `claude "prompt"` starts one with a first prompt; `claude -p "prompt"` (print mode) runs once and exits, reading piped stdin. `claude --help` does not list every flag. A mistyped subcommand prints a "Did you mean" suggestion and exits.

Subcommands, grouped:

- **Install and account**: `update`, `install [version|stable|latest]`, `auth login|logout|status` (status prints JSON and exits 1 when logged out), `setup-token` (long-lived OAuth token for CI), `doctor` (read-only install and settings diagnostics without a session).
- **Background sessions**: `agents` (agent view), `attach <id|name>`, `logs`, `stop` (alias `kill`), `respawn`, `rm`, and `daemon logs|run|status|stop` for the supervisor process. See [Agent view](https://code.claude.com/docs/en/agent-view).
- **Configuration**: `mcp` (including `mcp login <name>` for OAuth without the panel), `plugin` (alias `plugins`), `auto-mode defaults|config|reset`, `import [source]` (bring in Codex, Gemini CLI or Cursor configuration).
- **Data**: `purge [path]` deletes a project's local state (it was `project purge` before 2.1.288).
- **Remote and infrastructure**: `remote-control` (server mode), `self-hosted-runner`, `gateway` (the self-hosted Claude apps gateway), `ultrareview [target]` (non-interactive cloud review).

The flags that matter most, by job:

- **Sessions**: `-c`/`--continue`, `-r`/`--resume [id|name|path]`, `--fork-session`, `--from-pr`, `-n`/`--name`, `--session-id`, `-w`/`--worktree [name]` (with `--tmux`), `--bg` (start as a background agent; `--bg --exec '<cmd>'` runs a shell job instead).
- **Model and effort**: `--model`, `--effort low|medium|high|xhigh|max|ultracode`, `--fallback-model`, `--advisor <model>`, `--autocompact <tokens>`.
- **Permissions and tools**: `--permission-mode` (`default`, alias `manual`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions`), `--dangerously-skip-permissions`, `--allowedTools`, `--disallowedTools` (a bare name removes the tool from context), `--tools` (restricts the built-in set), `--add-dir`. `--enable-auto-mode` was removed; auto mode is in the `Shift+Tab` cycle by default.
- **Print mode and scripting**: `--output-format text|json|stream-json`, `--input-format stream-json`, `--json-schema`, `--max-turns`, `--max-budget-usd`, `--no-session-persistence`, `--permission-prompt-tool`, `--permission-prompts none`, `--include-partial-messages`, `--include-hook-events`.
- **Configuration loading**: `--settings <file|json>`, `--setting-sources user,project,local`, `--mcp-config` with `--strict-mcp-config`, `--plugin-dir`, `--plugin-url`, `--agent`, `--agents <json>`.
- **System prompt**: `--append-system-prompt[-file]` (keeps the default prompt; usually the right choice), `--system-prompt[-file]` (replaces it), `--append-subagent-system-prompt[-file]`. The prompt is recorded on the conversation's first request and reused on resume; `--system-prompt-snapshot off` rebuilds it every request.
- **Minimal and diagnostic modes**: `--bare` (skip hooks, skills, plugins, MCP, auto memory and CLAUDE.md; for CI), `--safe-mode` (disable all customizations but keep auth, model, built-in tools and permissions; for troubleshooting), `--restricted` (for evaluation harnesses on shared machines: removes command-running tools and WebFetch, confines file tools, loads only managed and `--settings`), `--debug[=categories]`, `--debug-file`, `--verbose`.
- **Cloud and surfaces**: `--cloud "task"` creates a cloud session (`--remote` is the deprecated alias), `--teleport`, `--remote-control`/`--rc`, `--desktop`, `--chrome`, `--ide`, `--environment` with `--ref`.

[CLI reference](https://code.claude.com/docs/en/cli-reference)

## Slash commands

Type `/` to filter; a command is recognized only at the start of a message, and several skills can be stacked at the start of one message. Commands sent while Claude works are queued until the turn ends, except a few such as `/status`, `/tasks`, `/usage`, `/model`, `/effort` and `/fast`, which run at once. Some entries are bundled skills (prompts handed to Claude) and some are bundled workflows (multi-agent fan-outs). Availability varies by plan and platform, and a few commands such as `/heapdump` are hidden from the menu until typed in full.

- **Session and context**: `/clear [name]`, `/compact [focus]`, `/context [all]`, `/resume`, `/rename`, `/branch`, `/rewind` (aliases `/checkpoint`, `/undo`), `/export`, `/copy [N]`, `/recap`, `/btw <question>` (side question that adds nothing to history), `/cd <path>` (move the session to another directory, keeping the conversation), `/add-dir`.
- **Model and cost**: `/model`, `/effort`, `/fast`, `/advisor`, `/autocompact`, `/usage` (aliases `/cost`, `/stats`), `/usage-credits`, `/rate-limit-options`.
- **Setup and configuration**: `/init`, `/memory`, `/config`, `/permissions`, `/hooks`, `/mcp`, `/plugin`, `/reload-plugins`, `/reload-skills`, `/skills`, `/skill-doctor` (context cost and usage per skill), `/output-style`, `/statusline`, `/keybindings`, `/theme`, `/tui default|fullscreen`, `/terminal-setup`, `/sandbox`, `/import`, `/update-config`, `/fewer-permission-prompts`, `/auto-mode-setup`.
- **Parallel and background work**: `/tasks` (alias `/bashes`), `/background` (detach the session as a background agent), `/fork` (copy the conversation into a new background session), `/subtask <task>` (forked background subagent), `/goal <condition>` (keep working until a separate model judges the condition met), `/loop [interval] [prompt]`, `/schedule` (cloud scheduled tasks, formerly routines), `/workflows`, `/list-agents`, `/stop`.
- **Review and verification**: `/diff`, `/code-review [level] [--fix] [--comment] [pr|branch|path]` (alias `/review`; `ultra` runs in the cloud), `/ultrareview`, `/security-review`, `/simplify`, `/verify` and `/run` (build, launch and observe the app), `/batch <instruction>` (split a large mechanical change across parallel worktree agents).
- **Diagnostics**: `/doctor [prompt-audit [path]]`, `/debug [issue]`, `/status`, `/heapdump`, `/feedback` and `/bug`, `/release-notes`, `/insights` (HTML report on recent usage).
- **Surfaces**: `/remote-control`, `/teleport`, `/desktop`, `/remote-env`, `/web-setup`, `/ide`, `/chrome`, `/install-github-app`, `/install-slack-app`, `/mobile`, `/voice`.
- **Bundled content skills**: `/deep-research` (workflow), `/dataviz`, `/design`, `/slides`, `/claude-api`, `/artifacts`.

Removed commands a model may still suggest: `/vim` (use `/config` and Editor mode), `/pr-comments` (just ask Claude), `/ultraplan` (use plan mode). `/agents` now only reminds the user to ask Claude or edit `.claude/agents/` directly.

[Commands](https://code.claude.com/docs/en/commands)

## Environment variables

There are roughly 400 variables, so search the page rather than memorizing names. They can be set in the shell (read once at launch) or in the `env` block of any settings file (reapplied to a running session when the file changes, and no shell expansion, so `~` stays literal). Precedence between a variable and its matching setting varies per key; each row states it. To neutralize an inherited variable from a settings file, set it to an empty string.

The families worth knowing:

- **`ANTHROPIC_*`**: authentication (`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`), routing (`ANTHROPIC_BASE_URL` and per-provider base URLs), and model pinning (`ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `ANTHROPIC_DEFAULT_FABLE_MODEL`).
- **Provider switches**: `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`, `CLAUDE_CODE_USE_ANTHROPIC_AWS`, `CLAUDE_CODE_USE_MANTLE`, plus `VERTEX_REGION_*` overrides.
- **Tool limits**: `BASH_DEFAULT_TIMEOUT_MS`, `BASH_MAX_TIMEOUT_MS`, `BASH_MAX_OUTPUT_LENGTH`, `CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS`, `MAX_MCP_OUTPUT_TOKENS`, `MCP_TIMEOUT`, `MCP_TOOL_TIMEOUT`, `CLAUDE_CODE_TOOL_MEMORY_LIMIT` (Linux cgroup cap).
- **Feature switches**: `CLAUDE_CODE_DISABLE_*` (auto memory, background tasks, file checkpointing, web fetch, workflows, bundled skills, CLAUDE.md files) and `CLAUDE_CODE_ENABLE_*` (for example `CLAUDE_CODE_ENABLE_TODO_TOOLS`); `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`; `CLAUDE_CODE_FORK_SUBAGENT=0` turns fork mode off; `ENABLE_TOOL_SEARCH`.
- **Models and effort**: `CLAUDE_CODE_EFFORT_LEVEL` (overrides `--effort` and `/effort`), `CLAUDE_CODE_SUBAGENT_MODEL`, `MAX_THINKING_TOKENS`, `CLAUDE_CODE_MAX_OUTPUT_TOKENS`.
- **Caching and retries**: `DISABLE_PROMPT_CACHING*`, `CLAUDE_CODE_PROMPT_CACHE_TTL`, `FORCE_PROMPT_CACHING_5M`, `CLAUDE_CODE_MAX_RETRIES`, `CLAUDE_CODE_RETRY_WATCHDOG=1` (retry capacity errors indefinitely in CI), `API_TIMEOUT_MS`.
- **Privacy and network**: `DISABLE_TELEMETRY`, `DO_NOT_TRACK`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, `DISABLE_AUTOUPDATER`, `HTTP_PROXY`/`HTTPS_PROXY`, client certificate variables. Gotcha: these, and every third-party provider, skip the feature-flag fetch, which silently disables a list of flag-gated features (Remote Control, `/import`, `/skill-doctor`, the advisor tool, MCP tasks and more). The first session after an install or upgrade can also lack them.
- **Paths and storage**: `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_PROJECT_DIR_NAME`, `CLAUDE_CODE_TMPDIR`, `CLAUDE_ENV_FILE` (a script sourced so env vars persist across Bash calls), `CLAUDE_CODE_SKIP_PROMPT_HISTORY`.
- **Set by Claude Code for subprocesses**: `CLAUDECODE=1`, `CLAUDE_CODE_CHILD_SESSION=1`, `CLAUDE_CODE_SESSION_ID`. Scripts can use these to detect that they run under Claude Code.
- **Security hardening**: `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` strips credential-looking variables from Bash, hook and stdio MCP environments, but deliberately leaves `GITHUB_TOKEN`, `GH_TOKEN` and proxy URLs in place.
- **Observability**: `OTEL_*` and `CLAUDE_CODE_ENABLE_TELEMETRY`; see `references/administration.md`.

[Environment variables](https://code.claude.com/docs/en/env-vars)

## Built-in tools

Tool names are the exact strings used in permission rules, subagent `tools` lists, hook matchers and `--tools`. The exact set depends on model, platform, provider and flags; asking Claude "what tools do you have" or running `/mcp` shows what is loaded. Rule specifiers: `Bash(npm run *)` also covers Monitor; `Read(path)` covers Read, Grep, Glob and LSP; `Edit(path)` covers Edit, Write and NotebookEdit; `WebFetch(domain:host)`; `Agent(Explore)`; `Skill(name)`; `WebSearch` takes no specifier. A `Read` deny rule also blocks Edit and Write on that path.

Files and search:

- **Read**: returns text with line numbers; also images, PDFs (over 10 pages, read with `pages`, at most 20 at a time) and notebooks. One call returns at most 25,000 tokens by default and refuses a whole file over 256KB; use `offset` and `limit`. Does not read directories. Refuses binary formats such as `.xlsx` or `.zip`.
- **Edit**: exact string replacement; `old_string` must match exactly and uniquely, or use `replace_all`. Newer models may edit a file without a prior Read when reading would not need a prompt; a single-file `cat`, `head`, `grep` or `sed -n` in Bash also counts as a read. Refuses non-UTF-8 files (except UTF-16LE with BOM) and writes through symlinks.
- **Write**: creates or fully overwrites a file. Overwriting an existing file without reading it fails on older models, and on every model for notebooks or partially read files.
- **NotebookEdit**: edits Jupyter cells by `cell_id` with `replace`, `insert` or `delete`.
- **Glob** and **Grep**: ABSENT from the default tool set on macOS, Linux and WSL; Claude uses `find` and `grep` (ripgrep-backed) through Bash instead. They return when named in `--tools` or `--allowedTools`, when Bash is denied or `--restricted` is used, or in a subagent whose `tools` lists them without Bash. When present, Grep uses ripgrep regex syntax and respects `.gitignore`; Glob does not respect `.gitignore` and caps results at 100 files.
- **LSP**: definitions, references, types, symbols and diagnostics after edits; inactive until a code intelligence plugin is installed. See [Code intelligence plugins](https://code.claude.com/docs/en/plugins/code-intelligence).

Execution:

- **Bash**: each command is a separate process. `cd` carries over inside the project; `export` does not (use `CLAUDE_ENV_FILE` or a SessionStart hook). The default timeout is two minutes and the maximum ten, and a foreground command that hits its timeout is moved to the background rather than killed (unless it starts with `sleep`). Exit code 1 counts as success only for `grep`, `rg`, `find`, `diff`, `test`, `git diff` and similar. Output read back is 30,000 characters by default. `run_in_background: true` starts a background task; in unattended sessions (`-p`, SDK, CI, cloud) background commands get a 30-minute limit by default (10 minutes for a plain-text `-p` prompt), at most 2 hours.
- **PowerShell**: native PowerShell; on by default on Windows, opt-in elsewhere with `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` and `pwsh` 7 or later. Hooks that inspect shell commands should match `Bash|PowerShell`.
- **Monitor**: runs a command (or opens a WebSocket) in the background and feeds each output line to Claude as an event. Every watch has a deadline: 5 minutes by default, at most 30, and at most 10 in a single-prompt `-p` run. Uses Bash permission rules.
- **TaskStop**: stops a background task, teammate or named background agent by ID. `TaskOutput` was removed in 2.1.277; Claude reads a background task's output file with Read.

Agents and orchestration:

- **Agent**: spawns a subagent (or a fork, or a named teammate when agent teams are on). Subagents run in the background by default, and their permission prompts surface in the main session. `tools` and `disallowedTools` in the definition set what it gets; `disallowedTools` wins.
- **SendMessage** and **ListAgents**: message a teammate, a resumable subagent, or another of the user's sessions; list who can be messaged.
- **Workflow**: runs a dynamic workflow script that orchestrates many subagents and returns one result.
- **SubagentHandback**: delivers a subagent's final report; only provided in auto mode.
- **Skill**: invokes a skill in the main conversation. **ToolSearch** loads deferred tools (MCP schemas by default). **WaitForMcpServers** waits for MCP servers still connecting. **ListMcpResourcesTool** and **ReadMcpResourceTool** read MCP resources.
- **EnterPlanMode** and **ExitPlanMode**: enter plan mode; present a plan for approval. A deny rule on ExitPlanMode prevents plan mode from being restored on resume.
- **EnterWorktree** and **ExitWorktree**: create or enter a git worktree and switch the session into it; a path outside `.claude/worktrees/` prompts first.
- **TaskCreate**, **TaskGet**, **TaskList**, **TaskUpdate**, **TodoWrite**: task tracking. Provided by default ONLY on Opus 4.7, Sonnet 4.6, Haiku 4.5 and earlier models (and always in background and cloud sessions); newer models track work without them unless `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` or `--tools` opts in. `TodoWrite` is disabled in favour of the Task tools.
- **CronCreate**, **CronDelete**, **CronList**: session-scoped scheduled prompts, restored on resume if unexpired. **ScheduleWakeup** paces a self-paced `/loop`. **RemoteTrigger** manages cloud scheduled tasks and backs `/schedule`.

User interaction and output:

- **AskUserQuestion**: multiple-choice questions; they stay open until answered unless `askUserQuestionTimeout` is set.
- **WebFetch**: fetches a URL, converts it to Markdown and runs an extraction prompt in a separate model call, so it is lossy by design; a "not mentioned" answer may only mean the prompt did not ask. Refuses `localhost` and dotless hostnames (use `curl` via Bash), does not follow cross-host redirects automatically, reads at most 100,000 characters per call, and caches responses for 15 minutes.
- **WebSearch**: returns titles and URLs only. An interactive session has a 200-search budget shared with subagents, refilling about 100 per hour; `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION` raises it. Not available on Amazon Bedrock.
- **Artifact**: publishes an HTML or Markdown page to claude.ai. **SendUserFile**: sends a file to the user's device. **PushNotification**: desktop and phone notification. **ReportFindings**: structured code-review findings.
- **SendFeedback**: drafts a feedback report queued locally for the user to review; nothing is sent until the user chooses to. **EndConversation**: ends the session only after sustained abuse or an explicit request for a demonstration; cannot be blocked while other tools remain. **ShareOnboardingGuide**: backs `/team-onboarding`.

The advisor is a server-side API tool with no name usable in permission rules.

[Tools reference](https://code.claude.com/docs/en/tools-reference)

## Interactive mode

Keys that matter, beyond ordinary readline editing:

- **Control the turn**: `Esc` interrupts (queued messages are sent next); `Esc Esc` clears the draft, or on an empty prompt opens rewind; `Ctrl+C` interrupts or clears, and twice exits; `Ctrl+Enter` or `Ctrl+X Ctrl+S` sends queued messages now; `Ctrl+B` backgrounds a running command or agent (press twice in tmux); `Ctrl+X Ctrl+K` stops all background subagents.
- **Modes and model**: `Shift+Tab` cycles permission modes (`Alt+M` on some Windows setups); `Alt+P` (Option+P on macOS) switches model; `Alt+T` toggles extended thinking (no effect on the newest models); `Alt+O` toggles fast mode.
- **Views**: `Ctrl+O` transcript viewer, `Ctrl+T` task checklist, `Ctrl+R` history search, `Ctrl+G` edit the prompt in an external editor, `Ctrl+S` stash the prompt, `Ctrl+L` redraw, `?` shortcut help.
- **Input prefixes**: `/` command or skill, `!` shell mode (runs the command directly and adds its output to context), `@` file mention, `:` emoji shortcode.
- **Newlines**: `\` then `Enter` works everywhere, `Ctrl+J` works in any terminal, `Shift+Enter` works natively in most modern terminals (`/terminal-setup` installs it for others).
- **Images**: `Ctrl+V` pastes an image (`Alt+V` on Windows and WSL).

Interactive features a mid-2026 model may not know: Vim editor mode is turned on through `/config` (not `/vim`); `/btw` side questions; automatic session recap after stepping away; automatic continuation after a usage-limit reset (stops after three in a row); prompt suggestions; the optional "You should know" built-in mod (`/plugin enable cc-plugin-you-should-know@builtin`); spell checking; PR review status in the footer; `/diff` panel. Rebind keys in `~/.claude/keybindings.json`; see [Keybindings](https://code.claude.com/docs/en/keybindings).

[Interactive mode](https://code.claude.com/docs/en/interactive-mode)

## Troubleshooting and debugging

Start with the right page for the symptom:

- **Install and login** (`command not found`, PATH, `EACCES`, TLS, install script returning HTML, 403 after login, OAuth loops, provider credentials): the page has a "Find your error" table keyed by exact message. A clean re-login is `/logout`, restart, `claude`; press `c` to copy the OAuth URL when the browser does not open. On macOS, `claude doctor` reports when the Keychain is not writable and credentials fell back to a plaintext file. [Troubleshoot installation and login](https://code.claude.com/docs/en/troubleshoot-install)
- **Configuration not taking effect** (CLAUDE.md ignored, hooks not firing, MCP servers missing, skills not found): see the next list. [Debug your configuration](https://code.claude.com/docs/en/debug-your-config)
- **Performance and stability** (high CPU or memory, hangs, auto-compact thrashing, search finding nothing): restart with `--safe-mode` to rule out customizations; a heap warning appears past 2.5GB, and `/heapdump` writes a snapshot (which contains credentials; share only the `-diagnostics.json`); if search fails, install system ripgrep and set `USE_BUILTIN_RIPGREP=0`; on WSL keep projects on the Linux filesystem. [Troubleshooting](https://code.claude.com/docs/en/troubleshooting)
- **A runtime error message**: look it up by exact text. [Error reference](https://code.claude.com/docs/en/errors)

Debugging configuration, in order:

1. `/context` shows what actually loaded: memory files, skills, MCP tools and subagents with their sources.
2. The dedicated views: `/memory`, `/skills`, `/hooks`, `/mcp`, `/permissions`, and `/status` (active settings sources, including managed settings).
3. `claude doctor` in the shell (read-only, finds invalid settings files) or `/doctor` in a session (proposes fixes, asks before applying).
4. `claude --debug` (or `--debug=mcp`, or `/debug` mid-session) to watch hook matching and MCP server stderr; logs go to `~/.claude/debug/`.
5. Isolate: `claude --safe-mode`, then a clean `CLAUDE_CONFIG_DIR` in an empty directory with `--setting-sources user`.

Common causes the docs list: a hook `matcher` written as an array or in lowercase (`bash` instead of `Bash`); hooks placed in a standalone file instead of the `hooks` key of `settings.json`; permissions or hooks put in `~/.claude.json` instead of `~/.claude/settings.json`; a skill at `.claude/skills/name.md` instead of `.claude/skills/name/SKILL.md`; `.mcp.json` placed under `.claude/` or using a `servers` key instead of `mcpServers` at the repo root; `mcpServers` in `settings.json` (not read there); a project MCP server whose one-time approval was dismissed; relative paths in an MCP `command`; a `Bash(rm *)` deny rule expected to block `/bin/rm` or `find -delete`.

The error reference groups about 300 messages into: automatic retries, server errors, usage limits, authentication, network, request errors (prompt too long, model not found, thinking and effort conflicts), command-line errors, plugin errors, tool errors, background session errors, wrapper and IDE errors, rewind warnings, session saving and configuration warnings. Two durable points from it:

- **Retries happen before the user sees an error**: transient failures are retried up to 10 times with backoff (`CLAUDE_CODE_MAX_RETRIES`). TLS certificate failures are not retried, and neither are failures after Claude has already produced a text block or tool call. Set `CLAUDE_CODE_RETRY_WATCHDOG=1` in CI to wait out 429 and 529 capacity errors indefinitely.
- **"Responses seem worse"**: Claude Code does not silently change model versions, but `--fallback-model`, an Amazon Bedrock or Google Cloud startup check, or automatic model fallback on the newest models can move a session. Check `/model`, `/effort` and `/context`, rewind rather than arguing with a bad turn, and report with `/feedback`.
