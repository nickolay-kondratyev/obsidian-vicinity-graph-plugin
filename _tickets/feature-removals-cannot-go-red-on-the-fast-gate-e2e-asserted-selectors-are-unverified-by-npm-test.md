---
id: nid_c5acy7gm7lj3afz0vtq79k8bx_e
title: "feature removals cannot go red on the fast gate: e2e-asserted selectors are unverified by npm test"
status: open
deps: []
links: [nid_yccejkvl0ccqc77olsgg5deka_e]
created_iso: 2026-07-26T16:16:00Z
status_updated_iso: 2026-07-26T16:16:00Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [testing, e2e, tooling]
---

ROOT CAUSE behind ticket `nid_yccejkvl0ccqc77olsgg5deka_e` (the 3-day-red release gate).

`npm test` (vitest) deliberately excludes `npm run test:e2e` (Playwright against real Obsidian — CLAUDE.md: "release gate, not `npm test`"). So when `998fdac` removed the folder breadcrumb it deleted the rendered element, its CSS class, and its unit tests in one commit — `npm test` stayed green by construction, while `e2e/vicinityGraph.e2e.ts` (which asserts `.vicinity-graph-node__breadcrumb` / the `solo/` title prefix) went red and STAYED red for 3 days across at least two branches. `_change_log/2026-07-24_03-57-33Z.md:20` records it misdiagnosed as an accepted "pre-existing" failure.

The blind spot is general: ANY feature removal, or any CSS-class rename in `src/view/`, can strand e2e assertions with no fast-loop signal.

## Design

Suggested 80/20 (reviewer's proposal): a cheap tripwire that runs inside `npm test` — a vitest test that extracts every `.vicinity-graph-*` CSS class literal asserted in `e2e/**/*.e2e.ts` and fails if the class appears nowhere in `src/view/**` (`*.tsx` render code or `*.css`). Pure string scan, no Obsidian, milliseconds. Would have caught `998fdac` in seconds.

Known limits to state in the test's own docs so it does not overclaim: it catches "the e2e asserts a selector src no longer produces", NOT "the e2e asserts text/DOM structure src no longer produces" (e.g. the `solo/` title-prefix half of the same failure). Deliberately a tripwire, not a substitute for the gate.

Alternative considered: run `test:e2e` in CI on every push. Correct but not cheap (needs a real Obsidian download + ~1 min per run) and does not help the local fast loop.

## Acceptance Criteria

`npm test` goes RED when a CSS class asserted anywhere under `e2e/` exists nowhere in `src/view/`. Verified by a mutation: delete/rename one class in `src/view/*.tsx` and observe the failure. Test lives with the other harness guards already covered by `npm test` (see the `e2e/**/*.test.ts` glob in the vitest config).


## Notes

**2026-07-26T16:23:42Z**

Reviewer note: as written, the tripwire criteria would false-positive on the new absence guard at e2e/vicinityGraph.e2e.ts:177 (it asserts a class is ABSENT). Exempt toHaveCount(0) assertions from the check.
