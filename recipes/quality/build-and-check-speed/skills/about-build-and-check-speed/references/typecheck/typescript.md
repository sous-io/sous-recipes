# TypeScript

Load when the repository has a `tsconfig.json` or TypeScript in its dependencies.
This file covers the compiler settings, the typecheck script, per-file typechecks, monorepo typechecks and moving
the compile to swc.

## What to Measure

| Command                                                   | Note                                |
| --------------------------------------------------------- | ----------------------------------- |
| `tsc --noEmit` on the main config and on the build config |                                     |
| `tsc --noEmit --incremental`, cold then warm              | The warm number is the target       |
| The build script, and the compiler alone                  | The difference is pre-build hooks   |
| Raw swc transpile of the source tree                      | Sets the ceiling for a compile      |
| Source size                                               | Files and lines; how many are specs |

Inventory: `incremental`, `tsBuildInfoFile`, `skipLibCheck`, `isolatedModules`, `paths` and `baseUrl`,
`declaration`, and whatever the framework CLI's builder setting is.

## Known Slow Spots

**No typecheck script.** When the only way to check types is the full build, a check also deletes the output and
may regenerate generated code (an ORM client, for example). `tsc --noEmit --incremental` on one 670-file service
took 31.5 s cold and 7.4 s warm on an idle machine, and 9 to 13 s warm with other work running.

**No incremental compile.** Every boot and build compiles from nothing. On the same service 26 s of a 37 s dev boot
was the compile. `incremental: true`, plus keeping the output directory between runs (see
[../dev-loop/nestjs.md](../dev-loop/nestjs.md) for the framework CLI flag that deletes it), brought the compile to
about 6 s.

**`skipLibCheck`.** It may already be on through a base config, so reading the effective config comes before
anything else.

**Compile with swc.** On that service raw swc transpiled the whole tree in about a second against 17 s for tsc.
The build went from 17 s to 2 to 4 s, of which swc itself was about 300 ms for 464 files. swc does not typecheck,
so a typecheck script stays as the gate; releases may stay on tsc. Two traps came with it:
- `paths` without `baseUrl` makes the framework's swc builder exit in about a second with no output and no error,
  which looks like success. Adding `baseUrl` fixes it.
- Under that project's swc configuration, the parameter-type metadata that a bare property injection relies on was
  not emitted, so every such injection failed at boot. swc emits that metadata when `jsc.transform.decoratorMetadata`
  is enabled (together with `jsc.transform.legacyDecorator`), so check both in `.swcrc` before rewriting any
  injection site. See [../dev-loop/nestjs.md](../dev-loop/nestjs.md). On that service it was 63 property injections
  of the shape `@Inject() private readonly fooService: FooService` in 36 files, mechanical, with no forward
  references.

**`declaration: true` on an application.** It was 8 of 14 build seconds, producing declaration files nothing
consumed. An application does not need them; a library does.

**Whole-workspace typecheck in a monorepo.** `pnpm run -r --parallel --aggregate-output typecheck` runs each
package's `typecheck` script at once and prints each package's output as one block. Types read from a workspace
package's built `dist/` need that package rebuilt first (`pnpm --filter <package> build`, not the whole repo).

## Per-File Typechecks

A per-file typecheck is possible and correct when it goes through a TypeScript LanguageService that uses the
project's own tsconfig; see [../per-file-checks/overview.md](../per-file-checks/overview.md) and
[../per-file-checks/warm-server.md](../per-file-checks/warm-server.md).

The trap is `tsc <file>`. It ignores the project config, so it checks the file in isolation with default settings
and none of the path mappings.

A fallback with no extra tooling is a temporary config in a directory made by `mktemp -d`:

```json
{
  "extends": "/absolute/path/to/package/tsconfig.json",
  "compilerOptions": { "noEmit": true, "composite": false, "incremental": false },
  "files": ["/absolute/path/to/the/file.ts"],
  "include": []
}
```

Then run `tsc --noEmit -p <temporary tsconfig>` from the package directory, so relative settings resolve as they
do for the project. A per-file typecheck reports errors inside the checked file only. A caller elsewhere that the
edit broke is caught by the full typecheck at the end.

For a duplicate typecheck job in CI and for testing a type error, see [general.md](general.md).

## Untested Ideas

These were not tried in any project measured for this skill:
- `tsgo`, the native TypeScript compiler preview, for the typecheck.
- Project references with `tsc --build`, for rebuilding only the packages that changed in a monorepo.

## Traps

**swc keeps type-only imports that tsc removes.** `import { Request, Response } from 'express'` compiled to a real
`require` of a package that was only a transitive dependency, and the application died at boot. The fix is
`import type` at every type-only import site, then a lint rule that enforces it; see [../lint/eslint.md](../lint/eslint.md)
for the rule and its traps.

**The removal differs in both directions.** swc also keeps an import that is only referenced from decorator
metadata. After a first swc build, listing every bare `require` in the emitted output and checking that each one
resolves is what found the express case, and showed nothing else was broken.

**Naming a package without checking it.** A report recommended a framework plugin by name for the injection
problem, and the package did not exist on the registry. Every named package is worth one lookup.

## Lessons From Implementation

1. A warm number belongs with its load conditions. The incremental typecheck was 7.4 s idle and 9 to 13 s on the
   same machine with other work running; see [../machine-load.md](../machine-load.md).
2. A read-only pass predicted 64 injection sites in 37 files with 12 circular cases. The real change was 63 in 36
   with none. Estimates from reading ran slightly high; doing one site first verifies the estimate.
