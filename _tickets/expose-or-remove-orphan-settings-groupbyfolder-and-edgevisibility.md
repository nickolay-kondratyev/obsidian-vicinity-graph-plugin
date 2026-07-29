---
closed_iso: 2026-07-29T18:06:40Z
id: nid_niz5dz6uqeyv237ckm15ittqa_e
title: Expose or remove orphan settings groupByFolder and edgeVisibility
status: closed
deps: []
links: [nid_3k0a4zl6in0mj8lcjibkjq2dx_e, nid_abreq4lmpo8vnvf61y9k9yly0_e, nid_8p0nn2g34d97finokwlz3u1dt_e]
created_iso: '2026-07-24T21:44:19Z'
status_updated_iso: 2026-07-29T18:06:40Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [settings, settings-cleanup]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Overarching context and chain ordering for the settings cleanup: docs-internal/notes/settings.md (grouping tag: settings-cleanup).
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

**2026-07-29T18:06:40Z**

RESOLVED (2026-07-29) — DELETED both fields per the owner decision. Commit c694e36.

WHAT WAS REMOVED
- src/engine/SettingsSpec.ts: both spec entries + the now-false "all-edges stays available via the toggle" docblock.
- src/engine/types.ts: ViewSettings.groupByFolder / .edgeVisibility and the EdgeVisibilityMode type (ViewSettingsOverride is Partial<ViewSettings>, so its counterparts went with them).
- src/engine/ViewSettingsResolver.ts, src/engine/constants.ts (DEFAULT_EDGE_VISIBILITY + both EngineDefaults entries), src/persistence/persistedShapes.ts (parse plumbing + EDGE_VISIBILITY_MODES), src/view/testFixtures/graphFixtures.ts.

HARDCODED SURVIVING BEHAVIOUR
- Folder grouping ON: deriveFolderGroups(nodes) lost its boolean param (preferred option in the ticket). The flag also stopped travelling through FlowGraph and FlowSnapshot, and decideLayout no longer has a groupByFolder-flip relayout branch (an impossible flip).
- Edges walked-from-center: EdgeVisibility.ts -> EdgeCounts.ts. The mode switch AND the induced-subgraph sweep are gone; EdgeCounts.attach() only attaches provider link counts to the truncator's walked pairs. WHY the deletion went past the ticket's file list: with no writer and no mode, the all-edges branch was unreachable code — leaving it would just move the dead config into the algorithm.

E2E FIXTURE REBUILD (the ticket's CALLOUT)
- harness.setEdgeVisibility() deleted. edgeRouting.e2e.ts and edgeRoutingEval.e2e.ts now raise the GLOBAL OUTGOING DEPTH to 2 instead. The ring fixture's diameter chords are sibling links, so a second outgoing hop WALKS them; the ring is closed, so the extra hop adds edges without adding nodes — same chord-crossing graph, produced by real traversal.
- The facing/ test in the same file explicitly restores default depths first (the ring test widens them globally).
- New engine test pins the mechanism: "WHEN the walk reaches the sibling link at depth 2 THEN it becomes an edge".

VERIFICATION
- npm run check, npm test: green (1131 passed).
- npm run test:e2e -- edgeRouting.e2e.ts: the routing/bend test (the one that needed the chords) PASSES.
- The facing-side test in that file FAILS — reproduced on an unmodified checkout too, so it is PRE-EXISTING and unrelated. Filed as nid_uv3al1mhaxmz37ooiit15iq0w_e.

TEST COVERAGE NOTES (transparency)
- Tests that used these fields purely as generic cascade/persistence carriers were re-pointed at nodePreviewPreference / nodeCap, not dropped.
- Genuinely deleted: the all-edges behaviour tests, the groupByFolder-off tests, the groupByFolder-flip relayout test, and the ViewSettingsResolver "boolean pinned to false" test (no boolean field remains in ViewSettings; the falsy-presence semantic stays covered by TraversalSettingsResolver's depth-0 test).
- Added: a persistence test proving the removed keys are dropped from an old data.json, matching the existing layoutMode/edgeRouting precedent.

FOLLOW-UP: nid_puf4a4q6fgn5lpehh5dowfm1r_e — "all-edges" as a real, specced feature with UI (tagged decide).
