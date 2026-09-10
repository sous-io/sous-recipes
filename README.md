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
| `core/sous-skills` | What sous is, which files it owns and must never be hand-edited, how a sous config is written and debugged, the `.tpl.` template convention and LiquidJS syntax, what an agent skill is, and how to create one. |
| `communication/control-flow` | Generic interaction skills for steering a session: approve a plan and proceed, ask for an opinion without acting, repeat the last instruction, and run a research task across background sub-agents. |
| `workflow/sub-agent-delegation` | The orchestrator-and-sub-agent working pattern the other recipes cite: the main session reasons, decides and talks to you, and delegates execution to background sub-agents. |
| `workflow/task-files` | Per-branch task files: one working-notes file per git branch, with skills for starting a task, resuming one, updating it before a session ends, and carrying remaining work into a follow-up branch. |
| `workflow/github-projects` | The GitHub Issues and Projects v2 workflow, with skills for creating an issue, picking one to work on, and filing tech debt. |
| `tool-usage/automated-browser-tasks` | Headless browser automation driven from your own Chrome session: the `ctx` API, the auth and cookie model, the scriptwriting conventions, and skills for writing, updating and running a browser task. Linux only, and it ships runnable code. |

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

### Dependencies

`workflow/sub-agent-delegation` is declared as a build dependency by four of the
recipes here. That makes its text addressable from their templates, but it does
not put the memory file into your project. Subscribe to it directly if you want
your agents to follow the delegation pattern by default:

```bash
sous subscribe workflow/sub-agent-delegation
```

## Contributing

Improvements are welcome, including new recipes. The short version: fork the
repository, make the change in a recipe folder, raise that recipe's `version` in
its `sous.recipe.yaml`, and open a pull request. From a working copy, sous will do
the last part for you:

```bash
sous repo release --check     # validate every manifest, the index and the tags
sous repo submit              # validate, then open a pull request
```

`CONTRIBUTING.md` has the details, including how versions are numbered and what
the release workflow does on merge.

## License

Apache-2.0. See `LICENSE`.
