---
id: nid_pgsj1vjjnmtflf55a4sd9txos_e
title: "edge-routing__00-wasm-spike-libavoid-in-obsidian"
status: open
deps: []
links: []
created_iso: 2026-07-22T16:04:58Z
status_updated_iso: 2026-07-22T16:04:58Z
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

