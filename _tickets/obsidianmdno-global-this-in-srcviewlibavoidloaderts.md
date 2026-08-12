---
closed_iso: 2026-08-12T00:34:00Z
session_ids: [{"a": "claude", "type": "execution", "id": "1bf93ea6-d7fe-4e24-a610-5dd3ac57ee40"}, {"a": "claude", "type": "review", "id": "b087c294-9b3c-40db-8d71-41271955d350"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_l17hhil9b22jas1lwvyfgxp5w_e
title: "obsidianmd/no-global-this in src/view/libavoidLoader.ts"
status: closed
deps: []
links: [nid_qjuqgqfwentq2l59o5ya17vra_e, nid_tbqtxmq5gyjr9ehrpk87bcje6_e, nid_6q26wh2r8ivgbeedpf17t31ry_e, nid_uyj3is3eyv9o3ctkv2meqcin7_e, nid_h2hs9s7uvugweohv076dvddpm_e, nid_zs2aog8b2i9e3wutsorjm88ft_e, nid_icr9gp534nm6kgkbc8rgcpu68_e, nid_nioldkusdrwc7fqzr4bmq2bow_e]
created_iso: 2026-08-11T21:26:40Z
status_updated_iso: 2026-08-12T00:34:00Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [lint, release]
---

`obsidianmd/no-global-this` at src/view/libavoidLoader.ts:158 — the libavoid WASM loader references `globalThis`. Investigate whether this is required by the WASM glue (it may be, for module bootstrapping). If avoidable, scope to `window`/a local; if genuinely required, add a narrowly-scoped eslint-disable with a WHY comment citing the WASM loader constraint. Verify: `npx eslint src/view/libavoidLoader.ts`. Do NOT touch e2e.

## Resolution

**The `globalThis` is genuinely required — it was NOT scoped to `window`.**

WHY: esbuild's node-build plugin injects the LITERAL token
`globalThis.__VICINITY_LIBAVOID_WASM_BINARY__` into the bundle as the Emscripten
`wasmBinary` source (`esbuild.config.mjs`, `LIBAVOID_WASM_BINARY_GLOBAL`). The
loader's publish (`libavoidLoader.ts` `initAvoid`) must land the embedded wasm
bytes on the EXACT object that injected read dereferences. The libavoid load is a
process-wide singleton shared across every Obsidian popout, and in a popout
`activeWindow !== globalThis`, so scoping to `window`/`activeWindow` (the rule's
suggestion) would strand the bytes on the wrong object and break the handoff.
`globalThis` is the correct single cross-window global for this.

**Mechanism (matches existing repo precedent, not an inline disable).** Inline
`eslint-disable` for `obsidianmd/*` rules is BANNED in this repo by
`eslint-comments/no-restricted-disable` (surfaced when I first tried it). The
sanctioned mechanism — already used for `VicinityGraphSettingTab.ts` in
`eslint.config.mjs` — is a file-scoped rule override. So:

- `eslint.config.mjs`: added a `files: ["src/view/libavoidLoader.ts"]` block
  turning `obsidianmd/no-global-this` `off`, with a full WHY comment.
- `src/view/libavoidLoader.ts`: expanded the `initAvoid` WHY comment explaining
  the `globalThis`↔esbuild coupling and pointing at the config scope-off.

**Verification:** `npx eslint src/view/libavoidLoader.ts` → exit 0 (clean).
`npm run check` (tsc strict) → exit 0. No behavior change (comment + config
only); e2e untouched.

