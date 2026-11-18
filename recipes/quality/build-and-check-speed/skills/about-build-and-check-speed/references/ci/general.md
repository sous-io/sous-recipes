# CI: Any Provider

What makes CI slow or wasteful, on pull requests and on merges, up to the job that hands off to deployment.
Provider files: [github-actions.md](github-actions.md), [gitlab-ci.md](gitlab-ci.md).

## Start With a Target

Set a target time before starting ("a full default-branch pipeline in about 500 s or less"). A target says when to
stop. One pass with that target took a default-branch pipeline from 1004 s to 399 s, total runner time from 1977 s to
1443 s, and a merge request pipeline from 438 s to 250 s.

## Measure From the Provider, Not the Files

Read timings from the provider's API: the last 30 completed runs per workflow for the median and the 90th percentile,
then per-job and per-step durations for about eight representative runs. Exclude runs that ended in seconds with no
steps; those are billing or runner failures, not code. Read step logs for cache hit and miss lines. Then draw the job
graph for each trigger (pull request, push to the default branch, tag) and mark the critical path: the chain of jobs
that decides when the pipeline finishes. Only a saving on the critical path shortens anyone's wait; a saving elsewhere
saves runner time.

Plot the longest job over the last ten weeks. A job that grows linearly passes a threshold on a predictable date: one
grew from 5.7 to 21.6 minutes in ten weeks, about ten seconds per calendar day.

Check what the pipeline actually calls. A shared organization workflow assumed to cover a repository did not; the
repository ran its own build inline.

## Common Slow Spots

- **Pipelines nobody needs.** A pipeline on every branch push, when nothing looks at the result until a pull or merge
  request is opened. Running only for pull or merge requests and for the protected branches removes them.
- **Superseded runs.** A second push leaves the first push's run going to the end. A concurrency group (cancel in
  progress, keyed on the branch) saves runner time and queue, though not the wait for the newest run.
- **Jobs waiting for things they do not read.** Stages, or `needs` declared out of habit, make a job wait for the
  whole previous stage. A job can start as soon as its real inputs exist. Before dropping a dependency, check every
  file the job reads: one unit job depended on the build only through one spec that read `dist/`.
- **Every job installing everything.** A job that installs nothing it uses can take no cache and no install step at
  all. A release tool that needs none of the repository's dependencies can be installed into a temporary directory.
- **Every job uploading the same cache.** Every job reads the dependency cache; one job writes it. Twenty jobs
  uploading twenty identical copies cost 8 to 12 s each and bought nothing.
- **Large caches uploaded when they cannot have changed.** Write such a cache only when its key's inputs changed (the
  lockfile) or on a schedule; one deploy job's cache re-uploaded the same 3,800 files in about 26 s, more than the
  download it saved.
- **Work whose inputs did not change.** Path filters skip jobs whose inputs did not change; build output handed to
  later jobs as artifacts saves rebuilding it; a deploy step can skip uploading a build whose hash matches the live one
  (and MUST upload anyway when reading the stored hash fails, never failing the deploy over the optimization).
- **Slow service-container health checks.** A database ready in seconds but polled every 10 s loses most of an interval
  per container; a 2-second interval recovered about 20 s per job in one pipeline.
- **The wrong fix for a slow test job.** Before sharding a test job or paying for a bigger runner, find out what the
  job spends its time on. One 20-minute unit job was the test transformer, and fixing it made both unnecessary. Never
  shard and upsize together without re-measuring; that over-subscribes the runner.

## Tool Caches in CI

A **tool cache** is a file or directory a check tool writes about its own last run, so the next run skips work on
unchanged inputs: ESLint's `.eslintcache`, TypeScript's `.tsbuildinfo`, Prettier's cache, Vite's and Storybook's
caches under `node_modules/.vite` or `node_modules/.cache`. Locally they survive between runs on their own. A CI job
starts from a fresh checkout, so they help only when the job restores the cache at its start and saves it at its end.

They are generally worth it where they shorten a real wait, and each one is weighed on two things:

- **How critical the project's stability is.** A stale cache can let a check pass in CI that would fail on a clean run.
  A project where that is unacceptable either skips the cache or keeps one uncached run as proof: one job that builds
  and checks with no cache, or a nightly full pipeline.
- **How the tool invalidates its cache.** Every tool differs. ESLint stores a hash of its config and version for each
  file, so a config change invalidates correctly, but a plugin upgrade with an unchanged config does not; keying the
  cache on the lockfile as well covers it. ESLint's default cache strategy uses modification times, which a fresh
  checkout resets, so CI needs `--cache-strategy content`. Each tool file says what its cache misses.

Judge a check job on its second run, not on the run that populates its caches: one lint job went from 57 s to 82 s on
the run that added its caches and new steps, and dropped after.

A tool cache is different from the **dependency cache** (the package manager's store, so installs do not download
everything) and a **build cache** (a whole task's output restored by a tool such as Turborepo, see
[../builds/turborepo.md](../builds/turborepo.md)).

## What Path Filters and Caches Cost

Path filters and caches can hide a break: a filter that misses a shared input skips a job that should have run, and a
stale cache passes a check that should fail. A scheduled pipeline that runs everything once a night checks the fast
paths against the full run daily. Path filters are a choice per repository, not a universal good: some repositories
run every job on every pipeline on purpose.

A path filter on a required status check can also block a pull request forever: the check never reports, so it never
passes. Gate the heavy jobs from a small "changes" job instead, so the required check still reports.

## What CI Does Not Check

Find out what CI does not run. In one repository CI ran the build, the tests, the typecheck and a format check, and
no linter at all, so linting the changed directories was part of the local definition of done there. Whatever CI
skips falls to the full checks run locally at the end.

## Diagnosing a Failure

Reproduce the failing step locally with the command the job runs before changing anything. Run any workflow linter
the provider has (`actionlint` for GitHub Actions) over changed workflow files before pushing; it takes seconds and
catches the mistakes that otherwise cost a whole run.

## Who Owns CI

Find out who decides CI changes in the project before changing them. In one organization CI, build, test and deploy
tooling counted as engineering work that needed no architect's review; elsewhere the answer differs.

## Reliability Fixes That Also Save Time

- Pull container images through a registry mirror or dependency proxy, to avoid anonymous pull limits.
- Raise the heap for a job that runs out of memory, instead of retrying it.
