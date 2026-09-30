# sous-recipes

The official [sous](https://github.com/sous-io/sous) recipe repository.

A **recipe** is a versioned bundle of agent configuration: skills, memories,
prompts and config layers, together with the questions a project has to answer
before those files make sense. Recipes are grouped into **namespaces**, and a
project subscribes to the ones it wants. Everything here is plain markdown, YAML
and, in one recipe, JavaScript you can read before you run it.

## What is published here

| Recipe | What it gives an agent |
|--------|------------------------|
| `omakase/house` | The standard set, chosen for you: subscribing to it subscribes the project to every `communication` and `reasoning` recipe, and to `workflow/agent-memory`, `workflow/autonomous-work`, `workflow/sources-of-truth`, `workflow/sub-agent-delegation`, `workflow/task-files` and `engineering/design-tenets`. It has no files of its own. |
| `core/sous-skills` | What sous is, which files it owns and must never be hand-edited, how a sous config is written and debugged, the `.tpl.` template convention and LiquidJS syntax, what an agent skill is and how to create one, and how a recipe repository and a recipe work. |
| `communication/control-flow` | Generic interaction skills for steering a session: approve a plan and proceed, ask for an opinion without acting, repeat the last instruction, and run a research task across background sub-agents. |
| `communication/agent-conduct` | Always-loaded conduct rules for an agent working with a person: a question is not an instruction, solve the whole problem, quote sources, label rulings and inferences, respect the user's time, show requested drafts instead of sending them, and take outward actions only as far as the project's settings allow. |
| `communication/plain-speech` | Speaking plainly, as a memory, a topic skill and a partial, plus the `/q`, `/speak-plainly` and `/wtf` commands. |
| `reasoning/evidence-and-verification` | State assumptions and verify the ones that matter; verify before asserting, label anything unconfirmed, and look for root causes. |
| `workflow/sub-agent-delegation` | The orchestrator-and-sub-agent working pattern the other recipes cite: the main session reasons, decides and talks to you, and delegates execution to background sub-agents. |
| `workflow/task-files` | Per-branch task files: one working-notes file per git branch, with skills for starting a task, resuming one, updating it before a session ends, and carrying remaining work into a follow-up branch. |
| `workflow/autonomous-work` | Let the agent keep working while you are away: `/plan-auto`, `/afk` and `/brb`, with ways around blockers and one report on your return. |
| `workflow/sources-of-truth` | Which artifact answers which question (docs, decision records, the tracker), and the `/decide` command, which records a ruling everywhere it belongs. |
| `workflow/agent-memory` | Improving the agent's instructions as one of its primary jobs, with the `/harvest`, `/reflect` and `/mistake` commands. |
| `workflow/github-projects` | The GitHub Issues and Projects v2 workflow, with skills for creating an issue, picking one to work on, and filing tech debt. |
| `tool-usage/automated-browser-tasks` | Headless browser automation driven from your own Chrome session: the `ctx` API, the auth and cookie model, the scriptwriting conventions, and skills for writing, updating and running a browser task. Linux only, and it ships runnable code. |
| `cli/command-design` | Principles for designing command-line interfaces, with skills for creating a new command and updating an existing one. |
| `engineering/design-tenets` | Always-loaded design tenets: start from the ideal experience and compromise only at named walls, one implementation per concern, the same input means the same thing everywhere, and accept every reasonable form of an intent while storing only the canonical one. |

## Using it

In any project that has a sous config:

```bash
sous repo add https://github.com/sous-io/sous-recipes
sous subscribe workflow/task-files
sous build
```

Adding a repository is what trusts it, so read a repository before you add it.
Subscribing asks whatever questions the recipe declares and writes your answers
into the project's env files: shared answers go to `.sous/.env`, which is
committed, and machine-specific ones go to `.sous/.env.local`, which is not.

### Subscribe per recipe, not per namespace

Namespace subscriptions are a real feature, and they suit a repository whose
namespace is one coherent collection. This repository is not shaped that way:
outside `core`, a namespace here holds recipes that have little to do with each
other, so subscribing to `workflow` would hand you an issue-board workflow you may
not want alongside the task files you do.

Subscribe to the recipes you want, one at a time. The one exception is `core`,
which sous auto-subscribes in every project with opt-out-only semantics; those are
the skills that teach an agent about sous itself, so a project that uses sous
wants them.

If you would rather not choose, subscribe to `omakase/house`, the standard set.
It subscribes you to the recipes and namespaces named in its row above, and
leaves out the ones that need something most projects lack (an issue board, a
browser script directory) or suit only some projects (command-line design):

```bash
sous subscribe omakase/house
```

### Dependencies

`workflow/sub-agent-delegation` is declared as a build dependency by four of the
recipes here. That makes its text addressable from their templates, but it does
not put the memory file into your project. Subscribe to it directly if you want
your agents to follow the delegation pattern by default:

```bash
sous subscribe workflow/sub-agent-delegation
```

## Layout

```
sous.repo.yaml                 what this repository publishes
sous.index.json                the published catalog, written by sous
recipes/<namespace>/<recipe>/
  sous.recipe.yaml             one recipe: its version, contents and variables
  skills/, memories/, ...      the files that recipe contributes
```

## The three files

**`sous.repo.yaml`** declares the namespaces this repository publishes and lists
every recipe folder in it. It is hand-written, and it is the first thing sous
reads.

**`sous.recipe.yaml`** describes one recipe: which namespace it belongs to, what
version it is at, what it depends on, which of its files a subscriber receives,
and which variables it needs answered. It is hand-written too, and its `version`
field is the source of truth for versions.

**`sous.index.json`** is the catalog: every recipe, every published version, and
a content hash for each one. It is written by `sous repo release` and committed.
Do not edit it by hand.

## Adding a recipe

1. Copy an existing recipe folder to a new folder under `recipes/`.
2. Edit its `sous.recipe.yaml`: set the namespace, the name, the version and the
   contents.
3. Add the new folder's path to the `recipes` list in `sous.repo.yaml`.
4. Open a pull request. The workflow in `.github/workflows/sous-release.yml`
   checks that everything is consistent before it can be merged.

## Publishing

Every merge to `main` publishes. The workflow in
`.github/workflows/sous-release.yml` runs `sous repo release --ci --push --yes`,
which regenerates `sous.index.json`, commits it, and cuts an annotated tag for
every version that has no tag yet. `--ci` raises no versions, so a recipe whose
files changed carries its raised `version` in the pull request itself; a merge
that changed a recipe without one fails to release.

To see what a change would publish before proposing it:

```bash
sous repo release --check                       # validate, and report what a merge changes
sous repo release --dry-run                     # show the full plan and stop
sous repo release --recipe workflow/task-files  # only this recipe
```

Tags are shaped `namespace/recipe@version`, and a version is published when its
tag exists.

To propose a change, commit it and run `sous repo submit`, which validates
everything first and then opens a pull request through your provider's own
command line tool.

## Working on it

`sous repo link` points a project at a working copy of this repository instead
of at a published version, so you can edit a recipe and rebuild without
releasing anything:

```bash
sous repo link sous-recipes /path/to/this/checkout
```

Builds say loudly when a repository is linked. Run `sous repo unlink sous-recipes`
to go back to published versions.

## Contributing

Improvements are welcome, including new recipes. Contribution instructions in this repository are
written for agents: `CONTRIBUTING.md` says why, and `CLAUDE.md` is where an agent without the sous
core skills starts.

## License

Apache-2.0. See `LICENSE`.
