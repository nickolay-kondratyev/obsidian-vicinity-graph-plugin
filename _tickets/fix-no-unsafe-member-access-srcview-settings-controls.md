---
closed_iso: 2026-08-10T23:34:54Z
session_ids: [{a: claude, type: execution, id: 2c4fa28a-b397-4aec-b72f-38d9c10f46c3}, {a: claude, type: review, id: 3619d38d-c9d6-4d1e-a1ba-fb357258b60b}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_epspxsqa74z7vnpu7846ou5sl_e
title: "fix no-unsafe-member-access: src/view settings & controls"
status: closed
deps: [nid_zyv1x5w08difwfdopm50bt2lu_e]
links: [nid_ez80034jh0f5mba3hgegc0lvq_e, nid_1fzz9jrjbnaa3iky57nmmckfc_e, nid_weo2x5v4mks9ge9bf642u0hg4_e, nid_d2ditwyebmdlyg3ktb3li0r3d_e, nid_6kz4747paujgvor7ftnav1xz6_e, nid_dq0439hrj3lj7edst73p6a9ic_e, nid_ymugwkesjh70astiz9bffzu26_e, nid_cinizzkohsf4r3hn48qvdfvzt_e]
created_iso: 2026-08-10T22:26:31Z
status_updated_iso: 2026-08-10T23:34:54Z
type: chore
priority: 3
assignee: nickolaykondratyev
tags: [lint, view]
---

The Obsidian pre-publish check reports `@typescript-eslint/no-unsafe-member-access` warnings. Parent ticket nid_1iskliqzhf6k4euouhn44phiq_e split the full file list into per-group fix tickets so each fits a reasonable context window; this is one such group.\n\nFix every `@typescript-eslint/no-unsafe-member-access` warning in the files below by giving the accessed values real types (or narrowing via a type guard / assertion at a typed seam) rather than blanket-disabling the rule. In test/e2e code, prefer typing Playwright `evaluate` return values and DOM-query results; do NOT weaken assertions or introduce silent fallbacks (repo rule: tests must fail explicitly, never fake-pass). Keep engine/shared layering guards intact.\n\nPREREQUISITE: depends on nid_zyv1x5w08difwfdopm50bt2lu_e (wire ESLint typed-lint locally). VERIFY each file with the single-file lint command that ticket documents, e.g. `npx eslint <file>`, and confirm zero `no-unsafe-member-access` warnings remain. Then run `npm run check` (and, for src/view changes, the relevant `npm run test:e2e` spec) to confirm no regression.\n\nFiles in this group:\n- src/view/SettingsRowView.tsx\n- src/view/VicinityGraphSettingTab.ts\n- src/view/ToggleSwitch.tsx\n- src/view/useOptimisticValue.ts\n- src/view/rowRenderingSource.ts\n- src/view/ConfirmModal.ts

## Resolution (2026-08-10)

No code changes were required — all six files already carry **zero**
`@typescript-eslint/no-unsafe-member-access` warnings.

Verification on branch `nid_epspxsqa74z7vnpu7846ou5sl_e_fix-no-unsafe-member-access-src-view-set` (based on current `main`):

- Per-file `npx eslint <file>` on each of the six files → 0 `no-unsafe-member-access`.
- Full `npx eslint src e2e` (JSON) → the rule fires correctly: **28** `no-unsafe-member-access` remain repo-wide, but **none** in this group's files. Remaining hits are sibling-ticket scope (`e2e/*.e2e.ts`, `src/persistence/*`, other `src/view/*`), confirming the typed-lint prerequisite (`nid_zyv1x5w08difwfdopm50bt2lu_e`) is wired and the rule is not disabled.
- `npm run check` (tsc strict, src + e2e) → clean, exit 0.

Why already clean: these six files are presenters / thin view helpers that read values through the typed accessor + row seams. Those seams were given real types by the earlier merged view-layer sibling ticket `nid_dq0439hrj3lj7edst73p6a9ic_e` (merged into `main` at 1df767d), which this branch is based on — so the member-access warnings the parent ticket's snapshot attributed to this group were eliminated upstream before this ticket was picked up. The files themselves were last touched days before the ticket was created; no edits needed here.

No `src/view` behavior changed, so no e2e run was warranted.
