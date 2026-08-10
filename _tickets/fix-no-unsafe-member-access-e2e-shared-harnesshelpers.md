---
closed_iso: 2026-08-10T23:13:40Z
session_ids: [{a: claude, type: execution, id: 24f9e97a-ecb2-4277-ad5b-2f8e12b66bea}, {a: claude, type: review, id: 8132fe41-dc47-45a0-b9a4-a089f0b5d11b}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_6kz4747paujgvor7ftnav1xz6_e
title: "fix no-unsafe-member-access: e2e shared harness/helpers"
status: closed
deps: [nid_zyv1x5w08difwfdopm50bt2lu_e]
links: [nid_ez80034jh0f5mba3hgegc0lvq_e, nid_1fzz9jrjbnaa3iky57nmmckfc_e, nid_weo2x5v4mks9ge9bf642u0hg4_e, nid_d2ditwyebmdlyg3ktb3li0r3d_e, nid_epspxsqa74z7vnpu7846ou5sl_e, nid_dq0439hrj3lj7edst73p6a9ic_e, nid_ymugwkesjh70astiz9bffzu26_e, nid_cinizzkohsf4r3hn48qvdfvzt_e]
created_iso: 2026-08-10T22:26:30Z
status_updated_iso: 2026-08-10T23:13:40Z
type: chore
priority: 3
assignee: nickolaykondratyev
tags: [lint, e2e]
---

The Obsidian pre-publish check reports `@typescript-eslint/no-unsafe-member-access` warnings. Parent ticket nid_1iskliqzhf6k4euouhn44phiq_e split the full file list into per-group fix tickets so each fits a reasonable context window; this is one such group.\n\nFix every `@typescript-eslint/no-unsafe-member-access` warning in the files below by giving the accessed values real types (or narrowing via a type guard / assertion at a typed seam) rather than blanket-disabling the rule. In test/e2e code, prefer typing Playwright `evaluate` return values and DOM-query results; do NOT weaken assertions or introduce silent fallbacks (repo rule: tests must fail explicitly, never fake-pass). Keep engine/shared layering guards intact.\n\nPREREQUISITE: depends on nid_zyv1x5w08difwfdopm50bt2lu_e (wire ESLint typed-lint locally). VERIFY each file with the single-file lint command that ticket documents, e.g. `npx eslint <file>`, and confirm zero `no-unsafe-member-access` warnings remain. Then run `npm run check` (and, for src/view changes, the relevant `npm run test:e2e` spec) to confirm no regression.\n\nFiles in this group:\n- e2e/buttonChrome.ts\n- e2e/nodeContentBox.ts\n- e2e/obsidianHarness.ts\n- e2e/settingsTabPage.ts\n- e2e/settingsWriteWindow.ts\n- e2e/vaultTarget.ts


## Resolution (2026-08-10)

No code changes were required — the target `no-unsafe-member-access` warnings
were already eliminated by sibling lint-fix commits that typed the shared
harness seam this file group covers:

- `667ac20` — "fix(e2e): type window.app seam to clear no-unsafe-call in harness helpers"
- `cf264d3` — "fix(e2e): mirror NodeOverrideChange content type exactly in harness seam"

`no-unsafe-call` and `no-unsafe-member-access` share the same root cause here
(an untyped `window.app` seam). Giving that seam a real type cleared BOTH
families at once, so by the time this ticket ran the member-access warnings were
already gone — fixed by real typing, not by disabling the rule.

Verification (branch HEAD 34fd4a1):

- `npx eslint <the 6 files>` → 14 warnings remain, ZERO are
  `no-unsafe-member-access`. The remainder are unrelated `obsidianmd/*` style
  warnings (prefer-create-el, prefer-window-timers, hardcoded-config-path) —
  out of scope for this lint ticket.
- `grep 'eslint-disable|no-unsafe'` across the 6 files → no matches; nothing is
  suppressed inline, so the clean result is genuine typing.
- Rule confirmed live: `npx eslint src e2e` still reports 38
  `no-unsafe-member-access` warnings repo-wide, so the zero count in this group
  is a real pass, not a disabled rule.
- `npm run check` (tsc strict, src + e2e) → exit 0, no regression.

Next reader: the remaining repo-wide `no-unsafe-member-access` warnings belong
to OTHER per-group tickets under parent nid_1iskliqzhf6k4euouhn44phiq_e.
