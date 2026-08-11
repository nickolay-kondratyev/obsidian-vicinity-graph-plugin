---
closed_iso: 2026-08-11T18:58:27Z
session_ids: [{"a": "claude", "type": "execution", "id": "2e369365-1da4-4495-aaf3-2ca927aac5cc"}, {"a": "claude", "type": "review", "id": "97dec7ef-56af-4aa5-a98b-23897621f371"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_9sf1iftrf914ggxv3jv3r60sw_e
title: "Spike: switch libavoid to node build to drop fetch network-risk tokens"
status: closed
deps: []
links: []
created_iso: 2026-08-11T18:30:24Z
status_updated_iso: 2026-08-11T18:58:27Z
type: task
priority: 2
assignee: nickolaykondratyev
tags: []
---

Spike switching the libavoid-js import from its web build (`dist/index.js`, resolved via the `default` export condition) to its NODE build (`dist/index-node.mjs`, the `node` export condition) so the shipped `main.js` no longer contains the two `fetch(` tokens the Obsidian scanner flags as network calls (user-facing "risk" badge).

The node build already ships in the package and has ZERO `fetch(` / `XMLHttpRequest` / `instantiateStreaming` tokens; it exposes the SAME `AvoidLib.load()` / `getInstance()` API and honors `wasmBinary`. WASM stays required (edge avoidance is core rendering) — this only changes HOW the same wasm is loaded, keeping it fully offline.

Full research, the two rejected alternatives (build-time glue strip; recompile with `-sENVIRONMENT=node`), current wiring, and detail live in `docs-internal/notes/tmp/libavoid-fetch-token-research.md`. Read that first.

Scope of the spike:
- Point esbuild resolution of `libavoid-js` at the node entry (`conditions: ['node']` or an `onResolve` to `dist/index-node.mjs`, mirroring the existing `libavoid-wasm` virtual-id trick in `esbuild.config.mjs`).
- Keep the offline embed: inject the embedded base64 wasm as `wasmBinary` (or `Module.instantiateWasm`) in `src/view/libavoidLoader.ts` so the node build never calls `readFileSync` (a single-file plugin bundle has no on-disk wasm path) or the network.

Open questions the spike must answer:
1. Byte injection: confirm the node build accepts the embedded bytes (`wasmBinary` / `locateFile` / `instantiateWasm`); `load(filePath?)` typing does not obviously expose it.
2. Electron: prove the node build instantiates in Obsidian's Electron renderer (e2e that renders routed edges), not just node.
3. New-token check: confirm `readFileSync` / `createRequire` do not trade the network badge for a different/worse Obsidian risk flag.

Acceptance:
- `grep -E 'fetch\(|XMLHttpRequest|instantiateStreaming' main.js` -> 0 matches.
- Add a token guard test over the BUILT `main.js` (pattern of `src/engine/importGuard.test.ts`) so the invariant is CI-enforced.
- Existing edge-routing e2e stays green (wasm instantiates, routed edges render).

If the spike proves the node build cannot load from injected bytes in Electron, STOP and reopen with findings; the fallback options (glue strip, recompile) are documented in the research note but are OUT OF SCOPE here.

---

## Resolution (2026-08-11) — DONE, node build shipped, tokens gone

The spike succeeded. `main.js` now has **0** `fetch(` / `XMLHttpRequest` /
`instantiateStreaming` tokens (was 2 `fetch(` + 2 `instantiateStreaming`), the wasm
still loads fully offline, and routed edges render in real Obsidian.

### What was built / changed

- **`esbuild.config.mjs`** — new `libavoidNodeBuildPlugin`:
  - `onResolve` maps `libavoid-js` → `dist/index-node.mjs` (the `node` export), replacing
    the previously-resolved `default` web build.
  - `onLoad` applies TWO adaptations to that vendored `.mjs`, each keyed on a STABLE anchor
    (not a minified identifier) and each throwing if the vendored shape changes (so a
    `libavoid-js` version bump fails LOUD, never silently):
    1. **`import.meta.url` shim.** The node build runs `createRequire(import.meta.url)` at
       module eval and `new URL(…, import.meta.url)` in `load()`; in our CJS bundle
       `import.meta.url` is empty and both throw. All occurrences are replaced with a
       constant well-formed `file://` URL — valid enough for `createRequire` (only builtin
       fs/path/url requires run) and `new URL`, and the wasm path it derives is never read.
    2. **`wasmBinary` injection.** The shipped `AvoidLib.load(filePath?)` wrapper does NOT
       forward a byte buffer to the Emscripten factory (it only builds `{locateFile}`) — this
       is the answer to open question 1: `load()` exposes NO byte-injection seam. So the
       plugin injects `wasmBinary: globalThis.__VICINITY_LIBAVOID_WASM_BINARY__` into that one
       `{locateFile:…}` options object. With `wasmBinary` set, Emscripten instantiates from the
       bytes and NEVER reaches its `readFileSync` disk fallback (the single-file bundle has no
       on-disk `libavoid.wasm`) and never touches the network.
  - `.wasm` loader changed `base64` → `binary` (imports as `Uint8Array`, no `atob` needed).
  - The esbuild options object was extracted into an exported `bundleContentOptions(prod)` so
    the token guard test builds the REAL bundle; the CLI build/watch is now guarded to run
    only when the file is invoked directly (not when imported by the test).
- **`src/view/libavoidLoader.ts`** — `initAvoid()` now publishes the embedded bytes on
  `globalThis.__VICINITY_LIBAVOID_WASM_BINARY__` then calls `AvoidLib.load()` (no arg). The
  `WasmLoadPath` type + `WASM_DATA_URL` (data-URL path) are gone.
- **`src/types/libavoidWasm.d.ts`** — `libavoid-wasm` default export retyped `string` →
  `Uint8Array` (binary loader). **`src/types/esbuildConfig.d.ts`** (new) — ambient types for
  `bundleContentOptions` so the TS test can import the `.mjs` config.
- **`src/view/libavoidTokenGuard.test.ts`** (new) — CI-enforced invariant (pattern of
  `importGuard.test.ts`): builds the production bundle in-memory (`write:false`, reusing
  `bundleContentOptions`, so no drift and no reliance on a possibly-stale on-disk `main.js`)
  and asserts it contains none of the 3 network tokens.
- Deleted the scratch research note `docs-internal/notes/tmp/libavoid-fetch-token-research.md`
  (its header said to delete once the ticket landed).

### Open questions — answered

1. **Byte injection.** `AvoidLib.load(filePath?)` exposes no byte seam. The node build's
   Emscripten module DOES honour `Module.wasmBinary`; we inject it via the esbuild `onLoad`
   transform (documented above). Confirmed working.
2. **Electron.** PROVEN: `npm run test:e2e -- edgeRouting.e2e.ts` is green — bent
   (obstacle-avoiding) edges + facing-side attachment both render, which is impossible unless
   the wasm instantiated in Obsidian's renderer. `vicinityGraph.e2e.ts` also green (clean
   plugin init, no `import.meta` throw). So `process.release.name === "node"` holds in the
   Obsidian Electron renderer and the node build's environment gate passes.
3. **New tokens.** The node build adds `readFileSync` (×1) and `createRequire` (×1) to
   `main.js`. These are FS, not network — not the network "risk" badge this ticket targets —
   and both are effectively dead (`wasmBinary` short-circuits the `readFileSync` path;
   `createRequire` only requires builtins). No worse flag traded in.

### Verification run

- `grep -Eco 'fetch\(|XMLHttpRequest|instantiateStreaming' main.js` → **0**.
- `npm run check` → pass. `npm test` → 1870 pass (incl. the new token guard + the real-wasm
  node-build integration test in `edgeRouting.test.ts`).
- e2e: `edgeRouting.e2e.ts` (2 pass) + `vicinityGraph.e2e.ts` (27 pass) on the pinned build.
  The two-version release e2e matrix was NOT run here (that is the release gate).

### Not-yet-published note

Per CLAUDE.md's clean-breaks rule (plugin unpublished): the data-URL loader path was removed
outright, no back-compat. Nothing persisted changed. Call this out in the release note when
the plugin ships: "libavoid switched to its node build to drop false-positive network flags."

