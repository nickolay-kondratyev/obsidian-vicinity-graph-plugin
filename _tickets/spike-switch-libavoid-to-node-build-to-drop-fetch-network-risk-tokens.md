---
session_ids: [{"a": "claude", "type": "execution", "id": "2e369365-1da4-4495-aaf3-2ca927aac5cc"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_9sf1iftrf914ggxv3jv3r60sw_e
title: "Spike: switch libavoid to node build to drop fetch network-risk tokens"
status: in_progress
deps: []
links: []
created_iso: 2026-08-11T18:30:24Z
status_updated_iso: 2026-08-11T18:34:13Z
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

