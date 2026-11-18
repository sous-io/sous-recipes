# Prisma

Load when `prisma/schema.prisma` exists or `@prisma/client` is in the dependencies. Covers client generation,
migrations on the dev boot, the migrate script's environment, and test databases.

## What to Measure

| Command                                                    | Note                                  |
| ---------------------------------------------------------- | ------------------------------------- |
| `prisma generate`                                          | Does anything skip it when unchanged? |
| `prisma migrate deploy` with nothing pending               | Standalone and inside the boot        |
| `prisma migrate deploy` on an empty database, full history |                                       |
| Which scripts and hooks trigger generate and migrate       | Read `pre*` hooks                     |

## Known Slow Spots

**Generate on every build, never on a fresh clone.** On one service the pre-build hook ran generate every time,
5.6 s, whether or not the schema changed. Meanwhile the package manager's default deny on install scripts blocked
Prisma's own post-install, so a fresh clone had no client and the first start failed until someone happened to run
a build. Skipping generate when a stored hash of the schema is unchanged (not a timestamp comparison; see the
lessons) and allowing the Prisma packages' install scripts explicitly addresses both.

**Migrate on every dev boot, always finding nothing.** 1.6 s, and it forced the database to be reachable before the
compile even started, so a cold compose boot raced the app. One arrangement keeps migrate on boot but reorders it:
build first (incremental, no database needed), then a short wait for the database, then migrate, then start. The
total time is the same and the race is gone. See [docker-compose.md](docker-compose.md) and
[nestjs.md](nestjs.md) for why watch mode needs the boot split into steps.

**The migrate script wraps the development env loader.** On one service the `migrate` script wrapped
`prisma migrate deploy` in `dotenv -c development`, and the production pre-start called the same script. It worked
only because the runtime image copied no env files. Splitting it gives a plain `prisma migrate deploy` that reads
the process environment, and a `migrate:local` script that keeps the loader for dev boots.

**Test env shares the dev database.** The test env file and the dev env file pointed at the same database, so the
end-to-end suite wrote into the developer's data and then failed on rows they had changed; the suite could not
finish locally at all. A separate database for the test env, with the compose cache password, avoids it. CI's cache
service then needs the same password or an override.

**One database per test worker.** An end-to-end suite limited to one worker, because every worker would share one
database, can use per-worker databases instead. A global setup (Jest `globalSetup`) creates them from a migrated
template with `CREATE DATABASE ... TEMPLATE <name>`. A template copy on an empty schema is well under a second, so
twelve cost less than the 2.4 s that one full `migrate deploy` costs. The worker id goes into the database name (or
schema) in the test setup file, and environment variables set in `globalSetup` reach the workers. The CI Postgres
user was a superuser, so the same setup worked there; `CREATE DATABASE` needs the privilege to create databases.
See [jest.md](../tests/jest.md) for worker counts.

**Migrate timing was never the problem.** 1.4 s for 15 migrations in production; 2.4 s for the full history on an
empty database. Measuring first showed that no change was needed there.

**Multiple engines shipped for musl.** `binaryTargets` carried a musl engine so the client worked on an Alpine
runtime. Once the runtime moves to a glibc base (see [docker.md](../builds/docker.md)) the extra target can go, and
the dependency tree shrinks.

## Lessons From Implementation

1. The staleness check has to hash the schema, not compare timestamps. Once the package manager is allowed to run
   Prisma's post-install script, that script generates a stub client in any context that has no schema file, such
   as a container stage that copies only the manifest and lockfile. A timestamp comparison then reads the stub as
   fresh and skips the real generation. A hash of the schema stored beside the client is right in every context.
   Generate took 0.04 s when the hash matched.
2. The container half of the same problem: the schema has to be copied into the dependency stage that runs the
   generation.
3. Per-worker databases held at four workers. Querying `pg_stat_database` showed that each worker used its own
   database and that the developer's database was never touched. The end-to-end suite then took 16 s.
4. The consolidated image on the glibc slim base ran all 70 migrations with the Debian OpenSSL engine, which is the
   evidence that the musl engine target can be dropped.
5. After a rebase that adds models, running generate comes before the checks. The client on disk is still the
   pre-rebase one and every typecheck and test reads it, so the failures point at the new code rather than at the
   stale client.
6. A spec that finds a migration by grepping the migration text for a name can match a comment in a newer migration
   and assert against the wrong file. Matching the statement instead of the name avoids it.
