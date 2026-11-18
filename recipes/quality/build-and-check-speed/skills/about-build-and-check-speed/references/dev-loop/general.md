# The Local Dev Loop: Any Stack

The dev loop is what a developer waits on while working locally: starting the dev server, the rebuild after a save,
installing dependencies, code generation and local migrations. Tool files: [nestjs.md](nestjs.md),
[prisma.md](prisma.md), [opentelemetry.md](opentelemetry.md), [docker-compose.md](docker-compose.md).

## What to Measure

| Item | Split it into |
| --- | --- |
| Dev server, launch to serving | Hooks, migrations, compile, module loading, application wiring |
| Rebuild after a one-line edit, save to serving | File detection, compile, process restart, application wiring |
| Local services (containers), cold and already running | Image pull, start, ready |

Before starting anything, check whether a dev server is already running. NEVER start a second one, and NEVER stop or
restart one that is running; measure from its log, or from a build dry run, and say so.

## Common Slow Spots

- **The restart, not the compile.** One watch rebuild spent 0.3 s detecting, 0.9 s compiling, 4.7 s restarting the
  process and 1.1 s wiring the application. Cutting the compile further did little; what loads during the restart
  mattered.
- **Instrumentation loaded in development.** Tracing that patches every module load made every boot and every rebuild
  about 3 s slower on one service. Gate it off in development and in tests.
- **Steps that run on every boot and almost never find work.** Migrations that find nothing pending, code generation
  whose input did not change. Keep them cheap (a hash check) or move them out of the boot.
- **A boot that races its services.** A dev boot that needs the database before it starts compiling waits on the
  slowest container. Compile first, then wait briefly for the services, then migrate and start.
- **A cleaned output directory on every boot.** A full compile each time; see [nestjs.md](nestjs.md).

## Answer "Will Developers Have to Remember This?" With a Script

A speed-up that depends on developers running an extra step will be skipped. The same command that ran before should do
the new thing (build first, check staleness, then run), so nothing new has to be remembered.

## Record What Could Not Be Verified

A change to the dev boot often cannot be verified live, because a dev server owns the port and stopping it is not
allowed. Say so in the report; a landed change is not a verified one.
