# Machine Load and Leaked Processes

On a machine where several agent sessions run at once, speed is as much about not starving the machine as about any
one command. A pinned CPU stops everything, the agents included. The numbers here come from one development virtual
machine with 10 virtual CPUs and about 96 GiB of memory.

## Keep Heavy Work From Pinning the Machine

- **Lower the priority of heavy background builds and confine them.** One long background run used
  `nice -n 19 taskset -c 6-9`, with test workers capped at 2: low priority, on four of the ten cores.
- **NEVER lower the priority of time-bound tests.** Test workers inherit the priority, and at `nice 19` on a busy
  machine, tests with short timeouts (Testing Library's 1-second `waitFor`, for example) fail where a normal run
  passes. Cap their workers and raise their timeouts instead.
- **Start few workers.** Test runners that start one worker per CPU up front multiply across agents. Start one and grow
  as files queue (see [tests/vitest.md](tests/vitest.md)).
- **A serial queue is load control.** A per-file check server that handles one request at a time means ten agents
  asking at once use about one core for checks, not ten.

## Timeouts Under Load Are Not Yet Failures

With the default 5-second test timeout and seven agents running (load average 21 to 27 on 10 cores), a different set
of unrelated tests timed out on each run. Rerun the file once with fewer workers and a longer timeout before judging.

## Helper Processes

- **Every long-lived helper needs an idle exit.** The per-file check server exits after 15 idle minutes. Leaked
  TypeScript language-server processes, started by an editor integration that no session used, once loaded the
  machine until they were found and the integration was removed. A helper nobody uses still costs CPU and memory.
- **Give a helper a fixed process title** (`check-file-srv`, for example) so it can be found and stopped by exact name.
  A title used with `pkill -x` or `pgrep -x` MUST be at most 15 characters, because Linux truncates a process name to
  15 characters and a longer name never matches.
- **Kill by exact name.** `pkill -f <pattern>` also matches the shell running the command when the pattern appears in
  its command line. Use `pkill -x <name>`, or a bracketed pattern (`pkill -f '[c]heck-file'`).

## Development Stacks

One development launcher that starts several apps and services:

- starts each child in its own process group and stops it as a group (SIGTERM, a grace period, then SIGKILL);
- runs a small watchdog per child that checks once a second whether the launcher is still alive and kills the group
  if not;
- cleans up leftover stacks at start-up;
- runs watched builds at a lowered priority.

Where only one instance of something can run (a stack bound to fixed ports), a lock directory makes it explicit, so
agents queue instead of colliding.

## Concurrent Agents in One Checkout

One agent's build deletes the output directory under another agent's test run; one agent's install moves package paths
under a running suite. Both look like real failures. Rerun before believing a failure, and say when the machine was
loaded. When several agents commit on one branch, each commits only its own paths
(`git add <paths> && git commit -m "message" -- <paths>`; the `git add` is needed because a commit limited to paths
fails on a new untracked file), never a bare `git commit`, which takes whatever the others staged.
