---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_f7vkm00ahrak377r5dqpiyy9v_e
title: "fix no-unsafe-call: e2e specs (group A)"
status: in_progress
deps: [nid_khnm364awuizz6cmr2pxxjkpk_e]
links: [nid_db5s4uypdiesrk6oi8nms46wv_e, nid_khnm364awuizz6cmr2pxxjkpk_e, nid_wv95rkafrcxn9by7t5ng95dvn_e, nid_j1zgoruaddxyhykf2maxsnzqn_e]
created_iso: 2026-08-10T22:22:58Z
status_updated_iso: 2026-08-11T00:00:00Z
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
e2e/canvasMarkdownLinkIndexing.e2e.ts
e2e/canvasSpaceKey.e2e.ts
e2e/controlsRestart.e2e.ts
e2e/coreEditingWhileGraphOpen.e2e.ts
e2e/edgeRouting.e2e.ts
e2e/edgeRoutingEval.e2e.ts
e2e/externalVault.e2e.ts
e2e/graphPlacement.e2e.ts
e2e/linkPreview.e2e.ts
e2e/localPinScenario.e2e.ts
e2e/nodeContentOverride.e2e.ts
e2e/nodeOutline.e2e.ts

Scope: e2e Playwright spec files, part A of 2. These likely trip the rule via `page.evaluate(...)` return values and Obsidian `app`/`window` globals accessed as `any` inside evaluated browser context.

