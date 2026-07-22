# Phase 0 spike — libavoid-js WASM in Obsidian — IMPLEMENTATION (self-plan)

Ticket: `_tickets/edge-routing__00-wasm-spike-libavoid-in-obsidian.md` (`nid_pgsj1vjjnmtflf55a4sd9txos_e`).
Status: **ALL acceptance criteria met, including the offline-in-Electron load (the biggest risk), proven by an automated e2e.**

## TL;DR verdict
- WASM **bundles into single `main.js`** and **loads OFFLINE inside real Obsidian/Electron** via the base64 **data-URL** path — proven by a Playwright/CDP e2e that blocks all http(s)/ws network and still routes.
- Obstacle avoidance (a), nested-shape endpoints (b), and the 100× create/destroy loop (c) all pass — in vitest (real WASM, node build) AND in the Electron e2e.
- **Load path that works: PRIMARY `data-url`** (`AvoidLib.load(dataUrl)`). The ticket's `wasmBinary` fallback is **not reachable** through the browser build's public API (see Callouts) — but it isn't needed: the primary path works.
- Nested-shape verdict: **WORKS, no "attach-to-group" fallback required.**
- `main.js` size delta: **+729,373 bytes** (1,877,709 → 2,607,082; ~712 KiB), consistent with the 647,280-char base64 of the 485,460-byte wasm + minified glue.

## Plan (as executed)
1. `npm install --save-exact libavoid-js@0.4.5` (chose the highest STABLE 0.4.x over the `latest` beta 0.5.0-beta.5, matching the ticket's verified API).
2. esbuild: `loader: { ".wasm": "base64" }` + a virtual-module resolver plugin (the package `exports` map blocks deep `.wasm` imports).
3. Ambient decl `src/types/libavoidWasm.d.ts` for the `libavoid-wasm` virtual module.
4. Production loader shim `src/view/libavoidLoader.ts` — lazy, singleton-cached `loadAvoid(): Promise<Avoid>`, data-URL path.
5. Throwaway spike scenarios `src/view/libavoidSpike.ts` (Avoid-injected, memory-safe arena) + vitest `libavoidSpike.test.ts` + dev command in `main.ts` + offline e2e `e2e/libavoidSpike.e2e.ts`.

## Files created / changed
| Path | Kind | Why |
|---|---|---|
| `package.json` / `package-lock.json` | changed | Pin `libavoid-js@0.4.5` (exact). |
| `esbuild.config.mjs` | changed (PROD, stays) | `loader['.wasm']='base64'` + `libavoidWasmPlugin` mapping the `libavoid-wasm` virtual id to `dist/libavoid.wasm` (exports map blocks a direct subpath import). |
| `src/types/libavoidWasm.d.ts` | new (PROD, stays) | Ambient `declare module "libavoid-wasm"` so tsc/vitest type the base64 import. |
| `src/view/libavoidLoader.ts` | new (PROD, stays) | The shim Phase 1 builds on: `loadAvoid()`, focused `Avoid` type, data-URL load, honest note on the missing wasmBinary hook. |
| `src/view/libavoidSpike.ts` | new (THROWAWAY) | Scenarios a/b/c + `AvoidArena` (correct ownership). Marked with ticket id; Phase 1 deletes. |
| `src/view/libavoidSpike.test.ts` | new (THROWAWAY) | vitest: real WASM (node build) proves a/b/c/100× + wasm-module validity. |
| `e2e/libavoidSpike.e2e.ts` | new (THROWAWAY) | Offline-in-Electron proof via the dev command. |
| `src/main.ts` | changed (THROWAWAY additions) | Dev command `debug-spike-libavoid-routing` → runs scenarios via the shipped loader, stashes result on `window.__vicinitySpikeResult`. |

## Which wasm load path worked, and where
- **PRIMARY `data-url`** — `data:application/octet-stream;base64,<b64>` handed to `AvoidLib.load()`. Emscripten `locateFile` returns it; Chromium/Electron `fetch()` accepts `data:` URLs. **Verified inside real Obsidian 1.12.7 Electron with network blocked** (`e2e/libavoidSpike.e2e.ts`, passed).
- The **browser build aborts in plain Node** ("not compiled for this environment"), so the data-URL path is genuinely Chromium/Electron-only — it CANNOT be exercised by vitest. vitest therefore loads the **node build** (`dist/index-node.mjs`, same wasm engine, reads bytes off disk) to prove routing/memory deterministically in CI.
- Under vitest a bare `import "libavoid-js"` resolves to the **browser** build (default condition) and aborts; the test loads the node build explicitly by file URL (`require.resolve` + `import(pathToFileURL(...))`). Documented in the test.

## Scenario (b) nested-shape behavior + verdict
**WORKS — no fallback needed.** A child shape inside a group container, connected via a proportional (0.5,0.5) centre `ShapeConnectionPin` to a shape outside the group, with a separate obstacle in between, routes: `[[175,175],[356,116],[404,116],[520,180]]` — starts at the child centre, crosses its OWN enclosing group (expected; the source is trapped inside it), and routes AROUND the outside obstacle. So the epic's "conn endpoints inside group containers route weirdly" risk does **not** materialize for correctness; the "attach-to-group instead" fallback is not required for Phase 1.
- Gotcha: shape-attached `ConnEnd(shape, classId)` needs a `ShapeConnectionPin` with that classId first, else libavoid warns "no pins with class id N" and silently degrades to a 2-point centre-to-centre line. The value `15` from earlier notes is `ConnDirAll` (a direction flag), NOT a pin class.

## 100× create/route/destroy loop
100/100 iterations produce a valid route, no crash — in vitest AND in the Electron e2e. Memory model **proven and load-bearing**: destroy only the leaf objects WE allocate (Points, Rectangles, ConnEnds) plus the Router; **NEVER** destroy ShapeRef/ConnRef/ShapeConnectionPin — the Router owns them and frees them on its own `destroy`. Destroying a router-owned object double-frees → heap corruption → "Maximum call stack size exceeded" / "program has already aborted". `AvoidArena` encodes this so leaks/double-frees are impossible at call sites.

## `main.js` size delta
| | bytes |
|---|---|
| before (on-disk pre-change build; `main.js` is gitignored) | 1,877,709 |
| after (`node esbuild.config.mjs production`) | 2,607,082 |
| **delta** | **+729,373 (~712 KiB)** |
Embedding verified: a mid-stream 80-char slice of the wasm's base64 AND the `data:application/octet-stream;base64,` prefix are both present in the built `main.js`.

## Reproduce each check
```bash
# tsc
npm run check
# full unit suite (54 files / 616 tests incl. 4 spike tests)
npx vitest run
# just the spike unit tests
npx vitest run src/view/libavoidSpike.test.ts
# production build + size
npm run build && wc -c main.js
# verify wasm embedded
SLICE=$(base64 -w0 node_modules/libavoid-js/dist/libavoid.wasm | cut -c100000-100080); grep -qF "$SLICE" main.js && echo EMBEDDED
# OFFLINE-in-Obsidian e2e (binary already at .tmp/obsidian/obsidian-1.12.7/obsidian)
OBSIDIAN_PATH="$PWD/.tmp/obsidian/obsidian-1.12.7/obsidian" bash scripts/run-e2e.sh libavoidSpike.e2e.ts
```

## Offline-in-Obsidian verification — precise status
- **RAN and PASSED.** `e2e/libavoidSpike.e2e.ts` launched the pinned Obsidian 1.12.7 Electron binary (headless Ozone), enabled the plugin, installed a renderer network blackhole (`page.route` aborting all `http(s)`/`ws`), ran `vicinity-graph:debug-spike-libavoid-routing`, waited for `window.__vicinitySpikeResult`, and asserted `ok=true`, `loadPath="data-url"`, plus scenarios a/b/c. `data:` URLs are not network requests, so success under the blackhole is the offline proof. 1 passed (~51ms test).
- Environment that each test exercised:
  - vitest → libavoid **node build** (real wasm, off-disk) — routing/memory logic.
  - e2e → libavoid **browser build + data-URL** inside **real Obsidian/Electron** — the offline load itself.
- **Mobile (iOS WKWebView / Android WebView): NOT verified** (no device/emulator here). `data:`-URL `fetch` of wasm is standard on both, but this remains human-verify-only. Best-effort note only.

## Callouts / risks
- **wasmBinary fallback is NOT implementable via the browser build's public API.** `AvoidLib.load()` only sets `locateFile`; the Emscripten module factory (which honors `Module.wasmBinary`) is module-internal and not exported. The shim documents this and relies on the primary path, which is proven to work. If a future Electron/Chromium ever rejects `data:` wasm, the fix would be to fork/patch libavoid-js to expose the factory — flagged for Phase 1 awareness, not needed now.
- **libavoid-js ships no usable types** (`declare module "libavoid-js"` → `any`; its `index.d.ts` also has strict TS7010 errors, hidden by the repo's `skipLibCheck:true`). We define a focused `Avoid` interface in the shim and cast via `unknown`.
- Pinned **0.4.5** (stable), deliberately NOT the `latest` **0.5.0-beta.5**.

## Deviations from ticket wording (all POLS-preserving)
- Virtual module `libavoid-wasm` + esbuild `onResolve` instead of `import "libavoid-js/dist/libavoid.wasm"` — the package `exports` map blocks the subpath (empirically confirmed: esbuild "Could not resolve"). Ambient decl names that exact module rather than `*.wasm`.
- Memory-safe arena lives in the throwaway spike (not the production shim) to respect Phase 0 scope (`edgeRouting.ts` is Phase 1). Recommend Phase 1 promote it.

## Acceptance criteria checklist
- [x] `npm run build` produces `main.js` with embedded wasm; plugin loads OFFLINE in `.dev-vault` Obsidian (e2e, network blocked).
- [x] Scenario (a) routes around the obstacle (polyline `[[0,50],[80,80],[120,80],[200,50]]`, none inside).
- [x] Scenario (b) nested-shape documented — **works**, no attach-to-group fallback needed.
- [x] Scenario (c) 100× create/destroy completes without crash (100/100).
- [x] Findings + measured `main.js` size delta recorded (this file; ticket note attempted — see PRIVATE).
- [x] `npm run check` passes; existing vitest suite still green (616/616, +4 spike).
```
```
No `#QUESTION_FOR_HUMAN:` — no blockers.
