---
closed_iso: 2026-08-11T22:39:05Z
session_ids: [{"a": "claude", "type": "execution", "id": "8a688c43-3a94-4198-bf13-5a086dfe8329"}, {"a": "claude", "type": "review", "id": "55953d28-0001-45c5-84ff-e8e625a66137"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_6q26wh2r8ivgbeedpf17t31ry_e
title: "obsidianmd/prefer-window-timers: use window.setTimeout in 3 src files"
status: closed
deps: []
links: [nid_qjuqgqfwentq2l59o5ya17vra_e, nid_tbqtxmq5gyjr9ehrpk87bcje6_e, nid_uyj3is3eyv9o3ctkv2meqcin7_e, nid_h2hs9s7uvugweohv076dvddpm_e, nid_l17hhil9b22jas1lwvyfgxp5w_e, nid_zs2aog8b2i9e3wutsorjm88ft_e, nid_icr9gp534nm6kgkbc8rgcpu68_e, nid_nioldkusdrwc7fqzr4bmq2bow_e]
created_iso: 2026-08-11T21:26:40Z
status_updated_iso: 2026-08-11T22:39:05Z
type: chore
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [lint, release]
---

`obsidianmd/prefer-window-timers` (auto-fixable). Replace bare `setTimeout`/`setInterval` with `window.setTimeout`/`window.setInterval` at:
- src/persistence/ChunkedWork.ts:34
- src/persistence/PluginDataStore.ts:57
- src/view/VicinityGraphFlow.tsx:355

Run `npx eslint src --fix` for these, then eyeball the diff (confirm no behavior change; return-type is `number` under `window.*`). Verify clean: `npx eslint src | grep prefer-window-timers` (empty = done). Do NOT touch e2e.

---

## Resolution (done)

`prefer-window-timers` is now clean across `src` — `npx eslint src | grep prefer-window-timers`
returns empty. `npm run check` (tsc) and `npm test` (131 files / 1870 tests) both pass.

### What changed (the three source sites)

The ticket's line numbers were stale; `grep` located the live sites. Bare timer
globals → `window.*`, mechanical swap, identical runtime behavior (all return a
`number` in the Obsidian/Electron renderer):

- `src/persistence/ChunkedWork.ts:34` — `setTimeout` → `window.setTimeout` (in `sleepZero`).
- `src/persistence/PluginDataStore.ts:57` — `setTimeout` → `window.setTimeout` (in `REAL_SLEEP`).
- `src/view/VicinityGraphFlow.tsx:355-356` — `requestAnimationFrame`/`cancelAnimationFrame`
  → `window.*`. (The site had moved off `setTimeout` to rAF since the ticket was filed;
  the rule flags the bare rAF globals the same way, and the paired `cancelAnimationFrame`
  was converted too so the pair stays consistent.)

### Did NOT run `npx eslint src --fix`

Ran it once as the ticket suggested and **reverted it** — with no path scope it
also applied a pile of unrelated autofixes across ~15 files (stripped type
casts, `globalThis`→`window` in tests, and — worst — mangled the compile-time
guardrail union assertions in `SettingsSpec.ts` / `settingsSectionFields.ts`
into empty `| ` members, silently weakening them). Out of scope and risky. The
three sites were edited by hand instead; the lint gate confirms the result.

### New test-infra choke point (why there are 2 extra files in the diff)

`ChunkedWork.sleepZero` is a low-level persistence primitive; several **node-env**
suites (`ChunkedWork`, `OrphanSweeper`, `DocIdMapWarmer` via it) actually invoke
it, and node-env has no `window` → `window.setTimeout` threw `ReferenceError`.
Rather than stub `window` per-file (whack-a-mole; the next node-env test to touch
the primitive breaks again), added ONE guard:

- `vitest.setup.ts` (new) — under node-env only (`typeof window === "undefined"`),
  point `window` at `globalThis` (which carries `setTimeout`). jsdom suites already
  own a real `window`, so the guard is a no-op for them.
- `vitest.config.ts` — registers it via `setupFiles`.

### e2e

Not run. The ticket said "do NOT touch e2e", the stated verification is
diff-eyeball + lint-grep, and the one view-layer edit is a `window.`-prefix swap
on rAF with zero rendered-behavior change (covered by the jsdom component
suites). No 200MB Obsidian provision was warranted for a mechanical prefix.

