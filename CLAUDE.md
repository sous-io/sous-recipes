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

## The Core Recipe Here Is a Copy

`recipes/core/sous-skills/` is written by the sous release pipeline, from its source in the
`sous-io/sous` repository. NEVER edit it here: every sous release overwrites it, and its manifest
refuses proposals. A change to the core skills is proposed to `sous-io/sous`, under
`recipes/core/sous-skills/`.

## This Repository Is the Model for Every Recipe Repository

`sous repo init` creates a new recipe repository, and this repository is the model it follows: a new
repository should be as complete as this one, minus the recipes. An improvement to a root-level file
here SHOULD also reach `sous repo init` in `sous-io/sous`, and an improvement to what `sous repo init`
writes SHOULD come back here.
