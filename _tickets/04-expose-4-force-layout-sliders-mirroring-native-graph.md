---
closed_iso: 2026-07-24T04:48:36Z
id: nid_lhandama1t1d3q9z6p4jefa4i_e
title: "expose force-layout tuning sliders: native-graph 4 + advanced spacing knobs (pre-release tuning harness)"
status: closed
deps: [nid_apkpp62otiz0qhxlxoqhe5l1r_e]
links: []
created_iso: 2026-07-23T23:34:33Z
status_updated_iso: 2026-07-24T04:48:36Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [layout, force, settings]
---

Follow-up to the force-placement-quality ticket (dependency). DECIDED (see note below): expose 4 sliders named to match Obsidian's NATIVE graph view (Center force / Repel force / Link force / Link distance) — POLS consistency with what users already know. Superseded earlier "only if defaults insufficient" framing.

Candidate knobs inventory (from planning discussion 2026-07-23): charge strength -300, link gap 40px, collide padding 20px, center pull 0.05, collide iterations 2 (all src/view/constants.ts:117-140); unset today: forceLink.strength, alphaDecay; elk seed: elk.force.model/iterations/repulsivePower (src/view/constants.ts:104).

Wiring pattern: new fields on ViewSettings (src/engine/types.ts) + defaults (src/engine/constants.ts) + resolver (src/engine/ViewSettingsResolver.ts) + settingsWritePlan command (src/view/settingsWritePlan.ts) + persistence with version field (src/persistence/persistedShapes.ts) + BDD tests, mirroring existing settings.

## Acceptance Criteria

- **Native-parity section** — 4 sliders named to match Obsidian's native graph view:
  Center force, Repel force, Link force, Link distance.
- **Advanced section** (collapsible/secondary, plainly labeled) — the remaining knobs
  that shape layout aesthetics:
  - Node spacing → `D3_FORCE_COLLIDE_PADDING_PX` (src/view/constants.ts:103) — min gap
    the rect-collide force enforces per box pair (the "too tight between neighbours" knob).
  - Group member spacing → `ELK_NODE_SPACING` (src/view/constants.ts:65) — gap between
    member notes inside folder-group containers (also feeds the elk seed).
- Ranges clamped so degenerate combos are unreachable (center pull well below link
  strength; spacings bounded so containers/labels never overlap).
- Sliders take effect on the rendered graph without plugin reload (re-run layout on change).
- Defaults equal the values landed by the placement-quality ticket; a restore-defaults
  affordance exists.
- Tests across write-plan/persistence/resolver; npm test + npm run check pass.
- The ticket-03 stranding metric test stays green at defaults (sliders must not change
  default behavior).

### Explicitly INTERNAL (not exposed) — WHY
- `D3_FORCE_COLLIDE_ITERATIONS` — overlap-resolution quality/perf, not layout taste;
  prototype showed 3 passes gain nothing over 2.
- `alphaDecay` / tick count — convergence mechanics; changing it trades determinism/perf,
  not aesthetics.
- `ELK_GROUP_PADDING` — inner container padding is coupled to the folder-name label
  reserve (top=36); a slider could clip labels.
- elk seed force params (model/iterations/repulsivePower) — seed only; the d3 refinement
  owns final geometry. Revisit only if tuning shows seed-induced local minima.

### Post-tuning follow-through (part of this ticket's purpose)
This is ALSO the pre-release tuning harness: human tunes via sliders on real vaults,
then the chosen values are baked back into `src/view/constants.ts` defaults (with WHY
comments updated) before release. Sliders stay shipped afterwards.


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

**2026-07-23 (post ticket-03 ship)**

DECISION (human-aligned): scope WIDENED from "exactly 4 sliders" to native-parity 4 + an
Advanced section (Node spacing, Group member spacing). Motivation: after the ticket-03
AABB collide fix the default layout reads too tight; sliders double as the pre-release
tuning harness — human tunes on real vaults, tuned values then become the new defaults.
Knob inventory refreshed against shipped code (post-AABB): charge -300, link gap 40,
collide padding 20 (now per-PAIR, rect collide), center pull 0.05, collide iterations 2,
forceLink.strength still d3-default/unset (the Link force slider introduces the explicit
override), ELK_NODE_SPACING "40".

**2026-07-24T04:48:36Z**

RESOLUTION (2026-07-23): Shipped via TOP_LEVEL_AGENT flow (.ai_out/04-force-layout-sliders/main/). 6 sliders: native-parity (Center force, Repel force, Link force, Link distance) + Advanced (Node spacing, Group member spacing). Wired ViewSettings -> engine defaults/resolver -> settingsWritePlan -> persistence (versioned) -> settings tab; live re-layout without reload; restore-defaults; clamped ranges as named constants (FORCE_LAYOUT_RANGES). Link force introduces explicit forceLink.strength override whose default reproduces d3 unset behavior (verified bit-identical). Defaults == ticket-03 shipped values; stranding metric test unmodified and green. Review: APPROVED (2 minors fixed, 1 nit rejected: no debounce). npm test 729 PASS, npm run check PASS. Pre-release tuning + bake-back of tuned defaults tracked in follow-up ticket.
