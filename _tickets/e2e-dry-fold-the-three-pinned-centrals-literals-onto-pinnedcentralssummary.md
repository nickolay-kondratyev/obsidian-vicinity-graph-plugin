---
id: nid_iwd08rsdnsbdziltw1odisuoc_e
title: "e2e DRY: fold the three 'Pinned centrals' literals onto PINNED_CENTRALS_SUMMARY"
status: open
deps: []
links: []
created_iso: 2026-07-26T16:53:34Z
status_updated_iso: 2026-07-26T16:53:34Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
---

The literal "Pinned centrals" now exists in three places:
- e2e/settingsBaseline.ts:136 — the exported PINNED_CENTRALS_SUMMARY const
- e2e/controlsRestart.e2e.ts:80
- e2e/pinnedCentralScenario.e2e.ts:95

The latter two should import PINNED_CENTRALS_SUMMARY from ./settingsBaseline instead of hard-coding the string. Two-line change; deliberately left out of ticket nid_vqw34wdpmb5qzn52cy6qugqgd_e to keep that change scoped (raised as N3 in its review).

## Acceptance Criteria

No hard-coded "Pinned centrals" literal outside e2e/settingsBaseline.ts. `npm run check` green and `npm run test:e2e -- controlsRestart pinnedCentralScenario` still green.

