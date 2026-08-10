---
closed_iso: 2026-08-10T23:17:39Z
session_ids: [{a: claude, type: execution, id: 1f319f44-f881-4c46-80d8-4f36669e276b}, {a: claude, type: review, id: 5a4ff594-198b-403b-ba6e-6f62f6f0a031}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_cinizzkohsf4r3hn48qvdfvzt_e
title: "fix no-unsafe-member-access: src/view link-preview + obsidian adapters + main"
status: closed
deps: [nid_zyv1x5w08difwfdopm50bt2lu_e]
links: [nid_ez80034jh0f5mba3hgegc0lvq_e, nid_1fzz9jrjbnaa3iky57nmmckfc_e, nid_weo2x5v4mks9ge9bf642u0hg4_e, nid_d2ditwyebmdlyg3ktb3li0r3d_e, nid_6kz4747paujgvor7ftnav1xz6_e, nid_epspxsqa74z7vnpu7846ou5sl_e, nid_dq0439hrj3lj7edst73p6a9ic_e, nid_ymugwkesjh70astiz9bffzu26_e]
created_iso: 2026-08-10T22:26:31Z
status_updated_iso: 2026-08-10T23:17:39Z
type: chore
priority: 3
assignee: nickolaykondratyev
tags: [lint, view]
---

The Obsidian pre-publish check reports `@typescript-eslint/no-unsafe-member-access` warnings. Parent ticket nid_1iskliqzhf6k4euouhn44phiq_e split the full file list into per-group fix tickets so each fits a reasonable context window; this is one such group.\n\nFix every `@typescript-eslint/no-unsafe-member-access` warning in the files below by giving the accessed values real types (or narrowing via a type guard / assertion at a typed seam) rather than blanket-disabling the rule. In test/e2e code, prefer typing Playwright `evaluate` return values and DOM-query results; do NOT weaken assertions or introduce silent fallbacks (repo rule: tests must fail explicitly, never fake-pass). Keep engine/shared layering guards intact.\n\nPREREQUISITE: depends on nid_zyv1x5w08difwfdopm50bt2lu_e (wire ESLint typed-lint locally). VERIFY each file with the single-file lint command that ticket documents, e.g. `npx eslint <file>`, and confirm zero `no-unsafe-member-access` warnings remain. Then run `npm run check` (and, for src/view changes, the relevant `npm run test:e2e` spec) to confirm no regression.\n\nFiles in this group:\n- src/view/LinkPreviewContent.tsx\n- src/view/LinkPreviewDrawer.tsx\n- src/view/GraphViewOpener.ts\n- src/view/ObsidianGraphUi.ts\n- src/view/ObsidianNoteNavigator.ts\n- src/main.ts


## Resolution (2026-08-10)

**No code changes required — all six files were already clean of the target rule.**

Prerequisite `nid_zyv1x5w08difwfdopm50bt2lu_e` (typed-lint wiring) is in place:
`eslint.config.mjs` runs the type-aware `typescript-eslint` stack via
`projectService: true`, so `@typescript-eslint/no-unsafe-member-access` fires.
Verified per-file with `npx eslint <file>`: **0** `no-unsafe-member-access`
warnings in each of the six files, and no `eslint-disable`/inline suppressions.

Confirmed the linter genuinely exercises these files (not silently skipping):
- They still report other diagnostics (`no-console`, `obsidianmd/commands/*`),
  so they are in lint scope.
- The rule fires **38** times elsewhere in `src`/`e2e` (`npx eslint src e2e`),
  proving it is active — the zero count here is a real pass, not a disabled rule.

`npm run check` (tsc `-noEmit` for src/ and e2e/) passes (exit 0); nothing
regressed. No src/view behavior changed, so no e2e run was warranted.

Matches sibling ticket `6c50004` ("close no-unsafe-member-access e2e harness
ticket (already fixed)"): these warnings were resolved by an earlier broader fix
pass before this ticket was picked up. Closing as already-satisfied.
