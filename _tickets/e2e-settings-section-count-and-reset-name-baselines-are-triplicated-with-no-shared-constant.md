---
id: nid_3399ajdcy5lq21lx5v0jxh9i4_e
title: "e2e: settings section-count and reset-name baselines are triplicated with no shared constant"
status: open
deps: []
links: []
created_iso: 2026-07-25T03:54:05Z
status_updated_iso: 2026-07-25T03:54:05Z
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

