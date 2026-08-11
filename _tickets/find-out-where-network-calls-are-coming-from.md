---
closed_iso: 2026-08-11T14:59:01Z
id: nid_snrc13nuv21y30lv26m9z1e3c_e
title: Find out where network calls are coming from
status: closed
deps: []
links: []
created_iso: '2026-08-11T14:56:36Z'
status_updated_iso: 2026-08-11T14:59:01Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Obsidian scanner found network calls
```
Number of network request calls
All network requests should be necessary and disclosed to users.
2 network calls
```
Find where the scanner may be thinking we are making network calls
(previously in plugins it would pick up false positives like LRU cache .fetch() )

## Resolution (2026-08-11) — FALSE POSITIVE, no code change needed

Both "network calls" are the two `fetch(` occurrences the scanner finds in the
built `main.js`. Both live inside the **Emscripten WASM-loader glue bundled from
`libavoid-js`** (the orthogonal edge-routing engine) — not in our own code:

1. `getBinaryPromise`: `fetch(G, {credentials:"same-origin"})` — loads the wasm
   binary from a URL.
2. `instantiateStreaming` path: `fetch(Ze, {credentials:"same-origin"})` — streams
   the wasm for `WebAssembly.instantiateStreaming`.

These are identifiable by their Emscripten markers in `main.js`
(`credentials:"same-origin"`, `instantiateStreaming`, `"failed to load wasm binary
file"`). They are the standard Emscripten pattern for fetching a wasm module over
the network — but **that branch never runs in this plugin**.

Our loader (`src/view/libavoidLoader.ts`) ships the wasm embedded as base64 and
hands Emscripten a **`data:` URL** (`AvoidLib.load(WASM_DATA_URL)`), so `fetch()`
resolves the embedded bytes locally with **zero network egress**. See the module
header and `initAvoid()` — the PRIMARY `data-url` path is explicitly offline.

Verified there are no other network primitives in `main.js`: no
`XMLHttpRequest`, `WebSocket`, `navigator.sendBeacon`, `.ajax(`, or Obsidian
`requestUrl`.

**Conclusion:** identical to the noted false-positive class (e.g. LRU cache
`.fetch()`). The plugin makes no actual network requests; the count comes from
dead network branches in a bundled wasm loader. Nothing to fix or disclose as a
real network call.
