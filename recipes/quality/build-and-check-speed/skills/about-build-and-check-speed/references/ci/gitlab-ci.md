# GitLab CI

Load when the repository has a `.gitlab-ci.yml`. Covers when pipelines run, `needs`, resource groups, cache policies,
path filters and what GitLab cannot do. The numbers come from one pnpm monorepo of several front-end apps.

## What to Measure

The general method in [general.md](general.md): pipeline durations from the API (`/projects/:id/pipelines` and
`/pipelines/:id/jobs`), per-job durations, cache hit lines in job logs, and the job graph for merge request, default
branch and scheduled pipelines.

## Known Slow Spots

**A pipeline on every branch push.** Running pipelines only for merge requests and the protected branches:

```yaml
workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == "develop"
    - if: $CI_COMMIT_BRANCH == "main"
```

In a merge request pipeline, `rules:changes` compares against the target branch rather than the previous push, so
path filters also behave correctly.

**Stages making jobs wait.** `needs: []` on the build jobs and on the longest check job lets them start at once, beside
lint. As the longest job in the pipeline, the latter is the one whose start time matters most.

**One deploy lock for the whole environment.** Giving each deployed app its own `resource_group`
(`$STAGE-app-<id>`) lets unrelated apps deploy in parallel. The groups' process mode is set to `oldest_first`
through the API; it is a project setting, not a YAML keyword.

**Every job uploading the dependency cache.** Every job reads; one job writes:

```yaml
default:
  cache: &pnpm-cache
    key: { files: [pnpm-lock.yaml] }
    paths: [.pnpm-store, .pnpm-cache]
    policy: pull

detect:changes:            # the single writer
  cache:
    - <<: *pnpm-cache
      policy: pull-push
```

- `.pnpm-cache` is included because it holds pnpm's lockfile verification log, worth about ten seconds per install.
- A job's own `cache:` replaces the default, so a job with an extra cache lists the shared one again.
- A job that installs nothing takes no cache and no install step at all (`before_script: []`, `cache: {}`).

**A large cache written on every run.** One deploy job's cache (a package store plus infrastructure tool plugins)
re-uploaded the same 3,800 files in about 26 s. Its policy became a variable: `pull-push` only on the nightly
schedule or when the relevant lockfile changed, `pull` otherwise. GitLab caches only paths inside the project
directory, so the tool's home directory was moved inside it.

**Path filters.** `rules:changes` per app, kept as hand-written lists. Each list also names the shared files that
affect every app (`pnpm-workspace.yaml`, the root `package.json`, the base tsconfig, `turbo.json`); those were the
gaps found. A nightly full pipeline (426 s on its first run) checks the filters against the full run.

## Traps

**A job with `needs` no longer waits for its stage.** It starts the moment its needs finish. A deploy job that gained
`needs` could start before lint or the tests reported, so each deploy lists every gate job in its `needs`, marked
`optional: true` (a gate may be absent from a given pipeline), through one shared YAML anchor.

**A job's output cannot gate a later job's rules.** GitLab evaluates `rules` before any job runs, so a computed
"affected packages" list cannot decide which jobs exist. Path filters or a generated child pipeline are the options.

**`parallel:matrix` is one job definition**, so it also has one `rules:changes`: one app's change would rebuild all of
them. Separate jobs per app keep separate filters.

**Shared caches between protected branches and merge requests** let a merge request poison the default branch's cache.
Keep them separate.

## Ideas Set Aside

| Idea | Why it was set aside |
| --- | --- |
| A child pipeline generated from the package manager's dependency graph | The hand-kept path lists were enough |
| Custom CI images with dependencies baked in | Not recorded |
| The build cache in the clean-build job | One job must prove the uncached build |
