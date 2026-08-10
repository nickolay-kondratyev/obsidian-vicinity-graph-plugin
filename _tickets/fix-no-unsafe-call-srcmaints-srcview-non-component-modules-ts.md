---
closed_iso: 2026-08-10T22:32:01Z
id: nid_j1zgoruaddxyhykf2maxsnzqn_e
title: 'fix no-unsafe-call: src/main.ts + src/view non-component modules (.ts)'
status: closed
deps: []
links: [nid_f7vkm00ahrak377r5dqpiyy9v_e, nid_db5s4uypdiesrk6oi8nms46wv_e, nid_khnm364awuizz6cmr2pxxjkpk_e,
  nid_wv95rkafrcxn9by7t5ng95dvn_e]
created_iso: '2026-08-10T22:23:32Z'
status_updated_iso: 2026-08-10T22:32:01Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [pre-release, eslint, no-unsafe-call]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-4
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
src/main.ts
src/view/ConfirmModal.ts
src/view/ControlsActionsContext.ts
src/view/ElkLayoutRunner.ts
src/view/GraphUiContext.ts
src/view/GraphViewOpener.ts
src/view/NoteOpenContext.ts
src/view/ObsidianGraphUi.ts
src/view/ObsidianNoteNavigator.ts
src/view/VicinityGraphSettingTab.ts
src/view/d3ForceRefinement.ts
src/view/elkMapping.ts
src/view/libavoidLoader.ts
src/view/rowRenderingSource.ts
src/view/useOptimisticValue.ts

Scope: plugin entry (src/main.ts) + non-JSX src/view modules. Likely trips via dynamic loaders (libavoidLoader.ts, ElkLayoutRunner.ts / elkjs, d3-force), and Obsidian API bridges (Obsidian* adapters, SettingTab). Type the external module surfaces at the loader seam. Respect CLAUDE.md layering.

## Resolution (2026-08-10) — no code changes required

**Outcome: closed as already-clean.** With a reproducible, correctly-typed lint
signal, all 15 files in this group have **zero** `@typescript-eslint/no-unsafe-call`
violations. No source edits were made (working tree unchanged; `npm run check`
green).

### How the signal was reproduced (option (b) from the Background)
No ESLint config is committed, so typescript-eslint was installed transiently
(`npm install --no-save eslint@9 typescript-eslint@8`, node_modules is gitignored)
and run against the group with a throwaway flat config in `.tmp/` (also gitignored):

- Preset: `tseslint.configs.recommendedTypeChecked` (which enables `no-unsafe-call`),
  `parserOptions.projectService: true` so real TS type info is engaged.
- Also re-verified under `strictTypeChecked`.
- Confirmed type info was genuinely active: other type-checked rules fired in the
  same run (`no-misused-promises`, `no-unused-vars`), and `no-unsafe-call` requires
  type info to report at all.

### Findings
- Group files (all 15): **0** `no-unsafe-call` under both `recommended-type-checked`
  and `strict-type-checked`.
- Whole-`src` scan surfaced only **2** `no-unsafe-call`, both in test files OUTSIDE
  this group: `src/view/GraphViewController.test.ts` and
  `src/view/VicinityGraphFlow.component.test.tsx` — belong to the sibling
  test/component tickets, not this one.

### Why the group is clean
The "likely trips" all resolve to real types in this repo, so no invoked value is
`any`:
- `libavoidLoader.ts` — `libavoid-js` ships declarations; `AvoidLib.getInstance()`
  is typed, then narrowed via `as unknown as Avoid`.
- `ElkLayoutRunner.ts` / `elkMapping.ts` — `elkjs` default export + `ElkNode` typed.
- `d3ForceRefinement.ts` — `d3-force` imports (`forceSimulation`, `forceManyBody`,
  …) are typed.
- Obsidian bridges + `VicinityGraphSettingTab.ts` — `obsidian` and
  `stable-ids-for-obsidian` type declarations are installed and resolve, so API
  calls are not `any`.

The original out-of-repo finding was almost certainly produced against a state
before external type declarations resolved (e.g. pre `obsidian-id-lib →
stable-ids-for-obsidian` migration, commit 9e1ad51) or with types absent, which
would degrade those seams to `any`. Against the current typed sources it does not
reproduce.

No `// eslint-disable` was added; nothing was silenced. If/when the ESLint-adoption
ticket lands a committed flat config + `npm run lint`, this group should stay green
with no per-file work.
