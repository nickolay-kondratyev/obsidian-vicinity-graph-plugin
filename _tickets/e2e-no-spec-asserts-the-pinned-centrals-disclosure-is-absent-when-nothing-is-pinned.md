---
id: nid_d9j4o9ecp93g5zhury5m1fb43_e
title: "e2e: no spec asserts the 'Pinned centrals' disclosure is ABSENT when nothing is pinned"
status: open
deps: []
links: []
created_iso: 2026-07-26T16:53:34Z
status_updated_iso: 2026-07-26T16:53:34Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
---

The controls-panel exhaustiveness pin in e2e/settingsUxVisual.e2e.ts (function `topLevelPanelSummaries`) deliberately filters the conditional "Pinned centrals (n)" disclosure out by name, so that spec is blind to a regression where the disclosure renders UNCONDITIONALLY.

No other spec covers the absence either: e2e/controlsRestart.e2e.ts:80 and e2e/pinnedCentralScenario.e2e.ts:95 only assert its PRESENCE once a central is pinned.

This is not a regression (nothing asserted it before) — raised as N2 in the review of ticket nid_vqw34wdpmb5qzn52cy6qugqgd_e.

## Acceptance Criteria

A spec asserts that on a view with NO pinned centrals, no `.vicinity-graph-toolbar__body > .vicinity-graph-disclosure` summary matches /^Pinned centrals \(\d+\)$/. Temporarily making the disclosure render unconditionally in src/view/GraphToolbar.tsx must fail that spec.

