---
closed_iso: 2026-08-13T17:26:21Z
session_ids: [{"a": "claude", "type": "execution", "id": "feeb841b-870d-40b7-86f8-5163bec32a54"}, {"a": "claude", "type": "review", "id": "427ebe24-1cfc-4ba7-a7b0-9546ec65635d"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_i3cznjkcnelqzvhp0gqlis499_e
title: "Hierarchy 3: settings UI - four depth rows with descriptive hovers"
status: closed
deps: [nid_dit8h888p2ml3092b2zn4zy3u_e]
links: [nid_ri1d36t7hmhu0kr652wny1dmz_e, nid_dit8h888p2ml3092b2zn4zy3u_e, nid_bw8hltfj3nsyas03mpfmqn7mg_e, nid_f5bfjoymr2pt7odxieunkxasd_e, nid_eymj85m7qccbpkoo4qj6b1q6t_e, nid_uxugk82jeu4cfj5ujyk4l79e7_e]
created_iso: 2026-08-13T15:35:42Z
status_updated_iso: 2026-08-13T17:26:21Z
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

## Resolution (2026-08-13)

Purely declarative, as the ticket predicted — ZERO presenter/accessor code
changes.

**What was built.** Four rows added to the EXISTING `depth-defaults` group in
`src/view/settingsRows.ts`:

- Active-note block (`From the active note`), after "Links in": **Descendants**
  (`descendantDepth`) and **Ancestors** (`ancestorDepth`).
- Pinned block (`From each pinned note`), after "Pinned links in": **Pinned
  descendants** (`pinnedDescendantDepth`) and **Pinned ancestors**
  (`pinnedAncestorDepth`).

All four reuse the existing `{ kind: "depth", field }` control (slider on tab,
compact stepper on panel), so both presenters' closed `switch` already render
them and `SettingsRowAccessors.depth(field)` already wires
`{read, bounds, settlesAt, interaction}` from each field's own
`SETTINGS_SPEC.globalDepths[field]` leaf — no new accessor, no literal ranges in
any presenter.

Each row's `description` is the descriptive folder-note explanation (owner ask):
Descendants leads with the `Jon.md`/`Jon/Jon.md` folder-note example, Ancestors
with the parent-chain, and the two Pinned rows cross-reference them plus the
standard "a pinned note that is also the active note uses the active-note
depths" note. Same string is the tab row description and the panel's `title`
tooltip (zero drift, by the existing row model).

**Allowlist removed.** The four `REACHABLE_LATER` entries in
`src/view/settingsRowSpecCoverage.test.ts` (the conscious Hierarchy-1 gap) were
deleted and the map is now `{}`; its doc comment records why. The coverage
tripwire now proves each field has exactly one row.

**Verification.** `npm run check` (green), `npm test` — 1963 passed (the
structural tripwires did the checklist: spec-walk suites, `settingsRowParity`,
`settingsRowSpecCoverage`, product-defaults table). `npm run test:e2e` over all
five settings specs (`settingsUxVisual`, `settingsResetReview`,
`settingsResetVerify`, `settingsTypedInput`, `settingsDependentRows`) — 55
passed, including the settings-tab accessible-name walk that renders every input
in real Obsidian.

No CSS, no build-artifact, and no e2e-submodule changes were needed.
