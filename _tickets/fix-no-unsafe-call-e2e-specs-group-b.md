---
closed_iso: 2026-08-10T23:57:43Z
session_ids: [{a: claude, type: execution, id: 4572d435-d180-49f5-9141-ea22983999a5}, {a: claude, type: review, id: 6a88857f-68e1-45dd-8c1b-2a1f82e52a73}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_db5s4uypdiesrk6oi8nms46wv_e
title: "fix no-unsafe-call: e2e specs (group B)"
status: closed
deps: [nid_khnm364awuizz6cmr2pxxjkpk_e]
links: [nid_f7vkm00ahrak377r5dqpiyy9v_e, nid_khnm364awuizz6cmr2pxxjkpk_e, nid_wv95rkafrcxn9by7t5ng95dvn_e, nid_j1zgoruaddxyhykf2maxsnzqn_e]
created_iso: 2026-08-10T22:23:31Z
status_updated_iso: 2026-08-10T23:57:43Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [pre-release, eslint, no-unsafe-call]
---

## Background

A pre-release lint pass flagged `@typescript-eslint/no-unsafe-call` violations across the codebase. That rule fires when a value typed `any` (or an unsafely-typed expression) is invoked as a function — typically from untyped third-party APIs, `JSON.parse` results, dynamic `require`/loader boundaries, or Playwright `page.evaluate` return values crossing into test code.

NOTE: there is currently NO ESLint config committed in this repo (see `docs-internal/tickets/ticket-eslint-adoption.md` — ESLint 9 flat config adoption is still pending). These findings came from an out-of-repo type-checked lint run. Before fixing, the agent MUST establish how to REPRODUCE the findings: either (a) coordinate with the ESLint-adoption ticket to land the flat config with `@typescript-eslint` type-checked rules and an `npm run lint` script, or (b) run typescript-eslint locally with the `recommended-type-checked` (or `strict-type-checked`) preset against the files below. Do not guess at fixes without a reproducible lint signal.

## How to fix (per file)

For each flagged call site, give the invoked value a real type instead of `any`:
- Add/assert precise types at the untyped boundary (declare a typed interface for the external module, type the `page.evaluate` return, type the parsed JSON) rather than sprinkling `as` casts blindly.
- Prefer a single well-named typed wrapper at each seam over per-call-site casts (DRY).
- Do NOT silence with `// eslint-disable` unless the boundary is genuinely un-typeable, and if so document WHY inline.
- Keep changes behavior-preserving; run `npm run check` and the relevant `npm test` / `npm run test:e2e` specs for touched surfaces.

## Files in THIS group (full relative paths)
e2e/nodeResize.e2e.ts
e2e/nodeTitleWrap.e2e.ts
e2e/noteRename.e2e.ts
e2e/perFileStorePersistence.e2e.ts
e2e/pinnedCentralScenario.e2e.ts
e2e/referenceProvenance.e2e.ts
e2e/settingsDependentRows.e2e.ts
e2e/settingsResetReview.e2e.ts
e2e/settingsResetVerify.e2e.ts
e2e/settingsTypedInput.e2e.ts
e2e/settingsUxVisual.e2e.ts
e2e/vicinityGraph.e2e.ts

Scope: e2e Playwright spec files, part B of 2. Same failure modes as group A (`page.evaluate` returns, Obsidian globals as `any`).

## Resolution (closed 2026-08-10)

**Outcome: no code changes required — all group B `no-unsafe-call` sites were already
eliminated by upstream tickets before this one ran.**

### Reproduction established (option b)
Ran `typescript-eslint@8.67` with the `recommended-type-checked` preset, type-aware
(`parserOptions.project` = `e2e/tsconfig.json`, which extends root `tsconfig.json`),
out-of-tree via a scratch `.tmp/eslint.config.mjs` (no repo `package.json`/config change —
ESLint adoption is still `docs-internal/tickets/ticket-eslint-adoption.md`'s job). The
config was sanity-checked against a deliberate `const x: any = () => 1; x()` snippet and
DID fire `@typescript-eslint/no-unsafe-call`, so a zero count is a real zero, not a
mis-wired rule.

### Baseline over all 12 group B files: **0 `@typescript-eslint/no-unsafe-call`**
The dependency `nid_khnm364awuizz6cmr2pxxjkpk_e` (harness/support helpers) landed the
shared type-only seam `e2e/obsidianInternals.ts` (`E2eObsidianApp`), and the sibling
`no-unsafe-member-access` e2e tickets (e.g. commit `cef344a` "fix no-unsafe-member-access
in e2e core graph/canvas/editing specs") swapped every `{ app: any }` cast in the spec
files for `{ app: E2eObsidianApp }`. Because `no-unsafe-member-access` and `no-unsafe-call`
both fire on `any`, typing `app` to reach a member ALSO typed the call on that member —
so fixing member access swept the call sites out too. No group B file still contains
`app: any`; the remaining lint output on these files is unrelated rules
(`require-await`, `no-unused-vars`, `unbound-method`), which are out of this ticket's scope.

### Verification
- Scratch lint over all 12 group B files: **0 `no-unsafe-call`**.
- Rule-fires sanity check: passed (see above).
- `npm run check` (tsc strict, src + `e2e/tsconfig.json`): pass.
- `git status`: clean — no edits made. Scratch config removed from `.tmp/`.

### For the next reader
If a future edit reintroduces an `app: any` (or any `any`-typed `page.evaluate` return)
into a group B spec, re-run the scratch config pattern above and route the value through
`E2eObsidianApp` in `e2e/obsidianInternals.ts` (add the narrow member there rather than
widening back to `any`) — same seam group A / the harness ticket use.


## Notes

**2026-08-10T23:59:31Z**

__READY_AS_IS__: verified 0 no-unsafe-call in all 12 group B e2e files via committed eslint config (rule enabled as error); branch is doc-only closure, no code changes needed.
