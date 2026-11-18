# GitHub Actions

Load when `.github/workflows/` exists. Covers measuring from the API, the job graph, concurrency, job dependencies,
service containers, caches, the release job, and the fixes that turned out unnecessary. The deployment step itself
is out of scope; the jobs leading up to it are in scope.

## What to Measure

The provider's API gives better numbers than the workflow files do. The last 30 completed runs per workflow give a
median and a p90 wall time; per-job and per-step durations for about eight representative runs each show where the
time goes. Runs that ended in seconds with no steps are billing or runner failures and are excluded. The step logs
show the cache hit and miss lines. Then the job graph for each trigger (pull request, push to the default branch,
tag) with the critical path marked.

| Item                                    | Note                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------- |
| Median and p90 wall time per workflow   | Last 30 completed runs, billing-blocked runs excluded                   |
| Per-job and per-step durations          | About eight representative runs per workflow                            |
| Cache hit and miss lines                | From the step logs                                                      |
| Longest job over many weeks             | A trend shows growth that a single run hides                            |
| What the workflows actually call        | Shared workflows or actions versus inline commands                      |

Plotting the longest job over ten weeks on one service showed it had grown from 5.7 to 21.6 minutes, about ten
seconds per calendar day, and would have passed 30 minutes six weeks later.

Checking what the workflows actually call matters too: on one repository a shared build workflow maintained by the
organisation was assumed to cover it, but the repository used two small shared actions and ran its own
`docker build` inline.

## Known Slow Spots

**One job was the whole critical path.** On one service lint took 59 s, build 61 s, end-to-end 246 s and unit tests
1194 s (median). The fix was in the test transformer, not in CI; see [jest.md](../tests/jest.md).

**No concurrency group.** Pushing a second commit left the first commit's run going to the end. In 100 runs, eight
pairs were superseded, about 61 runner minutes. A concurrency group keyed on the branch, with in-progress runs
cancelled, is three lines per workflow. It saves runner minutes and queue time, not the wait for the newest run.

**Unjustified job dependencies.** Both test jobs declared `needs: build`. The end-to-end job read nothing from the
build, and the unit job read it through one spec. Dropping the dependency and relocating that spec started both jobs
61 s earlier.

**Service container health intervals.** Postgres and the cache were ready in seconds but polled every 10 s, so each
container lost most of an interval: about 27 s per job. An interval of 2 s brought it to about 8 s.

**Full dependency install before the release tool.** The release job installed the whole tree, then two more
plugins, then ran semantic-release, which needs none of the repository's dependencies. Installing the tool into a
temporary directory saved 35 s per release.

**Two-core runners give Jest one worker.** Jest's default is the core count minus one. Fixing the transformer
(see [jest.md](../tests/jest.md)) came before paying for a bigger runner.

**Lint cache in CI.** See [eslint.md](../lint/eslint.md). The cache action with the content strategy, keyed on the
lockfile and the config, restores it.

**The dependency store cache was fine.** The logs confirmed a hit. A cache the logs show hitting needs no change.

## Fixes That Turned Out Unnecessary

- **Sharding the unit job.** Deferred until it was still needed after the transformer fix. It was not needed.
- **A 4-core runner.** It would have tripled the workers, and it was moot for the same reason. Sharding and
  upsizing together over-subscribe the runner unless the timing is re-measured between the two.

## Traps

**Path filters for docs-only changes.** A plain `paths-ignore` on a workflow whose job is a required status check
makes the check never report, which blocks the pull request forever instead of passing it. A small "changes" job
that gates the heavy jobs keeps the check reporting. Worth the effort only where docs-only pull requests are common.

**Billing-blocked runs look like failures.** They end in about two seconds with zero steps. They do not belong in
timing statistics and are not code bugs.

## Measured End State, First Pass

On one service, after the first pass:

| Wait                    | Before             | After                                   |
| ----------------------- | ------------------ | --------------------------------------- |
| A pull request run      | 21 to 22 min       | 1 min 59 s, on two runs                 |
| Unit test job           | 1194 s             | 114 s                                   |
| End-to-end job          | 246 s, after build | 103 s, in parallel with the unit job    |
| Build job               | 61 s               | 62 to 88 s                              |
| Lint job                | 57 s               | 82 s on its first run, with cold caches |

## Lessons From Implementation

1. Service containers cannot set a container command. A cache server that needs its password on the command line
   cannot be a service container at all; it runs as a plain `docker run` step followed by a short readiness loop.
   The health-interval fix still applies to the containers that stay service containers.
2. Moving the cloud authentication action from v1 to v2 came with removing the SDK setup step. Requesting an access
   token (`token_format: access_token`) as the replacement turns "use the key" into "mint a short-lived token with
   the key" through the credentials API, which needs a token-creator role on the service account that a deploy
   account usually lacks. Logging the registry in as `_json_key` with the key secret the repository already holds
   needs no role, no new secret and no permission change.
3. A failed release burns a version number. The release tool cuts the version, the tag and the release entry before
   the image steps run, so a failure after that point leaves a published release with no images and nothing written
   to the registry cache. The recovery release is cold twice over: no image layers and no cache tag. The gap in the
   version sequence is expected.
4. A check job can get slower on the run that lands the change and still be the right change. One lint job went
   from 57 s to 82 s on its first run because it now also ran the formatter and the typecheck, all with cold
   caches. A check job is judged on its second run, not on the one that populates its caches.
5. The build job no longer uploaded a build artifact on that service. The one job that consumed it ran its build
   check inside the build job instead, which is also what let both test jobs drop their dependency on it.
6. Running `actionlint` over changed workflow files before pushing takes seconds and catches mistakes that
   otherwise cost a whole run.
7. The pull request run time moves with the size of the change: 2 min 30 s on a branch that added 113 files,
   against 1 min 59 s on the first two runs. A range describes it better than a single run.

Related: [general.md](general.md) for provider-independent CI rules, [gitlab-ci.md](gitlab-ci.md) for the GitLab
equivalent, [docker.md](../builds/docker.md) for the image build inside the release job.
