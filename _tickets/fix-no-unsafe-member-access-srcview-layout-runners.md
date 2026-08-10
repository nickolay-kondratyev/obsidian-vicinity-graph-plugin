---
closed_iso: 2026-08-10T23:53:01Z
session_ids: [{a: claude, type: execution, id: ab30b493-12f1-48aa-b94a-7e4702c22cb1}, {a: claude, type: review, id: eba3a9da-c310-44ce-91f9-806a89987523}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_ymugwkesjh70astiz9bffzu26_e
title: "fix no-unsafe-member-access: src/view layout runners"
status: closed
deps: [nid_zyv1x5w08difwfdopm50bt2lu_e]
links: [nid_ez80034jh0f5mba3hgegc0lvq_e, nid_1fzz9jrjbnaa3iky57nmmckfc_e, nid_weo2x5v4mks9ge9bf642u0hg4_e, nid_d2ditwyebmdlyg3ktb3li0r3d_e, nid_6kz4747paujgvor7ftnav1xz6_e, nid_epspxsqa74z7vnpu7846ou5sl_e, nid_dq0439hrj3lj7edst73p6a9ic_e, nid_cinizzkohsf4r3hn48qvdfvzt_e]
created_iso: 2026-08-10T22:26:31Z
status_updated_iso: 2026-08-10T23:53:01Z
type: chore
priority: 3
assignee: nickolaykondratyev
tags: [lint, view]
---

The Obsidian pre-publish check reports `@typescript-eslint/no-unsafe-member-access` warnings. Parent ticket nid_1iskliqzhf6k4euouhn44phiq_e split the full file list into per-group fix tickets so each fits a reasonable context window; this is one such group.\n\nFix every `@typescript-eslint/no-unsafe-member-access` warning in the files below by giving the accessed values real types (or narrowing via a type guard / assertion at a typed seam) rather than blanket-disabling the rule. In test/e2e code, prefer typing Playwright `evaluate` return values and DOM-query results; do NOT weaken assertions or introduce silent fallbacks (repo rule: tests must fail explicitly, never fake-pass). Keep engine/shared layering guards intact.\n\nPREREQUISITE: depends on nid_zyv1x5w08difwfdopm50bt2lu_e (wire ESLint typed-lint locally). VERIFY each file with the single-file lint command that ticket documents, e.g. `npx eslint <file>`, and confirm zero `no-unsafe-member-access` warnings remain. Then run `npm run check` (and, for src/view changes, the relevant `npm run test:e2e` spec) to confirm no regression.\n\nFiles in this group:\n- src/view/ElkLayoutRunner.ts\n- src/view/GraphLayoutRunner.ts\n- src/view/elkMapping.ts\n- src/view/d3ForceRefinement.ts\n- src/view/libavoidLoader.ts

## Resolution (2026-08-10)

**No code change required — all five files were already clean under the wired typed-lint config.**

Verified against the prerequisite's local ESLint (`eslint.config.mjs`, the
`eslint-plugin-obsidianmd` recommended stack with the type-aware `projectService`
parser — the same stack the Obsidian pre-publish check uses):

- `npx eslint <each file>` -> **0 messages** on every one of the five files (not
  just zero `no-unsafe-member-access` — zero problems of any kind).
- `npx eslint --print-config src/view/elkMapping.ts` confirms the rule is live
  (`@typescript-eslint/no-unsafe-member-access: [2]`, error) with
  `typescript-eslint/parser` and a real TS program, so the clean result is genuine,
  not the rule silently failing to fire or the files being ignored.
- No suppression: no `eslint-disable`, `@ts-*`, `as any`, or `: any` in any of the
  five (the only "any" is a word in a `d3ForceRefinement.ts` comment).
- `git log main..HEAD` and `git diff main..HEAD` show these files were **not**
  touched on this branch — they were already type-safe on `main`.

**Why the ticket listed them anyway:** the parent ticket
(`nid_1iskliqzhf6k4euouhn44phiq_e`) split a file list captured from an earlier
pre-publish run. These layout runners were subsequently authored/refactored to be
type-safe at their untyped-library seams before this fix ticket executed — most
visibly `libavoidLoader.ts`, whose focused `Avoid` WebIDL interface (with an index
signature for the long enum tail) exists specifically to avoid `as number`/unsafe
access on the untyped `libavoid-js` binding; `elkjs` and `d3-force` are covered by
their `@types` packages. So the snapshot was stale by the time this ticket ran.

**Regression check:** `npm run check` (tsc strict for `src/` + `e2e/`) -> exit 0.
No `src/view` behavior changed, so no e2e run was warranted (no DOM/CSS/settings
change). Other `no-unsafe-member-access` warnings remain elsewhere in `src`
(`VaultFileStore.ts`, `LinkPreviewDrawer.tsx`, `SettingsRowView.tsx`, several
`*.test.ts(x)`) — those belong to the sibling fix tickets, not this group.

