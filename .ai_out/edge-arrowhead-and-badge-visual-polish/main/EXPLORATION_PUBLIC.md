# EXPLORATION_PUBLIC — Edge arrowhead + "×N" badge visual polish

Concrete context for CLARIFICATION / PLANNING / IMPLEMENTATION / REVIEW.

## 1. Key file:line references

### `src/view/NeighborhoodGraphFlow.tsx`
- `EDGE_ARROWHEAD_SIZE` + comment: **lines 27-33**
  ```
  27 /**
  28  * Arrowhead size in React Flow's default `markerUnits: strokeWidth` units, NOT
  29  * px: the marker scales with `--xy-edge-stroke-width` (1.5 in graph-view.css),
  30  * so the effective size is 18 × 1.5 = 27px-equivalent. RF's default (12.5)
  31  * reads too faint at graph zoom levels; final tuning belongs to the smoke run.
  32  */
  33 const EDGE_ARROWHEAD_SIZE = 18;
  ```
- Marker wired in `toReactFlowEdge` (lines 126-139): `markerEnd: { type: MarkerType.ArrowClosed, width: EDGE_ARROWHEAD_SIZE, height: EDGE_ARROWHEAD_SIZE }`. **No color prop** — color comes purely from CSS override (§2). Threads `data: { count, hasOpposite }`.

### `src/view/NeighborhoodEdge.tsx` (52 lines)
- Renders `<BaseEdge id={id} path={geometry.path} markerEnd={markerEnd} />` (line 35) — markerEnd passed straight through from RF (`url(#...)`).
- Badge via `EdgeLabelRenderer` (lines 36-48): `<span className="neighborhood-graph-edge__count-badge" data-count={...}>` positioned `transform: translate(-50%, -50%) translate(labelX, labelY)` centered on geometry label point. `badge === null` (single link) renders nothing.

### `src/view/edgeGeometry.ts` (55 lines)
- `EDGE_PAIR_CURVATURE_PX = 24` (line 21) — perpendicular bow offset for A↔B pairs.
- `edgePathFor(sx,sy,tx,ty,hasOpposite)` (29-54): straight `M..L..` when no opposite; quadratic Bezier `M..Q control..end` bowed to right-of-travel unit normal when `hasOpposite`. Label at `midpoint + normal*curvature/2` (actual on-curve point at t=0.5). Each direction bows to its OWN right-of-travel → mirror automatically. No marker-orientation logic here.

### RF marker internals (`@xyflow/react`)
- `Marker`: `viewBox="-10 -10 20 20"`, `refX=0 refY=0`, `orient="auto-start-reverse"`, default 12.5×12.5, `markerUnits='strokeWidth'`.
- `ArrowClosedSymbol`: `<polyline className="arrowclosed" points="-5,-4 0,0 -5,4 -5,-4" />` — tip at (0,0) anchored to path endpoint; base at x=-5, y:-4..4. Triangle occupies only a quarter of the 20×20 viewBox; rest is empty margin (uniform size scaling scales the margin too).
- `orient="auto-start-reverse"` → arrow follows curve end tangent, so mirrored-pair arrows point correctly along each curve. The "overlap/clipped" complaint is most likely **size/contrast/geometry-convergence near shared node**, not an orientation bug.
- `markerUnits='strokeWidth'` (not overridden) → size multiplies by `--xy-edge-stroke-width: 1.5`.

## 2. CSS classes + theme variables (`src/view/graph-view.css`)
- CSS is the SOURCE (compiled to shipped `styles.css` via esbuild). Hard constraint: **every color from an Obsidian theme variable; plugin ships zero own colors**. CSS-first, theme-var-driven, no fixed gray.
- RF re-theming vars (14-30): `--xy-edge-stroke: var(--text-faint)` (21), `--xy-edge-stroke-selected: var(--text-muted)` (22), `--xy-edge-stroke-width: 1.5` (23).
- Arrowhead color override (32-47):
  ```css
  .neighborhood-graph-flow .react-flow__arrowhead polyline {
      stroke: var(--text-faint) !important;
      fill: var(--text-faint) !important;
  }
  ```
  RF stamps `#b1b1b7` inline on the marker polyline → `!important` required. JS color prop intentionally avoided (would serialize into marker id / break "zero own colors"). Knowingly accepted: selected edge path brightens but arrowhead (shared `<defs>` marker) stays `--text-faint` (graph is read-only).
- Badge CSS (259-276) — **shared rule block** with folder-group `+N` badge:
  ```css
  .neighborhood-graph-group__badge,
  .neighborhood-graph-edge__count-badge {
      font-size: var(--font-smallest); line-height: 1.6;
      padding: 0 var(--size-4-1); color: var(--text-muted);
      background: var(--background-primary);
      border: 1px solid var(--background-modifier-border);
      border-radius: var(--radius-s);
  }
  .neighborhood-graph-edge__count-badge { position: absolute; pointer-events: none; }
  ```
  Polish must either keep both consistent or intentionally split the rule blocks.
- Theme vars available in file: `--background-modifier-border`, `--text-faint`, `--text-muted`, `--text-normal`, `--background-primary`, `--background-secondary`, `--background-modifier-hover`, `--interactive-accent`, `--radius-s`, `--radius-l`, `--shadow-s`, `--font-smallest`, `--font-ui-smaller`, `--font-medium`, `--size-4-1`, `--size-4-2`, `--size-4-3`.

## 3. Automated test contract — MUST NOT BREAK
### `src/view/edgeGeometry.test.ts`
- No opposite: path `"M 0,0 L 100,0"`, label at exact midpoint.
- With opposite: path `` `M 0,0 Q 50,${EDGE_PAIR_CURVATURE_PX} 100,0` ``, label at `(50, EDGE_PAIR_CURVATURE_PX/2)`.
- Mirrored pair: `backward.labelY === -forward.labelY`.
- Degenerate: `M 10,10 L 10,10`.
- ⚠ Any geometry change (curvature amount, path shape, path-shortening for bigger arrowhead) breaks exact-string asserts unless test updated in lockstep.

### `src/view/badgeText.test.ts`
- `linkCountBadgeText(2) === "×2"`, `linkCountBadgeText(1) === null`. Don't change "×N" text format without updating.

### `e2e/neighborhoodGraph.e2e.ts` (Playwright, real Obsidian)
- `RF_DEFAULT_ARROWHEAD_COLOR = "rgb(177,177,183)"` must **never** be the arrowhead computed stroke (46-47).
- Exactly one `.neighborhood-graph-edge__count-badge`, text `"×2"`, `data-count="2"` (108-113).
- Every `.react-flow__edge-path` has `marker-end` matching `/url\(/` (115-121) — marker always attached.
- Loop `["dark","light"]` (157-176): `getComputedStyle(polyline).stroke` === resolved `var(--text-faint)` exactly, never RF default. → selector `.neighborhood-graph-flow .react-flow__arrowhead polyline` + `stroke/fill: var(--text-faint) !important` must be preserved (or equivalent kept working). New arrowhead must still render as `polyline` inside `.react-flow__arrowhead` OR e2e updated in coordination.

## 4. Smoke-run tuning flag
Only one hit in `src/`: `NeighborhoodGraphFlow.tsx:31` — "final tuning belongs to the smoke run." This is the TODO the task resolves.

## 5. QA_CHECKLIST §4 / §7 human notes (`.ai_out/step-05-rich-rendering/main/QA_CHECKLIST.md`)
- §4 A↔B pair: `[NO]` "I dont see the arrowheads well, they arent rendering cleanly".
- §4 badge: `[x]` "×2" shows but "I would like this styled to be cleaner though".
- §4 single-link: no badge — OK.
- §7: arrowheads must match edge line color in BOTH light+dark (no fixed light-gray; RF `#b1b1b7` overridden).
- §5 (tangential): arrows non-interactive (decoration only) — clicking arrows does nothing, clicking node opens it.

## 6. Commands (`package.json`)
- `npm test` → `vitest run && npm run test:sublib` (unit; includes edgeGeometry/badgeText).
- `npm run check` → `tsc -noEmit`.
- `npm run build` → `npm run check && node esbuild.config.mjs production` (also compiles graph-view.css → styles.css).
- `npm run test:e2e` → setup vault + `playwright test` (real-Obsidian binding contract).
- `npm run dev` → esbuild watch. `npm run setup:dev-vault` → build+copy into `.dev-vault`.
