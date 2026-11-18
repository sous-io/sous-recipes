# Scripts and Installs: Any Package Manager

The commands a project's developers and agents type, and the dependency installs behind them. Tool file:
[node.md](node.md).

## What to Measure

| Item | Note |
| --- | --- |
| Dependency install, cold | In a scratch directory holding a copy of the manifest and lockfile, never by deleting the real dependency directory |
| Dependency install, warm (dependencies already match) | |
| Every script a developer or agent runs, cold and warm | Read the hooks that run before and after each |
| A project CLI wrapper's own start-up | Time a command people actually run, not only `--help` |
| A fresh install in a new git worktree | Agents create worktrees often; this cost repeats |

## Common Slow Spots

- **Hidden hooks** (`pre*` and `post*` scripts) that clean, generate or migrate on every run.
- **A project CLI that compiles itself on every call**, through a TypeScript runner or similar, while a compiled
  output sits unused.
- **Nothing scoped to one file**, so agents run whole-project checks; see
  [../per-file-checks/overview.md](../per-file-checks/overview.md).
- **Install time per worktree.** Each worktree with its own package store can download hundreds of megabytes on first
  install (about 700 MB in one monorepo). A shared store with hard links removes most of it; a per-repository store is
  sometimes kept on purpose, for example after a shared one let another checkout's state leak in. Record why the store
  is where it is.

## Usually Fine

Measure, then say so in the report so nobody spends time there: a dependency install with a shared store (7.6 s cold,
3 s warm on one service) and a CI dependency cache that the logs show hitting. Do not touch a cache the logs show
hitting.

## Lessons

1. **Check the wrapper before blaming what it calls.** A half-installed dependency directory (no `.bin`) made every
   command of a project CLI fail with "not found", which looked like a problem with the service the command talks to.
   A reinstall fixed it in 2 s.
2. **A committed symlink to another machine's directory** (a dependency directory pointing into someone's home) made a
   CLI fail on every fresh clone. Fix that first, in its own commit, before measuring anything.
3. **`--help` is the worst case for a CLI's start-up**, because it loads every command. Time a real command, and
   subtract whatever it shells out to.
