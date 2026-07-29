---
id: nid_niz5dz6uqeyv237ckm15ittqa_e
title: "Expose or remove orphan settings groupByFolder and edgeVisibility"
status: open
deps: []
links: [nid_3k0a4zl6in0mj8lcjibkjq2dx_e, nid_abreq4lmpo8vnvf61y9k9yly0_e, nid_8p0nn2g34d97finokwlz3u1dt_e]
created_iso: 2026-07-24T21:44:19Z
status_updated_iso: 2026-07-24T21:44:19Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [settings]
---

`groupByFolder` and `edgeVisibility` are persisted ViewSettings fields with defaults in src/engine/SettingsSpec.ts:69-70 but have ZERO write UI: no settings-tab control, no in-graph control, and no SettingsInteraction case in src/view/settingsWritePlan.ts. They can never be changed by a user.

Decide: give them real controls, or delete the fields. Do not leave dead persisted state.

Context: .ai_out/settings-ux-improvements/settings/EXPLORATION_PUBLIC.md

## Acceptance Criteria

- Either both settings are user-changeable through the UI and covered by tests, or the fields (and their persistence) are removed.


## Notes

**2026-07-26T15:30:39Z**

[decide] Product fork the human must resolve: ship real UI controls for groupByFolder + edgeVisibility, or delete the fields and their persistence. Materially different scope. Verified still open: both persist (src/engine/types.ts:307-308) and are read (src/engine/VicinityEngine.ts:92, src/view/flowMapping.ts:166) but have no interaction case in src/view/settingsWritePlan.ts:28-49 and no control anywhere.

**2026-07-29T17:28:25Z**

DECISION (owner, 2026-07-29): DELETE BOTH. Do not build toggles.

VERIFIED REACHABILITY (this is what settled it): neither field has ANY write path. grep over src/
and e2e/ shows groupByFolder is only ever the spec default true, and edgeVisibility only ever
"walked-from-center". The single writer of either is e2e/obsidianHarness.ts:475, which pokes storage
directly. So these are not features -- they are unfinished work parked in the type system, and no
user can reach them.

SCOPE OF DELETION:
- src/engine/SettingsSpec.ts:74-75,149,155 (spec entries)
- src/engine/types.ts:307-308 (ViewSettings fields) and the ViewSettingsOverride counterparts
- src/engine/ViewSettingsResolver.ts:50-51 (resolver entries)
- src/engine/constants.ts:31-32,267-268 (DEFAULT_EDGE_VISIBILITY + defaults)
- src/persistence/persistedShapes.ts:142,160-165 (parse/override plumbing)
- src/view/testFixtures/graphFixtures.ts:42-43

HARDCODE the surviving behaviour: folder grouping ON (deriveFolderGroups keeps its boolean param
ONLY if elkMapping/flowMapping still need it -- prefer removing the param), edges
"walked-from-center" at src/engine/VicinityEngine.ts:92.

CALLOUT -- this DOES remove capability from the e2e suite: obsidianHarness.saveGlobalView({
edgeVisibility }) is how the edge-routing fixture gets an all-edges graph with chords at all. That
fixture must be rebuilt to produce its edge set explicitly (real links) rather than by flipping a
mode. Do not delete the fixture coverage.

Also remove the now-false promise in the SettingsSpec.ts:150 docblock ("all-edges stays available
via the toggle").

Unpublished repo => clean break on stored data; stale keys in existing doc-data just fall back.

FOLLOW-UP: an "all-edges" view mode may still be a good FEATURE later. It is not lost -- it is
recorded here as an idea, to be specced properly (with UI) if wanted, not resurrected as dead config.
