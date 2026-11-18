# Tests: Any Runner

What makes a test suite slow, whatever the runner. Tool files: [jest.md](jest.md), [vitest.md](vitest.md).

## The First Question

**Is the runner doing work that is not testing?** On one TypeScript service, 88 percent of the unit suite's cold
time was the test transformer type-checking every import graph; one setting cut the suite from 190 s to 26 s and made
sharding, a bigger CI runner and a faster transformer all unnecessary. Look at what happens before the first test runs
(transform, setup files, global setup, application boot) before looking at the tests.

## Common Slow Spots

- **Transform cost.** Type-checking or compiling inside the test transformer, on every run, in every worker.
- **Specs that boot the whole application** to test one class with mocks. Each pays the whole dependency graph,
  including connections to real services. Narrow the spec's imports to what it asserts on; a spec that deliberately
  boots real modules belongs in the end-to-end suite.
- **Hidden dependencies on running services.** A unit spec that imports a module which dials a database, a cache or a
  queue at load time. Locally it produces noise (one suite printed 1,708 authentication errors and still passed); in CI
  it silently depends on a service container. Count the causes before counting the affected specs: on that suite, nine
  affected specs had one cause and one fix.
- **Fabricated volume.** A test that builds tens of thousands of rows to hit a ceiling. Make the ceiling injectable and
  assert at a small number (one such test went from 11.5 s to 33 ms).
- **One worker where several would do.** End-to-end suites often run serially because two suites share database rows;
  one database (or schema) per worker fixes the collision without serializing.
- **Too many workers up front.** A runner that starts one worker per CPU before any test is queued wastes memory and
  CPU on a machine where several agents run tests; start one and add more as files queue up.
- **Coverage nothing reads.** Coverage collection and extra reporters whose output no step consumes. Coverage belongs
  to the final run, if anything reads it.
- **Running the whole suite while working.** While working, run only the specs that cover the changed files (see
  [../per-file-checks/overview.md](../per-file-checks/overview.md)); a changed-specs script (Jest `--changedSince`,
  Vitest `--changed`) is a middle step for a branch's whole diff.

## Cheaper Tests Without Losing Coverage

- **Test the narrow thing.** Where a case asserts only one function's result, call that function directly instead of
  running the whole command around it.
- **Fold cases that pay for the same setup** into one case.
- **Reuse an expensive build inside a test file**, keyed by a hash of the build's inputs, with the key's inputs listed
  in a comment so a reader can see what would make the reuse wrong. One test file went from 108 s to 70 s in CI this
  way.
- **Fewer gates.** Before caching a slow check, ask whether each part of it still earns its time; removing a gate is
  the cheapest speed-up.
- **Cheap whole-tree tests can join the per-file loop.** A test that reads the source tree instead of rendering
  anything, and finishes in under a second, is worth running while working.

## Under Machine Load

When many agents load the machine, time-bound tests fail at random: with a 5-second timeout and seven agents running
(load average 21 to 27 on 10 cores), a different set of unrelated tests timed out on each run. Before judging a
timeout as a failure, rerun the file once with fewer workers and a longer timeout (for example
`--maxWorkers=1 --testTimeout=30000`). NEVER lower the process priority of a test run: test workers inherit it, and
time-bound tests then fail where a normal run passes. See [../machine-load.md](../machine-load.md).

## Before Believing a Failure

- **Concurrent agents in one checkout produce false failures.** One agent's build deletes the output directory under
  another's test run; one agent's install moves package paths under a running suite. Rerun before believing it, and
  say when the machine was loaded.
- **Run the same command on clean main first.** A local failure says nothing about a change until the same command
  has run on the main branch.
- **Do a clean install from the lockfile before calling a suite green.** A stray hoisted copy of a package once
  masked a real failure: the suite passed locally and the container did not boot on the same code.
- **Read a local number as local.** A warm local run on a fast machine is not a CI number; a cold CI run on a two-core
  runner can be several times slower.

## Browser and End-to-End Suites

They are not per-file checks: they build nothing incrementally and need a browser or a running system. They run once,
after all the work in a batch is in.
