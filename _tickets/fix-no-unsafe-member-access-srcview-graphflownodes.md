---
closed_iso: 2026-08-10T23:27:15Z
session_ids: [{a: claude, type: execution, id: eba67cad-496b-48b0-af75-4a3661e1772e}, {a: claude, type: review, id: 5ee8d6a8-3a18-49ab-bfc3-823ea3f66e16}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_dq0439hrj3lj7edst73p6a9ic_e
title: "fix no-unsafe-member-access: src/view graph/flow/nodes"
status: closed
deps: [nid_zyv1x5w08difwfdopm50bt2lu_e]
links: [nid_ez80034jh0f5mba3hgegc0lvq_e, nid_1fzz9jrjbnaa3iky57nmmckfc_e, nid_weo2x5v4mks9ge9bf642u0hg4_e, nid_d2ditwyebmdlyg3ktb3li0r3d_e, nid_6kz4747paujgvor7ftnav1xz6_e, nid_epspxsqa74z7vnpu7846ou5sl_e, nid_ymugwkesjh70astiz9bffzu26_e, nid_cinizzkohsf4r3hn48qvdfvzt_e]
created_iso: 2026-08-10T22:26:31Z
status_updated_iso: 2026-08-10T23:27:15Z
type: chore
priority: 3
assignee: nickolaykondratyev
tags: [lint, view]
---

The Obsidian pre-publish check reports `@typescript-eslint/no-unsafe-member-access` warnings. Parent ticket nid_1iskliqzhf6k4euouhn44phiq_e split the full file list into per-group fix tickets so each fits a reasonable context window; this is one such group.\n\nFix every `@typescript-eslint/no-unsafe-member-access` warning in the files below by giving the accessed values real types (or narrowing via a type guard / assertion at a typed seam) rather than blanket-disabling the rule. In test/e2e code, prefer typing Playwright `evaluate` return values and DOM-query results; do NOT weaken assertions or introduce silent fallbacks (repo rule: tests must fail explicitly, never fake-pass). Keep engine/shared layering guards intact.\n\nPREREQUISITE: depends on nid_zyv1x5w08difwfdopm50bt2lu_e (wire ESLint typed-lint locally). VERIFY each file with the single-file lint command that ticket documents, e.g. `npx eslint <file>`, and confirm zero `no-unsafe-member-access` warnings remain. Then run `npm run check` (and, for src/view changes, the relevant `npm run test:e2e` spec) to confirm no regression.\n\nFiles in this group:\n- src/view/VicinityGraphFlow.tsx\n- src/view/VicinityGraphView.tsx\n- src/view/NoteNode.tsx\n- src/view/FolderGroupNode.tsx\n- src/view/NodeOutline.tsx\n- src/view/VicinityEdge.tsx\n- src/view/nodeResize.ts\n- src/view/DrawerResizeHandle.tsx


## Resolution (2026-08-10)

No code change was required — all 8 files in this group already emit **zero**
`@typescript-eslint/no-unsafe-member-access` warnings under the settled
type-aware ESLint config (`eslint.config.mjs`, wired by the prerequisite
`nid_zyv1x5w08difwfdopm50bt2lu_e`).

### How this was verified
- Per-file: `npx eslint <file>` on each of the 8 files → 0 `no-unsafe-member-access`
  each (counted from `-f json`). The only remaining warning in the group is one
  out-of-scope `obsidianmd/prefer-window-timers` at `VicinityGraphFlow.tsx:355` —
  a different rule, not this ticket's scope.
- Rule-is-live sanity check: a full `npx eslint src e2e` pass reports 28
  `no-unsafe-member-access` errors across OTHER files (several `e2e/*.e2e.ts`,
  `GraphViewController.test.ts`, and — notably — `VicinityGraphFlow.component.test.tsx`,
  a `src/view` sibling). That confirms the config is not ignoring the view
  directory; these production `.tsx`/`.ts` files are simply well-typed React
  components with no `any`-valued member access. No `eslint-disable` / `no-unsafe`
  suppression comments exist in any of the 8 files (`grep` → none), so the clean
  result is genuine typing, not a blanket disable.
- Regression gate: `npm run check` (tsc strict for src/ + e2e/) → exit 0.

No `src/view` behavior changed, so no `test:e2e` spec run was warranted. The
remaining 28 warnings belong to OTHER per-group fix tickets (the
`.component.test.tsx` / `.test.ts` / `e2e` groups), not this one.
