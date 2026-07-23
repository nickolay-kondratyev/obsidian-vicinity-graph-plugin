# DETAILED_PLANNING__PUBLIC — 12-point edge-routing anchors

## 0. Scope recap (settled — do not reopen)

Change `BOUNDARY_PIN_SPECS` in `src/view/edgeRouting.ts` from **8 pins** (4 side-midpoints
+ 4 `"all"` corners) to **12 pins**: each of the 4 sides gets 3 outward-perpendicular pins
at fractions **{0.25, 0.5, 0.75}**. The 4 corner pins are removed.

- **Group boxes only.** `folder-group` obstacles get the 12 pins; note squares keep
  `CENTRE_PIN_SPEC` untouched. `registerPinsForShape`'s kind branch is unchanged.
- **Outward-perpendicular dir** for the new quarter pins (same convention as the midpoints).
- **No cost-model change.** Buffer/segment/crossing penalties untouched. Selection stays
  delegated to libavoid; we only change the candidate-pin set.

**WHY:** at a corner an edge can visually read as continuing *past* the node even though it
terminated there. Side-only anchors keep every attachment square-on to a side, removing that
ambiguity.

This is a ~15-line source edit plus tests. The plan is deliberately proportionate.

---

## 1. Exact code edit — `src/view/edgeRouting.ts`

### 1a. Add two fraction constants (beside `PIN_EDGE_MIN/MID/MAX`, ~lines 180–182)

Keep them adjacent to the existing proportional-offset constants and extend that block's
doc comment so 0.25/0.75 are covered by the same explanation (no magic numbers):

```ts
/**
 * Proportional pin offsets along a side: 0 = left/top border, 1 = right/bottom border
 * (libavoid multiplies these by the shape's width/height when `proportional = true`).
 * The three interior fractions 1/4, 1/2, 3/4 give each side three attachment points so
 * an edge can meet a box square-on near where it actually approaches, without ever
 * landing on a corner.
 */
const PIN_EDGE_MIN = 0;
const PIN_EDGE_Q1 = 0.25;
const PIN_EDGE_MID = 0.5;
const PIN_EDGE_Q3 = 0.75;
const PIN_EDGE_MAX = 1;
```

`PIN_INSIDE_OFFSET`, `PinDir`, and `BoundaryPinSpec` are unchanged. Note `PinDir` keeps
`"all"` in the union (still used by `CENTRE_PIN_SPEC`); only its use for corners goes away.

### 1b. Replace `BOUNDARY_PIN_SPECS` (lines 211–220) with the 12-pin set

Also update the array's doc comment: "eight boundary connection pins … four side-midpoint …
four corner pins accept any direction" → describe 12 side-only pins and state the corner-removal
WHY. Keep the existing WHY-NOT-on-note-squares paragraph verbatim (still accurate).

```ts
/**
 * The twelve boundary connection pins registered on a FOLDER-GROUP obstacle (all sharing
 * {@link PIN_CLASS}). Each of the four sides carries three pins — at 1/4, 1/2, 3/4 along the
 * side — every one facing OUTWARD perpendicular to its own side, so an edge leaves/enters the
 * box square-on near where it actually approaches instead of skimming along the border.
 *
 * WHY no corner pins: at a corner an edge can visually read as continuing PAST the node even
 * though it terminated there. Side-only anchors keep every attachment unambiguously on a face.
 * (Superseded the earlier 8-pin set of 4 side-midpoints + 4 "all"-direction corners.) This whole
 * pin set replaced the single centre pin that made libavoid optimise a centre→centre path whose
 * long interior leg — later clipped away by `clipRouteToEndpointRects` — diverged from the visible
 * border→border route and let a group's own child squares distort it (ticket edge-routing__04).
 * libavoid picks the cheapest pin per connector end.
 *
 * WHY-NOT on note squares: the roundabout pathology is specific to group boxes, and a dense
 * vicinity is mostly UNGROUPED spokes — many pins on each of ~100 note squares pushed the routing
 * pass far over budget (ticket edge-routing__04 Phase A). Note squares therefore keep the single
 * {@link CENTRE_PIN_SPEC}.
 */
const BOUNDARY_PIN_SPECS: readonly BoundaryPinSpec[] = [
	{ xFrac: PIN_EDGE_Q1, yFrac: PIN_EDGE_MIN, dir: "up" }, // top 1/4
	{ xFrac: PIN_EDGE_MID, yFrac: PIN_EDGE_MIN, dir: "up" }, // top 1/2
	{ xFrac: PIN_EDGE_Q3, yFrac: PIN_EDGE_MIN, dir: "up" }, // top 3/4
	{ xFrac: PIN_EDGE_MAX, yFrac: PIN_EDGE_Q1, dir: "right" }, // right 1/4
	{ xFrac: PIN_EDGE_MAX, yFrac: PIN_EDGE_MID, dir: "right" }, // right 1/2
	{ xFrac: PIN_EDGE_MAX, yFrac: PIN_EDGE_Q3, dir: "right" }, // right 3/4
	{ xFrac: PIN_EDGE_Q3, yFrac: PIN_EDGE_MAX, dir: "down" }, // bottom 3/4
	{ xFrac: PIN_EDGE_MID, yFrac: PIN_EDGE_MAX, dir: "down" }, // bottom 1/2
	{ xFrac: PIN_EDGE_Q1, yFrac: PIN_EDGE_MAX, dir: "down" }, // bottom 1/4
	{ xFrac: PIN_EDGE_MIN, yFrac: PIN_EDGE_Q3, dir: "left" }, // left 3/4
	{ xFrac: PIN_EDGE_MIN, yFrac: PIN_EDGE_MID, dir: "left" }, // left 1/2
	{ xFrac: PIN_EDGE_MIN, yFrac: PIN_EDGE_Q1, dir: "left" }, // left 1/4
];
```

Ordering is cosmetic (libavoid picks cheapest regardless). The clockwise-perimeter order above
reads naturally; the unit test in §2c is order-independent so a different order is fine.

**No change to** `registerPinsForShape`, `visDirsFor`, `CENTRE_PIN_SPEC`, the arena, or the
router. `visDirsFor`'s `"all"` case stays (centre pin still uses it).

---

## 2. Test strategy

Three layers. Prefer keeping the two existing facing-side tests green (robust-tests principle).

### 2a. Existing facing-side tests (`edgeRouting.test.ts:234–262`) — PASS AS-IS, verified

Geometry: two 100×100 `folder-group` boxes, perfectly aligned on the cross axis (horizontal
case both `y=0`; vertical case both `x=0`) with a clean gap. Because the boxes are aligned, the
{0.25, 0.5, 0.75} pins on the two facing sides line up in matched pairs, so the 25→25, 50→50 and
75→75 shots are all straight and of *equal* length — a genuine cost tie, not a case of the
midpoint being cheapest. libavoid's tie-break resolves this to the midpoint, so the endpoint
still lands at y=50 / x=50 and the `MID_SPAN_TOL_PX=10` assertions hold.

> PLAN_REVIEWER note (empirically verified): the 12-pin set was applied and the two facing-side
> tests were run against the real node wasm — **both stay green (4/4 in the real-wasm block)**.
> The pass is real, though it rests on libavoid's tie-break rather than a strict cost gap; the
> §2c pure spec test is the durable anchor for the new behaviour, so this dependence is low-risk.

**No reframing needed — leave these tests unchanged.** (They remain a valuable regression guard
that the midpoint pin and the outward `visDirs` mapping still work.)

If, contrary to this, a future run shows an endpoint at 25 or 75 for the aligned geometry, that
is a real signal (tie-break shifted) — investigate, do NOT loosen the tolerance to force green.

### 2b. NEW corner-removal integration test (real WASM, in the same `describe` block)

The core behavioral guarantee: **no route endpoint attaches at a box corner.** Design geometry
that would have *tempted* a corner attachment under the old 8-pin set, then assert the endpoint
lands on a face and clears every corner.

- **Geometry:** two 100×100 `folder-group` boxes offset **diagonally** so the natural straight
  path runs corner-to-corner. E.g. `boxL = {x:0, y:0, w:100, h:100}` and
  `boxR = {x:300, y:300, w:100, h:100}`. The old set would happily pick L's bottom-right corner
  `(100,100)` and R's top-left corner `(300,300)`. The new set must instead pick a face pin
  (L's right side at 0.75 → `(100,75)`, or bottom at 0.75 → `(75,100)`; symmetric for R).
- **Assertion (robust, tolerance-based):** for each endpoint, assert it lies on **exactly one**
  face of its box (one coordinate within `FACING_BORDER_TOL_PX=3` of a border, the other strictly
  interior) **and** its distance to the nearest of that box's four corners exceeds a clear margin.
  Valid quarter pins sit 25px from a corner; corners sit 0px away — so a `CORNER_CLEARANCE_TOL_PX`
  of, say, **12** cleanly separates the two cases (well below 25, well above 3).

Add a small helper next to `isStrictlyInside`:

```ts
const CORNER_CLEARANCE_TOL_PX = 12; // quarter pins sit 25px from a corner; a corner sits 0px away

function cornersOf(r: RoutingObstacle): { x: number; y: number }[] {
	return [
		{ x: r.x, y: r.y },
		{ x: r.x + r.widthPx, y: r.y },
		{ x: r.x, y: r.y + r.heightPx },
		{ x: r.x + r.widthPx, y: r.y + r.heightPx },
	];
}

function minCornerDistance(p: { x: number; y: number }, r: RoutingObstacle): number {
	return Math.min(...cornersOf(r).map((c) => Math.hypot(p.x - c.x, p.y - c.y)));
}
```

Test bodies (BDD, one behavior per test; keep the `if (!loaded) return;` skip guard the block
already uses):

- `WHEN two group boxes are offset diagonally THEN the source endpoint clears every corner of its box`
  → `expect(minCornerDistance(first, boxL)).toBeGreaterThan(CORNER_CLEARANCE_TOL_PX)`.
- `WHEN two group boxes are offset diagonally THEN the target endpoint clears every corner of its box`
  → `expect(minCornerDistance(last, boxR)).toBeGreaterThan(CORNER_CLEARANCE_TOL_PX)`.

Reuse the existing `routePair` helper (returns `{first, last}`) so no new plumbing is needed.
One assertion per test, per repo convention.

#QUESTION_FOR_HUMAN (non-blocking): the exact diagonal offset is a tuning choice. `(0,0)` vs
`(300,300)` gives a clean 45° with a wide gap so the router won't need to detour. If the run
shows the endpoint landing suspiciously near mid-face (0.5) rather than a quarter pin, that's
still a PASS for the corner guarantee — the test only asserts corner-clearance, which is the
actual contract — so no action needed unless you want a stronger "quarter-pin was used" assertion.

### 2c. NEW fast unit test locking the spec (pure, no WASM)

Export `BOUNDARY_PIN_SPECS` for test visibility (or a thin `readonly` accessor). A pure test that
runs in ms and locks the invariants regardless of libavoid:

- `THEN there are exactly 12 boundary pins` → `expect(BOUNDARY_PIN_SPECS.length).toBe(12)`.
- `THEN no boundary pin sits on a corner (both fracs at an extreme)` → for every spec, assert
  NOT (`xFrac ∈ {0,1}` AND `yFrac ∈ {0,1}`).
- `THEN every boundary pin faces outward-perpendicular (never "all")` →
  `expect(BOUNDARY_PIN_SPECS.every((s) => s.dir !== "all")).toBe(true)`.
- `THEN each of the 4 sides has pins at 1/4, 1/2, 3/4` → group specs by side (the coordinate
  pinned to an extreme + its `dir`) and assert each side's free-coordinate multiset equals
  `{0.25, 0.5, 0.75}`, and that `dir` matches the extreme side (top→up, right→right,
  bottom→down, left→left). This one assertion (or a few focused ones) locks the full geometry.

This is the cheapest, most durable guard and should be the primary regression anchor for the
change; the WASM test in §2b proves libavoid honors it end-to-end.

Export note: keep it minimal — add `BOUNDARY_PIN_SPECS` (and its `BoundaryPinSpec` type if not
already exported) to the module's exports. It is inert data, so exposing it carries no coupling risk.

---

## 3. Docs to update (succinct)

- **`docs-internal/CHANGELOG.md`** — one entry under the edge-routing lineage, e.g.:
  "Edge routing: folder-group boxes now expose 12 boundary pins (3 per side at 1/4, 1/2, 3/4,
  all outward-perpendicular); corner pins removed so an edge never appears to continue past a
  node it terminated at. Note squares unchanged (single centre pin). No cost-model change."
- **`docs-internal/architecture-map.md`** — exploration reports lines 49–60 mention libavoid-js
  only, with **no** 8-point/corner detail. **Confirmed: nothing to change there.**
- **`docs-internal/plan/high-level-plan.md`** — "pin" refers to user-pinned central nodes, an
  unrelated concept; no routing-anchor content. **Confirmed: nothing to change there.**
- **`src/view/edgeRouting.ts` doc comments** — updated inline as part of §1 (array + constant
  block comments; and the `RoutingObstacle.kind` JSDoc at lines 29–37 says "the 8 boundary pins"
  → change to "the boundary pins" or "the 12 boundary pins" for accuracy). The `registerPinsForShape`
  JSDoc (line 249) similarly says "get the 8 {@link BOUNDARY_PIN_SPECS}" → drop the count or say 12.

No new ticket needed — this fully resolves the requested change.

---

## 4. Risk / verification

- `npm run check` — tsc strict (`noUncheckedIndexedAccess`, `noImplicitReturns`). The spec array
  and new constants are trivially typed; watch the `cornersOf` spread + `Math.min(...[])` (guard is
  fine since the array is always length 4).
- `npm test` — vitest. Redirect verbose output to `.tmp/` per repo convention.
- The real-WASM `describe` block is the slower part (loads the node libavoid build). The new §2b
  tests add ~2 more `route()` passes; each pass is a tiny 2-box transaction, so cost is negligible.
  The `if (!loaded) return;` guard keeps CI environments without the wasm build honest (documented
  skip, not a fake pass).
- **No perf risk to the product:** 12 pins apply to `folder-group` boxes only (few per vicinity),
  never to the ~100 note squares — the edge-routing__04 Phase A budget concern is not revived.
- `npm run test:e2e` (Playwright vs real Obsidian) is a **release gate, not required for this
  change**; nothing here alters view wiring or persisted shapes.

---

## 5. Explicitly OUT OF SCOPE

- **Note squares** — `CENTRE_PIN_SPEC` and the `registerPinsForShape` note branch are untouched.
- **Cost model** — `EDGE_ROUTING_SHAPE_BUFFER_PX`, `SEGMENT_PENALTY_PX`, `CROSSING_PENALTY_PX`
  unchanged.
- **Clipping geometry** — `clipRouteToEndpointRects` / `clipRoutesToObstacles` / detour telemetry
  in `GraphViewController.ts` and `edgeGeometry.ts` are pin-layout independent; leave them alone.
- **`PinDir` union / `visDirsFor`** — `"all"` stays for the centre pin; no direction machinery change.

---

## 6. Implementation order (for the IMPLEMENTATION agent)

1. Start from a failing test: add the §2c pure unit test asserting 12 side-only pins → red.
2. Add the two fraction constants (§1a) and rewrite `BOUNDARY_PIN_SPECS` (§1b) → §2c green.
3. Add the §2b corner-removal WASM tests + helpers.
4. Fix stale "8"/"corner" wording in the three doc comments (§3) and add the CHANGELOG entry.
5. `npm run check` && `npm test` (output → `.tmp/`). Confirm the existing facing-side tests
   (§2a) stayed green without edits; if not, investigate rather than loosen tolerances.
