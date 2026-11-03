# Extending Claude Code: Skills, Subagents, Hooks, MCP and More

This branch covers the ways to add behavior to Claude Code without changing the product: skills,
custom subagents, settings hooks, MCP servers and claude.ai connectors, output styles, artifacts,
and channels. Packaging these for others (plugins, marketplaces) and in-process JavaScript
extensions (mods) are in `references/plugins-and-mods.md`. Background sessions, agent teams and
workflows are in `references/agents-and-automation.md`; settings files and permissions are in
`references/configuring.md`. Facts below are as of Claude Code 2.1.317.

## Choosing between

The overview page [Extend Claude Code](https://code.claude.com/docs/en/features-overview) compares
these too. The short version:

- **CLAUDE.md**: facts Claude should always know (conventions, commands, structure). Loaded every
  turn, so keep it short. See `references/foundations.md`.
- **Skill**: a procedure, checklist or body of reference material Claude loads only when it is
  relevant or when the user types `/name`. Runs in the main conversation unless it sets
  `context: fork`. Instructions, not guarantees.
- **Subagent**: a worker with its own context window, system prompt, tool set, model and
  permission mode, that returns one summary. Use it to keep verbose work out of the main context or
  to enforce tool restrictions.
- **Hook**: something that MUST happen every time, enforced by Claude Code rather than by Claude
  following an instruction (format after each edit, block a command, inject context at session
  start). If Claude keeps skipping a rule in a skill, move the rule into a hook.
- **MCP server**: a new tool or data source (issue tracker, database, browser). Also the transport
  for channels and for hooks of type `mcp_tool`.
- **Output style**: change the voice, length or role of every response in the session.
- **Plugin**: a package that ships any mix of skills, agents, hooks, MCP servers and output styles
  to other people. See `references/plugins-and-mods.md`.
- **Mod**: a plugin that runs JavaScript inside Claude Code to draw interface (panes, bands, status
  lines) or react to events in-process. Choose it only when the change is to Claude Code's own
  interface or tool-call handling. See `references/plugins-and-mods.md`.

## Skills

A skill is a folder with a `SKILL.md` (YAML frontmatter plus Markdown instructions) and optional
supporting files. Claude Code follows the open [Agent Skills](https://agentskills.io) standard and
adds its own frontmatter extensions. For writing a skill in a sous-managed project, YOU MUST load
`about-agent-skills`. In those projects skills are authored as recipe or project sources and
compiled into `.claude/skills`, so never edit the compiled copy.
[Extend Claude with skills](https://code.claude.com/docs/en/skills)

- **Commands are skills now**: `.claude/commands/deploy.md` and `.claude/skills/deploy/SKILL.md`
  both create `/deploy`. Command files still work but cannot use `name` or `paths` and have no
  supporting-file directory. When both exist with one name, the skill wins.
- **How skills load**: only the name and description sit in context each turn (the "skill
  listing"); the body loads when invoked and then stays in the conversation as one message for the
  rest of the session. Claude Code does not re-read the file on later turns, so write standing
  instructions, not one-time steps. After compaction only the start of each recent skill is
  re-attached, so put critical rules near the top. The listing has a character budget; when it
  overflows, descriptions of rarely used skills are dropped first (`/skill-doctor` shows cost and
  usage).
- **Where skills load from**: enterprise (managed settings directory), personal
  (`~/.claude/skills/`), project (`.claude/skills/` from the start directory up to the repository
  root), nested subdirectories (loaded the first time Claude touches a file there), `--add-dir`
  directories, plugins (`/plugin-name:skill`), and the claude.ai account. Precedence on a name
  clash: enterprise, then personal, then project. A local skill replaces a bundled skill or
  built-in command of the same name (but not its aliases). Edits to `SKILL.md` are picked up live.
- **Bundled skills**: prompt-based skills that ship with Claude Code, such as `/doctor`,
  `/code-review`, `/run`, `/verify`, `/loop` and `/claude-api`. A project skill named `verify` or
  `simplify` makes Claude run it before each commit. Turn all of them off with
  `disableBundledSkills`.
- **Frontmatter handles**: `description` (and `when_to_use`, capped together in the listing),
  `disable-model-invocation: true` (only the user can run it; also removes the description from
  context), `user-invocable: false` (only Claude can run it), `allowed-tools` (pre-approves tools
  for the invoking turn only; the grant clears at the next user message), `disallowed-tools`,
  `model`, `effort`, `arguments` with `$ARGUMENTS`, `$0` or `$name` substitution, `paths` (glob
  activation), `hooks` (registered for the rest of the session once invoked), `shell`, and
  `context: fork` with `agent` and `background`. Unknown fields are ignored silently.
- **Dynamic context**: a line starting with `` !`command` `` (or a fenced block opened with
  ```` ```! ````) runs before Claude sees the skill, and the output replaces it. A failing command
  aborts the whole invocation; append `|| true` to commands that may exit non-zero. Commands are
  checked against permission rules and never prompt. `disableSkillShellExecution` turns this off.
- **`context: fork` is not a conversation fork**: it starts a fresh subagent (type from `agent`,
  default `general-purpose`) whose task is the skill body, with no conversation history. It runs in
  the background by default; set `background: false` to wait for its result in the same turn. A
  backgrounded fork gets the narrower background tool set.
- **Synced skills from claude.ai**: in a terminal session signed in with a claude.ai account,
  Claude Code downloads the account's enabled skills (including Anthropic ones such as `pdf` and
  `xlsx`) into `~/.claude/skills/synced/` and keeps them updated during the session. Each has the
  full name `/anthropic-skills:<name>`, and also the short `/<name>` unless another command already
  uses it. The name `anthropic-skills` is reserved: a local skill or command with that name or
  prefix does not load. On the local machine a synced skill's `` !` `` commands, `@` references and
  `${CLAUDE_PROJECT_DIR}` are not executed or substituted. Edits under `synced/` are overwritten;
  change the skill on claude.ai instead. Turn syncing off with `syncClaudeAiSkills: false`.
- **Cloud and Cowork sessions**: they never read `~/.claude/skills/`. Enable the skill on the
  claude.ai account or commit it to the repository's `.claude/skills/`.
- **`skillOverrides`**: a settings map from skill name to `"on"`, `"name-only"`,
  `"user-invocable-only"` or `"off"`, for hiding skills whose file should stay unedited. The
  `/skills` menu writes it to `.claude/settings.local.json`. It does not apply to plugin skills.
- **Permission rules**: `Skill(name)` and `Skill(name *)` in allow or deny; deny `Skill` to turn
  skills off entirely.

This skill pre-approves its own bundled script, because `${CLAUDE_SKILL_DIR}` expands in both the
body and the `allowed-tools` rule:

```yaml
---
name: render-chart
description: Render a chart from a CSV file. Use when the user asks for a chart of tabular data.
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/render.sh *)
---

Run `${CLAUDE_SKILL_DIR}/scripts/render.sh <csv-file>` to render the chart.
```

## Custom subagents

A subagent definition is a Markdown file whose frontmatter configures it and whose body becomes
its whole system prompt (it does not get the Claude Code system prompt). Only `name` and
`description` are required. [Create custom subagents](https://code.claude.com/docs/en/sub-agents)

- **Definition files and precedence**: managed settings, then the `--agents` JSON flag, then
  `.claude/agents/` (walked up from the working directory), then `~/.claude/agents/`, then plugin
  `agents/`. Directories are scanned recursively; identity comes only from `name`. `/agents` no
  longer opens a wizard: ask Claude to write the file or write it by hand. Files are watched, so
  edits apply to the next delegation. A file with no `name`, a bad `name`, no `description` or
  unparseable YAML is skipped silently (visible with `--debug`).
- **Frontmatter handles** (camelCase): `tools` and `disallowedTools` (including `mcp__server__*`
  entries), `model` (alias, full ID or `inherit`), `permissionMode`, `maxTurns`, `skills`
  (preloads full skill bodies at startup), `mcpServers` (inline servers scoped to this subagent, so
  their tool descriptions stay out of the main context), `hooks`, `memory` (`user`, `project` or
  `local` persistent directory), `background`, `omitClaudeMd`, `effort`, `isolation: worktree`,
  `autoCompactWindow`, `color` and `initialPrompt`. Plugin subagents ignore `hooks`, `mcpServers`
  and `permissionMode`.
- **What a subagent starts with**: its own prompt, Claude's delegation message, the CLAUDE.md
  hierarchy (not for the built-in Explore and Plan, nor with `omitClaudeMd`), a git status snapshot,
  and preloaded skills. It never sees the conversation history, the output style or the main auto
  memory. Restate any rule it must follow in the delegation prompt.
- **Background by default**: a subagent Claude spawns from the main conversation starts in the
  background and its result arrives as a completion notification in a later turn. In interactive
  sessions Claude cannot wait for it while fork mode is on (the default); set
  `CLAUDE_CODE_FORK_SUBAGENT=0` to let Claude wait. Background subagents get a reduced built-in tool
  set (MCP tools are kept) and surface their permission prompts in the main session.
- **Forks**: a fork inherits the whole conversation, system prompt, tools and model and shares the
  prompt cache, then returns only its result. Claude can start one on its own while fork mode is
  on; the user starts one with `/subtask <task>`. Deny `Agent(fork)` to stop them.
- **Nesting**: subagents can spawn subagents up to three layers below the main conversation by
  default (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`; `1` turns nesting off). About 20 may run at once
  (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`). Omit `Agent` from `tools` to stop one subagent spawning.
- **Model order**: the per-call `model` parameter, then the definition's `model`, then
  `CLAUDE_CODE_SUBAGENT_MODEL`, then the main model. `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` forces one
  model on every subagent.
- **Resume and message**: Claude continues a finished subagent with `SendMessage` using its agent
  ID or name, keeping its full history. Explore and Plan are one-shot and cannot be resumed.
- **Invoking explicitly**: name it in the prompt, @-mention it (`@agent-<name>`), or run the whole
  session as it with `claude --agent <name>` or the `agent` setting (its prompt then replaces the
  system prompt). Block a type with `Agent(<name>)` in `permissions.deny`.

```markdown
---
name: code-reviewer
description: Reviews recent changes for quality and security. Use after code is modified.
tools: Read, Grep, Glob, Bash
model: sonnet
memory: project
---

You are a code reviewer. Run git diff, focus on modified files, and report findings
grouped as critical, warning and suggestion.
```

## Hooks

Hooks are handlers Claude Code runs at lifecycle events. They are configured in settings files
(user, project, local, managed), in a plugin's `hooks/hooks.json`, or in skill and subagent
frontmatter, as event, then matcher group, then handler list. Read the guide first and the
reference for schemas. [Automate actions with hooks](https://code.claude.com/docs/en/hooks-guide)
and [Hooks reference](https://code.claude.com/docs/en/hooks)

- **Event families** (fetch the reference for each event's input and decision fields):
  - Session: `SessionStart`, `Setup`, `SessionEnd`, `InstructionsLoaded`, `ConfigChange`,
    `PreCompact`, `PostCompact`.
  - Turn and prompt: `UserPromptSubmit` (also fires for scheduled-task turns, background subagent
    reports and cross-session messages), `UserPromptExpansion` (a user typing `/skill`, which
    `PreToolUse` on the Skill tool does not see), `Stop`, `StopFailure`, `MessageDisplay`
    (display-only rewrite of streamed text).
  - Tool loop: `PreToolUse`, `PermissionRequest`, `PermissionDenied` (auto mode), `PostToolUse`,
    `PostToolUseFailure`, `PostToolBatch`.
  - Agents and tasks: `SubagentStart`, `SubagentStop`, `TaskCreated`, `TaskCompleted`,
    `TeammateIdle`.
  - Environment: `CwdChanged`, `DirectoryAdded`, `FileChanged`, `WorktreeCreate`,
    `WorktreeRemove`, `PreModelSwitch`, `PostModelSwitch`, `Notification`.
  - MCP: `Elicitation` and `ElicitationResult` (answer or decline an MCP server's input request
    from a script).
- **Handler types**: `command` (stdin JSON, exit code and stdout), `http` (POST, JSON response
  body; header env vars need `allowedEnvVars`), `mcp_tool` (call a tool on a connected MCP server),
  `prompt` (one model call returning `{"ok": ..., "reason": ...}`), and `agent` (experimental
  subagent verifier with tools). Not every event accepts every type: `SessionStart` and `Setup`
  take only `command` and `mcp_tool`, and `prompt` and `agent` are limited to the tool-loop, turn,
  stop and task events.
- **Filtering**: `matcher` is an exact name, a `|` list, or an unanchored regular expression when
  it holds other characters (`mcp__memory__.*`; a bare `mcp__memory` matches nothing). The per
  handler `if` field takes one permission rule such as `Bash(git *)` and only works on tool events.
- **What hooks can return**: exit 0 with optional JSON; exit 2 to block (stderr becomes the
  reason); any other exit is a non-blocking error, so `exit 1` does not enforce anything. JSON
  fields: universal `continue`, `stopReason`, `systemMessage`, `terminalSequence` (the only way to
  ring the bell or notify, since hooks have no `/dev/tty`); top-level `decision: "block"` for
  prompt, post-tool, stop and compact events; `hookSpecificOutput` with `permissionDecision`
  (`allow`, `deny`, `ask`, `defer`), `updatedInput`, `updatedToolOutput` and `additionalContext`.
  `SessionStart` can also return `initialUserMessage`, `sessionTitle`, `watchPaths` and
  `reloadSkills`. Text fields are capped at 10,000 characters. With several hooks, the most
  restrictive decision wins (`deny` over `defer` over `ask` over `allow`).
- **Limits on a hook's power**: a hook's `deny` holds in every permission mode, including bypass;
  its `allow` cannot override deny rules or approval prompts that no mode skips. `defer` works only
  in `-p` runs. The `if` filter is best-effort, so enforce hard policy with permission rules.
- **`onFailure`**: on `command` and `http` hooks, `"block"` makes a hook that cannot start, crashes,
  times out or prints invalid JSON block the action as exit 2 would. Without it a broken policy
  hook fails open.
- **Async**: `async: true` runs a command hook in the background (it cannot block; its context
  arrives next turn); `asyncRewake: true` also wakes Claude on exit 2.
- **Gotchas**: a `Stop` hook that keeps blocking is overridden after eight consecutive blocks
  (check `stop_hook_active`); shell profile output before the JSON breaks parsing; `-p` and SDK
  sessions treat the folder as trusted, so committed project hooks run unprompted;
  `disableAllHooks` cannot disable managed hooks. Inspect configured hooks with `/hooks`.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/check-command.js"],
            "onFailure": "block"
          }
        ]
      }
    ]
  }
}
```

## MCP

MCP servers add tools, resources (`@server:uri` mentions) and prompts (`/server:prompt`
commands). Add one with `claude mcp add` and manage it with `/mcp`.
[Connect to MCP servers](https://code.claude.com/docs/en/mcp-quickstart) walks one end to end;
[Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp) is the full reference.

- **Transports**: `http` (preferred for remote), `sse`, `ws`, and local `stdio`. `claude mcp add`
  also accepts setup instructions written for other clients (a URL, an `npx` line, or an
  `mcpServers` JSON block).
- **Scopes**: `local` (default; this project, only the user, stored in `~/.claude.json`),
  `project` (`.mcp.json`, committed, each teammate approves it once), and `user` (all projects, in
  `~/.claude.json`). Precedence on duplicates: local, project, user, then plugin servers, then
  claude.ai connectors; the winning entry is used whole, never merged. Organizations can deploy or
  restrict servers with [managed MCP configuration](https://code.claude.com/docs/en/managed-mcp).
  `.mcp.json` supports environment-variable expansion. Toggle a server off per project in `/mcp`
  without deleting it.
- **Connectors from claude.ai**: when the session is signed in with a claude.ai subscription login
  (not an API key, gateway token or cloud provider), the account's connectors appear automatically
  in `/mcp`, named like `claude.ai Slack`. Anthropic also provides some itself, such as
  `claude.ai Claude Docs`. Organizations can set connector tools to `ask` (prompt on every call in
  every mode) or `blocked`. Turn fetched connectors off with `disableClaudeAiConnectors`.
- **Tool search and deferred tools**: by default MCP tool definitions are deferred. Only names and
  server instructions load at startup, and Claude loads a tool's schema through the `ToolSearch`
  tool before calling it, so many servers cost little context. A deferred tool cannot be called
  until it is loaded. Control this with `ENABLE_TOOL_SEARCH` (`auto` and `auto:N` for threshold
  mode, `false` to load everything upfront), and exempt one server with `alwaysLoad: true` in its
  config. Server authors can mark a tool with `_meta["anthropic/alwaysLoad"]`. Server instructions
  and upfront descriptions are cut at about 4,096 characters, so put key words first.
- **Long calls**: a main-conversation MCP call still running after two minutes moves to a
  background task and reports back later. Servers using the MCP tasks extension run jobs
  server-side that survive the session (public beta).
- **Elicitation**: a server can ask the user for input mid-call in form mode (fields) or URL mode
  (open a link, such as sign-in). Claude Code shows a dialog automatically; an `Elicitation` hook
  can answer instead.
- **Server-author handles**: `_meta["anthropic/requiresUserInteraction"]` forces a prompt on every
  call in every mode; `readOnlyHint` or `idempotentHint` let Claude Code retry after a dropped
  connection; `list_changed` notifications refresh tools live.
- **Claude Code as a server**: `claude mcp serve` exposes Claude Code's tools to other MCP clients.
- **Subagent-scoped servers**: define a server inline in a subagent's `mcpServers` to give only
  that subagent its tools (see Custom subagents above).

## Output styles

An output style is a set of instructions applied to every response in the session.
[Output styles](https://code.claude.com/docs/en/output-styles)

- **Built-in styles**: Default plus Proactive (start work, assume routine decisions; does not change
  the permission mode), Concise (result first, no narration), Explanatory (adds `Insight` blocks)
  and Learning (Insight blocks plus `TODO(human)` pieces for the user to write).
- **Switching**: `/output-style <name>`, `/config`, or `outputStyle` in settings (case-sensitive;
  a wrong value silently means Default). A switch applies from the next message, no `/clear`
  needed.
- **Custom styles**: Markdown files in `~/.claude/output-styles/` or `.claude/output-styles/`
  (or a plugin's `output-styles/`). Without `keep-coding-instructions: true` a custom style drops
  Claude Code's software engineering instructions. Plugin styles can set `force-for-plugin`. Style
  files are read at startup, so restart after editing.
- **Scope**: styles shape the main conversation and forks, never other subagents. They are
  instructions, not guarantees; use a hook for anything that must always happen.

## Artifacts

An artifact is a single self-contained HTML or Markdown page that Claude publishes from the session
to a private claude.ai URL, updates in place, and the user can share with their organization or
publicly. It needs a claude.ai login on a paid plan and the Anthropic API (not Bedrock, Agent
Platform or Foundry), and is off by default in `-p`, the Agent SDK and the GitHub Action.
[Share session output as artifacts](https://code.claude.com/docs/en/artifacts)

- **When to use**: output that is easier to look at than to read (annotated diffs, dashboards,
  side-by-side options, progress checklists). Not a hosted app: no backend, one page, strict CSP
  (scripts only from a few public CDNs, fonts only from Google Fonts, images as data URIs), at most
  16 MiB rendered.
- **Working with them**: each publish is a version at the same URL; `/artifacts` lists and attaches
  them across sessions; `Ctrl+]` reopens the latest. To update one from another session, give
  Claude its URL. Editors on Team and Enterprise plans can republish too, and stale copies are
  refused and merged.
- **Live pages**: a page can call the viewer's own claude.ai connectors on each load (not local
  MCP servers), offer file downloads, and collect comments that Claude can read and answer; Claude
  watches its published artifacts for comments sent to it.
- **Templates**: `/slides` and `/design` start from Claude Slides and Claude Design templates;
  documents meant for other people go to the `claude.ai Claude Docs` connector instead of a page.
- **Turning off**: `enableArtifact: false`, `CLAUDE_CODE_DISABLE_ARTIFACT=1`, or deny `Artifact`.

## Channels

A channel is a local stdio MCP server that pushes events into an already running session (chat
messages, CI webhooks, alerts) and can be two-way through a reply tool. Research preview: it needs
Anthropic authentication, Team and Enterprise organizations must set `channelsEnabled`, and
`--channels` is not shown in `claude --help`.
[Push events into a running session with channels](https://code.claude.com/docs/en/channels)

- **Using one**: install a channel plugin (Telegram, Discord, iMessage, or the localhost fakechat
  demo), then start with `claude --channels plugin:<name>@<marketplace>`. Being in `.mcp.json` is
  not enough; the server must be named in `--channels`. Events arrive only while the session is
  open, as `<channel source="...">` blocks, and queue while Claude is busy. Senders are gated by a
  per-plugin allowlist (pairing for Telegram and Discord).
- **Building one**: declare `capabilities.experimental['claude/channel']`, emit
  `notifications/claude/channel` with `content` and identifier-only `meta` keys, add a reply tool
  for two-way use, and gate on the sender identity, not the room. Declaring
  `claude/channel/permission` relays tool approval prompts so the user can approve remotely; anyone
  on the allowlist then holds that authority. Custom channels are not on the approved allowlist, so
  test them with `--dangerously-load-development-channels` in an interactive session. Notifications
  are fire-and-forget with no delivery error.
  [Channels reference](https://code.claude.com/docs/en/channels-reference)
- **Compared with neighbors**: a plain MCP server is queried, never pushes; Remote Control lets the
  user drive the session; session-scoped scheduled tasks poll on a timer instead. On the v2 MCP
  runtime, a server that negotiates the newest protocol revision cannot register as a channel.
