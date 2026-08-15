---
closed_iso: 2026-08-15T02:31:06Z
session_ids: [{"a": "claude", "type": "execution", "id": "6a22ae2b-83bf-4a05-baa5-96948d39a65d"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_ea12b9v9fpfvg7n1ssmeyw58u_e
title: "Arrowhead inset floor overshoots edges shorter than 14px"
status: closed
deps: []
links: []
created_iso: 2026-08-15T00:42:38Z
status_updated_iso: 2026-08-15T02:31:06Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
parent: nid_1gpbw8a2a3p09ny3kjl0u0az5_e
tags: [view, geometry]
---

ROOT CAUSE: src/view/edgeGeometry.ts arrowFromApproach — the inset is clamp(min=EDGE_ARROWHEAD_INSET_MIN_PX=14, max=48, len*0.12) but is never clamped to the EDGE LENGTH, so an edge shorter than 14px places the arrow tip PAST the far endpoint (length 10 → tip at -4, beyond the source on the wrong side). Short edges are reachable: facingSideAnchorsFor anchors on facing borders of two boxes that can sit a few px apart after drag/resize. Severity: misplaced glyph only — no NaN, direction correct for len >= 14.

FAILING TEST (committed as it.skip — UNSKIP as acceptance): src/view/edgeGeometry.test.ts, "WHEN the edge is shorter than the inset floor THEN the tip stays between the endpoints".

FIX SHAPE: clamp inset to min(inset, edgeLength) (or a fraction of it) in arrowFromApproach; check the source-side arrow anchor for the mirror-image overshoot too.

## Resolution (2026-08-15, commit 0b6162f)

Fixed in `src/view/edgeGeometry.ts` `arrowFromApproach`: `edgeLength` was added as a third term to the inset `Math.min`, so the inset can never exceed the edge length. Clamping to the FULL length (not a fraction) was chosen as the minimal change: for any `edgeLength >= EDGE_ARROWHEAD_INSET_MIN_PX` the old clamp already yields `<= edgeLength`, so behavior changes ONLY for the buggy sub-14px edges — the tip now lands at worst ON the far endpoint. The source-side anchor needed no separate fix: it flows through the same `arrowFromApproach` (mirrored direction), so the one clamp covers both ends; a mirror-image test pins that.

Acceptance: the committed `it.skip` in `src/view/edgeGeometry.test.ts` was unskipped (fails before the fix, `arrowX = -4`) plus a new source-side sibling test. Verified: `npm test` (2112 passed), `npm run check`, and `npm run test:e2e -- vicinityGraph.e2e.ts` (27 passed) all green.

