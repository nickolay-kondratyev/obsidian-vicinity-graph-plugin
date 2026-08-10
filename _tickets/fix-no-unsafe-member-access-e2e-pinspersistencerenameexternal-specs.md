---
closed_iso: 2026-08-10T23:22:26Z
session_ids: [{a: claude, type: execution, id: b6f4c579-05be-4e86-8eab-0cdecf94dad8}, {a: claude, type: review, id: d10acd16-8ae6-4bb1-a7fa-24c42906e8a7}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_d2ditwyebmdlyg3ktb3li0r3d_e
title: "fix no-unsafe-member-access: e2e pins/persistence/rename/external specs"
status: closed
deps: [nid_zyv1x5w08difwfdopm50bt2lu_e]
links: [nid_ez80034jh0f5mba3hgegc0lvq_e, nid_1fzz9jrjbnaa3iky57nmmckfc_e, nid_weo2x5v4mks9ge9bf642u0hg4_e, nid_6kz4747paujgvor7ftnav1xz6_e, nid_epspxsqa74z7vnpu7846ou5sl_e, nid_dq0439hrj3lj7edst73p6a9ic_e, nid_ymugwkesjh70astiz9bffzu26_e, nid_cinizzkohsf4r3hn48qvdfvzt_e]
created_iso: 2026-08-10T22:26:30Z
status_updated_iso: 2026-08-10T23:22:26Z
type: chore
priority: 3
assignee: nickolaykondratyev
tags: [lint, e2e]
---

The Obsidian pre-publish check reports `@typescript-eslint/no-unsafe-member-access` warnings. Parent ticket nid_1iskliqzhf6k4euouhn44phiq_e split the full file list into per-group fix tickets so each fits a reasonable context window; this is one such group.\n\nFix every `@typescript-eslint/no-unsafe-member-access` warning in the files below by giving the accessed values real types (or narrowing via a type guard / assertion at a typed seam) rather than blanket-disabling the rule. In test/e2e code, prefer typing Playwright `evaluate` return values and DOM-query results; do NOT weaken assertions or introduce silent fallbacks (repo rule: tests must fail explicitly, never fake-pass). Keep engine/shared layering guards intact.\n\nPREREQUISITE: depends on nid_zyv1x5w08difwfdopm50bt2lu_e (wire ESLint typed-lint locally). VERIFY each file with the single-file lint command that ticket documents, e.g. `npx eslint <file>`, and confirm zero `no-unsafe-member-access` warnings remain. Then run `npm run check` (and, for src/view changes, the relevant `npm run test:e2e` spec) to confirm no regression.\n\nFiles in this group:\n- e2e/localPinScenario.e2e.ts\n- e2e/pinnedCentralScenario.e2e.ts\n- e2e/referenceProvenance.e2e.ts\n- e2e/perFileStorePersistence.e2e.ts\n- e2e/noteRename.e2e.ts\n- e2e/externalVault.e2e.ts


## Resolution

Of the six files, five (localPinScenario, pinnedCentralScenario, perFileStorePersistence, noteRename, externalVault) already had **zero** `no-unsafe-member-access` warnings — resolved by prior sibling-ticket merges into this branch. Verified via `npx eslint <file>`.

Only `e2e/referenceProvenance.e2e.ts` still carried them (10 occurrences), all stemming from `window.app` being cast to `{ app: any }` and the `metadataCache.getFileCache(...)` cache/reference values flowing through as `any`.

Fix — typed the seam rather than disabling the rule:
- Extended the shared narrow app model in `e2e/obsidianInternals.ts`: added `metadataCache: E2eMetadataCache` to `E2eObsidianApp`, plus new `E2eMetadataCache` (`getFileCache(file): E2eCachedMetadata | null`), `E2eCachedMetadata` (optional `links`/`embeds`/`frontmatterLinks` arrays), and `E2eReference` (`link: string`, optional `original`). Narrow mirror of Obsidian's real `CachedMetadata`/`Reference`, consistent with the module's "no `obsidian` runtime" rule.
- `referenceProvenance.e2e.ts`: cast `window` to `{ app: E2eObsidianApp }` (type-only import, erased before the `page.evaluate` serializes), and rewrote the observation block with explicit null-guards that **throw** (`fixture note not in vault` / `no file cache`) instead of dereferencing `any`. `slim()` now takes a typed `readonly { link; original? }[]` and returns `ObservedReference[]`. No assertion weakened; the throw-guards strengthen the spec (explicit failure vs. a downstream TypeError).

Left in place: the pre-existing `no-console` error on the `[observed]` log line — a different rule, deliberately kept and out of this ticket's scope.

Verification: `npx eslint` across all six files → 0 `no-unsafe-member-access`; `npm run check` (tsc strict, src + e2e) green; `npm run test:e2e -- referenceProvenance.e2e.ts` → 4/4 passing.

## Notes

**2026-08-10T23:23:52Z**

__READY_AS_IS__: focused lint fix; 0 no-unsafe-member-access remain across all 6 files, npm run check green, seam typed via import type (erased), guards throw not weaken. No changes needed.
