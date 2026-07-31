---
id: nid_uwnew3dok0gn8ijar54hiozst_e
title: "pre-release force-layout tuning: tune sliders on real vaults, bake chosen values into constants defaults"
status: punted
deps: []
links: []
created_iso: 2026-07-24T04:48:50Z
status_updated_iso: 2026-07-24T04:48:50Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [layout, force, release, settings]
---

Follow-through from ticket _tickets/04-expose-4-force-layout-sliders-mirroring-native-graph.md (closed): the sliders are the pre-release tuning harness.

HUMAN tunes on real vaults via the shipped sliders (Settings -> Vicinity Graph: native-parity Center/Repel/Link force + Link distance; Advanced: Node spacing, Group member spacing).

Then bake the chosen values back as defaults:
- Update force defaults in src/engine/constants.ts (single source: FORCE_LAYOUT_DEFAULTS / FORCE_LAYOUT_RANGES area) and any mirrored WHY comments in src/view/constants.ts.
- Update WHY comments to reflect tuning rationale.
- Keep sliders shipped; only defaults change.
- Verify: npm test + npm run check pass; ticket-03 stranding metric test green at new defaults (adjust ONLY with explicit human alignment if new defaults shift the metric).

Context: .ai_out/04-force-layout-sliders/main/IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md documents ranges/defaults wiring.


## Notes

**2026-07-26T15:30:39Z**

[decide] Remaining work is a subjective tuning pass on real vaults that only the maintainer can perform and judge. Partial progress: commit 22bd5cb baked collidePaddingPx 20->50 and linkGapPx max 150->250 (src/engine/SettingsSpec.ts:243,255). elkNodeSpacingPx has since been baked 40->20 with a recorded, measured rationale (src/engine/SettingsSpec.ts) — no longer part of this ticket. Still at the ship-time defaults: centerPullStrength 0.05, repelStrength 300, linkStrengthFactor 1, linkGapPx 40 — and no tuning rationale recorded.

**2026-07-29T17:28:25Z**

DECISION (owner, 2026-07-29): DOWNGRADE to a post-release feedback item. Does NOT block release.

Ship the current force-layout defaults. Tune later from real usage rather than from a speculative
pre-release session.

WHY: the sliders are already shipped, and every default already carries a reasoned range comment, so
the remaining delta is TASTE, not correctness -- and taste cannot be validated against a user base
that does not exist yet. Unpublished repo means changing a default later is a free clean break, so
deferring costs nothing and buys real signal.

CORRECTION to the ticket body: defaults now live in src/engine/SettingsSpec.ts:209-247 as the single
source. constants.ts only DERIVES FORCE_LAYOUT_RANGES from the spec -- do not edit constants.ts for
this. Also out of scope / already baked: collidePaddingPx (50), linkGapPx max (250),
elkNodeSpacingPx.

In scope when this is picked up: centerPullStrength 0.05, repelStrength 300, linkStrengthFactor 1,
linkGapPx 40. Bake chosen values WITH a WHY comment recording what vault shape drove each.
