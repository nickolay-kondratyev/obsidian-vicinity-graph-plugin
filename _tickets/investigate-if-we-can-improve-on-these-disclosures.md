---
closed_iso: 2026-08-11T20:50:51Z
id: nid_zzw9tlrhewemtp1zx5yx05pp8_e
title: investigate if we can improve on these disclosures
status: closed
deps: []
links: []
created_iso: '2026-08-11T20:29:38Z'
status_updated_iso: 2026-08-11T20:50:51Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
We have the following disclosures pop up when submitting the obsidian plugin for publishing:
```
Plugin references unrecognized WASM files
Unrecognized .wasm files contain native binary code that cannot be statically reviewed. All WASM modules should be documented.
.wasm

WASM module (inline WASM blob #1) imports WASI stdio functions. Typical of Rust/C compiled WASM.

WASI stdio imports (fd_write, proc_exit, etc.) are commonly emitted by Rust and C compilers for panic handling and are generally low risk.

WASM module (inline WASM blob #1) exports its linear memory
    Exporting WASM memory allows the JavaScript host to directly read and write the module's entire address space.
```

We do need WASM modules to be able to do edge routing. The question though can we add some documentation that will be obsidian score card friendly regarding these modules?

---

## Resolution (2026-08-11) — DONE

Yes — documentation is the right (and only needed) fix here. All three findings
are inherent, low-risk properties of an Emscripten-compiled C++ module, not
plugin misbehaviour; the scorecard explicitly wants WASM modules *documented*, so
we documented them honestly and pointed the module at its upstream source.

The single WASM module is **libavoid-js 0.4.5** — an Emscripten build of the
Adaptagrams `libavoid` orthogonal edge-routing library (C++, LGPL-2.1-or-later,
https://github.com/Aksem/libavoid-js, ~474 KB embedded in `main.js`). It routes
the connectors drawn between graph nodes.

Changes made:

- **`README.md`** → new section *"Bundled WebAssembly (edge-routing engine)"*:
  identifies the module + upstream + license, states it loads offline from
  embedded bytes (no network, no sidecar), and addresses each scanner note —
  WASI stdio imports are Emscripten panic/abort plumbing (no I/O in normal use);
  exported linear memory is Emscripten's default marshalling seam (the module's
  own heap, not vault/host access); only node geometry crosses the boundary
  (rectangles in, poly-lines out — no note contents/paths/metadata). This is the
  user-facing, reviewer-discoverable documentation the scorecard asks for.
- **`docs-internal/wasm-disclosures.md`** (new): ready-to-paste disclosure
  responses, one per scorecard finding, plus verifiable supporting facts
  (offline-load token guard `src/view/libavoidTokenGuard.test.ts`, bounded
  binding surface in `src/view/libavoidLoader.ts` / `src/view/edgeRouting.ts`).
- **`docs-internal/RELEASE_CHECKLIST.md`**: pointer to the disclosures doc for
  when store submission happens (currently out of scope / deferred).

No code changes — the offline-load hardening that keeps network tokens out of the
bundle already existed (`esbuild.config.mjs` node-build + `libavoidTokenGuard`).
