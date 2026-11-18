# Turborepo

Load when the repository has a `turbo.json`, or `turbo` in dependencies. Covers build caching across runs, the
inputs list, and keeping the cache in CI.

## What to Measure

| Item | Note |
| --- | --- |
| The build with an empty cache and with a full one | The full-cache number is the target |
| In CI, cache hits per run | Turborepo prints "cache hit" or "cache miss" per task |
| The cache's size over time | Turborepo never deletes an entry on its own |

## Known Slow Spots

**Shared packages rebuilt in every job.** Before Turborepo, each app's CI build job in one monorepo rebuilt four
shared packages, about 25 s a job. With Turborepo and the cache kept between runs, a scheduled run restored 5 of 5
builds from the cache. That monorepo used Turborepo only in CI; local builds stayed on plain pnpm.

## The Inputs Must Be Complete

A restored build is only correct if `turbo.json` names everything the build reads. That monorepo's file opened with a
header saying exactly that ("THIS FILE MUST NAME EVERYTHING A BUILD READS, and keeping it so is a standing duty"), and
that a new build-time environment variable, or a new file outside a package that a build reads, goes into it in the
same change. Its config:

```jsonc
{
  "globalDependencies": ["tsconfig.base.json", "pnpm-workspace.yaml"],
  "envMode": "strict",
  "globalEnv": ["NODE_ENV"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "env": ["APP_DEV_BUILD", "APP_STAGE", "APP_API_URL"]
    }
  }
}
```

Listing every build-time variable is what makes the cache key correct: a changed listed variable changes the hash,
so a stale output is not restored for it. `envMode: "strict"` makes an unlisted variable undefined inside the task,
instead of silently read. The build fails visibly only if it rejects a missing value; otherwise it builds without the
variable and nothing reports it.

## Keeping the Cache in CI

On a CI cache (GitLab's, for example):

- One cache key per job, prefixed with the job name and keyed on the lockfile. One shared key keeps only the last
  job's archive.
- Saved on success only.
- Pruned by a script after each build (entries unused for 7 days), because Turborepo never deletes an entry.
- Caches of protected branches and of merge requests kept separate, so a merge request cannot hand the default branch
  a poisoned build output.

## Traps

**The clean build has to be proven somewhere.** One job builds with plain `pnpm run build` and no Turborepo cache, so
the packages' suites there always run against a build of the source in front of them. Giving that job the cache too
removes the only proof.
