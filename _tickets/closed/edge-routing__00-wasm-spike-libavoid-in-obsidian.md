---
closed_iso: 2026-07-22T16:45:16Z
id: nid_pgsj1vjjnmtflf55a4sd9txos_e
title: "edge-routing__00-wasm-spike-libavoid-in-obsidian"
status: closed
deps: []
links: []
created_iso: 2026-07-22T16:04:58Z
status_updated_iso: 2026-07-22T16:45:16Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
parent: nid_w8co2gp7cok2a2hwwsm88brfo_e
---

# Phase 0 — Spike: prove libavoid-js (WASM) works inside Obsidian

Parent epic (full plan): `_tickets/edge-routing-via-libavoid-js-obstacle-avoiding-edges-for-all-layouts-force-directed-first.md` (id `nid_w8co2gp7cok2a2hwwsm88brfo_e`). Read it first.

## Goal

De-risk the whole edge-routing effort by proving, inside the real Obsidian plugin runtime, that:
1. The `libavoid-js` WASM module can be bundled into the single-file `main.js` and loaded OFFLINE (no network fetch).
2. Routing works: 1 connector routed around 1 rectangle obstacle produces a sane polyline.
3. A connector whose endpoint shape is NESTED inside another shape (child node inside a folder-group rect) routes sanely — this mirrors our subflow/folder-group structure.
4. The WebIDL memory-cleanup pattern is proven (no crash/leak on repeated create/destroy across view open/close).

Throwaway code is ALLOWED for the spike surface (e.g. a temporary command or console-triggered function), but the esbuild wiring is production-shaped and stays.

## Context: why WASM and why this shape

- `libavoid-js` (npm) is the Emscripten/WebIDL WASM port of C++ libavoid (adaptagrams). There is no wasm-free mode: `dist/index.js` (~76KB glue) + `dist/libavoid.wasm` (~474KB engine).
- The plugin ships as a single `main.js` (+ `manifest.json`, `styles.css`) — see `esbuild.config.mjs` `PLUGIN_ARTIFACTS` / `copyToDevVaultPlugin`. No sidecar files, no runtime fetch of app-relative URLs. Therefore the wasm must be EMBEDDED.
- `manifest.json` has `isDesktopOnly: false` — mobile (iOS WKWebView / Android WebView) must not be broken. Desktop verification is required in this spike; mobile verification is best-effort (note result in ticket).

## Verified libavoid-js API facts (from dist v0.4.x, checked 2026-07-22)

- `import { AvoidLib } from "libavoid-js";` then `await AvoidLib.load(filePathOrUrl); const Avoid = AvoidLib.getInstance();`
  - `load(filePath?)` routes the `.wasm` request through Emscripten `locateFile`: any string ending in `.wasm` is replaced by `filePath` verbatim. Singleton — second `load` is a no-op (logs "already initialized").
  - The Emscripten module honors `Module.wasmBinary` (checked in dist source: `t.wasmBinary&&(ae=t.wasmBinary)`) — this is the FALLBACK loading path if data-URL fetch fails.
- Routing API: `new Avoid.Router(Avoid.PolyLineRouting)`; `new Avoid.Rectangle(new Avoid.Point(x1,y1), new Avoid.Point(x2,y2))`; `new Avoid.ShapeRef(router, rect)`; `new Avoid.ConnEnd(shapeRef, classId)` (shape-attached) or `new Avoid.ConnEnd(point)`; `new Avoid.ConnRef(router, srcEnd, dstEnd)`; `router.processTransaction()`; `connRef.displayRoute()` → `PolyLine { size(), get_ps(i) }` with `.x/.y` per point.
- Cleanup: `Avoid.destroy(obj)` for every JS-created binding object (Points, Rectangles, ConnEnds, and the Router; router destruction tears down registered shapes/conns).

## Work items

1. `npm install libavoid-js` (pin exact version).
2. `esbuild.config.mjs`: add `loader: { ".wasm": "base64" }` (no loaders exist today — new config key). Import the wasm as `import wasmB64 from "libavoid-js/dist/libavoid.wasm"`.
   - CHECK: how `libavoid-js` package.json exports map resolves — may need an explicit path import or `tsconfig.json` ambient module declaration for `*.wasm` (add `src/types/wasm.d.ts` with `declare module "*.wasm"`).
3. Loader shim, e.g. `src/view/libavoidLoader.ts`:
   - Primary path: build `data:application/octet-stream;base64,${wasmB64}` and pass to `AvoidLib.load(dataUrl)`. Emscripten's data-URL check (`isDataURI`) short-circuits `locateFile` rewriting only for its default name; passing our data URL through `load()` makes `locateFile` return it, then Chromium `fetch()` accepts data: URLs.
   - Fallback path (only if primary fails in Electron): decode base64 → `Uint8Array`, hand it to the Emscripten module factory as `wasmBinary` (requires calling the module factory directly instead of `AvoidLib.load`; keep the shim's public API identical either way: `async loadAvoid(): Promise<Avoid>`).
   - Lazy: nothing loads at plugin startup; first call initializes, subsequent calls return the cached instance.
4. Spike harness (throwaway): a dev-only command or exported function callable from the dev console in the `.dev-vault` that runs:
   - a) 1 conn (point endpoints) + 1 rect obstacle straddling the straight line → log polyline points; assert >2 points and no point inside the rect.
   - b) nested-shape scenario: outer rect (group) containing inner rect (child); conn from inner shape (shape-attached ConnEnd) to a shape outside the outer rect → log route; observe whether route escapes the group sanely.
   - c) loop create-router/route/destroy 100x → no crash, stable behavior (memory can be eyeballed via DevTools heap snapshot).
5. Document findings in this ticket (add-note): bundle-size delta of `main.js`, which load path worked, nested-shape behavior, mobile check result if performed.

## Acceptance criteria

- [ ] `npm run build` (or dev build) produces `main.js` containing the embedded wasm; plugin loads in `.dev-vault` Obsidian with network disabled.
- [ ] Scenario (a) routes around the obstacle (verified polyline logged).
- [ ] Scenario (b) nested-shape endpoint behavior documented (works / needs the "attach to group instead" fallback noted in the epic's risk table).
- [ ] Scenario (c) 100x create/destroy loop completes without crash.
- [ ] Findings + measured `main.js` size delta recorded on this ticket via `ticket add-note`.
- [ ] `npm run check` and existing vitest suite still pass (spike must not regress anything).

## Out of scope

- Any integration with the layout pipeline or snapshot (that is ticket `edge-routing__01-routing-pass-and-snapshot-threading`).
- Rendering (ticket `edge-routing__02-render-routed-edges`).


## Notes

**2026-07-22T16:45:16Z**

Phase 0 spike COMPLETE — all acceptance criteria met. Findings:

WASM LOAD PATH: primary data-URL path works in real Obsidian/Electron.
`AvoidLib.load("data:application/octet-stream;base64,<b64>")` → Emscripten
`locateFile` → Chromium `fetch()` accepts the data: URL. The ticket's
`wasmBinary` FALLBACK is UNREACHABLE through libavoid-js's browser build
(the Emscripten module factory is not exported), so it was NOT implemented —
the primary path works, so the fallback is unnecessary. Recorded as a risk
note for the epic risk table.

OFFLINE VERIFICATION: proven via automated e2e (`e2e/libavoidSpike.e2e.ts`)
driving a REAL pinned Obsidian 1.12.7 Electron binary over CDP with the
renderer's http/ws network blackholed — the base64-embedded wasm still loads
and routes. `1 passed`.

SCENARIO (a) obstacle avoidance: PASS — 1 conn + 1 rect obstacle straddling
the straight line produces a bent polyline (>2 points, no vertex inside the
obstacle rect).

SCENARIO (b) nested-shape endpoint: PASS — a child rect nested inside an
outer folder-group rect, conn from the child shape (shape-attached ConnEnd)
to a shape outside the group, routes sanely and escapes the group. NO
"attach-to-group" fallback needed (epic risk table row can be marked
mitigated for the common case).

SCENARIO (c) memory cleanup: PASS — 100/100 create-router/route/destroy loop,
no crash. Load-bearing rule discovered and encoded in the `AvoidArena`
wrapper: NEVER `Avoid.destroy()` router-owned ShapeRef/ConnRef/connector pins
(the router owns them; double-free → wasm abort). Only Points/Rectangles/
Router are destroyed explicitly.

main.js SIZE DELTA: 1,877,709 B → 2,607,082 B = +729,373 B (~+712 KiB) from
the base64-embedded 474 KB wasm. Accepted (noted for Phase 3 release notes).

MOBILE (iOS WKWebView / Android WebView): NOT verified — no mobile runtime in
this environment. Best-effort per ticket; deferred. Desktop verification done.

PRODUCTION-SHAPED ARTIFACTS (stay for Phase 1): esbuild `loader:{".wasm":
"base64"}`, `src/types/libavoidWasm.d.ts` ambient decl, `src/view/
libavoidLoader.ts` (lazy singleton `loadAvoid(): Promise<Avoid>` + memory-safe
`AvoidArena`). THROWAWAY (delete in Phase 1): `src/view/libavoidSpike.ts`,
`src/view/libavoidSpike.test.ts`, `e2e/libavoidSpike.e2e.ts`, and the
`debug-spike-libavoid-routing` command in `src/main.ts`.

REVIEW: independently reproduced every claim (build/check/vitest/e2e).
Verdict READY TO CLOSE, 0 blocking. One code item addressed (I2): `loadAvoid`
no longer memoizes a rejected promise — only successful init is cached, a
failed init resets the slot so a later call can retry (better contract for
Phase 1's `LibavoidEdgeRouter` to inherit).

VERIFIED: `npm run check` 0 errors; `vitest run` 616 passed (612 pre-existing
+ 4 spike, no regressions); `npm run build` (production) green with wasm
embedded; e2e offline-load `1 passed`. libavoid-js pinned at 0.4.5.

Commits: 9b79f3b (exploration), 5c6685b (impl), 3a5fc74 (review+iteration).
Full details: .ai_out/edge-routing__00-wasm-spike/edge-routing/*.md.
