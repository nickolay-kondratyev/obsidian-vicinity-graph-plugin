# PRIVATE memory — Phase 0 libavoid-js WASM spike (rehydrate a clone)

## Outcome
All acceptance criteria PASS, including offline-in-Electron (automated e2e). No blockers.

## Hard-won API / environment facts (libavoid-js 0.4.5)
- Package `exports` map ONLY publishes `.` → `{ node: dist/index-node.mjs, types: dist/libavoid.d.ts, default: dist/index.js }`.
  - `dist/libavoid.d.ts` in the `types` condition **does not exist** on disk (real files: `index.d.ts`, `index-node.d.ts`; `typings/libavoid.d.ts` exists). Irrelevant because `index.d.ts` has `declare module "libavoid-js"` → module is `any`. `skipLibCheck:true` (tsconfig) hides the lib's own TS7010 errors.
  - Deep subpath imports (`libavoid-js/dist/libavoid.wasm`, `.../index-node.mjs`) are BLOCKED (`ERR_PACKAGE_PATH_NOT_EXPORTED` / esbuild "Could not resolve"). `require.resolve("libavoid-js/package.json")` also blocked. `require.resolve("libavoid-js")` WORKS → resolves to `dist/index-node.mjs` (node condition); wasm is the sibling `dist/libavoid.wasm`.
- **Two builds, different environments:**
  - `dist/index.js` = BROWSER: uses `fetch()`, handles `data:` URIs. ABORTS in plain Node ("not compiled for this environment"). This is what esbuild bundles (browser platform default) and what Electron runs.
  - `dist/index-node.mjs` = NODE: uses `readAsync`/`createRequire` (fs). Runs in Node/vitest.
- `AvoidLib.load(ie)` source: `if(avoidLib) log("already initialized"); else avoidLib = await he({locateFile: (de,re)=> ie!==undefined && de.endsWith(".wasm") ? ie : re+de})`. The factory `he` is NOT exported → cannot inject `wasmBinary` on the browser build. So the ticket's wasmBinary fallback is unreachable via public API. Primary data-URL path is the only one and it works.
- Enum constants are FLAT on the instance: `Avoid.PolyLineRouting`, `Avoid.OrthogonalRouting`, `Avoid.shapeBufferDistance`, `Avoid.segmentPenalty`, `Avoid.crossingPenalty`, `Avoid.ConnDirAll` (=15), etc. NOT `Avoid.RoutingParameter.shapeBufferDistance` (that path is undefined — TypeError).
- Shape-attached endpoints: `new ConnEnd(shape, classId)` requires a `ShapeConnectionPin(shape, classId, xOff, yOff, proportional, insideOffset, visDirs)` with the SAME classId already added, else warns "ConnEnd ... no pins with class id N" and degrades to a 2-pt centre-to-centre line. Use a proportional centre pin: `new ShapeConnectionPin(shape, 1, 0.5, 0.5, true, 0, Avoid.ConnDirAll)`, then `new ConnEnd(shape, 1)`.
- **MEMORY MODEL (critical, cost me the most time):** Router OWNS ShapeRef/ConnRef/ShapeConnectionPin and frees them on `destroy(router)`. Destroying any of those YOURSELF double-frees → "Maximum call stack size exceeded" then "program has already aborted" (Emscripten abort latches for the whole module instance — every later call fails). Destroy ONLY: Points, Rectangles, ConnEnds, Router. Bisect proof: `destroyShape:true` crashed; `buffer:true` alone fine. 100/100 loop clean with the correct set.

## Design decisions
- Pinned `libavoid-js@0.4.5` (highest stable 0.4.x). `latest` dist-tag is a beta (0.5.0-beta.5) — avoided.
- Virtual module `libavoid-wasm` resolved by esbuild `onResolve` plugin → `path.join(path.dirname(require.resolve("libavoid-js")), "libavoid.wasm")`; base64 loader inlines it. Ambient decl in `src/types/libavoidWasm.d.ts`.
- Scenario logic is `Avoid`-INJECTED (pure functions in `libavoidSpike.ts`) so the same code runs under vitest (node build) and the Obsidian command (browser build). `libavoidSpike.ts` imports `./libavoidLoader` as `import type` only (erased) so it does NOT drag `libavoid-wasm` into vitest.
- Production surface (stays): `libavoidLoader.ts` (`loadAvoid()` only), esbuild wiring, `libavoidWasm.d.ts`. Everything else marked THROWAWAY with the ticket id.
- `AvoidArena` (memory-safe wrapper) kept in throwaway spike, NOT the shim, to respect Phase 0 scope (edgeRouting.ts = Phase 1). Recommend promoting it in Phase 1.

## Dead-ends / gotchas hit
- `import wasmB64 from "libavoid-js/dist/libavoid.wasm"` → esbuild "Could not resolve" (exports). → virtual module.
- Browser build data-URL load in Node → "not compiled for this environment". → node build for vitest.
- Bare `import "libavoid-js"` in vitest → browser build → stack overflow/abort. → explicit node-build load via `require.resolve` + `import(pathToFileURL().href)`.
- `getInstance() as Avoid` (my interface) → TS2352 (lib's exported `Avoid` differs). → `as unknown as Avoid`.
- Reverse-order dispose that freed ShapeRef → crash (see memory model).

## Key file locations / line anchors
- Loader: `src/view/libavoidLoader.ts` (`loadAvoid`, `Avoid`/`AvoidRouter`/... types, `WASM_DATA_URL`).
- Scenarios+arena: `src/view/libavoidSpike.ts` (`AvoidArena`, `runObstacleScenario`, `runNestedScenario`, `runStressLoop`, `isStrictlyInside`).
- Unit test: `src/view/libavoidSpike.test.ts` (loads node build by file URL in `beforeAll`).
- Command: `src/main.ts` — `addCommand id:"debug-spike-libavoid-routing"` + private `spikeLibavoidRouting()` (stashes `window.__vicinitySpikeResult`).
- e2e: `e2e/libavoidSpike.e2e.ts` (network blackhole + command + assert). Uses `ObsidianHarness.launch()`, `harness.page`, `PLUGIN_ID` from `e2e/obsidianHarness.ts`.
- esbuild: `esbuild.config.mjs` — `createRequire`, `LIBAVOID_WASM_PATH`, `libavoidWasmPlugin`, `loader:{".wasm":"base64"}`, plugin added between styles and copy plugins.

## Numbers
- wasm: 485,460 bytes → base64 647,280 chars.
- main.js: 1,877,709 → 2,607,082 (+729,373 ≈ 712 KiB). main.js is GITIGNORED (baseline was the on-disk pre-change artifact).
- vitest full: 54 files / 616 tests pass (incl. 4 new). e2e: 1 passed ~51ms.
- Scenario a route: [[0,50],[80,80],[120,80],[200,50]]. Scenario b (with outside blocker): [[175,175],[356,116],[404,116],[520,180]].

## Test/repro commands
```
npm run check
npx vitest run                                   # full
npx vitest run src/view/libavoidSpike.test.ts    # spike only
npm run build && wc -c main.js
OBSIDIAN_PATH="$PWD/.tmp/obsidian/obsidian-1.12.7/obsidian" bash scripts/run-e2e.sh libavoidSpike.e2e.ts
```
Obsidian binary already present (offline) at `.tmp/obsidian/obsidian-1.12.7/obsidian`. CDP harness needs NO Playwright browser download (connectOverCDP to Obsidian's own Chromium). No `~/.cache/ms-playwright`.

## Scratch probes (in .tmp, gitignored) if you need to re-derive
- `.tmp/probe-node.mjs`, `.tmp/probe-nested2.mjs`, `.tmp/bisect.mjs`, `.tmp/confirm-mem.mjs`, `.tmp/probe-dataurl.mjs` (browser-in-node abort), `.tmp/esbuild-probe/` (exports block).

## ITERATION (convergence pass, post-review)
- Review verdict: READY TO CLOSE, 0 BLOCKING, 2 IMPORTANT (I1 ticket-note = orchestrator's; I2 = mine), 5 NIT.
- **I2 FIXED** in `loadAvoid` (`libavoidLoader.ts:89-118`): only a SUCCESSFUL init is memoized. On
  failure, `.catch` resets `cached=null` (guarded by `if (cached===attempt)` so a newer attempt is
  not clobbered) → later call retries instead of session-long straight-edge lock-in. In-flight promise
  still assigned synchronously → concurrent-caller sharing / no double-load race preserved. Error still
  surfaces to caller (we return the rejecting `attempt`; `.catch` is side-effect only, never swallows).
  Full WHY at code site + in IMPLEMENTATION_ITERATION__PUBLIC.md.
- **All 5 NITs REJECTED** (spike/YAGNI/scope): N1 already a tracked Phase-1 follow-up; N2 throwaway e2e;
  N3 vertex-check is acceptable spike proxy; N4 pragmatic untyped-lib index sig; N5 module-singleton is
  a Phase-1 DIP decision. Zero NIT code changes.
- Verify: `npm run check` exit 0; `vitest run` 616 passed / 54 files (unchanged). e2e NOT re-run —
  justified: only the failure-caching branch changed; load path + success-caching unchanged, so the
  offline-load proof is unaffected. Logs: `.tmp/check-iter.log`, `.tmp/vitest-iter.log`.
- Output: `IMPLEMENTATION_ITERATION__PUBLIC.md` written. NOT committed (orchestrator commits).

## Follow-ups for Phase 1
- Promote `AvoidArena` (or its ownership rules) into `LibavoidEdgeRouter`; router-per-pass, dispose in `finally`.
- Endpoint attachment uses centre pins (classId 1) — carry that into the real router.
- Consider forking libavoid-js only IF `data:` wasm ever breaks (to expose the factory for wasmBinary). Not needed now.
- Remove all THROWAWAY-marked code (grep ticket id `edge-routing__00-wasm-spike` / `nid_pgsj1vjjnmtflf55a4sd9txos_e`).
