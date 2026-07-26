---
id: nid_vqw34wdpmb5qzn52cy6qugqgd_e
title: "e2e: controls-panel disclosures have no exhaustiveness pin"
status: open
deps: []
links: []
created_iso: 2026-07-26T05:34:55Z
status_updated_iso: 2026-07-26T05:34:55Z
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

