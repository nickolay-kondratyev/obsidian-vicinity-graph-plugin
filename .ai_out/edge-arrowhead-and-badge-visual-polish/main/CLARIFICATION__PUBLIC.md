# CLARIFICATION — Edge arrowhead + badge polish

## Decision: proceed, no blocking human questions
Ticket is explicit on WHAT. Remaining choices are visual taste, best judged on concrete
before/after screenshots at review time (not abstract pre-alignment). Implementation MUST
produce both-theme screenshots for human judgment.

## Constraints resolved (from EXPLORATION_PUBLIC.md)
1. **Arrowhead color is LOCKED to `var(--text-faint)`** by e2e contract
   (neighborhoodGraph.e2e.ts:157-176, both themes) + §7. So legibility levers are
   **SIZE** (EDGE_ARROWHEAD_SIZE) and **GEOMETRY SEPARATION** (EDGE_PAIR_CURVATURE_PX) and
   marker shape — NOT color. Must keep rendering as `<polyline>` inside `.react-flow__arrowhead`.
2. **Marker must always stay attached** (`marker-end: url(...)` on every edge path).
3. **Badge**: keep text `×N` and `data-count` (unit + e2e asserted). Restyle for cleaner/less
   cluttered look. It currently shares one CSS rule block with the folder-group `+N` badge —
   split into its own block to restyle independently (folder badge was NOT flagged).
4. If curvature changes, update `edgeGeometry.test.ts` exact-string asserts in lockstep
   (these are geometry-constant asserts, not behavior-capturing tests being weakened).
5. CSS-first, theme-variable-driven, zero fixed colors.

## Success criteria
- Arrowheads clearly legible at normal zoom, both themes; mirrored A↔B pair individually
  visible (no overlap/clipping near shared node).
- Badge visibly cleaner/less cluttered.
- `npm test` + `npm run check` green; e2e contract preserved.
- Screenshots (light + dark) produced for human sign-off.
