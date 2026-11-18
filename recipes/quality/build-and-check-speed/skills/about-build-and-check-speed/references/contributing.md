# Improving This Skill

This skill grows from real speed-up work: every tool file holds what one project learned. When the agent learns
something here that would help any project (a slow spot not described, a number that proved wrong, a trap, a tool with
no file), it is worth sending upstream. Lessons specific to one project go into that project's own instructions
instead.

## Permission First

The skill is published in a public recipe repository, and a proposal there is visible to everyone. The agent MUST NOT
propose a change upstream on its own. It drafts the change, shows the user the full text of every added or changed
file, and proposes it only after the user approves that draft.

## Strip Everything Private

Before showing the draft, the agent removes everything that identifies the project it came from: project, company,
team and people's names; private hosts, registries, package scopes and URLs; dates of private sessions; and any
number or detail that only makes sense inside that project. A lesson is stated as what any project with the same tool
would see. Numbers stay, with their conditions, as examples of size ("on one 670-file TypeScript service, 28 s to
2 s warm").

## Where It Goes

- A slow spot, a trap or a lesson for a tool that has a file: that file.
- A tool with no file: a new file in the folder for its area (`lint/`, `typecheck/`, `tests/`, `builds/`, `ci/`,
  `dev-loop/`, `scripts-and-installs/`), plus a row in the "Which tool files to load" table in
  [method.md](method.md).
- Something true of any tool in an area: that folder's `general.md`.
- A change to the per-file check command's design: [per-file-checks/overview.md](per-file-checks/overview.md) or
  [per-file-checks/warm-server.md](per-file-checks/warm-server.md).

## The Shape of a Tool File

```markdown
# <Tool>

Load when <the signal in the repository>. <One or two sentences on what the file covers.>

## What to Measure

<A table of commands or stages to time, with notes; then what to inventory.>

## Known Slow Spots

**<Short title.>** <What happens and why. The fix. An example number with its conditions.>

## Traps

**<Title.>** <What goes wrong, and what to do instead.>

## Lessons From Implementation

1. <What was learned while implementing a fix.>
```

A section with nothing in it is left out. Text follows the repository's rules: plain sentences, "the user" and "the
agent", no em-dashes.

## How to Propose It

From the project where the lesson was learned:

1. `sous repo contribute quality/build-and-check-speed` links the recipe's repository on a new branch, so an edit
   shows in the project's next build.
2. Edit the recipe's files in that checkout, and raise `version` in its `sous.recipe.yaml`: a patch step for wording
   and fixes, a minor step for a new file.
3. `sous repo contribute quality/build-and-check-speed --finish` proposes the change and goes back to the published
   version.

The `about-sous-repos` skill describes these commands in full; the agent performing this work MUST load it first.
