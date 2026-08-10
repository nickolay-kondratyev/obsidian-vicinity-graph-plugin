---
closed_iso: 2026-08-10T23:47:43Z
session_ids: [{a: claude, type: execution, id: b59d6357-01b2-435a-a195-dfe7d759c4e6}, {a: claude, type: review, id: f8ab9321-a710-4dd2-bcbc-6205407b5e31}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_weo2x5v4mks9ge9bf642u0hg4_e
title: "fix no-unsafe-member-access: e2e settings specs"
status: closed
deps: [nid_zyv1x5w08difwfdopm50bt2lu_e]
links: [nid_ez80034jh0f5mba3hgegc0lvq_e, nid_1fzz9jrjbnaa3iky57nmmckfc_e, nid_d2ditwyebmdlyg3ktb3li0r3d_e, nid_6kz4747paujgvor7ftnav1xz6_e, nid_epspxsqa74z7vnpu7846ou5sl_e, nid_dq0439hrj3lj7edst73p6a9ic_e, nid_ymugwkesjh70astiz9bffzu26_e, nid_cinizzkohsf4r3hn48qvdfvzt_e]
created_iso: 2026-08-10T22:26:30Z
status_updated_iso: 2026-08-10T23:47:43Z
type: chore
priority: 3
assignee: nickolaykondratyev
tags: [lint, e2e]
---

The Obsidian pre-publish check reports `@typescript-eslint/no-unsafe-member-access` warnings. Parent ticket nid_1iskliqzhf6k4euouhn44phiq_e split the full file list into per-group fix tickets so each fits a reasonable context window; this is one such group.\n\nFix every `@typescript-eslint/no-unsafe-member-access` warning in the files below by giving the accessed values real types (or narrowing via a type guard / assertion at a typed seam) rather than blanket-disabling the rule. In test/e2e code, prefer typing Playwright `evaluate` return values and DOM-query results; do NOT weaken assertions or introduce silent fallbacks (repo rule: tests must fail explicitly, never fake-pass). Keep engine/shared layering guards intact.\n\nPREREQUISITE: depends on nid_zyv1x5w08difwfdopm50bt2lu_e (wire ESLint typed-lint locally). VERIFY each file with the single-file lint command that ticket documents, e.g. `npx eslint <file>`, and confirm zero `no-unsafe-member-access` warnings remain. Then run `npm run check` (and, for src/view changes, the relevant `npm run test:e2e` spec) to confirm no regression.\n\nFiles in this group:\n- e2e/settingsDependentRows.e2e.ts\n- e2e/settingsResetReview.e2e.ts\n- e2e/settingsResetVerify.e2e.ts\n- e2e/settingsTypedInput.e2e.ts\n- e2e/settingsUxVisual.e2e.ts

## Resolution (2026-08-10)

All five files already carry **zero** `@typescript-eslint/no-unsafe-member-access`
warnings — the fixes were landed as part of this ticket's prior execution
session, via the e2e settings-spec commits that typed the Playwright
`page.evaluate` return values and DOM-query results (see `git log` for these
files: `7170c240` "type into the settings tab's number and textarea inputs",
`79ca22a9` "make the settings flush-on-leaving claims falsifiable",
`c7f7d399` "align specs with content-fit sizing", `ec70c002`).

Verification (with the ESLint typed-lint config wired by the prerequisite
`nid_zyv1x5w08difwfdopm50bt2lu_e`):

- `npx eslint <file>` on each of the five files → 0 `no-unsafe-member-access`.
- The rule is confirmed ENABLED and firing: a repo-wide `eslint e2e src` reports
  2 remaining `no-unsafe-member-access` errors, both `.mockRestore on an any`
  in `src/view/*.component.test.tsx` — OUT of this group's scope (other tickets).
- `npm run check` (tsc strict for src/ + e2e/) passes, exit 0 — no regression.

No source changes were needed in this session; the scope was already satisfied.
The five files do still carry other, unrelated lint findings (no-console,
prefer-create-el, no-unused-vars, unbound-method) that belong to their own
per-rule fix tickets, not this `no-unsafe-member-access` group.

