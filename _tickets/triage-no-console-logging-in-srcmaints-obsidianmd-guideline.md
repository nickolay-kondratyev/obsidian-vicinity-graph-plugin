---
closed_iso: 2026-08-12T00:27:55Z
session_ids: [{"a": "claude", "type": "execution", "id": "25b78d41-7244-41a8-919d-a742e9a08346"}, {"a": "claude", "type": "review", "id": "b0823a94-0653-4ceb-a792-bb549e01624a"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_h2hs9s7uvugweohv076dvddpm_e
title: "Triage no-console logging in src/main.ts (obsidianmd guideline)"
status: closed
deps: []
links: [nid_qjuqgqfwentq2l59o5ya17vra_e, nid_tbqtxmq5gyjr9ehrpk87bcje6_e, nid_6q26wh2r8ivgbeedpf17t31ry_e, nid_uyj3is3eyv9o3ctkv2meqcin7_e, nid_l17hhil9b22jas1lwvyfgxp5w_e, nid_zs2aog8b2i9e3wutsorjm88ft_e, nid_icr9gp534nm6kgkbc8rgcpu68_e, nid_nioldkusdrwc7fqzr4bmq2bow_e]
created_iso: 2026-08-11T21:26:40Z
status_updated_iso: 2026-08-12T00:27:55Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [lint, release]
---

`eslint-plugin-obsidianmd` reports 13 `no-console` findings (rule id surfaces as `obsidianmd/rule-custom-message`) in src/main.ts — the debug command `logVicinityGraph` (console.log/console.table around lines 284-350) and the orphan-sweep logs (~269, 273). Obsidian guidelines discourage console logging in shipped plugins.

Triage, do not blanket-delete: drop the debug/dev `console.log`/`console.table` (the `debug-log-vicinity-graph` command is a dev harness — consider removing the command too), keep any deliberate error reporting but route user-facing failures through `Notice`/the existing UserNoticePort rather than console. Verify: `npx eslint src/main.ts | grep -c no-console`. Do NOT touch e2e.

---

## Resolution (2026-08-11)

All 13 `no-console` findings were `console.log`/`console.table`; `npx eslint src/main.ts | grep -c no-console` now returns **0**.

Key triage fact: the `obsidianmd` `no-console` rule **allows `console.error`** — the two `console.error` calls (delete-cleanup failure ~line 229, orphan-sweep failure) were never among the 13 findings. Both are background-maintenance error reporting with **no user-facing action to report against** (a live `vault.on('delete')` cleanup and a delayed timer sweep, neither triggered by a user gesture), so routing them through `Notice`/`UserNoticePort` would surface toasts for invisible internal work. They were **kept on `console.error`** as deliberate diagnostics — consistent with the ticket's "keep any deliberate error reporting". A short WHY comment now records that at the sweep call site.

Changes in `src/main.ts`:
- **Removed** the `debug-log` command (`addCommand`) and both dev-harness methods it drove: `logVicinityGraph` and `logBacklinkProvenance` (all 11 debug `console.log`/`console.table` calls).
- **Removed** the orphan-sweep success `console.log` (the `.then(summary => …)` block); kept the `.catch` → `console.error`.
- **Removed** now-unused imports: `type { TFile }`, `asVaultPath` (from `./engine`), `BacklinksAdapter`, `ObsidianLinkProvider`.
- Updated the `graphBuilder` doc comment (dropped its "and the debug command" clause).

Verification: `npx eslint src/main.ts` clean, `npm run check` (tsc + check:e2e) passes, `npm test` 1871/1871 pass. e2e not touched (per ticket) and not needed — no rendered graph/panel/settings surface changed; the removed command had zero references in `src/` or `e2e/`. No behavior a user or test depended on was removed (the debug command was a manual-QA harness only).


## Notes

**2026-08-12T00:29:13Z**

__READY_AS_IS__: Clean dev-harness removal; eslint no-console=0, tsc check passes, no dangling refs, kept console.error justified.
