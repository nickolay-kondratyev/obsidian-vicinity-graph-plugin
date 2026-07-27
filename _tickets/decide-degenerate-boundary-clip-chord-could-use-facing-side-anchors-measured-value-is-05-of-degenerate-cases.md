---
id: nid_bq5k5gx5k3112otsbz1u0h7ba_e
title: "[decide] Degenerate boundary-clip chord could use facing-side anchors — measured value is ~0.5% of degenerate cases"
status: open
deps: []
links: [nid_var2o7krxq7ribq3iofni3aw1_e]
created_iso: 2026-07-27T21:38:41Z
status_updated_iso: 2026-07-27T21:38:41Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
---

Follow-up from the review of `feat/side-aware-straight-edge-anchoring` (ticket `nid_var2o7krxq7ribq3iofni3aw1_e`), review item B2(b).

## Context

`clipRouteToEndpointRects` (`src/view/edgeGeometry.ts`) falls back to the UNCLIPPED 2-point centre→centre chord when clipping would consume the whole polyline (overlapping/nested endpoint rects). That chord plunges into both boxes. The new `facingSideAnchorsFor` in the same file computes border anchors for exactly this kind of geometry, so the reviewer proposed feeding it into that fallback.

## Why it was NOT implemented (measured, not assumed)

Brute force over 200k random rect pairs (scratch harness, not committed), classifying every case where the clip degenerates back to the raw chord:

- route = 2-point centre→centre chord (the case the proposal names): **0 of ~37,700 degenerate cases** had usable facing-side anchors. Degeneracy for a chord means one box swallows the other box's border crossing, which is exactly when the anchors come out reversed/inside and `facingSideAnchorsFor` returns null. The two conditions are mutually exclusive — wiring them together would be a guaranteed no-op. Pinned by a test in `src/view/edgeGeometry.test.ts` ("WHEN the centre→centre chord DEGENERATES on overlapping boxes THEN there is no facing side either").
- route = 3-point (a real libavoid polyline with an interior vertex): **191 of ~37,600 (~0.5%)** had usable anchors — all corner-overlapping boxes.

So the change would touch the ROUTED branch (explicitly out of this ticket's scope) to affect ~0.5% of an already-rare fallback, with no guarantee the resulting anchors sit outside both boxes in corner-overlap geometry.

## Decision needed

Accept the current behaviour (degenerate chord stays a raw centre→centre chord) and close this, OR implement the ~5-line change in `clipRouteToEndpointRects`: when `facingSideAnchorsFor(sourceRect, targetRect)` is non-null, emit those two points instead of the chord; keep the chord as the second fallback. If implemented it MUST be unit-tested in `src/view/edgeGeometry.test.ts` and the corner-overlap case checked for anchors landing inside the other box.

