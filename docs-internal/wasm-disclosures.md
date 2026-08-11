# WASM submission disclosures (libavoid-js)

Ready-to-paste responses for the WASM findings the Obsidian community-plugin
review scorecard raises on submission. The user-facing version of this lives in
[`README.md`](../README.md) → *Bundled WebAssembly (edge-routing engine)*; keep
the two in sync. Ticket: `nid_zzw9tlrhewemtp1zx5yx05pp8_e`.

## The module, in one line

`main.js` embeds **libavoid-js 0.4.5** (`node_modules/libavoid-js/dist/libavoid.wasm`,
~474 KB): a WebAssembly build of **libavoid**, the C++ orthogonal
connector-routing library from the [Adaptagrams](https://github.com/mjwybrow/adaptagrams)
project, compiled with Emscripten. Upstream: https://github.com/Aksem/libavoid-js.
License: LGPL-2.1-or-later. It computes the orthogonal edge routes between graph
nodes — the plugin's core feature and the reason the WASM is present.

## Per-finding responses

**"Plugin references unrecognized WASM files / All WASM modules should be
documented."**
> The single WASM module is libavoid-js 0.4.5 — an Emscripten build of the
> Adaptagrams `libavoid` orthogonal edge-routing library (C++, LGPL-2.1-or-later,
> https://github.com/Aksem/libavoid-js). It is embedded as raw bytes in `main.js`
> and used to route the connectors drawn between graph nodes. It is documented in
> the plugin README under "Bundled WebAssembly (edge-routing engine)".

**"WASM module imports WASI stdio functions (`fd_write`, `proc_exit`, …). Typical
of Rust/C compiled WASM."**
> Correct and expected: these are emitted by Emscripten's C/C++ runtime for
> `abort`/panic handling. The plugin does no terminal or file I/O through the
> module; in normal operation it reads and writes no streams. As the finding
> itself notes, these imports are low risk.

**"WASM module exports its linear memory."**
> This is Emscripten's default and is the mechanism by which the thin JS binding
> exchanges data with the engine: node bounding rectangles are written into the
> module's heap, and the routed connector poly-lines are read back out. The
> exported memory is the module's own private heap — it is not access to the
> vault, the filesystem, or the Obsidian host, none of which the WASM sandbox can
> reach. Only geometry crosses the boundary; no note contents, paths, or metadata
> are passed to the engine.

## Supporting facts a reviewer can verify

- **Offline load, no network.** The wasm is instantiated from the embedded bytes,
  never fetched. The plugin bundles libavoid-js's *node* build specifically so the
  shipped code contains none of the web build's `fetch(` / `instantiateStreaming`
  tokens; `src/view/libavoidTokenGuard.test.ts` fails the build if any reappear.
  Rationale in `esbuild.config.mjs` and `src/view/libavoidLoader.ts`.
- **Bounded binding surface.** The exact libavoid API the plugin calls is
  enumerated and typed in `src/view/libavoidLoader.ts`; the routing pass that
  drives it (and the only data handed across) is `src/view/edgeRouting.ts`.
- **No `.wasm` sidecar ships** — the bytes live inside `main.js` (loader
  `'.wasm': 'binary'` in `esbuild.config.mjs`).
