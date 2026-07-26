---
closed_iso: 2026-07-26T16:57:51Z
id: nid_vqw34wdpmb5qzn52cy6qugqgd_e
title: "e2e: controls-panel disclosures have no exhaustiveness pin"
status: closed
deps: []
links: []
created_iso: 2026-07-26T05:34:55Z
status_updated_iso: 2026-07-26T16:57:51Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [e2e]
---

`e2e/settingsBaseline.ts` `CONTROLS_PANEL_DISCLOSURES` lists the 5 panel disclosures,
but `e2e/settingsUxVisual.e2e.ts` only asserts each listed entry exists — a NEWLY added
disclosure silently escapes assertion. The settings tab no longer has this hole (its
`toHaveText(SETTINGS_TAB_SECTION_HEADINGS)` pins count + identity + order).

A naive count is wrong: the doc at `e2e/settingsBaseline.ts` (see `CONTROLS_PANEL_DISCLOSURES`
comment) correctly excludes the conditional "Pinned centrals (n)" and the NESTED
"Advanced spacing" disclosure. The 80/20 is a scoped assertion, e.g. DIRECT-CHILD
`.vicinity-graph-disclosure` elements of the panel root === `CONTROLS_PANEL_DISCLOSURES.length`.

Raised as N-1 in the `settings-e2e-baseline-dry` review.

## Acceptance Criteria

Adding an unlisted top-level controls-panel disclosure makes an e2e spec fail.


## Notes

**2026-07-26T16:57:51Z**

RESOLVED. e2e/settingsUxVisual.e2e.ts now pins the panel's TOP-LEVEL disclosures: direct-child `.vicinity-graph-toolbar__body > .vicinity-graph-disclosure > .vicinity-graph-disclosure__summary`, asserted with toHaveCount + toHaveText against the new derived CONTROLS_PANEL_DISCLOSURE_SUMMARIES (count + identity + order, mirroring the settings tab).

Exclusions handled as the ticket required: nested 'Advanced spacing' drops out structurally via the direct-child chain; conditional 'Pinned centrals (n)' is filtered by a full-text `^Pinned centrals \(\d+\)$` regex rather than relying on this spec's pin-free fixture.

Acceptance criterion proven empirically against real Obsidian: a temporary 6th <Disclosure> failed with 'toHaveCount Expected: 5 / Received: 6'. Additionally hardened after review — summaries use tail-anchored `^...\d*$` regexes (tolerating NodeExclusionSection's count badge) so a prefix-preserving rename also fails.

Verified: npm run check clean, npm test 990 passed, test:e2e -- settingsUxVisual pinnedCentralScenario 18 passed. Change log: 2026-07-26_16-57-39Z. Follow-ups: nid_d9j4o9ecp93g5zhury5m1fb43_e, nid_iwd08rsdnsbdziltw1odisuoc_e.
