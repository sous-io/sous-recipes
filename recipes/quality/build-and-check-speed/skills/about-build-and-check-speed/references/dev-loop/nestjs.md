# NestJS

Load when `@nestjs/core` is in the dependencies or `nest-cli.json` exists. Covers the CLI config, specs that boot
the application, injection under swc, and the watch-rebuild profile.

## What to Measure

| Item                                                 | Note                                                      |
| ---------------------------------------------------- | --------------------------------------------------------- |
| Dev server, launch to serving                        | Split: migrate, CLI start, compile, require graph, wiring |
| Watch rebuild after a one-line edit, save to serving | Split: detect, compile, process respawn, wiring           |
| `nest build` alone                                   | Compare with the build script to find pre-build hooks     |

Whether a dev server is already running is worth checking before anything is started. A second server is never
started and the existing one is never stopped; the measurement then comes from its log, or from a build dry run, and
says so.

## Known Slow Spots

**`deleteOutDir: true` in `nest-cli.json`.** On one service every boot wiped a good output directory and did a full
compile: 26 s of a 37 s boot. The build script already cleaned the output itself, so the flag only taxed local
boots. With the flag off and `incremental` on in the TypeScript config, the compile took about 6 s.

**The watch rebuild is dominated by the process respawn, not the compile.** One measured rebuild: 0.3 s detect,
0.9 s compile, 4.7 s respawn, 1.1 s wiring. Cutting the compile further does little; what loads during the respawn
matters. See [opentelemetry.md](opentelemetry.md).

**Specs that import the root module.** Two specs built their testing module with `imports: [AppModule]` and then
overrode providers with mocks. Each constructed the entire application graph to run 16 mocked tests: 69 s for
under 4 s of tests. They already supplied every mock they needed, so an explicit providers list in place of the
root module import does the same job. A spec that deliberately boots real modules as an assertion belongs in the
end-to-end suite.

The same import had a second cost. Registering a queue module (BullMQ) builds a real `Worker`, and the worker dials
the cache server at boot. Nine unit specs looked as if they pulled a queue module into their graph, but all 1,708
authentication-error lines in a run came from the two specs that imported the root module. Locally, with a password
on the compose cache and none in the test env, the tests still passed because nothing awaited the connection. In CI
the workers connected for real, so the unit job silently depended on the cache service container. Replacing the root
module import with explicit providers removed the queue modules along with everything else, and no queue mocking
was needed; the unit suite stayed green even with a wrong cache password. Fixing the test env password removes the
local noise but not the dependency, because the workers then connect successfully instead; only taking the modules
out of the graph removes it. Counting causes before counting symptom sites matters here: nine specs looked
affected, and one fix covered them.

**Bare `@Inject()` under swc.** On one service, 63 property injections in 36 files of the shape
`@Inject() private readonly fooService: FooService` relied on tsc's parameter-type metadata. Under that service's swc
configuration the metadata was not emitted, so the app died at boot with "can't resolve dependencies". swc emits it
when `jsc.transform.decoratorMetadata` is enabled (with `jsc.transform.legacyDecorator`), so check both in `.swcrc`
before rewriting any site. If the metadata cannot be enabled, each becomes `@Inject(FooService)`. None needed
`forwardRef`; one is added only where the boot actually names a circular dependency. A wrong token fails loudly at
boot and tsc still validates, so the risk is low, and the change is mechanical. An expected plugin that would
handle this does not exist for the version in question.

**The swc builder exits silently.** `nest build --builder swc` with `paths` and no `baseUrl` in the TypeScript
config exits in about a second with no output and no error. Adding `baseUrl` first avoids it.

**Watch mode has no hook between compile and launch.** To run something after the compile and before the app
starts (a migration, for instance), the boot has to be three steps: `nest build`, the extra step, then
`nest start --watch`, which recompiles incrementally in about a second. See [prisma.md](prisma.md).

## Lessons From Implementation

1. `useMocker(() => ({}))` is the missing half of replacing the root module import with explicit providers. Without
   it, every provider the explicit list forgot has to be found one boot failure at a time; with it the testing
   module fills the gaps and the spec only names what it actually asserts on.
2. Forward references added speculatively hide the real picture. Compiling the root module from the build output
   through the testing package lets the framework name what it cannot resolve. That is a cheap dependency-injection
   check that takes seconds, and it shows which sites are really circular. On that service it showed none.
3. The framework's swc builder ignores the build tsconfig's `exclude`: it compiled 161 spec files into the output
   directory. `.swcrc` needs its own `exclude`. After the first swc build, diffing the emitted file list against a
   tsc build comes before trusting anything else about the output.
4. A relative `jsc.baseUrl` of `"."` works on @swc/core 1.10.1, so the tsconfig `baseUrl` fix does not have to be an
   absolute path.
5. Measured after: `nest build` took 2 to 4 s, of which swc was about 300 ms for 464 files. The incremental
   typecheck script stays the type gate; swc checks nothing.
6. See [typescript.md](../typecheck/typescript.md) for the type-only import hazard swc introduces, which is what
   breaks the boot next.
