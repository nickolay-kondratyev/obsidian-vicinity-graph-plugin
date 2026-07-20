# Ticket: Edge visual polish — arrowhead clarity + collapsed-count badge

**Status:** RESOLVED (2026-07-20) — pending human real-render confirmation of the size/curvature taste calls (see Resolution).
**Origin:** step-05 human smoke run (2026-07-20), QA_CHECKLIST §4. Also absorbs
the deferred Phase-B review NIT on arrowhead size.

## Resolution (2026-07-20)

Implemented + independently reviewed (verdict READY, 0 blockers). See
`.ai_out/edge-arrowhead-and-badge-visual-polish/main/` (IMPLEMENTATION / REVIEW PUBLIC docs).

- **Arrowheads**: `EDGE_ARROWHEAD_SIZE` 18→24 (`NeighborhoodGraphFlow.tsx`) for legible
  direction; `EDGE_PAIR_CURVATURE_PX` 24→34 (`edgeGeometry.ts`) so the mirrored A↔B pair
  fans apart and each head is individually visible near the shared node. Color stays
  `--text-faint` (locked by e2e contract; the levers were size + geometry, not color).
- **"×N" badge**: split from the shared folder-badge CSS block; restyled to a borderless,
  theme-var pill (`--radius-l` + `--shadow-s`, tight padding) — folder `+N` badge unchanged.
- All theme-variable-driven, zero hardcoded colors. `npm run check` + `npm test`
  (451 root + 69 sublib) green. Contract preserved (polyline arrowhead + `--text-faint`
  override, `marker-end url()`, `×N` text + `data-count`).

**Open verification (human):**
1. Size 24 / curvature 34 are taste calls tuned on a faithful chromium **proxy**
   (`.out/edge-badge-polish/edge-badge-{dark,light}.png`), not a live Obsidian render —
   confirm on a real render at normal zoom. Next lever if still faint: size 24→28 and/or a
   small node-gap path-shortening (that path change would require updating the literal-string
   asserts in `edgeGeometry.test.ts`).
2. `npm run test:e2e` could not run in this env (no display / no Obsidian binary) — run in a
   display-capable env before release to confirm the both-theme arrowhead-color assert.

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
