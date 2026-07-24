---
id: nid_lhandama1t1d3q9z6p4jefa4i_e
title: "expose 4 force-layout sliders mirroring native graph (center/repel/link force, link distance)"
status: open
deps: [nid_apkpp62otiz0qhxlxoqhe5l1r_e]
links: []
created_iso: 2026-07-23T23:34:33Z
status_updated_iso: 2026-07-23T23:34:33Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [layout, force, settings]
---

Follow-up to the force-placement-quality ticket (dependency). DECIDED (see note below): expose 4 sliders named to match Obsidian's NATIVE graph view (Center force / Repel force / Link force / Link distance) — POLS consistency with what users already know. Superseded earlier "only if defaults insufficient" framing.

Candidate knobs inventory (from planning discussion 2026-07-23): charge strength -300, link gap 40px, collide padding 20px, center pull 0.05, collide iterations 2 (all src/view/constants.ts:117-140); unset today: forceLink.strength, alphaDecay; elk seed: elk.force.model/iterations/repulsivePower (src/view/constants.ts:104).

Wiring pattern: new fields on ViewSettings (src/engine/types.ts) + defaults (src/engine/constants.ts) + resolver (src/engine/ViewSettingsResolver.ts) + settingsWritePlan command (src/view/settingsWritePlan.ts) + persistence with version field (src/persistence/persistedShapes.ts) + BDD tests, mirroring existing settings.

## Acceptance Criteria

- 4 sliders (Center force, Repel force, Link force, Link distance) in the settings tab, named to match Obsidian's native graph view.
- Ranges clamped so degenerate combos are unreachable (center pull well below link strength).
- Defaults equal the values landed by the placement-quality ticket; a restore-defaults affordance exists.
- Tests across write-plan/persistence/resolver; npm test + npm run check pass.


## Notes

**2026-07-23T23:37:40Z**

DECISION (2026-07-23, human-aligned): DO expose sliders — no longer gated on "only if defaults insufficient". Rationale: Obsidian NATIVE graph view already exposes Center force / Repel force / Link force / Link distance sliders; mirroring them is POLS-consistent and users expect it.

Scope: exactly 4 sliders in src/view/VicinityGraphSettingTab.ts, named to match native graph:
- Center force -> D3_FORCE_CENTER_PULL_STRENGTH (src/view/constants.ts:133)
- Repel force -> D3_FORCE_CHARGE_STRENGTH (src/view/constants.ts:117)
- Link force -> forceLink.strength() override (wired by dependency ticket nid_apkpp62otiz0qhxlxoqhe5l1r_e)
- Link distance -> D3_FORCE_LINK_GAP_PX (src/view/constants.ts:120)

Constraints:
- CLAMPED ranges chosen so degenerate combos are unreachable (center pull must stay well below link strength or graph collapses onto hub — see WHY at src/view/constants.ts:129-133).
- Defaults = values landed by the placement-quality ticket; sliders default to those, plus a "restore defaults" affordance.
- Collide padding / alpha decay / elk seed params stay INTERNAL (non-intuitive, overlapping semantics).
- Still depends on placement-quality ticket: sliders cannot fix the stranding bug (unset link strength + static local minimum); ship correct defaults first.
