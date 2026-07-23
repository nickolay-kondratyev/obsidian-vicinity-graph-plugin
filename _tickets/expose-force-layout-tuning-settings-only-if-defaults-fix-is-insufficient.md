---
id: nid_lhandama1t1d3q9z6p4jefa4i_e
title: "expose force-layout tuning settings (only if defaults fix is insufficient)"
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

Follow-up to the force-placement-quality ticket (dependency). Only do this if tuned defaults cannot satisfy differing vault shapes — good defaults beat settings (80/20).

If needed, expose at most 2-3 SEMANTIC sliders in src/view/VicinityGraphSettingTab.ts, not raw physics constants:
- "Spacing / density" → maps to D3_FORCE_COLLIDE_PADDING_PX + D3_FORCE_LINK_GAP_PX (src/view/constants.ts:120,126) and possibly D3_FORCE_CHARGE_STRENGTH (:117).
- "Link tightness" → forceLink strength override in src/view/d3ForceRefinement.ts.

Candidate knobs inventory (from planning discussion 2026-07-23): charge strength -300, link gap 40px, collide padding 20px, center pull 0.05, collide iterations 2 (all src/view/constants.ts:117-140); unset today: forceLink.strength, alphaDecay; elk seed: elk.force.model/iterations/repulsivePower (src/view/constants.ts:104).

Wiring pattern if implemented: new fields on ViewSettings (src/engine/types.ts) + defaults (src/engine/constants.ts) + resolver (src/engine/ViewSettingsResolver.ts) + settingsWritePlan command (src/view/settingsWritePlan.ts) + persistence with version field (src/persistence/persistedShapes.ts) + BDD tests, mirroring existing settings.

Decision gate: get explicit human approval on WHICH sliders (if any) before implementing.

## Acceptance Criteria

- Either: explicit decision recorded that defaults suffice and ticket closed without code; or approved sliders implemented with tests across write-plan/persistence/resolver.

