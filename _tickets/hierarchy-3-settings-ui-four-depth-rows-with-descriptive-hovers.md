---
session_ids: [{"a": "claude", "type": "execution", "id": "feeb841b-870d-40b7-86f8-5163bec32a54"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_i3cznjkcnelqzvhp0gqlis499_e
title: "Hierarchy 3: settings UI - four depth rows with descriptive hovers"
status: in_progress
deps: [nid_dit8h888p2ml3092b2zn4zy3u_e]
links: [nid_ri1d36t7hmhu0kr652wny1dmz_e, nid_dit8h888p2ml3092b2zn4zy3u_e, nid_bw8hltfj3nsyas03mpfmqn7mg_e, nid_f5bfjoymr2pt7odxieunkxasd_e, nid_eymj85m7qccbpkoo4qj6b1q6t_e, nid_uxugk82jeu4cfj5ujyk4l79e7_e]
created_iso: 2026-08-13T15:35:42Z
status_updated_iso: 2026-08-13T17:23:00Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: [ui, settings]
---

Settings rows for the new depth dials. Full spec in body.


Design record: ticket `nid_ri1d36t7hmhu0kr652wny1dmz_e` (closed PLAN). Depends on
Hierarchy 1 (`nid_dit8h888p2ml3092b2zn4zy3u_e`) for the spec leaves.

## Scope (src/view/ settings surfaces)

Declare 4 rows in the EXISTING Depth group of `src/view/settingsRows.ts`:
"Descendants", "Ancestors", "Pinned descendants", "Pinned ancestors" — same control
kind as the existing depth rows (slider on tab, compact stepper on panel). Each row's
description is a DESCRIPTIVE explanation of the folder-note convention (owner ask),
e.g.: "Folder-note children: `Jon.md` or `Jon/Jon.md` is the folder note of `Jon/`;
notes inside that folder are its descendants. Depth = folder levels. 0 = off."
Wire accessors in `src/view/settingsRowAccessors.ts` ({read, bounds, settlesAt,
interaction} from the SAME spec leaves — no literal ranges in presenters).

The structural tripwires do the checklist: spec walk suites, row parity
(`settingsRowParity.test.ts`), spec coverage (`settingsRowSpecCoverage.test.ts` —
remove any allowlist entry Hierarchy 1 added), product defaults table. Both
presenters render via the closed `switch` — expect ZERO presenter code changes if
the control kind is reused; only declarations.

## Verification

`npm test` + `npm run test:e2e` (settings tab has NO npm-test coverage; a rendered
row with its hover text must be proven in real Obsidian — coordinate with
Hierarchy 5, but at minimum run the existing settings e2e specs green).
