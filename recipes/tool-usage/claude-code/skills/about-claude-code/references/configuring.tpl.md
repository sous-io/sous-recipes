# Settings, Permissions, Sandboxing, Models and the Interface

This branch covers how Claude Code is configured on the user's machine: the settings files and
which one wins, permission rules and permission modes (including auto mode), the sandboxed Bash
tool and stronger isolation environments, model and effort configuration, and the terminal
interface. For managed settings from an organization's point of view, read
`references/administration.md`; for output styles, hooks and skills, read `references/extending.md`;
for `-p` runs and CI, read `references/agents-and-automation.md`.

## Settings files and precedence

Settings are strict JSON files (no comments, no trailing commas). The file a key lives in decides
who it applies to, and many keys are now refused from a repository's files.

- **The four files plus managed**: `~/.claude/settings.json` (user, every project),
  `.claude/settings.json` (shared project, committed), `.claude/settings.local.json` (project local,
  personal) and managed settings (MDM, `managed-settings.json`, or server-managed from the claude.ai
  console). `~/.claude.json` is a separate file Claude Code writes for itself (account, MCP servers,
  trust decisions, and a small set of "Global config" keys that `/config` writes).
  [Settings files and precedence](https://code.claude.com/docs/en/settings)
- **Precedence, highest first**: managed, then `--settings <file-or-json>` (one session), then
  project local, then shared project, then user. Environment variables are not a level in this
  stack; each variable/key pair has its own rule (for example `ANTHROPIC_MODEL` beats the `model`
  key from any file, while `ANTHROPIC_DEFAULT_MODEL` applies only when no file sets `model`). The
  key's entry on the reference page says which flag or variable overrides it.
  [Settings files and precedence](https://code.claude.com/docs/en/settings)
- **Lists merge across files**: `permissions.allow` and other arrays combine rather than override.
  Exceptions: `fallbackModel` and `modelPicker` take the whole value from the highest file, a
  managed `availableModels` replaces lower lists, and `modelSettings` resolves model by model.
- **Restrictive values can beat managed**: for a few security keys Claude Code honors the stricter
  value from any scope, for example `permissions.blockReadsOutsideWorkingDirectories: true`,
  `disableClaudeAiConnectors: true`, and `maxEffortLevel` (the lowest cap wins). The "Exceptions to
  managed settings precedence" table on the settings page lists them.
- **Keys a repository file cannot set (this list keeps growing)**: the Scope column of the settings
  index marks keys as `User or managed`, `User, local, or managed`, `Managed` or `Global config`;
  none of those apply from a committed `.claude/settings.json`. Notable ones the agent might try to
  commit: `permissions.defaultMode` values `auto` and `bypassPermissions` (bypass was accepted from
  any file before v2.1.257), the `autoMode` classifier rules, `modelPicker`, `axScreenReader`,
  `skipAutoPermissionPrompt`, `skipDangerousModePermissionPrompt`, `useAutoModeDuringPlan: false`,
  sandbox credential masking and `network.strictAllowlist`, `processWrapper`, `pluginConfigs`,
  and telemetry export variables inside `env`. The VS Code extension also ignores project files when
  choosing a starting permission mode.
  [All settings](https://code.claude.com/docs/en/settings-reference)
- **Workspace trust gates some project keys**: `permissions.allow`, `additionalDirectories`,
  `extraKnownMarketplaces`, most `env` values, hooks and the status line command take effect only
  after the user accepts the trust dialog for the folder. `deny` and `ask` rules apply immediately.
  `claude -p` never shows the dialog and skips project allow rules with a stderr warning.
  [Configure permissions](https://code.claude.com/docs/en/permissions)
- **Where the local file lives**: "Yes, and don't ask again" writes an allow rule to
  `.claude/settings.local.json` at the git repository root (the main checkout's root for a
  worktree), and Claude Code adds it to the user's global git excludes. Path rules in it still
  anchor at the session's primary working directory.
- **Finding a key**: search the settings index on the reference page (key, description, topic,
  scope), or add `"$schema": "https://json.schemastore.org/claude-code-settings.json"` for editor
  autocomplete (the schema can lag new keys). `/config` edits only a short list of personal
  options. `/status` shows the `Setting sources` line; `claude doctor` lists rejected entries.
  [All settings](https://code.claude.com/docs/en/settings-reference)
- **Reload behavior**: most edits (permissions, hooks, `apiKeyHelper`) apply to the running session.
  `model`, `effortLevel` and `modelSettings` are read at start; use `/model` and `/effort` instead.
- **Cloud sessions**: read the committed project file (single-repository sessions) and
  server-managed settings only; user and local files never reach them.
- **Starting points**: ready-made files for a developer, a team, and an organization's managed
  policy, each with a commented twin. [Example settings files](https://code.claude.com/docs/en/settings-example)

## Permission rules

Rules are enforced by Claude Code, not the model; instructions in CLAUDE.md do not change what is
allowed. Rules are evaluated deny, then ask, then allow, and the first match wins regardless of how
specific a rule is, so an allow rule can never carve an exception out of a deny rule.
[Configure permissions](https://code.claude.com/docs/en/permissions)

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Bash(git commit *)",
      "WebFetch(domain:*.example.com)"
    ],
    "ask": [
      "Bash(git push *)",
      "Agent(model:opus)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./secrets/**)",
      "mcp__*"
    ]
  }
}
```

- **Bash rules**: `*` matches any text including spaces; put it after the subcommand
  (`Bash(git log *)`, not `Bash(git *)`). `Bash(ls *)` needs the space and also matches bare `ls`;
  `Bash(ls:*)` is the older equivalent. Compound commands are split on `&&`, `||`, `;`, `|` and
  every part must be allowed. A fixed list of wrappers (`timeout`, `nice`, `nohup`, bare `xargs` and
  a few others) is stripped first; runners such as `npx`, `docker exec` or `devbox run` are not.
- **Bash rules are not a security boundary**: `Bash(curl *)` in deny does not stop `/usr/bin/curl`
  or `sh -c 'curl ...'`. For real enforcement use the sandbox or a PreToolUse hook.
- **`Tool(param:value)` rules (newer)**: deny and ask rules can match one top-level scalar input
  parameter of a built-in tool, such as `Agent(model:opus)`, `Agent(isolation:worktree)` or
  `Bash(run_in_background:true)`; `*` works in the value. Allow rules cannot use this form, the
  primary content field (`command`, `file_path`, `url`) cannot be matched this way, and `mcp__`
  rules with parentheses are skipped in settings files (pass them with `--disallowedTools`).
- **Read and Edit paths** use gitignore syntax with four anchors: `//abs/path`, `~/path`,
  `/path` (relative to the settings source, so in user settings it means `~/.claude/path`) and
  `path` (relative to the current directory). A leading single `/` is not the filesystem root.
  `Write(...)`, `NotebookEdit(...)` and `Glob(...)` path rules never match; use `Edit(...)` and
  `Read(...)`. A `.claudeignore` file has no effect.
- **Other rule types**: `WebFetch(domain:host)` (wildcards only as a leading `*.` or bare `*`),
  `mcp__server__tool` and `mcp__server__*`, `Agent(Name)` to disable a subagent, `Skill(skill:name)`,
  and `Cd(path)` rules that restrict the user's `/cd` command. A bare tool name in deny removes the
  tool from Claude's context entirely.
- **Hooks and mods**: a PreToolUse hook cannot override a deny or ask rule, but a hook exiting with
  code 2 blocks even an allowed call. A mod handling `tool.check` can approve some calls; the
  permissions page explains when that answer outranks rules.
- **Working-directory blocks (newer)**: `permissions.blockReadsOutsideWorkingDirectories` and
  `permissions.blockWritesOutsideWorkingDirectories` make the file tools refuse outside paths in
  every mode, including bypass. They do not limit shell commands; pair them with the sandbox.
  `/add-dir` or `additionalDirectories` in user settings lets one directory through.
- `/permissions` lists every rule with its source file and has a tab for the auto mode rules.

## Permission modes

A mode sets what runs without asking; rules layer on top, and deny rules hold in every mode.
`Shift+Tab` cycles modes in the CLI. [Choose a permission mode](https://code.claude.com/docs/en/permission-modes)

- **Manual** (config value `default`, alias `manual`): asks before edits, most shell commands and
  network access. The mode was renamed in the UI; hooks and SDK options still say `default`, and the
  status bar shows `manual mode on`.
- **`acceptEdits`**: also runs file edits and common filesystem commands (`mkdir`, `mv`, `cp`,
  `rm`, `sed`) inside the working directories.
- **`plan`**: read and propose only. When auto mode is available, the classifier reviews planning
  shell commands instead of prompting (`useAutoModeDuringPlan`, on by default).
- **`auto`**: a classifier model reviews actions in place of the user. See the next section.
- **`dontAsk`**: anything that would prompt is denied; for CI with an exact allowlist.
- **`bypassPermissions`**: no prompts. Only inside a container or VM; refused when running as root
  on Linux and macOS, and blocked by `permissions.disableBypassPermissionsMode`.
- **Which mode a session starts in**: flag, then `permissions.defaultMode`, then the built-in
  default. As of v2.1.283 the built-in default for interactive terminal and VS Code sessions is
  `auto` on every plan and provider (Manual under the HIPAA configuration or when auto is
  disabled). `claude -p` and Agent SDK runs start in Manual (v2.1.302 and later), so calls needing
  approval are denied unless allow rules, a hook, `canUseTool` or `--permission-mode auto` cover them.
- **Never auto-approved in any mode**: explicit ask rules, `AskUserQuestion` and MCP tools marked
  `requiresUserInteraction`, `rm`/`rmdir` on critical paths (root, home, working directory), and
  some cross-session messaging safeguards. Writes to protected paths (`.git`, `.claude`, `.vscode`,
  shell rc files, `.mcp.json` and similar) are never auto-approved outside bypass (they prompt, go
  to the classifier in auto mode, or are denied in `dontAsk`), and allow rules do not pre-approve them.

## Auto mode and its classifier

Auto mode is the newest and most changed area here; most of what a mid-2026 model knows about it is
partly out of date. [Choose a permission mode](https://code.claude.com/docs/en/permission-modes)

- **How decisions are made**: allow/ask/deny rules resolve first, reads and working-directory edits
  are auto-approved, and everything else (mainly shell commands, network, `SendMessage` to other
  agents) goes to the classifier. On entering auto mode, broad allow rules such as `Bash(*)`,
  `Bash(python *)`, package-manager run commands, `Agent` and `Monitor` rules are suspended; narrow
  rules stay. `autoMode.classifyAllShell: true` sends every shell command to the classifier.
- **Blocked by default**: `curl | bash`, exfiltration, production deploys, force push,
  `git reset --hard` and other discards of uncommitted work, IaC destroys, merging unapproved PRs,
  IAM changes and similar. Boundaries the user states in conversation ("don't push") also block,
  but they are re-read from the transcript and can be lost to compaction; use a deny rule for a
  hard guarantee. An approval in conversation must name the specific action.
- **Fallback**: 3 blocks in a row or 20 in a session pause auto mode and return to prompting (not
  configurable). Blocked actions appear under `/permissions`, Recently blocked.
- **Teaching it the user's infrastructure**: the `autoMode` key (`environment`, `allow`,
  `soft_deny`, `hard_deny`, with `"$defaults"` to keep built-ins) is read only from user and managed
  settings. [Configure auto mode](https://code.claude.com/docs/en/auto-mode-config)
- **Subagents**: checked when spawned, on each action, and when they report back; a subagent's
  frontmatter `permissionMode` is ignored in auto mode.
- **Classifier model and billing**: on many connections the server now performs the checks inside
  the session's own model requests at no charge (`/status` shows `Auto mode server: Enabled`).
  When that fails, usually because an LLM gateway strips fields, Claude Code makes its own
  classifier requests (default model Sonnet 5, override with `CLAUDE_CODE_AUTO_MODE_MODEL`) and
  shows a one-time notice that the session is not eligible for no-charge checks. Pro, Max, Ultra
  and Team users never see that notice; on Enterprise, API and cloud-provider accounts the fallback
  requests count as token usage. `CLAUDE_CODE_AUTO_MODE_SERVER=0` opts out of server checks.
  [Auto mode classifier request charges](https://code.claude.com/docs/en/auto-mode-classifier-billing)
- **Turning it off**: `permissions.disableAutoMode: "disable"` (usually managed) removes it from the
  cycle and makes sessions start in Manual.

## Sandboxing and isolation

- **Sandboxed Bash tool**: OS-enforced limits on Bash, PowerShell and Monitor commands and their
  children (Seatbelt on macOS; `bubblewrap` and `socat` on Linux and WSL2; not native Windows). Off
  by default; `/sandbox` turns it on and picks a mode. By default commands may write the working
  directory and a temp directory, may read most of the machine (including `~/.ssh` unless denied),
  and reach the network only through a local proxy whose allowlist starts empty.
  [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing)
- **Auto-allow versus regular permissions mode**: auto-allow runs sandboxed commands without a
  prompt (content-scoped ask rules like `Bash(git push *)` and deny rules still apply); regular
  mode keeps prompting. Auto-allow is the classifier-free way to cut prompts.
- **Escape hatches**: Claude can retry a failed command with `dangerouslyDisableSandbox`, which then
  goes through normal approval; `sandbox.allowUnsandboxedCommands: false` disables that (strict
  mode). `excludedCommands` always run outside. `sandbox.failIfUnavailable: true` makes Claude Code
  exit instead of silently running unsandboxed when a dependency is missing.
- **Controls**: `sandbox.filesystem.allowWrite`, `denyWrite`, `denyRead`, `allowRead`;
  `sandbox.network.allowedDomains` and `deniedDomains` (plus `WebFetch(domain:...)` allow rules);
  `sandbox.credentials` entries that `deny` a file or environment variable, or `mask` it so the
  proxy injects the real secret only toward allowed hosts (masking needs `network.tlsTerminate` and
  is honored only from user, managed or `--settings`). In auto mode Claude names the hosts each
  command needs, and the classifier reviews them with the command.
- **What the sandbox does not cover**: the Read, Edit, WebFetch tools (permission rules govern
  them), MCP servers, hooks, the status line command, mods, and commands the user types at `!`.
  Tools that ignore proxy variables (plain `ssh`, most database drivers) cannot reach the network.
- **Sandbox environments**: to put the whole Claude Code process behind a boundary, use the sandbox
  runtime (`srt claude`, configured in `~/.srt-settings.json`, beta), the published dev container
  with its firewall, a custom container, a VM, or a cloud session.
  `--dangerously-skip-permissions` should always run inside one of these; auto mode benefits from
  one but does not require it. Only the built-in Bash sandbox can be enforced through settings.
  [Choose a sandbox environment](https://code.claude.com/docs/en/sandbox-environments)

Choosing between:

- Fewer prompts, local, no classifier: Manual mode plus the sandbox in auto-allow mode.
- Hands-off local work: auto mode, optionally inside a container.
- Unattended with no checks at all: `bypassPermissions` inside a container, VM or `srt`.
- CI with a fixed list: `dontAsk` plus `--allowedTools`.
- Untrusted repository: a VM or a cloud session.

## Models, effort and context

[Model configuration](https://code.claude.com/docs/en/model-config) holds the current alias table,
default model per plan and provider, and version requirements; fetch it before naming a model.

- **Aliases**: `default` (clears overrides), `best`, `fable`, `opus`, `sonnet`, `haiku`,
  `opus[1m]`, `sonnet[1m]`, `opusplan` (Opus in plan mode, Sonnet for execution). Aliases resolve to
  different versions per provider (Bedrock, Agent Platform and Foundry lag); pin with a full model
  ID or `ANTHROPIC_DEFAULT_OPUS_MODEL` and friends. Fable models are never the default and may bill
  to usage credits; `/model fable` handles the one-time consent.
- **Choosing the model**: `/model` (saves as default; press `s` to switch for this session only),
  `--model`, `ANTHROPIC_MODEL`, then the `model` key. Enterprise admins can set an organization
  default model; `availableModels`, `deniedModels` and `enforceAvailableModels` restrict choice and
  `modelPicker` relabels the picker.
- **Effort**: levels `low`, `medium`, `high`, `xhigh`, `max`, calibrated per model. Newer models
  default to `medium` (older ones to `high`), so do not carry a level over between models. `/effort`
  now saves the level per model under `modelSettings` rather than the top-level `effortLevel`
  (v2.1.251), and a top-level `effortLevel` in user settings is ignored by the newest models.
  `max` applies to one session only. `CLAUDE_CODE_EFFORT_LEVEL` outranks everything;
  set it to `auto` to send no effort. The word `ultrathink` in a prompt deepens one turn; "think
  hard" is ordinary text.
- **`maxEffortLevel`**: caps effort for every source (flag, skill frontmatter, model default) on any
  provider; the lowest cap across scopes wins, so a repository can lower it but nobody can raise it.
- **Ultracode toggle**: not an effort level. With it on, Claude plans a dynamic workflow for each
  substantive task, at whatever effort the session runs. Toggle in the `/effort` slider with `Tab`,
  `/effort ultracode` or `/effort ultracode off` for the session, the `ultracode` settings key, or
  `--effort ultracode` (which also sets `xhigh`). Needs workflows enabled and a model with `xhigh`.
  Workflows themselves are in `references/agents-and-automation.md`.
- **Thinking**: cannot be turned off on the newest models; `alwaysThinkingEnabled: false` and
  `MAX_THINKING_TOKENS=0` affect only older ones. `showThinkingSummaries: true` shows full summaries
  under `Ctrl+O`.
- **Fallback models**: `fallbackModel` (array, at most three, highest file wins) or
  `--fallback-model sonnet,haiku` switches on overload or unavailability for the current turn only.
  Separately, requests that a safety classifier flags (cybersecurity, biology) automatically re-run
  on a designated older model; `switchModelsOnFlag: false` asks first.
- **1M context**: the newer models run with a 1M window natively; `[1m]` matters only for the
  4.6-era models. `CLAUDE_CODE_DISABLE_1M_CONTEXT=1` holds sessions at 200K.
- **Auto-compact window**: `/autocompact 500k` (saved per model), the `autoCompactWindow` key,
  `--autocompact` for one launch, or `CLAUDE_CODE_AUTO_COMPACT_WINDOW` (wins over all). Native-1M
  models compact just before the window fills by default. For gateway model IDs Claude Code does
  not recognize it assumes 200K; fix with `modelOverrides`, a `[1m]` suffix or
  `CLAUDE_CODE_MAX_CONTEXT_TOKENS`.
- **Idle compaction (new)**: on by default; when a large conversation (default threshold 200K
  tokens) on the one-hour prompt cache sits idle for about an hour, Claude Code compacts it so the
  next message does not resend the whole uncached transcript. Turn off with `idleCompaction: false`.
  Related cache keys: `promptCacheTtl` and `subagentPromptCacheTtl`.
  [All settings](https://code.claude.com/docs/en/settings-reference)
- **Fast mode**: `/fast` runs supported Opus models up to 2.5x faster at a higher per-token price,
  same quality. Anthropic API and subscriptions only (not Bedrock, Agent Platform, Foundry); on
  subscriptions it always bills to usage credits, and Team and Enterprise need an Owner to enable
  it. Turning it on mid-conversation re-bills the whole context uncached, so enable it at the start.
  The `fastMode` key persists it; `fastModePerSessionOptIn` makes it per session.
  [Speed up responses with fast mode](https://code.claude.com/docs/en/fast-mode)
- **Advisor tool (experimental)**: a server-side tool through which Claude consults a stronger model
  at decision points (before committing to an approach, on a recurring error, before declaring
  done). The advisor sees the whole conversation; Claude decides when to call it. Set with
  `/advisor opus`, `advisorModel`, or `--advisor`. The advisor must rank at or above the main model,
  it is Anthropic API only, and toggling it does not break the prompt cache.
  [Escalate hard decisions with the advisor tool](https://code.claude.com/docs/en/advisor)
- **Output styles**: the `outputStyle` key selects a built-in (Explanatory, Learning, Proactive) or
  custom style; edits apply from the next message. Details are in `references/extending.md`.
  [Output styles](https://code.claude.com/docs/en/output-styles)

Choosing between ways to get more capability or speed: raise effort for one hard task; `ultrathink`
for one turn; the advisor for a cheap main model with strong planning; `opusplan` for strong
planning then cheap execution; a subagent with its own `model` for a delegated subtask; fast mode
for latency at higher cost; lower effort for speed at some quality cost.

## Interface

- **Terminal setup**: Enter submits; `Ctrl+J` or `\` then Enter always adds a newline. Shift+Enter
  works natively in most modern terminals; `/terminal-setup` installs it for VS Code, Cursor, Zed and
  older Alacritty. macOS Option shortcuts need "Option as Meta". tmux needs `allow-passthrough`,
  `focus-events` and `extended-keys`. `preferredNotifChannel: "terminal_bell"` forces a bell;
  Notification hooks add sounds. `/theme` includes custom JSON themes in `~/.claude/themes/`.
  Vim mode is `editorMode: "vim"`; `vimInsertModeRemaps` maps `jj` to Escape.
  [Configure your terminal for Claude Code](https://code.claude.com/docs/en/terminal-config)
- **Fullscreen rendering (research preview)**: draws on the alternate screen like `vim`, removes
  flicker, keeps memory flat, adds mouse support and click-to-expand tool output. Switch with
  `/tui fullscreen` or `/tui default` (saved as the `tui` key) or `CLAUDE_CODE_NO_FLICKER=1`. Newer
  installs often start in fullscreen. Native terminal search and scrollback no longer apply; use
  `Ctrl+O` then `/` to search. [Fullscreen rendering](https://code.claude.com/docs/en/fullscreen)
- **Screen reader mode**: `--ax-screen-reader`, `CLAUDE_AX_SCREEN_READER=1`, or
  `axScreenReader: true` in user settings (project files cannot turn it on). Output becomes labeled
  linear text (`you:`, `claude:`, `Permission Required:`), menus become numbered lists, and the
  bell rings when input is needed. `prefersReducedMotion`, the daltonized themes and
  `CLAUDE_CODE_ACCESSIBILITY=1` (visible cursor for magnifiers) cover other needs.
  [Use Claude Code with a screen reader](https://code.claude.com/docs/en/accessibility)
- **Voice dictation**: `/voice` (hold Space to talk, or `/voice tap`), persisted under the `voice`
  key. Audio streams to Anthropic for transcription, requires a claude.ai login (not API key or
  cloud providers) and a local microphone, so it does not work over SSH or in cloud sessions. The
  `language` key sets the dictation language. [Voice dictation](https://code.claude.com/docs/en/voice-dictation)
- **Status line**: `statusLine` with `type: "command"` runs a script that receives session JSON on
  stdin (model, context window usage, cost, effort, rate limits, prompt cache state, git worktree)
  and prints one or more lines with ANSI colors or OSC 8 links. `/statusline <description>` writes
  one for the user. It runs only after workspace trust, is disabled by `disableAllHooks`, and should
  read `COLUMNS` rather than `tput`. `subagentStatusLine` formats agent-panel rows.
  [Customize your status line](https://code.claude.com/docs/en/statusline)
- **Keybindings**: `/keybindings` opens `~/.claude/keybindings.json`, a `bindings` array of
  `{ context, bindings }` blocks mapping keys to `namespace:action` names (or `null` to unbind),
  with chords such as `ctrl+k ctrl+s`. Changes apply live. `Ctrl+C`, `Ctrl+D` and a few others are
  reserved; vim motions are not remappable; `keybindingFlavor` is deprecated and does nothing.
  [Customize keyboard shortcuts](https://code.claude.com/docs/en/keybindings)
