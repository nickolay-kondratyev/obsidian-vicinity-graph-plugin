---
closed_iso: 2026-08-10T23:04:47Z
session_ids: [{a: claude, type: execution, id: 782308f6-3aaa-47cb-a0bb-2ac51571ba50}, {a: claude, type: review, id: e20d7a9d-4499-42a9-a85b-a88e7ce537bf}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_1fzz9jrjbnaa3iky57nmmckfc_e
title: "fix no-unsafe-member-access: e2e edge/node rendering specs"
status: closed
deps: [nid_zyv1x5w08difwfdopm50bt2lu_e]
links: [nid_ez80034jh0f5mba3hgegc0lvq_e, nid_weo2x5v4mks9ge9bf642u0hg4_e, nid_d2ditwyebmdlyg3ktb3li0r3d_e, nid_6kz4747paujgvor7ftnav1xz6_e, nid_epspxsqa74z7vnpu7846ou5sl_e, nid_dq0439hrj3lj7edst73p6a9ic_e, nid_ymugwkesjh70astiz9bffzu26_e, nid_cinizzkohsf4r3hn48qvdfvzt_e]
created_iso: 2026-08-10T22:26:30Z
status_updated_iso: 2026-08-10T23:04:47Z
type: chore
priority: 3
assignee: nickolaykondratyev
tags: [lint, e2e]
---

The Obsidian pre-publish check reports `@typescript-eslint/no-unsafe-member-access` warnings. Parent ticket nid_1iskliqzhf6k4euouhn44phiq_e split the full file list into per-group fix tickets so each fits a reasonable context window; this is one such group.\n\nFix every `@typescript-eslint/no-unsafe-member-access` warning in the files below by giving the accessed values real types (or narrowing via a type guard / assertion at a typed seam) rather than blanket-disabling the rule. In test/e2e code, prefer typing Playwright `evaluate` return values and DOM-query results; do NOT weaken assertions or introduce silent fallbacks (repo rule: tests must fail explicitly, never fake-pass). Keep engine/shared layering guards intact.\n\nPREREQUISITE: depends on nid_zyv1x5w08difwfdopm50bt2lu_e (wire ESLint typed-lint locally). VERIFY each file with the single-file lint command that ticket documents, e.g. `npx eslint <file>`, and confirm zero `no-unsafe-member-access` warnings remain. Then run `npm run check` (and, for src/view changes, the relevant `npm run test:e2e` spec) to confirm no regression.\n\nFiles in this group:\n- e2e/edgeRouting.e2e.ts\n- e2e/edgeRoutingEval.e2e.ts\n- e2e/linkPreview.e2e.ts\n- e2e/nodeContentOverride.e2e.ts\n- e2e/nodeOutline.e2e.ts\n- e2e/nodeResize.e2e.ts\n- e2e/nodeTitleWrap.e2e.ts

---

## Resolution (2026-08-10)

All `@typescript-eslint/no-unsafe-member-access` warnings in this group are gone.
Only 3 of the 7 listed files carried warnings at pickup time (`edgeRoutingEval`,
`nodeOutline`, `nodeResize`); the other 4 (`edgeRouting`, `linkPreview`,
`nodeContentOverride`, `nodeTitleWrap`) were already clean under the wired config.

Every warning had one root cause: a value reached through `any`. Fixes type the
seam, never disable the rule.

### What changed

- **`e2e/obsidianInternals.ts`** — extended the narrow, type-only `E2eObsidianApp`
  seam with the members these specs touch: `E2eWorkspace.getActiveFile()`,
  `E2eWorkspace.openLinkText(...)` (a method, so tests can spy/reassign),
  `E2eWorkspaceLeaf.openFile` gained the optional `openState?: E2eOpenState` arg,
  and a new `E2eOpenState { eState?: { subpath?: string } }`.
- **`e2e/nodeOutline.e2e.ts`** — three `{ app: any }` casts → `{ app: E2eObsidianApp }`;
  a local (type-only ⇒ legal inside `page.evaluate`) `NavigationSpyStore` interface
  narrows the recorded originals to function types; the leaf-prototype spy casts
  `Object.getPrototypeOf(...)` to `Pick<E2eWorkspaceLeaf, "openFile">` and annotates
  the replacement fn's `this`/params. Spy runtime is byte-identical (erasable types).
- **`e2e/nodeResize.e2e.ts`** — same `{ app: any }` → `{ app: E2eObsidianApp }` on its
  `activeFilePath` helper + the import.
- **`e2e/edgeRoutingEval.e2e.ts`** — `arg.jsonValue().then((data: PerfEntry["data"]) => ({kind, data}))`:
  annotating the callback param types the unsafe assignment AND drops the now-unnecessary
  `as PerfEntry` assertion the typed-lint pass also flagged.

### Verification

- `npx eslint <the 7 files>` → 0 `no-unsafe-*` / `no-explicit-any`. (3 unrelated
  pre-existing warnings remain in `edgeRoutingEval`: `obsidianmd/prefer-window-timers`
  L175 and `obsidianmd/rule-custom-message` no-console L276/L288 — out of scope.)
- `npm run check` → clean.
- `npm run test:e2e -- nodeOutline.e2e.ts nodeResize.e2e.ts edgeRoutingEval.e2e.ts`
  → **37 passed** against real Obsidian 1.12.7.

### Note for next reader

- This fresh checkout lacked the prereq's ESLint deps in `node_modules`; ran
  `npm install` (needed to reproduce the lint). That surfaced pre-existing
  package.json/lock drift (`@eslint/js` + `globals` in the lock, not the manifest).
  Reverted `package-lock.json` to keep this commit scoped; filed follow-up
  **nid_p9omkaitzkvzvthv5f2vvou2y_e**.
- Single-file lint command (prereq nid_zyv1x5w08difwfdopm50bt2lu_e): `npx eslint e2e/<file>.e2e.ts`.


## Notes

**2026-08-10T23:06:54Z**

__READY_AS_IS__: type-only erasable e2e seam annotations; npm run check clean, zero no-unsafe warnings remain, behavior byte-identical.
