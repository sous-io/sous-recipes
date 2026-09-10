# Installation

## Runtime & platform

- Node.js ≥ 22.
- Linux with a GNOME-keyring-compatible Secret Service (the user's Chrome must
  have stored its Safe Storage key there — true after Chrome has run once on a
  desktop session with an unlocked keyring).
- Google Chrome installed with at least one profile the user has logged into.

macOS (Keychain) and Windows (DPAPI) are not yet supported by `keyring.mjs`.

## Dependencies

The runner and harness import these at runtime; the framework does not bundle
them. Install them **at the consuming project's root** — NOT globally.

Why not global: the scripts use ESM `import 'playwright'`. ESM resolves bare
imports by walking *up* the directory tree from the importing file looking for a
`node_modules`. The compiled runner lives at
`<projectRoot>/.claude/skills/about-automated-browser-tasks/scripts/run.mjs`, so a
`node_modules` at `<projectRoot>` is found by walking up; a global npm install is
never on that resolution path.

```bash
cd <projectRoot>        # the repo root that contains .claude/skills/
npm install playwright better-sqlite3 dbus-next
npx playwright install chromium
```

Add a `package.json` at `<projectRoot>` if none exists (`{"type":"module","private":true}`)
and gitignore `node_modules/`.

- `playwright` — headless browser automation.
- `better-sqlite3` — reads Chrome's `Cookies` SQLite DB.
- `dbus-next` — pure-JS D-Bus client for the keyring (no Python, no native build).

Tested with: Playwright 1.61, better-sqlite3 12.x, Node 22, Chrome cookie format
v11, Ubuntu 22.04.

## Project wiring (via sous)

Subscribe the project to this recipe:

```bash
sous repo add https://github.com/sous-io/sous-recipes
sous subscribe tool-usage/automated-browser-tasks
sous build
```

The subscription delivers the skills (`SKILL.tpl.md`, the references, the examples
and the scripts) into the project's skills directory, and the task manifest memory
into its memories directory. `settings.tpl.mjs` is compiled to `settings.mjs`
beside `run.mjs` in the same pass, so scripts get `ctx.settings`.

Subscribing asks the two questions this recipe declares:
`browserAutomationScriptsDir` (the absolute path to the project's task scripts,
which both the runtime and the task manifest read) and `chromeProfile`. Both
answers are written to the gitignored `.sous/.env.local`, because both are specific
to one machine.

Any other project values the scripts need (base URLs, resource identifiers and so
on) go in the project's own `_vars`. The `{% exportScalarVarsJs %}` tag in
`settings.tpl.mjs` emits every in-scope scalar as the runtime settings module, so
there is no per-key wiring to do.

## Task manifest in core memory

So the agent always knows which browser tasks exist, without relying on a skill
trigger firing, the recipe ships a memory file that renders a live list of every
task script with `{% getFiles ... import="meta" %}`, reading each script's `meta`
export.

The subscription places it in the project's memories directory as
`automated-browser-tasks.md`, and sous rebuilds it on every `sous build`, so a
newly created task appears on its own. It needs `browserAutomationScriptsDir` to be
in scope; that is the same answer the subscription already collected.

## Verifying

Run any example script by absolute path:

```bash
node <scriptsDir>/run.mjs <scriptsDir>/../examples/simple-fetch.mjs --url=https://example.com
```

A clean run prints extracted cookie counts, a browser-ready line, and the result.
