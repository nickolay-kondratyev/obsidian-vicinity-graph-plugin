---
id: nid_uwnew3dok0gn8ijar54hiozst_e
title: "pre-release force-layout tuning: tune sliders on real vaults, bake chosen values into constants defaults"
status: open
deps: []
links: []
created_iso: 2026-07-24T04:48:50Z
status_updated_iso: 2026-07-24T04:48:50Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [layout, force, release]
---

Follow-through from ticket _tickets/04-expose-4-force-layout-sliders-mirroring-native-graph.md (closed): the sliders are the pre-release tuning harness.

HUMAN tunes on real vaults via the shipped sliders (Settings -> Vicinity Graph: native-parity Center/Repel/Link force + Link distance; Advanced: Node spacing, Group member spacing).

Then bake the chosen values back as defaults:
- Update force defaults in src/engine/constants.ts (single source: FORCE_LAYOUT_DEFAULTS / FORCE_LAYOUT_RANGES area) and any mirrored WHY comments in src/view/constants.ts.
- Update WHY comments to reflect tuning rationale.
- Keep sliders shipped; only defaults change.
- Verify: npm test + npm run check pass; ticket-03 stranding metric test green at new defaults (adjust ONLY with explicit human alignment if new defaults shift the metric).

Context: .ai_out/04-force-layout-sliders/main/IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md documents ranges/defaults wiring.

