# The .sous directory

This directory holds this project's sous configuration: the main `sous.config.*` file, the `conf.d/` drop-in layers, the answers files and the lockfile.

Most of it is committed to version control. Machine-specific files (the links map, the build state, the watcher's PID file and `.env.local`) are kept out by the sous-managed block in `.gitignore`.
