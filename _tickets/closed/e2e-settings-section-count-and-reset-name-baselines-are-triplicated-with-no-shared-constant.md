---
closed_iso: 2026-07-26T05:42:12Z
id: nid_3399ajdcy5lq21lx5v0jxh9i4_e
title: "e2e: settings section-count and reset-name baselines are triplicated with no shared constant"
status: closed
deps: []
links: []
created_iso: 2026-07-25T03:54:05Z
status_updated_iso: 2026-07-26T05:42:12Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [tests, e2e]
---

Three specs hand-maintain the SAME baseline about the settings tab, with no shared source:

- `.vicinity-graph-settings-section` `toHaveCount(6)` in `e2e/settingsResetReview.e2e.ts` (~:81), `e2e/settingsResetVerify.e2e.ts` (~:59) and `e2e/settingsUxVisual.e2e.ts` (~:128);
- the exact 6/7-entry restore-button NAME lists in `e2e/settingsResetReview.e2e.ts` (~:185-193) and `e2e/settingsUxVisual.e2e.ts` (~:161-168).

Add or rename a settings card and you must find all five sites by hand; miss one and it either goes red for the wrong reason or keeps asserting a stale truth. `e2e/settingsUxVisual.e2e.ts`'s panel-disclosure enumeration (~:52-58) is the same failure class — `node-content-preference` had to add "Node contents" to it manually, and until it did, that test silently under-asserted.

Noted as a deferred DRY target by the `node-content-preference` plan (which believed it was already ticketed — it was not; no ticket existed in `_tickets/` or `docs-internal/tickets/`).

## Acceptance Criteria

One shared e2e-side source for the expected section names + reset-row names (a const in a small `e2e/settingsBaseline.ts`, or derived from the plugin at runtime), consumed by all three specs; counts become `EXPECTED.length` rather than a literal 6. The panel-disclosure list gets the same treatment. No assertion is weakened — the point is that ONE edit updates every site.


## Notes

**2026-07-26T05:42:12Z**

Resolved on branch settings-e2e-baseline-dry.

New `e2e/settingsBaseline.ts` is the single e2e-side source: reset-row names derived from
`src/view/settingsResetPlan` (SECTION_RESET_SCOPES + SETTINGS_RESET_SCOPES[scope].label +
ALL_SETTINGS_RESET_SCOPE); card headings hand-written but keyed `Record<SectionResetScope, string>`
so a new scope fails `tsc`. Separate CONTROLS_PANEL_DISCLOSURES const for the toolbar panel list
(different from the tab list), carrying a per-entry `.first()` flag so strict-mode locator
semantics are unchanged.

All three specs (settingsResetReview / settingsResetVerify / settingsUxVisual) consume it; every
count is now <CONST>.length. No assertion weakened (card headings are now DOM-asserted, which is
additive). Also added `npm run check:e2e` chained from `npm run check` so the compile-time
exhaustiveness guard actually runs in CI/build.

Verified: npm run check exit 0; npm test 74 files / 988 passed; the three settings specs in real
Obsidian 34/34 passed. Pre-existing unrelated e2e failure at e2e/vicinityGraph.e2e.ts:160 tracked
separately as nid_yccejkvl0ccqc77olsgg5deka_e.
