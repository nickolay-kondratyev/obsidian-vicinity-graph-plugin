---
id: nid_itpt4tf0kkhsbbz0np304a558_e
title: "Settings writes: user-visible failure policy for void-ed write promises"
status: open
deps: []
links: [nid_m5hxe4eo9jgt7cfic7s2o3uvi_e]
created_iso: 2026-07-30T01:17:40Z
status_updated_iso: 2026-07-30T01:17:40Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [settings, settings-cleanup, ux, robustness]
---

Pre-existing gap, unchanged by the write-pipeline ticket (nid_m5hxe4eo9jgt7cfic7s2o3uvi_e) and explicitly out of its scope. Both the implementer and reviewer of that ticket flagged it.

PROBLEM: several settings write promises are fire-and-forget (`void`), so a failed persist is silent to the user — the UI keeps showing a value that was never stored:
- the debounce window drain in `src/view/settingsDebounce.ts`
- `void this.writes.apply(...)` in `src/view/VicinityGraphSettingTab.ts`
- `void actions.restoreDefaults(...)` in the in-graph controls path (`src/view/ControlsActions.ts`)

Note the optimistic-control model (`src/view/optimisticValue.ts`) now RELEASES the override when the store does not move, so a failed write visibly snaps back to the old value — the value is not lied about, but the user is given no reason.

GOAL: ONE failure policy for the whole pipeline (`src/view/settingsWritePipeline.ts` is the natural single place), e.g. an Obsidian `Notice` naming the setting that failed to save. Keep it in one place — do not sprinkle try/catch at call sites.

Acceptance: a rejecting persist produces exactly one user-visible notice, covered by a test through the pipeline seam (no new test-infra deps needed).

