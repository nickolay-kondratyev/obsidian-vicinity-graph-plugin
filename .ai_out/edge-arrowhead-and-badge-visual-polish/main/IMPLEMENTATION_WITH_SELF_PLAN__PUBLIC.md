# IMPLEMENTATION — Edge arrowhead + "×N" badge visual polish (PUBLIC)

For REVIEWER + TOP_LEVEL_AGENT. Context/contract in EXPLORATION_PUBLIC.md +
CLARIFICATION__PUBLIC.md (not duplicated here). No commit made (TOP_LEVEL owns commits).

## Files changed (before → after)

| File | Change | Rationale |
|------|--------|-----------|
| `src/view/NeighborhoodGraphFlow.tsx` | `EDGE_ARROWHEAD_SIZE` **18 → 24** (+ doc comment rewrite) | RF's ArrowClosed triangle fills only a quarter of its 20×20 marker viewBox; with `markerUnits=strokeWidth × --xy-edge-stroke-width 1.5`, size 24 → ~9×14.4px visible head (was ~6.75×10.8). Directly answers "can't see the arrowheads well". Color untouched (locked to `--text-faint`). |
| `src/view/edgeGeometry.ts` | `EDGE_PAIR_CURVATURE_PX` **24 → 34** (+ WHY comment) | The tight bow let each incoming arrowhead overlap the returning edge near the shared node (read as one clipped smudge). Wider separation fans the two mirrored curves apart at their endpoints so each arrowhead is individually legible. |
| `src/view/graph-view.css` | **Split** the shared badge rule block; restyled ONLY the edge badge | Folder-group `+N` badge (`.neighborhood-graph-group__badge`) kept its bordered-chip look unchanged (not flagged). Edge `×N` badge (`.neighborhood-graph-edge__count-badge`) → borderless **pill**: dropped the 1px border, `border-radius: var(--radius-l)`, `box-shadow: var(--shadow-s)`, tight padding; kept solid `--background-primary` fill (occludes the edge line under the digits) + `--text-muted`. Cleaner/less-cluttered per the smoke-run note. All theme vars — zero own colors. |

## Contract preservation (EXPLORATION §3)
- Arrowhead still renders as `<polyline>` inside `.react-flow__arrowhead`; color override
  (`stroke/fill: var(--text-faint) !important`) UNTOUCHED → e2e both-theme color asserts hold.
- Every edge path keeps `marker-end: url(...)` (only the marker SIZE changed).
- Badge text still `×N` + `data-count` (only styling changed) → unit + e2e asserts hold.
- `edgeGeometry.test.ts` needed NO edit: its paired-path/label asserts interpolate the
  `EDGE_PAIR_CURVATURE_PX` symbol, so they auto-follow 24→34; the literal-string
  straight-line/degenerate asserts are curvature-independent (no path-shortening added).

## Tests run
- `npm run check` (tsc -noEmit) → **PASS**.
- `npm test` (vitest run + sublib) → **PASS** (69 vitest tests green).
- `npm run test:e2e` → **NOT run** — this environment has no Obsidian binary (`OBSIDIAN_PATH`),
  no display, no xvfb. The e2e contract is preserved by construction (see above); it should
  be run in a display-capable env before release.

## Screenshots — PROXY render (both themes)
Real-Obsidian screenshots are NOT possible in this env (no display / no Obsidian binary).
Built a FAITHFUL standalone proxy (`.tmp/render-proxy.mjs`, playwright chromium) that
reproduces RF's exact arrowhead marker markup, the 1.5 edge stroke-width, the edgeGeometry
quadratic, and the graph-view.css badge/arrowhead theming, using representative Obsidian
default light/dark theme-var values. Before (18 / 24 / bordered chip) vs After (24 / 34 /
pill) side-by-side:
- `.out/edge-badge-polish/edge-badge-dark.png`
- `.out/edge-badge-polish/edge-badge-light.png`

Shows: after arrowheads are clearly larger, clean solid triangles with legible direction;
the wider curvature separates the two mirrored heads near each node; the badge reads as a
soft floating pill instead of a boxed chip. **CAVEAT:** faithful for marker geometry + CSS,
but NOT the live view (no elk layout; real theme hues differ slightly) — treat as a strong
proxy pending a real-render eyeball.

## #QUESTION_FOR_HUMAN
- Size 24 / curvature 34 are taste calls tuned on the proxy. Please confirm on a real
  render. If heads still read faint, the next lever is size 24→28 and/or a small
  node-gap path-shortening (that path change WOULD require updating the literal-string
  asserts in `edgeGeometry.test.ts`). Flag if you want me to push further.
