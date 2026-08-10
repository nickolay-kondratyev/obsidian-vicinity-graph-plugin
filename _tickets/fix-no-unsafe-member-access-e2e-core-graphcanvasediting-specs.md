---
closed_iso: 2026-08-10T23:42:06Z
session_ids: [{a: claude, type: execution, id: 70ba9581-ea67-48d4-b80e-9e8e9535857c}, {a: claude, type: review, id: b646a443-b7cb-4bd2-819a-c32256e715b1}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_ez80034jh0f5mba3hgegc0lvq_e
title: "fix no-unsafe-member-access: e2e core graph/canvas/editing specs"
status: closed
deps: [nid_zyv1x5w08difwfdopm50bt2lu_e]
links: [nid_1fzz9jrjbnaa3iky57nmmckfc_e, nid_weo2x5v4mks9ge9bf642u0hg4_e, nid_d2ditwyebmdlyg3ktb3li0r3d_e, nid_6kz4747paujgvor7ftnav1xz6_e, nid_epspxsqa74z7vnpu7846ou5sl_e, nid_dq0439hrj3lj7edst73p6a9ic_e, nid_ymugwkesjh70astiz9bffzu26_e, nid_cinizzkohsf4r3hn48qvdfvzt_e]
created_iso: 2026-08-10T22:26:30Z
status_updated_iso: 2026-08-10T23:42:06Z
type: chore
priority: 3
assignee: nickolaykondratyev
tags: [lint, e2e]
---

The Obsidian pre-publish check reports `@typescript-eslint/no-unsafe-member-access` warnings. Parent ticket nid_1iskliqzhf6k4euouhn44phiq_e split the full file list into per-group fix tickets so each fits a reasonable context window; this is one such group.\n\nFix every `@typescript-eslint/no-unsafe-member-access` warning in the files below by giving the accessed values real types (or narrowing via a type guard / assertion at a typed seam) rather than blanket-disabling the rule. In test/e2e code, prefer typing Playwright `evaluate` return values and DOM-query results; do NOT weaken assertions or introduce silent fallbacks (repo rule: tests must fail explicitly, never fake-pass). Keep engine/shared layering guards intact.\n\nPREREQUISITE: depends on nid_zyv1x5w08difwfdopm50bt2lu_e (wire ESLint typed-lint locally). VERIFY each file with the single-file lint command that ticket documents, e.g. `npx eslint <file>`, and confirm zero `no-unsafe-member-access` warnings remain. Then run `npm run check` (and, for src/view changes, the relevant `npm run test:e2e` spec) to confirm no regression.\n\nFiles in this group:\n- e2e/canvasMarkdownLinkIndexing.e2e.ts\n- e2e/canvasSpaceKey.e2e.ts\n- e2e/coreEditingWhileGraphOpen.e2e.ts\n- e2e/controlsRestart.e2e.ts\n- e2e/graphPlacement.e2e.ts\n- e2e/vicinityGraph.e2e.ts

## Resolution (2026-08-10)

All `@typescript-eslint/no-unsafe-member-access` warnings in this group are fixed. Root cause: `page.evaluate` blocks cast `window` to `{ app: any }` then reached into Obsidian internals off that `any`.

Approach — followed the existing seam, no rule-disabling:
- Extended the shared narrow type surface in **`e2e/obsidianInternals.ts`** (the file that already declares `E2eObsidianApp` for exactly this) with the members these specs touch:
  - `E2eMetadataCache`: added `resolvedLinks` (`Record<string, Record<string, number>>`) and `getFirstLinkpathDest(...)`.
  - `E2eVault`: added `read(...)` and `modify(...)`.
  - New canvas shapes: `E2eCanvasNode`, `E2eCanvasTextNodeOptions`, `E2eCanvas` (`nodes` as `ReadonlyMap`, `wrapperEl.focus()`, `createTextNode`, `selectOnly`), `E2eCanvasLeafView`, and `E2eWorkspaceLeaf.view`.
- Replaced every `{ app: any }` cast with `{ app: E2eObsidianApp }` in the four affected specs (`import type { E2eObsidianApp }` added to each).
- `noUncheckedIndexedAccess` now forces guards the old `any` hid: `getLeavesOfType("canvas")[0]` → explicit `if (leaf === undefined) throw`; `getAbstractFileByPath` null → explicit throw; `resolvedLinks[path]` undefined → explicit throw. These are EXPLICIT test failures on paths that previously threw a raw TypeError anyway — no assertion weakened, no silent fallback.
- Dropped now-redundant `as string` / `as number` casts.

`controlsRestart.e2e.ts` and `graphPlacement.e2e.ts` are listed but already had ZERO `no-unsafe-member-access` warnings — no changes needed.

Note: `npx eslint` still reports OTHER rules on two files — `no-console` x3 (`canvasMarkdownLinkIndexing.e2e.ts`) and `prefer-create-el` x1 (`vicinityGraph.e2e.ts`) — pre-existing, out of this ticket's scope (sibling split tickets own them).

Verification:
- `npx eslint` on all touched files: zero `no-unsafe-member-access` remaining.
- `npm run check` (tsc src + e2e): clean.
- `npm run test:e2e` for the four affected specs: 42 passed.


## Notes

**2026-08-10T23:45:07Z**

__READY_AS_IS__: Clean type-safety refactor; tsc check + e2e harness guards pass; target specs free of no-unsafe-member-access.
