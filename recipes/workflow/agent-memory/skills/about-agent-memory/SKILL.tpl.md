---
name: about-agent-memory
description: YOU MUST load this skill when working with agent memory files (adding, editing, reorganizing or compressing memory content), when asked to "remember" something, or when updating the agent's standing instructions.
user-invocable: false
---

# Agent Memory

## Overview

A memory is a fragment of Markdown that the agent loads at the start of every session. In this
project memories are tracked source files under `{{ memoryRoot }}/`. `sous build` composes them,
through `@`-includes, into the compiled instruction files (such as `CLAUDE.md` and `AGENTS.md`),
which are build output: never edit a compiled copy. `sous config show` lists the compilation targets,
including the entry file each instruction file is compiled from.

This is the only memory system for this project. Never write durable facts to a machine-local memory
store: they do not travel with the project and silently fork agent behavior between machines.

Memories that arrive from a subscribed recipe are compiled into the directory the project names under
`recipeOutputs.memories`. Those are output too; the source lives in the recipe's repository, and the
`about-sous` skill explains how to edit it.

**Core principle:** every line is loaded into every session. Balance density with clarity.

## One source of truth

Every recurring topic has exactly one authoritative memory file. Duplicated guidance bloats context
and guarantees contradictions.

- Update the existing file for a topic; search the memory files before creating one.
- Remove conflicting or redundant instructions elsewhere in the same change.
- Treat competing or stale instructions as bugs, and fix them before proceeding.

Improving these instructions is part of every task; the always-loaded "Improving the Instructions"
memory of this recipe says what to watch for and what to do.

## Conventions

A coding convention, style or preference the user asks for is recorded as a memory fragment under
`{{ conventionsSourceDir }}/`, before the work continues. The "Structure" rules below apply there
too: one topic per file, listed in that directory's `README.md`.

## Structure

- One topic per file, named in `lower-kebab-case.md`.
- Group files in category subdirectories under `{{ memoryRoot }}/`. Each directory has a `README.md`
  that `@`-includes every fragment in it, one per line, and nothing else. Adding or removing a file
  means updating that `README.md` in the same change.
- A new category is wired into the entry file (a line holding `@<category>/README.md`), or its content
  never reaches the compiled output. Add a category only when the content fits no existing one.
- An `@path` line is resolved relative to the file that contains it; every other line passes through
  as written.

## File format

- Plain Markdown with no YAML frontmatter; frontmatter would render literally into the compiled
  output. Frontmatter belongs only in skill files.
- No index file: the category `README.md` files are the index. Never keep a separate `MEMORY.md`
  listing.
- Each fragment owns its content under its own heading.
- Whether a file takes the `.tpl.` infix (`name.tpl.md`), which renders it with LiquidJS, is
  settled by `about-liquid-templates`; load it before naming or writing one.

## Memory or skill?

A memory holds what is needed across many tasks. Move content into a skill when it is needed only
for specific tasks, is a step-by-step procedure, or would bloat every session if always loaded.
Skills load on demand; `about-agent-skills` covers how to write one. Neither memories nor skills name
specific tickets or one-off objectives.

## Writing guidelines

- Do: use bullets, combine related concepts, use precise words, point at code or another memory file
  instead of repeating it.
- Do not: add redundant examples, explain basic concepts, write preamble or transitions, document
  nice-to-haves, state the obvious, or list every file, class or component.

Compression example:

```text
Before: When the agent creates a new aggregate, it should first check if a similar aggregate
already exists in the codebase. If it does, it should follow the same patterns.

After: New aggregates: check existing ones first and follow their patterns.
```

## Common tasks

If `sous build --watch` is already running, it rebuilds on every change and the agent need not
run `sous build` itself.

### Add or update a memory

1. Find the file for the topic, or choose the category directory for a new one.
2. Edit it under the guidelines above; for a new file, add it to the category `README.md`.
3. Check the other memory files for conflicts and resolve them; newer guidance supersedes older.
4. Run `sous build`, then confirm the compiled instruction file carries the change.

### Add a category

1. Create the directory under `{{ memoryRoot }}/` and its topic files.
2. Add a `README.md` that `@`-includes each topic file.
3. Add `@<category>/README.md` to the entry file.
4. Run `sous build` and check the output.

### Reduce the token cost

1. Find verbose sections in the compiled output.
2. Compress them with the guidelines above, or move a procedure into a skill.
3. Run `sous build` and check the output.

## Source for this Skill

This skill comes from the `workflow/agent-memory` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file.

- Source Path: {{ sousTemplatePath }}
