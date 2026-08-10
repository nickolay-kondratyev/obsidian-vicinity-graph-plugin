---
closed_iso: 2026-08-10T22:30:10Z
id: nid_wv95rkafrcxn9by7t5ng95dvn_e
title: 'fix no-unsafe-call: src/view React components (.tsx)'
status: closed
deps: []
links: [nid_f7vkm00ahrak377r5dqpiyy9v_e, nid_db5s4uypdiesrk6oi8nms46wv_e, nid_khnm364awuizz6cmr2pxxjkpk_e,
  nid_j1zgoruaddxyhykf2maxsnzqn_e]
created_iso: '2026-08-10T22:23:32Z'
status_updated_iso: 2026-08-10T22:30:10Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [pre-release, eslint, no-unsafe-call]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
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
src/view/DrawerResizeHandle.tsx
src/view/FolderGroupNode.tsx
src/view/LinkPreviewContent.tsx
src/view/LinkPreviewDrawer.tsx
src/view/NodeOutline.tsx
src/view/NoteNode.tsx
src/view/SettingsRowView.tsx
src/view/VicinityEdge.tsx
src/view/VicinityGraphFlow.tsx
src/view/VicinityGraphView.tsx
src/view/testFixtures/settingsPanelHarness.tsx

Scope: React component modules under src/view. Likely trips via @xyflow/react / Obsidian API values reaching JSX as `any`, and dynamic handlers. Respect the layering rules in CLAUDE.md; keep engine imports via src/engine/index.ts.

## Resolution (2026-08-10) — NOT REPRODUCIBLE in-repo; NO code changes needed

**Outcome:** Established a reproducible type-checked lint signal (option (b)) and found **ZERO `@typescript-eslint/no-unsafe-call` violations** across all 11 files in this group. No source changes were made — there was nothing to fix. Ticket closed as resolved-vacuous.

**How the signal was reproduced (out-of-repo toolchain, nothing committed):**
1. Installed `eslint@9 typescript-eslint@8 typescript@5` into a scratchpad dir (repo has no ESLint config; adoption still pending in `docs-internal/tickets/ticket-eslint-adoption.md`).
2. Flat config = `tseslint.configs.recommendedTypeChecked` with `parserOptions.project` → the repo's `tsconfig.json`, `tsconfigRootDir` → repo root. Ran eslint with **cwd = repo root** (critical: running from the scratchpad dir makes eslint skip every file as "outside base path" and silently report 0 — that is a false green, not a pass).
3. Command shape:
   `eslint --config <cfg> --no-config-lookup --rule '{"@typescript-eslint/no-unsafe-call":"error"}' src/view/<file>.tsx ...`

**Result:**
- `recommended-type-checked`: 12 total problems across the group, **0 of them `no-unsafe-call`** (they were `no-unused-vars` on intentionally `_`-prefixed fake params, `require-await`, `unbound-method`, `no-unnecessary-type-assertion` — all OTHER rules, out of this ticket's scope).
- `strict-type-checked`: 50 total problems, still **0 in the `no-unsafe-*` family** (verified by grepping `@typescript-eslint/no-unsafe-`).
- Manual scan for `as any` / `: any` / `require(` call sites in all 11 files: only prose "any" inside comments; no `any`-typed value is ever invoked.
- `tsc -noEmit` is clean and all boundary type packages (`@xyflow/react`, `obsidian`, `stable-ids-for-obsidian`, `react`, `@types/react`) are installed.

**Why the original out-of-repo pass flagged these files:** almost certainly run in an environment where those third-party type packages were NOT resolvable, so `@xyflow/react` / Obsidian values degraded to `any` and their calls tripped `no-unsafe-call`. With the repo's own installed types, they are fully typed. **The finding is an artifact of a type-incomplete lint environment, not a real defect in these files.**

**Likely applies to the sibling tickets too** (`nid_f7vkm00ahrak377r5dqpiyy9v_e`, `nid_db5s4uypdiesrk6oi8nms46wv_e`, `nid_khnm364awuizz6cmr2pxxjkpk_e`, `nid_j1zgoruaddxyhykf2maxsnzqn_e`): whoever picks those up should reproduce with the repo's own `tsconfig` + installed types (cwd = repo root) before touching code, and expect the same result unless their files genuinely cross an untyped JSON/loader boundary. The durable fix for the whole family is the pending ESLint-adoption ticket, which will make `no-unsafe-call` a committed, always-correct gate.
