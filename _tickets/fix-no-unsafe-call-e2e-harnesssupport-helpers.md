---
id: nid_khnm364awuizz6cmr2pxxjkpk_e
title: 'fix no-unsafe-call: e2e harness/support helpers'
status: in_progress
deps: []
links: [nid_f7vkm00ahrak377r5dqpiyy9v_e, nid_db5s4uypdiesrk6oi8nms46wv_e, nid_wv95rkafrcxn9by7t5ng95dvn_e,
  nid_j1zgoruaddxyhykf2maxsnzqn_e]
created_iso: '2026-08-10T22:23:31Z'
status_updated_iso: '2026-08-10T22:27:06Z'
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [pre-release, eslint, no-unsafe-call]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-3
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
e2e/buttonChrome.ts
e2e/nodeContentBox.ts
e2e/obsidianHarness.ts
e2e/settingsTabPage.ts
e2e/settingsWriteWindow.ts
e2e/vaultTarget.ts
e2e/playwright.config.ts

Scope: e2e shared harness/page-object/config helpers (non-spec). These are the seams where Obsidian `app` and `page.evaluate` results are typed once and reused, so fixing them well (typed wrappers) will remove many downstream unsafe-call sites in the spec groups A/B. Consider doing this group FIRST.
