# Jest

Load when the repository has a jest config file or `jest` in its dependencies.
This file covers the transformer, coverage, workers, and the slow-spec patterns, including what a spec's import
graph pulls in.

## What to Measure

| Command                                                        | Note                                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| The unit suite, cold and warm                                  | Cold means an empty transform cache; CI is always cold                 |
| The unit suite with the CI environment (coverage on)           |                                                                        |
| Per-file times, sorted                                         | `--json --outputFile`; report the ten slowest and their test-only time |
| The end-to-end suite, cold and warm, on a fresh database       |                                                                        |
| The suites again with `isolatedModules: true` and nothing else | The one experiment worth running before reporting                      |

Inventory: transformer and its settings, `maxWorkers`, timeouts, `bail`, setup files, global setup and teardown,
coverage, reporters, the cache directory, and whether the test env file shares a database with the dev env file.

## Known Slow Spots

**ts-jest type-checks every import graph on every run.** On one 168-suite TypeScript service this was 88 percent
of the unit suite's cold time. `isolatedModules: true` in the transform took the unit suite from 190 s to 26 s
cold and from 61 s to 22 s warm, and the end-to-end suite from 112 s to 35 s cold. Every suite stayed green.
`diagnostics: false` saved nothing, because the cost is building the program, not reporting errors. The type
errors are still caught by the typecheck script (see [../typecheck/typescript.md](../typecheck/typescript.md)).
On that service this one line made sharding, a bigger runner and swc-for-jest unnecessary, so it is the change
to measure before any of those.

**Coverage that nothing reads.** On the same service coverage cost 15 s per CI run, plus two reporters whose
output no step consumed. That project removed coverage and the extra reporters everywhere, locally and in CI, since
nothing read the output.

**One worker for end-to-end.** With `maxWorkers: 1`, twelve suites each booted the application in series: 5 s of
tests and 35 s of boot. At four workers the run went from 28 s to 13 s, but two suites collided on shared rows.
A database per worker, created in a global setup, fixes that; see [../dev-loop/prisma.md](../dev-loop/prisma.md)
for the template-database approach. Scoping the two suites' fixtures instead is cheaper, and regresses the next
time someone adds a suite.

**The default worker count on a small runner.** Jest uses the core count minus one. On a two-core CI runner that
is one worker, strictly serial. On that service the transformer fix mattered more than the worker count.

**Specs that boot the whole application.** Two specs took 69 s for 32 mocked tests. See
[../dev-loop/nestjs.md](../dev-loop/nestjs.md).

**A spec that requires build output.** One spec required a file from `dist`, and that was the only reason the CI
unit job waited on the build job. Moving the spec, or making it build what it needs, removes the dependency.

**One test builds twenty thousand rows.** A ceiling test fabricated the full row limit: 7.4 s alone, 20 s under
load, the most expensive test in the repository. Making the ceiling injectable and asserting at fifty rows took
it from 11.5 s to 33 ms.

**No changed-specs script.** `--changedSince=<default branch>` runs only the specs a branch touched. See
[../scripts-and-installs/node.md](../scripts-and-installs/node.md) for where such a script fits.

**The cache directory unset in CI.** The transform cache lived in a shared temp directory locally and nowhere in
CI. After the transformer fix it stopped mattering on that service; measuring comes before adding one.

## The Test Graph: What a Spec Imports

A spec that imports a root module pulls in everything that module registers. On one service, registering a queue
module (BullMQ) builds a real `Worker`, and the worker dials the cache server at boot.
- Nine unit specs looked like they pulled a queue module into their graph. Locally, with a password on the
  compose cache and none in the test env, this produced about 1,700 authentication-error lines per run. The tests
  still passed, because nothing awaited the connection.
- In CI the workers connected for real, so the unit job silently depended on the cache service container.
- Replacing the root-module import with explicit providers in the two specs that had one removed the queue
  modules along with everything else. No queue mocking was needed; all 1,708 error lines came from those two
  specs, and the unit suite stayed green even with a wrong cache password.
- Fixing the test env password makes the local noise disappear but does not remove the dependency; the workers
  then connect successfully instead. Only a smaller graph (or mocking) removes it.

Counting the causes before counting the symptom sites matters here: nine specs looked affected, and one fix
covered them. The cost was mostly noise plus a hidden dependency on a service.

## Traps

**`bail: true`.** It hides every failure after the first, so a suite with three problems looks like it has one.
`--bail=0` shows all of them while fixing.

**`@jest/types` under a strict package layout.** It is not resolvable there. Typing the `globalSetup` argument
locally avoids importing the framework's config type.

**Environment variables set in `globalSetup`.** They do reach the workers, which is how each worker can get its
own database name.

**A spec that fails for no reason.** On one occasion another agent ran an install mid-suite and moved the store
paths under the running tests. See [../machine-load.md](../machine-load.md).

## Fixes That Turned Out Unnecessary

Both were planned and set aside after re-measuring, which is the lesson:
- **Sharding the unit job.** It would have taken CI from 16 minutes to 6 before the transformer fix. After the
  fix the job was 26 s.
- **swc for the transform.** Two investigators disagreed about its value. After the transformer fix the transform
  was no longer the cost.

## Expected Effect, First Pass

On the service above, estimated step by step:

| Step                                    | CI unit job | CI end-to-end job | Local warm unit |
| --------------------------------------- | ----------- | ----------------- | --------------- |
| Before                                  | 205 s       | 112 s             | 61 s            |
| Transformer fix                         | 41 s        | 35 s              | 22 s            |
| Plus coverage off                       | 26 s        | 35 s              | 22 s            |
| Plus workers                            | 26 s        | 13 s              | 22 s            |
| Plus spec cleanups and the ceiling test | about 14 s  | about 13 s        | 18 s measured   |
| Measured in CI after the whole set      | 114 s       | 103 s             | 18 s            |

## Lessons From Implementation

Measured after, locally, with other work on the machine:

| Suite      | Before, warm | After, warm | After, cold |
| ---------- | ------------ | ----------- | ----------- |
| Unit       | 61 s         | 18 s        | 45 s        |
| End to end | 40 s         | 16 s        | 24 s        |

1. The warm unit estimate of about 8 s was optimistic; 18 s over 168 suites is where it landed. In CI, on a cold
   cache and a two-core runner, the same suite took 114 s and the end-to-end job 103 s, and the two ran in
   parallel. A local warm number is not a CI number.
1. End-to-end took 16 s at four workers. The two specs that booted the application went from 12.4 s and 7.9 s to
   2.7 s and 2.3 s.
