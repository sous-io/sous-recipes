# Plugins, Mods and Marketplaces

This branch covers Claude Code plugins: what they bundle, how they are installed, trusted, built,
tested, published and measured; marketplaces and their source types; organization controls; and
mods, the plugins that run JavaScript or TypeScript inside Claude Code. For the standalone
features a plugin packages (skills, subagents, settings hooks, MCP, output styles), read
`references/extending.md`. For managed settings in general, read `references/administration.md`.
Details here are as of Claude Code 2.1.317.

## What a plugin is

A plugin is a directory of components that loads as one unit, usually with a manifest at
`.claude-plugin/plugin.json` (only `name` is required, and the manifest itself is optional). An
enabled plugin is part of every session: the names and descriptions of its model-invocable skills,
agents and commands cost context on every turn, its MCP servers run, and its hooks fire. What it
runs, it runs as the user. Its id is `name@marketplace`, and its skills run as
`/<plugin>:<skill>`. [Plugins overview](https://code.claude.com/docs/en/plugins/overview)

What a plugin can bundle (each default location, and the manifest key that overrides it, is in
[Add components to a plugin](https://code.claude.com/docs/en/plugins/components)):

- **Skills** in `skills/<name>/SKILL.md`, and legacy **commands** in `commands/*.md`.
- **Agents** in `agents/*.md`. Plugin agents ignore `permissionMode`, `hooks`, `mcpServers` and
  `initialPrompt` in their frontmatter.
- **Settings hooks** in `hooks/hooks.json`, the same shape as the settings `hooks` object.
- **A hooks module** (a `modules` key in `hooks/hooks.json`), which makes the plugin a mod (see
  below).
- **MCP servers** in `.mcp.json` or `mcpServers`, which can also point at an `.mcpb` bundle.
  Tools are named `mcp__plugin_<plugin>_<server>__<tool>`.
- **LSP servers** in `.lsp.json` (code intelligence; the user installs the server binary).
- **Output styles** in `output-styles/`, and **themes** in `themes/*.json` (manifest key
  `experimental.themes`).
- **Monitors** in `monitors/monitors.json`: background shell commands whose stdout reaches Claude
  as notifications, started at session start or on the first run of a named skill. They do not run
  under `claude -p` and run outside the sandbox.
- **Channels** (`channels` in the manifest), which bind an `mcpServers` entry as a message channel.
- **Workflows** in `workflows/*.js`, and executables in `bin/`, which is appended to the Bash
  tool's PATH.
- **User config** (`userConfig`): typed options the user fills in on install or enable, with
  `sensitive` values kept in secure storage. Components read them as `${user_config.KEY}` and hooks
  as `CLAUDE_PLUGIN_OPTION_<KEY>`.
- **Default settings** (`settings.json`), where only `agent` and `subagentStatusLine` take effect.

Gotchas: a `CLAUDE.md` at a plugin root is NOT loaded (write a skill instead); only `plugin.json`
belongs inside `.claude-plugin/`; write state to `${CLAUDE_PLUGIN_DATA}`, never to
`${CLAUDE_PLUGIN_ROOT}`, which changes with each version.

## Installing and using plugins

- **Install and scopes**: `/plugin` (tabs Discover, Installed, Marketplaces, Errors, Stats) or
  `claude plugin install name@marketplace`. User scope writes `enabledPlugins` in
  `~/.claude/settings.json`, project scope writes the committed `.claude/settings.json`, local
  scope writes `.claude/settings.local.json`. Project scope only enables: each collaborator still
  installs the plugin once, or sees "enabled in project settings but isn't installed".
  `/plugin install name --marketplace <source>` adds the marketplace and installs in one step.
  After a shell install, run `/reload-plugins` in an open session.
  [Install and manage plugins](https://code.claude.com/docs/en/plugins/install)
- **Other surfaces**: the terminal, Desktop local sessions and the VS Code extension share the same
  settings files. Cloud sessions load neither local plugins nor the repository's plugin settings;
  only server-managed ones arrive. Plugins enabled on the user's claude.ai account arrive as
  `name@synced`.
- **Anthropic's marketplaces**: `claude-plugins-official` (repository
  `anthropics/claude-plugins-official`) is added automatically on the first interactive terminal
  session. The community marketplace is named `claude-community` and the user adds it. The old
  `claude-code-plugins` marketplace is deprecated, so skip tutorials that add it. Auto-update is on
  by default for official marketplaces and off for community and third-party ones.
  [Anthropic's marketplaces](https://code.claude.com/docs/en/plugins/anthropic-marketplaces)
- **Code intelligence**: official LSP plugins (for example `typescript-lsp`, `pyright-lsp`,
  `gopls-lsp`, `rust-analyzer-lsp`) give Claude diagnostics after each edit and a read-only `LSP`
  tool for symbol navigation. The binary must already be on PATH. When it is and the plugin isn't
  installed, Claude Code offers the plugin in a recommendation dialog.
  [Code intelligence plugins](https://code.claude.com/docs/en/plugins/code-intelligence)
- **Trust**: whatever its tier, a plugin runs code as the user. Hooks, monitors, mods, MCP servers
  and LSP processes all run outside permission rules and the sandbox. The official and community
  marketplace names are honored only for sources under `github.com/anthropics/`; every other
  marketplace, including the user's own organization's, is third-party. Auto-update can change
  files the user already reviewed. `claude plugin details <name>` prints a component inventory.
  [Plugin security and trust](https://code.claude.com/docs/en/plugins/security)

## Building a plugin

- **Create**: start from an empty directory, then load it for one session with
  `claude --plugin-dir ./my-plugin`, which needs no marketplace, takes a `.zip` or a folder of
  plugins, and gives the id `name@inline`. `--plugin-url` fetches a zip at startup.
  `claude plugin init <name>` scaffolds a skills-directory plugin under `~/.claude/skills/<name>/`
  (id `name@skills-dir`), which loads in every session with no install. To convert an existing
  `.claude/` setup, move `commands/`, `agents/`, `skills/` and the hooks object into the plugin.
  [Create a Claude Code plugin](https://code.claude.com/docs/en/plugins/create)
- **Dependencies**: `dependencies` in `plugin.json` takes names or `{ name, version, marketplace }`
  with npm semver ranges such as `^1.2`. Ranges resolve against git tags named
  `<plugin>--v<version>`, which `claude plugin tag` creates. Dependencies from another marketplace
  are blocked unless the marketplace lists them in `allowCrossMarketplaceDependenciesOn`. A
  manifest with only `name` and `dependencies` is a valid "bundle" plugin. Auto-installed
  dependencies stay after an uninstall until `claude plugin prune` removes them.
  [Plugin dependencies](https://code.claude.com/docs/en/plugins/dependencies)
- **Publishing**: share a folder or zip (no updates), list the plugin in your own marketplace, or
  submit it to Anthropic's directory (it then reaches Claude Code as `name@synced`). The biggest
  gotcha is versions: if `version` is set and not bumped, users stay on the old copy ("already at
  the latest version"). Either bump it every release or leave it out everywhere, so the commit SHA
  is used. Names that start with `claude-`, `anthropic-` or `cc-plugin-` fail validation.
  [Publish and distribute a plugin](https://code.claude.com/docs/en/plugins/publish)
- **Measuring cost and use**: `claude plugin details <name>` shows the always-on token figure and a
  per-component split. `/skill-doctor` reports each skill's cost and use, flags skills that are
  listed but never invoked (plugin skills included), and opens in the `/plugin` Stats tab
  (`/plugin stats`). `/doctor` suggests disabling unused plugins, and the Installed tab groups
  them under "Not used recently". Fleet-wide, use OpenTelemetry events such as
  `claude_code.plugin_loaded` and `claude_code.skill_activated`.
  [Measure plugin cost and usage](https://code.claude.com/docs/en/plugins/measure)
- **CLI hints**: a CLI or SDK can prompt Claude Code users to install its official-marketplace
  plugin by printing `<claude-code-hint v="1" type="plugin" value="name@claude-plugins-official" />`
  on its own line to stderr, gated on the `CLAUDECODE` environment variable. Claude Code strips
  the line and shows a one-time prompt, only in attended interactive sessions.
  [Recommend your plugin from your CLI](https://code.claude.com/docs/en/plugins/cli-hints)

### Testing: validate, test and eval

Three commands, three different questions:

- **`claude plugin validate <dir>`** checks the files without running anything: the manifest or
  `marketplace.json`, component frontmatter, `.mcp.json` and, for a mod, a static scan of the
  hooks module that lists its `hooks:` and `calls:`. It is free, so run it on every edit and in CI
  with `--strict`. It does not read `.lsp.json`.
  [Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference)
- **`claude plugin test`** runs a mod's `*.test.ts` files: unit tests that fire events through the
  hooks and stub Claude Code's answers. It makes no model call and needs no session, sign-in or
  network. It applies only to mods. [Test a mod](https://code.claude.com/docs/en/plugins/mods/test)
- **`claude plugin eval`** measures behavior: whether the plugin actually leads Claude to the right
  outcome. Each case in `evals/<case>/` is a `prompt.md` (or `case.yaml`) plus graders (`regex`,
  `tool_used`, `tool_order`, `file_exists`, and model-judged `llm` and `baseline`). Each case runs
  several times in isolated `claude -p` sessions, both with the plugin and without it, and reports
  `WITH`, `W/OUT` and the delta. Every run is billed. `claude plugin eval init` drafts the suite.
  In CI, gate with `--threshold` and `--json`. A delta near zero with the Skill grader failing
  usually means the skill's description doesn't trigger. This is not the skill-creator plugin's
  `evals/evals.json`; neither reads the other's files.
  [Test plugins with evals](https://code.claude.com/docs/en/plugin-evals)

## Marketplaces

A marketplace is a catalog, not a store: a directory or repository with
`.claude-plugin/marketplace.json` that holds `name`, `owner` and `plugins[]`, each entry giving a
`name` and a `source`. Keep each entry's `name` equal to the plugin's manifest `name`, or installs
fail with "not found in marketplace". [Create a marketplace](https://code.claude.com/docs/en/plugins/create-marketplace)

Plugin source types (in an entry's `source`):

- **Relative path** (`"./plugins/x"`): resolved from the marketplace root. It does not work in a
  marketplace hosted as a bare `marketplace.json` URL.
- **`github`** (`repo`, `ref`, `sha`) and **`url`** (any git URL, with `ref` and `sha`).
- **`git-subdir`**: one subdirectory of a repository, using a sparse clone.
- **`npm`** (`package`, `version`, `registry`): install scripts never run.
- **`archive`**: an https zip, optionally pinned by `sha256`.
- **`command`**: a command on the user's machine that prints the plugin directory's path. The user
  must review and accept it, and it re-runs each session (`copy` or `link` mode).

Marketplace source types (what `claude plugin marketplace add` builds, or what a settings file
writes): `github`, `git`, `url` (a direct link to the JSON file), `file`, `directory` and
`settings`. Note that `url` means a JSON file here but a git repository as a plugin source. An
`npm` marketplace source parses but does not load yet.

**The inline `settings` marketplace**: a settings file can declare a whole catalog inline, with no
hosted file. The `name` must equal the map key, and each plugin's `source` must be an object
(relative paths have nothing to resolve against). Paired with `enabledPlugins` in a project's
`.claude/settings.json`, this gives everyone in a repository the plugin once they accept workspace
trust (external sources still need a per-user install):

```json
{
  "extraKnownMarketplaces": {
    "team-tools": {
      "source": {
        "source": "settings",
        "name": "team-tools",
        "plugins": [
          {
            "name": "formatter",
            "source": {
              "source": "github",
              "repo": "example-org/formatter"
            }
          }
        ]
      }
    }
  },
  "enabledPlugins": {
    "formatter@team-tools": true
  }
}
```

- **Hosting**: GitHub, any git host, a hosted JSON URL, or a shared directory. Private repositories
  use the user's existing git credentials with no prompts; `GITHUB_TOKEN` alone does nothing.
  Auto-update is off for third-party marketplaces, and `marketplace.json` cannot turn it on (users
  toggle it, admins set `autoUpdate` on the `extraKnownMarketplaces` entry). A `renames` map
  renames a plugin without breaking installs. There are no built-in release channels; use two
  marketplaces with different names at different refs.
  [Host and maintain a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace)
- **Reference**: every `marketplace.json` field, how an entry combines with `plugin.json` (`strict`),
  reserved names, and which source values are valid in `extraKnownMarketplaces`,
  `strictKnownMarketplaces` and `blockedMarketplaces`.
  [Marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference)
- **Relevance suggestions**: a `relevance` block on an entry (signals such as the working
  directory, the CLI commands run, the hosts reached, files read and manifest dependencies) makes
  Claude Code suggest the plugin when local work matches. It requires the admin to list the
  marketplace in `pluginSuggestionMarketplaces`. Nothing installs automatically.
  [Recommend plugins for your org](https://code.claude.com/docs/en/plugins/relevance)

## Organization control

- **Plugins**: managed settings can require plugins (`extraKnownMarketplaces` plus `enabledPlugins`;
  a managed `true` can't be disabled), allowlist marketplaces (`strictKnownMarketplaces`, where
  matching is exact and `owner/*` is allowed), block them (`blockedMarketplaces`), reject
  `--plugin-dir` and similar flags (`disableSideloadFlags`), block `command` sources
  (`disableCommandPluginSources`), and pre-seed a read-only plugin cache
  (`CLAUDE_CODE_PLUGIN_SEED_DIR`). Only the first managed source applies (server, then MDM, then
  file) unless `managedSourcesBehavior` is `merge`. An allowlist without a `skills-dir` entry
  silently stops skills-directory plugins from loading.
  [Manage Claude Code plugins for your organization](https://code.claude.com/docs/en/plugins/org)
- **Mods**: see "Admin controls for mods" below.
  [Manage mods for your organization](https://code.claude.com/docs/en/plugins/mods/admin)

## Loading, manifest, commands, troubleshooting

- **Loading**: a plugin is declared in settings, fetched into `~/.claude/plugins/` (the cache is
  `cache/<marketplace>/<plugin>/<version>/`), and loaded at session start or on `/reload-plugins`.
  Precedence runs user, then project, then local, then `--settings`, then managed; opt out of a
  project-enabled plugin with `false` in `.claude/settings.local.json`. "Why an update changed
  nothing" is nearly always the computed version: manifest `version`, then entry `version`, then
  the source-derived SHA. A project's `.claude/plugins/` directory is NOT scanned. Node
  dependencies with a lockfile are installed automatically, with scripts off.
  [Plugin loading reference](https://code.claude.com/docs/en/plugins/loading)
- **Manifest**: every `plugin.json` field, path rules (`./`, inside the plugin root), which manifest
  keys replace the default folder (commands, agents, output styles) and which add to or merge with
  it (skills, hooks, MCP, LSP), the `userConfig` schema, and the environment variables
  `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` and `CLAUDE_PROJECT_DIR` (none of them is set in Bash
  tool commands). [Plugin manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference)
- **Commands**: `claude plugin` has `init`, `install`, `uninstall`, `enable`, `disable`, `update`,
  `list`, `details`, `configure`, `prune`, `eval`, `tag`, `test`, `validate`, and
  `marketplace add|list|update|remove`. In a session there are `/plugin` and
  `/reload-plugins [--force]`; `--force` is needed when a reload would change MCP tools and break
  the prompt cache. `claude plugin add`, `--project` and `/install` do not exist.
  [Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference)
- **Troubleshooting**: error messages grouped by stage, from where `/plugin` runs through install
  and organization policy. Common ones: `/plugin` doesn't exist in `-p`, the Desktop Code tab or
  the web; the official marketplace is only auto-added in an interactive terminal; an unquoted
  `${CLAUDE_PLUGIN_ROOT}` breaks on paths with spaces; MCP servers that work with `--plugin-dir`
  but fail once cached (paths outside the plugin).
  [Troubleshoot plugins](https://code.claude.com/docs/en/plugins/troubleshooting)

## Mods

A mod is a plugin whose `hooks/hooks.json` has a `modules` key pointing at one JavaScript or
TypeScript file, the hooks module. Claude Code calls that file's functions in its own process
(installed mods share one hooks worker thread) when events happen. Mods have been on by default
since 2.1.287 (2.1.286 in the Desktop app); the early-access variable
`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` is now ignored. A mod can draw panes and a band above the
prompt, restyle Claude Code's own interface (but never the permission prompt), rewrite or answer
tool calls and prompts, add commands and tools, and call models. It is NOT sandboxed: through the
mods API it reads and writes files, starts processes and makes network requests as the user, and
permission rules do not cover those calls. In mod docs, "hook" means a mod's handler, and the
`settings.json` kind is a "settings hook".
[Mods overview](https://code.claude.com/docs/en/plugins/mods/overview)

Mods run in the CLI, the Desktop Code tab and the VS Code extension. Hooks also run in `claude -p`,
the Agent SDK and cloud sessions, but nothing is drawn there.

### Minimal mod (from the docs)

```text
first-mod/
├── .claude-plugin/
│   └── plugin.json
└── hooks/
    ├── hooks.json
    └── register.js
```

`hooks/hooks.json`:

```json
{
  "description": "The first-mod hooks module",
  "modules": ["./register.js"]
}
```

`hooks/register.js`, which counts tool calls and shows the count beside the spinner:

```javascript
// The count, shared by the two hooks below
let calls = 0

// Claude Code calls this once when the mod loads
export function register(on) {
  // Runs each time Claude is about to use a tool
  on('tool.call', async ($, e, next) => {
    calls += 1
    // Ask Claude Code to draw the interface again, so the new count shows
    $.ui.invalidate('ui.render')
    // Let the tool run as usual
    return next(e)
  })

  // Runs each time Claude Code draws the spinner
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    // Keep Claude Code's spinner, with the count added after its word
    return next({ ...e, props: { ...e.props, suffix: ' · tool calls: ' + calls + '…' } })
  })
}
```

Every hook gets `$` (the mods API), `e` (the event as frozen data; to change it, pass a copy to
`next`) and `next` (middleware: the later mods, then Claude Code's own behavior). A hook can
**observe** (`return next(e)`), **rewrite** (`next({ ...e, text })`) or **answer** (return a result
without calling `next`, such as `{ deny: reason }`). The second argument to `on` is an optional
matcher, such as `{ tool: 'Bash' }`; values may be arrays or regular expressions. `register(on,
options)` receives the manifest's `userConfig` values as `options`.
[Create a mod](https://code.claude.com/docs/en/plugins/mods/create)

### Making and iterating

- **Ask Claude**: describe the mod in a session. The built-in `plugin-authoring` skill writes it
  under `~/.claude/dev-mods/<session-id>/`, and the user approves hot reloading. It loads only in
  that session and is cleaned up later, so copy it out to keep it. Claude does not see the "change
  didn't load" transcript line unless the user pastes it.
- **Write it yourself**: no Node.js or build step is needed (`.js` and `.ts` load directly). Load it
  with `claude --plugin-dir ./first-mod`, which hot-reloads on save. A reload re-runs `register`, so
  module variables reset. Claude Code writes type declarations for the running build into
  `.claude-plugin/types/`; trust them over any doc page.
- **Static-analysis rules** (enforced by `claude plugin validate`): write each API call in full
  (`$.fs.read(...)`, never `const ui = $.ui`), event names as string literals, ES module imports
  from inside the plugin only, and no dynamic `import()`.
- **Develop against the directory, not an installed copy**: an installed copy is cached by version
  and ignores edits.

### Events

Event families ([React to events with a mod](https://code.claude.com/docs/en/plugins/mods/events)
explains each; [Mods reference](https://code.claude.com/docs/en/plugins/mods/reference) has every
field):

- **`tool.*`**: `tool.call` (before a tool runs: pass, `{ deny }`, or a fake `{ result }`),
  `tool.check` (the permission decision, after `PreToolUse`: `{ decision: 'allow' | 'ask' |
  'deny' }`; arguments are in `e.input` here) and `tool.describe` (rewrite a tool's description).
- **`prompt.*`**: `prompt.submit` (rewrite, add `context` only Claude reads, or `{ drop }`),
  `prompt.compose` and `prompt.section` (the system prompt), `prompt.context`, `prompt.attachment`
  (reminders), `prompt.mention`, `prompt.autocomplete`, `prompt.fill` and `prompt.suggest`, plus
  `skill.prompt` and `attribution.text`. Text that changes between requests breaks the prompt cache.
- **`turn.*`**: `turn.start`, `turn.step` (one model request, an async generator; change `model` or
  `effort`, read token usage) and `turn.complete`.
- **`session.*`**: `session.start` (register commands and tools here; it does not re-fire after
  `/clear`, `/resume` or `/branch`), `session.end`, `session.compact`, `session.send` and
  `session.receive` (messages between sessions), `session.append` and `session.measure`.
- **`agent.*`**: `agent.offer` (withhold a subagent type) and `agent.spawn` (choose its model, or
  deny it). It does not fire on a `SendMessage` resume.
- **`command.*` and `config.*`**: `command.run` (answer a `/command`), `command.describe`,
  `config.set`, `config.describe`, and `settings.read`.
- **`ui.*`**: `ui.render` (draw a render site), `ui.press`, `ui.input`, `ui.select`, `ui.close`,
  `ui.message`, `ui.fault` and others.
- **`plugin.register`**: another hooks module is about to load. `e.uses` lists what it calls;
  return `{ refuse }`. `engine.create` can add a namespace to the mods API.
- **`classic.<Event>`**: each settings hook event (`classic.Stop`, `classic.PostToolUse`), with the
  settings hook's stdin JSON as `e`.
- **API calls as events**: every mods API method is also an event (`fs.read`, `http.fetch`), so an
  earlier mod can observe, deny or answer a later mod's calls.

Order and failure: mods form a chain (the built-in guard and managed `prependPlugins`, then mods
the user installed, then `appendPlugins`, then built-ins). A managed `PreToolUse` hook runs before
every mod. A hook that throws or times out (10 seconds of its own time, 50 ms for `prompt.edit`) is
skipped, so a guard fails OPEN unless it adds `.catch(...)` that denies when `!next.called`.

### Mods API ($)

[Use the mods API](https://code.claude.com/docs/en/plugins/mods/api); the full method list is in
the reference.

- **`$.ui`**: `open` and `close` for panes, `toast`, `status` (a sticky line under the prompt),
  `ask` (a question; rejects on dismiss and in `-p`), `notify` (an OS or terminal notification),
  `log` (a transcript line Claude does not read), `invalidate` (ask for a redraw), `resolve` (get
  the element functions), `blit`, and more.
- **`$.command.register`** (with `immediate` to run while Claude works) and **`$.tool.register`**.
  Claude sees a registered tool as `mcp__<plugin>__<name>`, and the mod answers it in a `tool.call`
  hook.
- **`$.model.complete`** (a lone prompt with no tools or CLAUDE.md; failures resolve with
  `isAnswered: false` instead of rejecting) and **`$.model.fork`** (the whole conversation plus a
  prompt, mostly cached). Both bill the user. `classify` also exists.
- **`$.fs`** (`write` is not atomic), **`$.process.run` and `spawn`** (no shell; rejects when the
  program can't start or times out), and **`$.http.fetch`** (cross-origin redirects drop the
  `Authorization` header).
- **`$.store`**: persistent JSON shared by every session on the machine. **`$.state`**: reactive
  session state that survives a module reload but not `/clear`. A module variable is lost on every
  reload.
- **`$.env`** (names must be string literals), **`$.session`** (`messages`, `usage`, `send`, `id`,
  `cwd`), **`$.agent`** (`register`, `spawn`, `list`), **`$.prompt.submit`** (start a turn; don't
  await it mid-turn), **`$.clock`** (`after`, `every`; timers die on reload), plus `$.mcp`,
  `$.config`, `$.settings`, `$.turn.abort` and `$.audio`.

### Interface elements

- **Where to draw**: a `Pane` (a sidebar in a wide fullscreen terminal, otherwise a region above the
  prompt; open it with `$.ui.open`, then draw it in a `ui.render` hook), the `AbovePrompt` band
  (shared by every mod, so put `await next(e)` inside your tree to keep theirs), and built-in sites
  to restyle, such as `Spinner`, `ToolUse`, `ToolResult`, `AssistantMessage` and
  `AskUserQuestion`. A drawing is a snapshot: call `$.ui.invalidate('ui.render')` to redraw. A pane
  the mod opens on its own appears only in a wide terminal; one opened from a user action appears
  at any width. [Draw in the interface with a mod](https://code.claude.com/docs/en/plugins/mods/interface)
- **Elements**: `Box`, `Text`, `Button`, `Link`, `Code` (including diffs) and `Markdown` everywhere;
  `Input` and `Select` with string `key`s; `Svg` in Desktop and VS Code only; `Client` (a script for
  animation and pointer input); `Raster` and `Image` in the terminal only. Samples with screenshots
  are in [Interface gallery for mods](https://code.claude.com/docs/en/plugins/mods/gallery).
- **Gotchas**: `focus`, `closeOnEscape` and `autoFocus` accept only `true` (passing `false` throws);
  the user can collapse the band and the mod can't tell, so never put a required question only
  there; VS Code ignores hotkeys and frames mod output with the plugin's name.

### Testing and troubleshooting mods

- **Tests**: `*.test.ts` files import `test`, `expect` and `mock` from `claude-code/testing`. In
  `test(name, async ($, on) => ...)`, calls on `$` fire events through the mod (for example
  `$.tool.call(...)` or `$.command.run(...)`), and `on(name, stub)` answers in Claude Code's place
  (`{ value }` or `{ deny }` for API calls). `$.ui.mount(...)` renders a pane, and `press`, `input`
  and `find` drive it. `mock.clock` controls timers, and `tier(...)` with inline `plugins` tests a
  policy mod. Register every stub before the first call on `$`; `session.start` is not fired
  automatically. [Test a mod](https://code.claude.com/docs/en/plugins/mods/test)
- **Troubleshooting**: a broken mod fails silently and looks like one that does nothing. Start with
  `claude plugin validate`, then `/plugin` (its "N mods active" line), then the debug log
  (`claude --debug`; look for `hooks module <name> loaded` or `not loaded: <reason>`). Running
  `claude plugin test` in a directory with no mod reports whether mods can load at all. A loop that
  never awaits crashes the shared hooks worker, and three crashes turn off every installed mod for
  the session. [Troubleshoot a mod](https://code.claude.com/docs/en/plugins/mods/troubleshoot)

### Admin controls for mods

- **Built-in guard** `cc-plugin-sec-default` (`sec-default@builtin`): it loads ahead of every user
  mod when the machine has managed settings or the session uses a Team or Enterprise `/login`. It
  protects managed hooks, the system prompt, managed instructions and managed MCP tools. It makes
  deny and ask rules and blocking `PreToolUse` hooks win over a user mod's approval, and it skips
  user mods' hooks on `classic.*`, `prompt.compose`, `prompt.section` and similar events. API-key
  and cloud-provider users without managed settings get no guard, so a mod can approve calls an
  `ask` rule would prompt for.
- **Stop user mods**: set `allowManagedModsOnly: true` under
  `pluginConfigs["cc-plugin-sec-default@builtin"].options` in managed settings. Settings hooks,
  status lines and built-in mods keep running. `allowModsToOverrideDenyRules` is the opposite lever.
- **Organization mods**: a mod counts as the organization's only when managed `enabledPlugins`
  enables it from a `directory` marketplace at an absolute path, listed by relative path. A mod
  copied into the cache (from a GitHub or npm source) counts as a user's. `prependPlugins` and
  `appendPlugins` set the order. Setting `prependPlugins` replaces the default list, so include
  `sec-default@builtin` in it. A policy mod hooks `plugin.register` to refuse mods by `e.uses`, and
  hooks API events such as `http.fetch` to deny single calls.
- **Network**: a `WebFetch` deny rule or `CLAUDE_CODE_DISABLE_WEB_FETCH` does NOT stop
  `$.http.fetch`, and nothing covers programs started with `$.process.run`.
- **Switches**: `disableAllHooks`, `--safe-mode` and `--bare` stop installed mods but not built-in
  ones. [Manage mods for your organization](https://code.claude.com/docs/en/plugins/mods/admin)

### Built-in mods

Listed under Built-in in the `/plugin` Installed tab; they can't be uninstalled:
`cc-plugin-agents-md` (loads `AGENTS.md`), `cc-plugin-diff` (the `/diff` pane),
`cc-plugin-plugin-authoring` (the skill for writing mods), `cc-plugin-sec-default` (the guard),
`cc-plugin-telemetry`, and `cc-plugin-you-should-know`. The last one is off by default. When the
user turns it on, a tool-less side agent rereads the conversation during longer tasks and shows a
"Heads up" note above the prompt about something the user might have missed, such as an unflagged
tradeoff. Turn it off with `/plugin disable cc-plugin-you-should-know@builtin`. It needs a direct
Claude API connection; it doesn't appear through gateways or an `apiKeyHelper`. See
[Mods overview](https://code.claude.com/docs/en/plugins/mods/overview). Source for several of
these is public in the `mods/` directory of the anthropics/claude-code repository.

## Choosing between a mod and its neighbors

- **Skill**: Claude needs instructions or knowledge.
- **Settings hook**: block, allow or log an event with an existing script.
- **MCP server**: Claude needs to reach an external system.
- **Monitor**: stream a background command's output to Claude.
- **Mod**: the work needs a pane or a band, a `/command` that runs code with no Claude turn, to rewrite an
  event or Claude Code's own drawing, or state shared between hooks. One plugin can ship all of
  these together.
