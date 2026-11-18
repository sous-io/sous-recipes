# OpenTelemetry

Load when any `@opentelemetry/*` package is in the dependencies. Covers the cost of instrumentation registration on
every boot, watch rebuild and test run.

## What to Measure

Require the application's root module with tracing loaded and without. The difference is the tax paid on every boot
and every watch rebuild.

## Known Slow Spots

**Every auto-instrumentation loaded at import time in development.** On one service the tracing module called
`registerInstrumentations` with all 77 auto-instrumentations and no environment guard. Each patches `require`, so
every module load after that is slower. Requiring the root module cost 4.6 s clean and 7.8 s once tracing had
hooked in: about 3 s on every watch rebuild and every boot. Gating the registration behind an environment flag,
off in development and in test, removes it. The tracer and span helpers stay exported as working no-ops so every
call site compiles unchanged, and a developer who wants local traces sets the flag and starts the compose tracing
service. At 100 rebuilds a day that is about 5 minutes back, which was the biggest daily saving on that dev loop.

## Lessons From Implementation

1. The gate has to exclude the test environment as well as development, or every spec run pays the instrumentation
   cost.
2. The cost is the `registerInstrumentations` call, not importing the packages. Leaving the imports and the span
   helpers in place cost nothing measurable, so only the registration call needs the guard and no call site has to
   change.

Related: [nestjs.md](nestjs.md) for the watch-rebuild profile this cost sits inside.
