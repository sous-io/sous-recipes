# Docker Compose

Load when `docker-compose.yml`, `docker-compose.yaml`, `compose.yml` or `compose.yaml` exists for local
development. Covers local dev services, health
checks and boot ordering.

## What to Measure

Compose up with the containers already running, and cold. Whether any service declares a health check. Whether the
application's boot depends on a service being ready before it starts compiling.

## Known Slow Spots

**No health checks, and the app needed the database first.** One compose file declared zero health checks, and the
dev boot ran migrations before compiling, so a cold `up` raced the boot. Reordering the boot so the compile runs
first (see [prisma.md](prisma.md)), adding a short wait-for-database loop before the migration, and declaring health
checks on the database and cache services removes the race.

**Containers already up: 0.8 s.** Not a target once they are running.

## Traps

**Password mismatch between compose and the test env.** The compose cache had a password and the test env file had
none, producing about 1,700 auth-error lines per unit run. See [nestjs.md](nestjs.md) for what actually caused them
and [prisma.md](prisma.md) for the separate test database.

## Lessons From Implementation

1. The health checks and the reordered boot went in but could not be verified live: a dev server already owned the
   port and the build output, and stopping it was not allowed. Recording what was not verified keeps a landed change
   from reading as a confirmed one.
