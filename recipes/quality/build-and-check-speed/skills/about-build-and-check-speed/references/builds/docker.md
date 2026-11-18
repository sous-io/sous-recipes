# Docker

Load when any `Dockerfile*` exists. Covers the layer cache, the build context, cache backends on ephemeral runners,
stage layout, image consolidation, the registry login, and the traps around the base image. The deployment rollout
that follows the image push is out of scope.

## What to Measure

From the build log of one release: the build context size and send time, how many steps were cached, and the
duration of each image build and push.

| Item                                      | Note                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| Build context size and send time          | The first lines of the build log                                          |
| Cached steps per build                    | A second image that should share layers with the first reports few        |
| Duration of each image build and push     | Per target, cold and warm                                                 |
| Dependency install on the runner          | Whether the workflow installs before `docker build` and then copies it in |

Inventory: every Dockerfile (read each for layering), whether a `.dockerignore` exists, whether two Dockerfiles share
a build stage, and which registry login step the workflow uses.

## Known Slow Spots

**One debug line forked the layer cache.** A `RUN ls -la` sat early in one Dockerfile and not in the other. Every
later layer differed, so the second image re-ran the install, build and generate steps from scratch; the log showed
two cached steps. Deleting the line saved 1 min 50 s per release on one service.

**No `.dockerignore`.** On one service the workflow ran the dependency install on the runner before `docker build`,
and the build context was 668 MB, sent twice at 24 s each. Worse, `COPY . .` then overwrote the dependencies the
image had installed under its own Node version with the runner's copy, installed under a different Node version. It
worked by luck. A single `.dockerignore` took the context from 668 MB to under 150 KB, saved 40 s per release and
removed the hazard. The usual exclusions are dependencies, build output, version control metadata and every env
file.

**No cache backend on ephemeral runners.** Runners start empty, so the local layer cache never carries over from
one run to the next. Buildx can push a cache to the registry between runs (`cache-from` and `cache-to` on a registry
reference). On a code-only change, what survives is the dependency install layer when the lockfile is unchanged, and
the production prune layer once it has its own stage; the compile layer always reruns. On one service this saved
about 1 to 1.5 min per release, and more on the first release after a dependency bump.

**Prune in the wrong stage.** The production-only install ran after `COPY . .`, so any source change reran it, which
cost 39 s. A stage that depends only on the manifest and lockfile keeps it cached, and the ORM client generation can
move with it:

```dockerfile
FROM node:20 AS deps
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@10 && pnpm install --frozen-lockfile

FROM deps AS prod-deps
RUN pnpm install --frozen-lockfile --ignore-scripts --production && npx prisma generate

FROM deps AS build
COPY . .
RUN pnpm build
```

**Two images that differed only in base.** The same build stage ran twice. The API ran on the musl base, and the
worker on the glibc slim base because a native module could not load on musl, which had once crash-looped the API.
The API image also carried an openssl symlink workaround and a second ORM engine to survive musl. Moving the API to
the slim base left one Dockerfile, one build and one push, with the worker pointing at the same image through a
command override. On that service the saving was 2 min 15 s per release. The risk is medium because the change
alters the API's base image: build and run the image locally first (see the lessons below for the rollback tag).

**Full cloud SDK installed to log in to a registry.** The login step installed the whole cloud SDK, 22 s per
release. The registry login action, fed the token the authentication step had already produced, took about 1 s.

## Traps

**Native modules and the base image.** A prebuilt glibc native module fails at require time on a musl base with
`ERR_DLOPEN_FAILED`, before any application code runs, so a try/catch or a flag cannot guard it. This decides
whether a build's image runs at all. The base image has to be the one the native modules were built against.

**A cold build is not the steady state.** The first release after adding a registry cache always misses, because the
cache tag does not exist yet, and it pays the cache export on top. A failed release leaves no cache tag either, so
the release that recovers from one is cold again. See the lessons below.

## Combined Estimate, First Pass

Release job only (image build, push and the steps around them). On the source project the merge-to-serving time
also included the deployment rollout, which is out of scope here and is left out of this table.

| Stage                                            | Release job |
| ------------------------------------------------ | ----------- |
| Before                                           | 8 min 30 s  |
| Delete the line, add `.dockerignore`             | 6 min       |
| Plus cache, login action, one image, prune stage | 3 min 30 s  |
| Measured, on a cold registry cache               | 4 min 34 s  |

## Lessons From Implementation

1. Measured after the first pass, on one service: the build context was 63 KB. A cold API image build in CI took
   2 min 31 s, of which 54 s was exporting the cache at `mode=max`; the worker target then took 6 s with 15 of its
   steps cached. The consolidated image on the glibc slim base ran all 70 database migrations with the Debian
   OpenSSL engine, which is what showed that the musl engine target could go.
2. The first release after adding a registry cache always misses; the cache tag does not exist yet. A failed release
   leaves no cache tag either, so the recovery release is cold again. The first build that can show the warm number
   is the one after that. A cold build should not be read as the steady state.
3. Writing the registry cache from one target only works: `cache-to` with `mode=max` on the first build, and
   `cache-from` alone on the second. Both targets share the build stage, so the second reads what the first wrote.
4. A registry cache keyed on the lockfile misses whenever the dependencies change, so the first release after a
   dependency bump rebuilds the dependency stage and hides the warm number. Only a code-only release shows it. On
   the second release with a changed lockfile, the API build took 2 min 27 s against 2 min 31 s cold, and the
   second target took 3 s.
5. A build argument the workflow passed was never declared by any `ARG` line, so the commit hash had never reached a
   build at all. Declaring it is safe; exporting it as an `ENV` is not automatically safe, because on that project
   the tracing code renamed the tracer whenever the variable was set. Declare first, read every consumer, then
   decide about exporting.
6. Setting `provenance: false` on the build-and-push action drops the default attestation manifest. On that project
   nothing in the deploy path used it.
7. A comment in one Dockerfile described copying an assets directory that does not exist in the repository. A
   comment is not evidence; check the path.
8. Moving the ORM client generation into the dependency stage needs the schema file copied into that stage. See
   [prisma.md](../dev-loop/prisma.md) for why a timestamp check misfires there.
9. The slim runtime image has no `wget` and no `curl`, so a check that has to talk HTTP from inside the container
   needs `node -e`.
10. When a release consolidates images or changes the base image, keeping the previous image tags published for that
    release leaves a rollback target. They can be dropped the release after.

Related: [general.md](general.md) for build-wide rules, [github-actions.md](../ci/github-actions.md) for the
workflow that runs these builds.
