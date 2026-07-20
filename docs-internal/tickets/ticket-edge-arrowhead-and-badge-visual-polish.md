# Ticket: Edge visual polish — arrowhead clarity + collapsed-count badge

**Status:** OPEN
**Origin:** step-05 human smoke run (2026-07-20), QA_CHECKLIST §4. Also absorbs
the deferred Phase-B review NIT on arrowhead size.

## Context

Edge direction/pairing/count are functionally correct and e2e-asserted (marker
presence + theme color, "×N" badge text). But **visual quality is human-judged
and the smoke run flagged two issues** that automation does not catch:

1. **Arrowheads don't render cleanly** (§4). The human "can't see the arrowheads
   well" and the mirrored A↔B curved-pair arrows read as not rendering cleanly.
   Current size is `EDGE_ARROWHEAD_SIZE=18` in `markerUnits: strokeWidth` (× the
   1.5 stroke width) — `NeighborhoodGraphFlow.tsx` already flags final tuning as
   smoke-run work. Investigate: arrowhead size/shape at typical zoom, whether the
   mirrored curvature offset (`edgeGeometry.ts`) leaves the two arrowheads
   overlapping or clipped, and marker anchoring on curved paths.
2. **"×N" collapsed-count badge styling** (§4) — functionally right, human wants
   it styled cleaner (less cluttered at the edge midpoint).

## Scope

- Tune arrowhead size/shape so direction is clearly legible at normal zoom, in
  both light and dark themes (must stay theme-driven — no fixed gray).
- Ensure mirrored A↔B pair arrows are individually visible (no overlap/clipping).
- Restyle the "×N" badge for a cleaner look.
- CSS-first per house style; keep changes theme-variable-driven.

## References

- `.ai_out/step-05-rich-rendering/main/QA_CHECKLIST.md` §4
- `src/view/NeighborhoodGraphFlow.tsx` (`EDGE_ARROWHEAD_SIZE`), `NeighborhoodEdge.tsx`,
  `edgeGeometry.ts`, `src/view/graph-view.css`
