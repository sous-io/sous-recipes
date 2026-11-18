# Prettier

Load when the repository has a Prettier config file or `prettier` in its dependencies.
This file covers caching, running Prettier inside or outside the linter, and a one-file format command.

## What to Measure

| Command                                  | Note                          |
| ---------------------------------------- | ----------------------------- |
| `prettier --check` over the source globs |                               |
| The same with `--cache`, cold then warm  | The warm number is the target |

Inventory: whether Prettier runs as an ESLint rule, which globs the format script covers, and whether the
format check is a separate CI step.

## Known Slow Spots

**No cache.** Every file is re-read and re-formatted every run. On one TypeScript service with 642 files,
`--cache` took the check from 27 s to about 2 s warm.

**Running inside the linter.** When Prettier runs as an ESLint rule, every file is formatted, diffed and reported
through the linter's machinery, which is slower than Prettier checking the file directly. The two tools' caches
also do not know each other's inputs, so a Prettier config change does not invalidate the linter's cache.
Running Prettier as its own script and CI step, cached, and keeping only `eslint-config-prettier` so the linter
does not fight the formatting, avoids both costs. Then `prettier --check` fails CI on its own and
`prettier --write` fixes locally.

**One-file shortcut.** Once Prettier leaves the linter, a one-file lint with `--fix` no longer formats. A script
that runs `prettier --write` on one path (`format:file <path>`) restores that; on the service above it took under
a second. See [../per-file-checks/overview.md](../per-file-checks/overview.md) for the per-file check command.

**CI cache.** The same treatment as ESLint applies: restore the cache file keyed on the lockfile and the Prettier
config. See [eslint.md](eslint.md).

## Traps

**`pnpm <script> -- --flag`.** pnpm forwards the `--` literally, so Prettier reads it as a file name and fails.
Pass the flag without the separator. See [../scripts-and-installs/node.md](../scripts-and-installs/node.md).

## Lessons From Implementation

1. Measured after the first pass on the TypeScript service: the check script was 2.2 s warm.
