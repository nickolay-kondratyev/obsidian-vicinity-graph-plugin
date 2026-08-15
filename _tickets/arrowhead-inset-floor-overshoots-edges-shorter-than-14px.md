---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_ea12b9v9fpfvg7n1ssmeyw58u_e
title: "Arrowhead inset floor overshoots edges shorter than 14px"
status: in_progress
deps: []
links: []
created_iso: 2026-08-15T00:42:38Z
status_updated_iso: 2026-08-15T02:29:00Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
parent: nid_1gpbw8a2a3p09ny3kjl0u0az5_e
tags: [view, geometry]
---

ROOT CAUSE: src/view/edgeGeometry.ts arrowFromApproach — the inset is clamp(min=EDGE_ARROWHEAD_INSET_MIN_PX=14, max=48, len*0.12) but is never clamped to the EDGE LENGTH, so an edge shorter than 14px places the arrow tip PAST the far endpoint (length 10 → tip at -4, beyond the source on the wrong side). Short edges are reachable: facingSideAnchorsFor anchors on facing borders of two boxes that can sit a few px apart after drag/resize. Severity: misplaced glyph only — no NaN, direction correct for len >= 14.

FAILING TEST (committed as it.skip — UNSKIP as acceptance): src/view/edgeGeometry.test.ts, "WHEN the edge is shorter than the inset floor THEN the tip stays between the endpoints".

FIX SHAPE: clamp inset to min(inset, edgeLength) (or a fraction of it) in arrowFromApproach; check the source-side arrow anchor for the mirror-image overshoot too.

