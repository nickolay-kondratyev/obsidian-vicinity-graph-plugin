# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE memory

Task: edge arrowhead clarity + "×N" badge restyle. Branch main. Fresh start (no prior
private memory). Context from EXPLORATION_PUBLIC.md / CLARIFICATION__PUBLIC.md / ticket.

## Self-plan (as executed)
Goal: make arrowheads legible + mirrored pair individually visible, and clean up the
×N badge — CSS-first, theme-var-driven, without breaking the e2e/unit contract.
Levers allowed (color is LOCKED to --text-faint by e2e): SIZE, curvature SEPARATION,
badge CSS. Chose to bump both constants + split+restyle badge CSS. No path-shortening
(would churn the two literal-string edgeGeometry asserts and add RF marker-anchor risk
for little extra value — Pareto).

## Changes made (exact values)
1. `src/view/NeighborhoodGraphFlow.tsx` — `EDGE_ARROWHEAD_SIZE` 18 → **24** (+ rewrote
   the doc comment: effective 24×1.5=36px-equiv; noted the quarter-viewBox empty-margin
   reason the number must run large; removed the stale "final tuning belongs to smoke run"
   line since this IS that tuning).
2. `src/view/edgeGeometry.ts` — `EDGE_PAIR_CURVATURE_PX` 24 → **34** (+ WHY comment: the
   tight bow let each incoming arrowhead sit on top of the returning edge near the shared
   node; more separation fans the curves apart so each head is legible).
3. `src/view/graph-view.css` — SPLIT the shared badge rule block:
   - `.neighborhood-graph-group__badge` now its own block, UNCHANGED look (bordered chip,
     radius-s) — folder badge was not flagged.
   - `.neighborhood-graph-edge__count-badge` consolidated into ONE block: dropped the
     1px border; kept `background: var(--background-primary)` (occludes edge line under
     the digits for legibility); `border-radius: var(--radius-l)` (pill);
     `box-shadow: var(--shadow-s)`; `line-height: 1.5`; padding `0 var(--size-4-1)`;
     color `--text-muted`; font `--font-smallest`. Zero own colors.

## Why these values
- Arrowhead: RF ArrowClosed triangle fills only x:-5..0 (5u) of the 20u viewBox, and
  markerUnits=strokeWidth multiplies by --xy-edge-stroke-width 1.5. size 24 → box 36u,
  scale 1.8, visible triangle ≈ 9px × 14.4px (was ≈ 6.75 × 10.8 at 18). Meaningful, not
  grotesque. Judgment call — human confirms on real render.
- Curvature 34 (from 24): labelY offset = curv/2 = 17px; bows fan apart enough that the
  two heads separate near each node without the edges looking like balloons.

## Tests
- `npm run check` (tsc) → PASS (CHECK_EXIT=0).
- `npm test` (vitest + sublib) → PASS. 69 vitest tests pass.
- edgeGeometry.test.ts did NOT need editing: its paired-path/label asserts interpolate the
  `EDGE_PAIR_CURVATURE_PX` symbol (lines 18, 23), so they auto-follow 24→34. The only
  literal-string asserts are the straight-line / degenerate cases (unaffected — no
  curvature, and I did not add path-shortening). Verified green.
- e2e contract preserved (not run here — needs real Obsidian binary/display, unavailable):
  arrowhead still a `<polyline>` in `.react-flow__arrowhead`, color still --text-faint via
  the untouched `!important` override; every edge still has marker-end; badge still `×N` +
  data-count; only one edge badge.

## Screenshots (PROXY — see caveat)
Real Obsidian e2e is NOT runnable in this env: no DISPLAY, no OBSIDIAN_PATH binary, no
xvfb. Instead built a FAITHFUL standalone proxy: `.tmp/render-proxy.mjs` reproduces RF's
exact marker markup (viewBox -10 -10 20 20, markerUnits=strokeWidth, points
"-5,-4 0,0 -5,4 -5,-4", refX/refY 0, orient auto-start-reverse — copied from
node_modules/@xyflow/react/dist/esm/index.js:2443/2467), the 1.5 edge stroke-width, the
edgeGeometry quadratic, and graph-view.css badge/arrowhead theming, with representative
Obsidian default light/dark theme-var values. Rendered via playwright chromium (installed
here with `npx playwright install chromium`). Before (18/24/chip) vs After (24/34/pill)
side by side.
- `.out/edge-badge-polish/edge-badge-dark.png`
- `.out/edge-badge-polish/edge-badge-light.png`
Confirms: after arrowheads clearly larger + clean solid triangles; wider curvature
separates the two heads near each node; badge reads as soft floating pill vs boxed chip.
CAVEAT: proxy geometry/CSS are faithful but this is NOT the live view (no elk layout, real
theme hues differ slightly). Human should sanity-check on a real render.

## Open questions / follow-ups
- Exact size/curvature are taste; if human still finds heads faint on real render, next
  lever is size 24→28 and/or a small node-gap path-shortening (would need edgeGeometry
  literal asserts updated). Documented in PUBLIC as #QUESTION_FOR_HUMAN.
- Did NOT run real e2e (`npm run test:e2e`) — env lacks Obsidian binary + display.

## Do NOT
- Do not commit (TOP_LEVEL_AGENT owns commits).
- Do not weaken/skip tests.
