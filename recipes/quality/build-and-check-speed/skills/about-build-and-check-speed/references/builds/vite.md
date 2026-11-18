# Vite

Load when the repository has a `vite.config.*` file or `vite` in its dependencies. Covers development builds, the
React plugin, chunking, preview servers, and the config loader.

## What to Measure

| Item | Note |
| --- | --- |
| The production build, cold | Note the heap peak (`/usr/bin/time -v`) as well as the time |
| The development build, if the project has one | Compare with production; the difference is what dev can skip |
| Dev server start and the first page load | Dependency pre-bundling runs on the first start |
| Several builds in one process (a test file, a launcher) | Memory after each build |

## Known Slow Spots

**The Babel-based React plugin.** `@vitejs/plugin-react-swc` in place of `@vitejs/plugin-react` compiles with SWC.
One app build wrapper switched as one of four development-build changes.

**Development builds doing release work.** One wrapper's development builds set `minify: false`,
`sourcemap: "hidden"`, and left library sources out of the source maps.

**One `vite preview` process per app in a local stack.** About 255 MB and measurable idle CPU per app. One development
launcher serves the apps that are not being edited from a plain static server instead.

**Large entry chunks.** Lazy routes and deep imports (importing one icon rather than a whole icon index) shrink what
the bundler parses and holds in memory; see [general.md](general.md), "Memory".

## Traps

**Several vendor chunks can create an import cycle.** Splitting vendor code into several chunks created a cycle that
broke CommonJS interop; one project kept a single vendor chunk with stable names.

**The default config loader leaks in a long-lived process.** With `configLoader: "bundle"` (the default), each
in-process build kept about 210 MB alive, because Node never unloads ES modules: four builds in one process held
873 MB, against 247 MB with `configLoader: "runner"`, with byte-identical output. Anything that runs several builds in
one process (a test file, a warm server, a launcher) needs `runner`.
