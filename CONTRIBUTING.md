# Contributing to sous-recipes

Thank you for wanting to improve these recipes. Everything here is read by
somebody's coding agent, so the bar is clarity: a recipe should read well to a
person and be unambiguous to a model.

## Before you start

Read `sous.repo.yaml` to see which namespaces exist and which recipe folders the
repository publishes. Read the recipe you intend to change, including its
`sous.recipe.yaml`, which declares its version, its dependencies, the files a
subscriber receives, and the questions a subscriber is asked.

The file formats are documented in full at
https://sous-io.github.io/sous/markdown/#/repositories-file-formats.

## Making a change

1. Fork the repository and make your change inside one recipe folder.
2. Raise that recipe's `version` in its `sous.recipe.yaml`. Versions are
   semantic: a patch for wording and fixes, a minor for new files or a new
   optional variable, a major for anything that breaks an existing subscriber,
   which includes removing a file, renaming a variable, or tightening a
   variable's validation. `sous repo release --bump patch --recipe <ref>` does
   the edit for you.
3. If you added a recipe folder, add its path to the `recipes` list in
   `sous.repo.yaml` too.
4. Validate, from a checkout of your fork:

   ```bash
   sous repo release --check
   ```

   That checks every manifest, confirms each recipe folder matches what the
   repository manifest lists, and confirms the committed index and the git tags
   agree with the versions in the recipe manifests. It only reads.

5. Open a pull request. `sous repo submit` will validate and then open one
   through the GitHub command line tool, or you can open it by hand.

Do not edit `sous.index.json`. It is written by `sous repo release` and committed
by the release workflow.

## House style

These rules apply to every word in this repository, including code comments and
example output.

- No em-dashes. Use semicolons to join clauses, and commas or parentheses for
  asides. Hyphens in compound words and ranges are fine.
- No emojis.
- Plain, complete sentences. No abbreviated lingo, and no compressed notation
  that assumes the reader can decode it.
- Do not enumerate things a file already states. Point at the file instead;
  hand-maintained lists rot.

## Writing a skill

A skill is a folder holding `SKILL.md` or `SKILL.tpl.md`, plus optional
`references/`, `examples/` and `scripts/` directories. The `core/sous-skills`
recipe publishes `about-agent-skills`, which is the authoritative reference for
frontmatter, naming and the topic-versus-action distinction. Read it before
adding a skill.

A file whose name contains `.tpl.` is rendered through LiquidJS and loses the
`.tpl.` in its output name; every other file is copied verbatim. Only use `.tpl.`
when the file actually substitutes something.

## Variables

A recipe declares the questions it needs answered under `variables`. Two rules
matter more than the rest:

- Mark an answer `scope: local` when it belongs to one person or one machine, so
  it lands in the gitignored `.sous/.env.local` rather than the committed
  `.sous/.env`.
- A schema may only loosen within a major version. Tightening a `validate`
  constraint is a major bump, because an upgrade re-validates stored answers.

## Referring to another recipe

Write `@~<namespace>/<recipe>/<path>` to include a file another recipe publishes,
and declare that recipe under `depends` (addressable, but its files stay out of
your subscriber's output) or `subscribes` (its files and its questions come along
with yours). A recipe may always address itself.

## What happens on merge

The workflow in `.github/workflows/sous-release.yml` runs
`sous repo release --check` on every pull request. On a merge to `main` it runs
`sous repo release --tag --push`, which cuts a git tag shaped
`namespace/recipe@version` for every version that does not have one, pushes the
tags, and commits the regenerated index. A version is published when its tag
exists.
