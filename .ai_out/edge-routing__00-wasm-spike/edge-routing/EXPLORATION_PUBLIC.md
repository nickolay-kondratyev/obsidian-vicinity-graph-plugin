# EXPLORATION_PUBLIC — Phase 0 libavoid-js WASM spike

Consolidated from two Explore agents (build wiring + runtime/dev-vault). Source of
truth for CLARIFICATION / PLANNING / REVIEW stages.

## Task recap
Prove `libavoid-js` (WASM) can be **bundled into the single `main.js` and loaded OFFLINE**
inside real Obsidian, and that routing works (obstacle avoidance, nested-shape endpoints,
100× create/destroy without crash). Throwaway harness allowed; esbuild wiring is production-shaped and stays.
Full spec: `_tickets/edge-routing__00-wasm-spike-libavoid-in-obsidian.md`. Epic: `_tickets/edge-routing-via-libavoid-js-...md`.

## Current state (verified 2026-07-22)
- `libavoid-js` is **NOT installed** (absent from `package.json` + `node_modules/`). Must `npm install` (pin exact).
- Scratch research (git-ignored) lives in `.tmp/`: `libavoid.d.ts` (hand-sketched ambient decls), `libavoid-dist.js` (glue), `libavoid-readme.md`, `libavoid-example.js`. Useful reference, NOT wired.
- No `src/types/` dir and **zero `.d.ts` files under `src/`** — a new `src/types/wasm.d.ts` would be the first ambient decl (no tsconfig change needed; `include: ["src/**/*.ts"]` picks it up).

## Build wiring — `esbuild.config.mjs`
- `entryPoints: ["src/main.ts"]`, `bundle: true`, `format: "cjs"`, `target: "es2021"`, `outfile: "main.js"`.
- **No `loader` key today** — adding `loader: { ".wasm": "base64" }` is net-new, overrides nothing.
- `external`: `obsidian`, `electron`, all `@codemirror/*`, `@lezer/*`, all Node `builtinModules`. No `define`/`inject`.
- Prod (`node esbuild.config.mjs production`): `minify:true`, `sourcemap:false`, one-shot rebuild+dispose. Dev (`npm run dev`): inline sourcemap, `context.watch()`.
- Two plugins:
  - `generateStylesPlugin` — regenerates `styles.css` from RF dist CSS + `src/view/graph-view.css` on `onStart`.
  - `copyToDevVaultPlugin` — on successful `onEnd`, copies `PLUGIN_ARTIFACTS = ["main.js","manifest.json","styles.css"]` into `.dev-vault/.obsidian/plugins/<manifest.id>/`. **This is how the spike reaches real Obsidian — no extra wiring.**
- Precedent for non-JS import: only `import manifest from "../manifest.json"` (via `resolveJsonModule`). No CSS-in-JS, no binary-asset precedent.

## Typescript — `tsconfig.json`
- `module: ESNext`, `moduleResolution: "node"`, `strict`, `isolatedModules`, `noEmit`, `allowSyntheticDefaultImports: true`, `resolveJsonModule: true`, `lib: [ES2021, DOM]`.
- tsc is check-only (`npm run check` = `tsc -noEmit`); esbuild does emit. Ambient `.d.ts` only needs to satisfy tsc.
- No `typeRoots`/`types`/`paths`.

## Runtime / plugin entry — `src/main.ts`
- `VicinityGraphPlugin extends Plugin` (`src/main.ts:25`). `onload` at `:40-88`, `onunload` at `:104-108`.
- **Already has two `addCommand` calls** (`:78-87`): `open-vicinity-graph`, `debug-log-vicinity-graph`. The latter calls `logVicinityGraph()` (`:168-201`, "Step-03 exit-criterion harness") — an async private debug method that `console.log`/`console.table`s, no UI. **This is the exact precedent for the spike harness command.**
- Recommended: add a 3rd `addCommand` (e.g. `debug-spike-libavoid-routing`) → new private async method logging scenario results. **No view/controller changes needed** for this spike.
- Command ids are namespaced by Obsidian as `vicinity-graph:<id>` (used in e2e).
- Lazy-async precedent: `VicinityGraphView.onOpen()` (`src/view/VicinityGraphView.tsx:52-68`). Loader shim should follow "nothing at startup; first call inits + caches" shape.

## Dev-vault / e2e loop
- `.dev-vault/` gitignored, built by `scripts/setup-dev-vault.sh` (fixtures + minimal `.obsidian` config, then `npm run build`).
- Plugin is **copied, not symlinked** (via `copyToDevVaultPlugin`). `npm run dev` watch auto-recopies on save. Manual reload: Cmd/Ctrl+R in Obsidian.
- `scripts/setup-obsidian-bin.sh`: downloads pinned Obsidian v1.12.7 tarball → `.tmp/obsidian/`, prints binary path on stdout.
- `scripts/run-e2e.sh`: sets `OBSIDIAN_PATH`, headless Electron flags, runs `setup:dev-vault`, typechecks `e2e/`, `npx playwright test`.
- e2e harness (`e2e/obsidianHarness.ts`): real Electron Obsidian + Playwright **over CDP** (`--remote-debugging-port=0`, connectOverCDP) — NOT `_electron.launch` (fused node inspector hangs it). Drives via `page.evaluate` against `window.app`, e.g. `app.commands.executeCommandById("vicinity-graph:open-vicinity-graph")`; enables plugin via `app.plugins.setEnable(true)`+`enablePlugin`.

## Tests — `vitest.config.ts`
- `include: ["src/**/*.test.{ts,tsx}"]`, **environment defaults to `node`** (no jsdom, no DOM). `WebAssembly.instantiate` works in Node. No `setupFiles`.
- Repo convention: heavy pure-module coverage with colocated `.test.ts`.

## Manifest
- `id: vicinity-graph`, `minAppVersion: 1.12.4`, `isDesktopOnly: false` (mobile must not break; desktop verify required, mobile best-effort).

## Key libavoid-js API (from ticket, verified v0.4.x)
- `import { AvoidLib } from "libavoid-js"; await AvoidLib.load(filePathOrUrl); const Avoid = AvoidLib.getInstance();` Singleton; 2nd load no-op. `load()` string ending in `.wasm` fed to Emscripten `locateFile`. Module honors `Module.wasmBinary` (fallback path).
- Routing: `new Avoid.Router(Avoid.PolyLineRouting)`; `new Avoid.Rectangle(new Avoid.Point(x1,y1), new Avoid.Point(x2,y2))`; `new Avoid.ShapeRef(router, rect)`; `new Avoid.ConnEnd(shapeRef, classId)` or `ConnEnd(point)`; `new Avoid.ConnRef(router, src, dst)`; `router.processTransaction()`; `connRef.displayRoute()` → `PolyLine {size(), get_ps(i){x,y}}`.
- Cleanup: `Avoid.destroy(obj)` for every `new`-ed binding (Points, Rectangles, ConnEnds, Router). Router destroy tears down registered shapes/conns.

## Implementation plan (from ticket work items)
1. `npm install libavoid-js` (pin exact).
2. `esbuild.config.mjs`: add `loader: { ".wasm": "base64" }`. Add `src/types/wasm.d.ts` (`declare module "*.wasm"`).
3. `src/view/libavoidLoader.ts` shim: primary = `data:application/octet-stream;base64,${wasmB64}` → `AvoidLib.load(dataUrl)`; fallback = decode base64 → `Uint8Array` as `wasmBinary`. Public API `async loadAvoid(): Promise<Avoid>`, lazy + cached.
4. Throwaway harness command in `src/main.ts` running 3 scenarios: (a) 1 conn + 1 rect obstacle (assert >2 pts, none inside rect); (b) nested-shape endpoint (inner rect in outer group → conn to outside shape); (c) 100× create/destroy loop no crash.
5. Record findings on ticket via `ticket add-note`: main.js size delta, which load path worked, nested-shape behavior, mobile check.

## Acceptance criteria (ticket)
- `npm run build` produces `main.js` with embedded wasm; loads offline in `.dev-vault`.
- (a) routes around obstacle; (b) nested-shape documented; (c) 100× loop no crash.
- Findings + measured main.js size delta on ticket.
- `npm run check` + vitest suite still pass.
