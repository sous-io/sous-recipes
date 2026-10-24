# sous-recipes

This is `sous-io/sous-recipes`, the official sous recipe repository. It publishes recipes: versioned
bundles of agent skills, memories and partials that sous installs into the projects that subscribe
to them.

## Recipe Repositories Are Part of Sous

Writing a recipe, raising its version, checking a change, proposing it and releasing it all work
here exactly as they do in any other sous recipe repository. How a recipe repository works is part
of sous itself, so the sous core skills teach it, and they are the official source of truth for it.
This file does not repeat them. The agent MUST read these before changing anything here:

- `about-sous-repos`: a recipe repository as a whole; the repo manifest, namespaces, the index,
  release tags, what happens to a pull request and a merge, and proposing a change.
- `about-sous-recipes`: one recipe; its manifest, how its version is raised, its variables, its
  contents, its dependencies and its partials.
- `about-agent-skills`: how a skill is written, including the rules every new skill follows.

An agent in a project that uses sous already has these skills. An agent that cannot install sous or
use it reads them directly, as plain markdown files. They are in this checkout:

- `recipes/core/sous-skills/skills/`

and online, at their latest published version:

- https://github.com/sous-io/sous-recipes/tree/main/recipes/core/sous-skills/skills

Never write `$` followed by a digit in a skill or anything a skill includes: Claude Code replaces
`$0`, `$1` and so on with the command's arguments.

## The Core Recipe Here Is a Copy

`recipes/core/sous-skills/` is written by the sous release pipeline, from its source in the
`sous-io/sous` repository. NEVER edit it here: every sous release overwrites it, and its manifest
refuses proposals. A change to the core skills is proposed to `sous-io/sous`, under
`recipes/core/sous-skills/`.

## Working in This Repository

These points come from building recipes here. They are not in the core skills yet; the ones about
sous in general SHOULD be proposed to `sous-io/sous` for its core skills, and removed from here once
they land.

- **This repository is public.** Every recipe, commit and pull request here is public, so examples
  use fictional people, projects and paths (such as `/home/ada`), and a ruling quoted from a
  session is attributed to "the user, in an agent session (date)".
- **A new recipe is listed twice:** under `recipes` in `sous.repo.yaml`, which publishes it, and in
  the recipe table in `README.md`, which tells people it exists.
- **Check before pushing.** `sous repo release --check` validates every manifest and names the
  versions that will publish. A push to `main` runs the release workflow, which cuts the tags and
  commits the regenerated index; a version is published once its workflow run has succeeded and its
  tag exists on the remote.
- **An unreleased recipe cannot be subscribed to,** even from a project that links this checkout,
  because `sous subscription add` looks recipes up in the published index. To check that its
  templates render before the release, render them with the Liquid engine from the sous package
  (`createLiquidEngine` in `dist/templating/init-liquid-engine.js`), passing the variables they use.
- **Templates:** `sousHome` (the user-level sous folder) is in scope in every template, and
  `getFiles` on a folder that does not exist yields an empty list, so a memory can count files
  that may not exist yet. No variable names a skill's compiled output folder, so a skill locates
  the scripts it ships relative to its own folder at run time.
- **A recipe that ships code** keeps it dependency-free where it can, as ES modules beside a
  `package.json` holding `"type": "module"`, and states its runtime in an `x-requires-node` key.
  Nothing exports a recipe's secret variable into the agent's environment, so a script that needs
  one reads its environment variable first and then the project's `.sous/.env.local`.
- **Rehearse before writing.** A recipe that drives an interactive workflow is best run through
  with the user several times in a scratch folder outside this repository, recording each ruling as
  it is made, and written up only once the flow has settled.

## This Repository Is the Model for Every Recipe Repository

`sous repo init` creates a new recipe repository, and this repository is the model it follows: a new
repository should be as complete as this one, minus the recipes. An improvement to a root-level file
here SHOULD also reach `sous repo init` in `sous-io/sous`, and an improvement to what `sous repo init`
writes SHOULD come back here.
