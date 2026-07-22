# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC (edge-routing__03)

Phase 3: edge routing ON by default, verified across all layout modes, parameters
tuned, docs + release notes. Do NOT git commit — orchestrator handles commits.

## TL;DR verification (REAL results — after the radial-gate follow-up)
- `npm run check` (tsc -noEmit): **EXIT 0**.
- `npm test` (vitest): **650 passed / 54 files** (baseline 646 + 3 tuning-constant tests + 1 radial-gate test; 0 failures, 0 regressions).
- `npm run test:e2e` (full suite, headless Obsidian 1.12.7): **32 passed / 0 failed**.
- `npm run build` (production): green; `main.js` = **2,610,310 B**.
- Radial-gate `#QUESTION` is RESOLVED (human decision) — see next section.

## #QUESTION_FOR_HUMAN — RESOLVED (human: gate radial off)
Original concern: on a dense + `all-edges` vicinity, radial routing (~490ms) exceeded
its trivially-cheap layout (~45ms). **Human decision: SKIP routing entirely when
`layoutMode === "radial"`** (near-straight spokes → routing adds cost for no benefit).
Ship default-ON for `force` + `layered`; radial renders straight spokes; web-worker
offload stays deferred. The `graphFixtures.ts` kept-false decision was ACCEPTED.

### Gate implemented (follow-up)
- **`GraphViewController.ts`:** named `const ROUTING_SKIPPED_LAYOUT_MODE: LayoutMode = "radial"`
  + `isRoutingSkippedLayout(mode)` predicate, checked in `resolveRoutes` right beside
  the `edgeRouting` OFF gate → returns `EMPTY_ROUTES` for radial (wasm never loads,
  edges straight). Self-documenting WHY comment on the constant (no buried magic string).
- **Tests flipped honestly:**
  - `e2e/edgeRouting.e2e.ts`: `layered` still asserts a real detour (>0 bends); the
    `radial` test now asserts **0 bends** with a WHY (proves the GATE, not a regression).
  - `GraphViewController.test.ts`: new BDD test — GIVEN radial + edgeRouting ON, THEN
    the `FakeEdgeRouter` is **never invoked** (`callCount === 0`).
  - `e2e/edgeRoutingEval.e2e.ts`: radial test now asserts **no routing timing is logged**
    (`routingMs` undefined) — gate proven; force + layered timing kept.
- **Docs updated:** `arrows.md` §5 (routing = force + layered; radial excluded, one-line
  WHY) and the CHANGELOG phase-3 entry (default-ON for force+layered, radial gated).

### Post-gate verification (REAL)
- tsc **EXIT 0**; vitest **650 passed / 54 files** (+1 radial-gate test); full e2e **32 passed / 0 failed**.
- Eval perf (post-gate): force/dense routing ~137ms vs layout ~1494ms; layered/dense ~172ms vs ~276ms; **radial/dense `routingMs=undefined` (gated off)**.
- main.js = **2,610,310 B** (+80 B for the gate).

## What changed (by item)

### Item 4 — default flipped ON
- `src/engine/constants.ts:47` `DEFAULT_EDGE_ROUTING = false → true` (WHY comment updated).
- `src/persistence/persistedShapes.test.ts:53-61` — the two default-value tests updated: explicit `false` now round-trips; non-boolean falls back to the new `true` default (behavior change called out in comments).
- `src/view/testFixtures/graphFixtures.ts:45` — **kept `edgeRouting: false`** (see Decision below), comment expanded to document the deliberate decoupling from the engine default.
- `src/view/GraphViewController.test.ts:433` — comment clarified ("fixture baseline OFF; routing tests opt in").
- The OFF path still renders straight edges: existing phase-02 regression tests pass unchanged; the e2e OFF test now pins `edgeRouting=false` explicitly (default is ON).

**DECISION (reviewers note): `graphFixtures.ts` fixture stays `edgeRouting:false`, not flipped.**
The ticket said "update the fixture to reflect the new default," but flipping it would
(a) break the controller's "routing OFF" baseline test and (b) make every pure
mapping test implicitly invoke the wasm router. This fixture already deliberately
does NOT mirror engine defaults (its `layoutMode:"layered"` ≠ engine `force`, with a
comment saying so). The correct, precedent-following action is to keep the neutral
baseline and document it — routing tests opt in via `withEdgeRouting`/`routedGraphOf`.
This is a reasoned engineering call, not a skipped requirement.

### Item 2 — tuning constants (named, in `src/view/edgeRouting.ts`)
Evaluated on 3 dev-vault fixtures; screenshots read back to eyeball route quality
(clean, obstacle-avoiding, not absurd/overlapping in all cases).
- `EDGE_ROUTING_SHAPE_BUFFER_PX = 17` — **kept** (= `EDGE_PAIR_CURVATURE_PX/2`); > the 14px arrowhead min inset so routes clear boxes past the head, small vs node spacing. Related-to-inset rationale added to the WHY.
- `EDGE_ROUTING_SEGMENT_PENALTY_PX = 50` — **NEW**; ~50px virtual cost per extra bend → calmer routes, kills spurious near-collinear zig-zags. libavoid's documented example value.
- `EDGE_ROUTING_CROSSING_PENALTY_PX = 0` — **NEW knob, DISABLED**. Any positive value pays libavoid's ~O(connectors²) crossing check: at 100 it pushed dense routing to **~1700ms** (above layout); at 0 it dropped to **~140ms**. Crossing reduction is not "cheap" on hub-shaped vicinities, so it's off; kept as a named knob (not deleted) for the future web-worker path.
- `ROUTED_CORNER_RADIUS_PX = 10` (edgeGeometry.ts) — **kept**; WHY updated from "defer to __03" to the final rationale.
- Wired at `edgeRouting.ts` `route()` via three `router.setRoutingParameter(...)` calls together.
- Deferral WHY comments updated: `constants.ts:42-46`, `edgeRouting.ts` buffer block, `edgeGeometry.ts` corner-radius block.
- Unit tests added (`edgeRouting.test.ts`): buffer > arrowhead min inset; segment penalty = 50; crossing penalty = 0 (disabled, with rationale).

### Item 1 — all layout modes (radial gated per human follow-up)
- Routing is layout-agnostic (runs in `GraphViewController` post-layout). `force` + `layered` route correctly — collapsed group-box edges and child-square edges attach right, no NaN paths. **`radial` is gated off** (see resolved #QUESTION) and renders straight spokes.
- `e2e/obsidianHarness.ts` — added `setLayoutMode(mode)` helper mirroring `setEdgeRouting`.
- `e2e/edgeRouting.e2e.ts` — `layered` genuinely detours a hub-crossing chord (`bentEdgeCount > 0`); `radial` asserts **0 bends** (gate); both guarded no-NaN well-formed.

### Item 3 — performance
Instrumented `GraphViewController` with two gated `console.debug` timing lines
(elk+d3 layout pass; routing pass with obstacle/edge counts) — silent unless
devtools verbose. Numbers above. `e2e/edgeRoutingEval.e2e.ts` reads them and asserts
the default-force budget; radial exceedance flagged (see #QUESTION).

### Item 5 — docs
- `docs-internal/vicinity-graph-specs/arrows.md` — new "### 5. Obstacle-avoiding edge routing" section after Layout modes (when routes apply, straight-line/failure fallback, bidirectional/`hasOpposite` × routing, tuning summary).
- `docs-internal/CHANGELOG.md` — dated `2026-07-22` Phase-3 entry (default flip, all-layouts, tuned constants + values, perf numbers, `main.js` delta, mobile-not-verified).
- **Project `CLAUDE.md` — MOOT: it does not exist anywhere in this repo** (confirmed). Nothing created.
- **Version — LEFT at 0.1.1** (manifest/package/versions unchanged). Per `RELEASE_CHECKLIST.md` §3 the three-file bump happens at the actual release cut; phases 0–2 added CHANGELOG entries without per-phase bumps. Not guessing a bump.

### Item 6 — mobile
**NOT verified on mobile.** No iOS/Android runtime or simulator in this environment.
Recorded here AND in the CHANGELOG entry (not silently skipped). `isDesktopOnly:false`
unchanged.

## main.js size
Production `main.js` = **2,610,230 B**. Pre-routing Phase-00 baseline 1,877,709 B ⇒
**+732,521 B (~+715 KiB)**, essentially all the base64-embedded libavoid wasm; the
Phase-3 source delta over Phase 2 is ~3 KB.

## Screenshots (gitignored, under /.out) — read & verified clean
- `edge-routing-force-sparse.png` — mostly straight edges (few obstacles). ✅
- `edge-routing-force-medium.png` — collapsed group-box edges (`x4` badges) around `hub-medium`. ✅
- `edge-routing-force-dense.png` — organic spokes bending around ~100 packed nodes (`+10 hidden` = cap). ✅
- `edge-routing-layered-dense.png` — clean fan, no through-box crossings. ✅
- `edge-routing-radial-dense.png` — near-straight radial spokes. ✅
(Plus `edge-routing-force.png` from the regression spec.)

## Files touched
- src/engine/constants.ts
- src/view/edgeRouting.ts, src/view/edgeGeometry.ts, src/view/GraphViewController.ts
- src/view/edgeRouting.test.ts, src/persistence/persistedShapes.test.ts, src/view/GraphViewController.test.ts, src/view/testFixtures/graphFixtures.ts
- e2e/obsidianHarness.ts, e2e/edgeRouting.e2e.ts, e2e/edgeRoutingEval.e2e.ts (new)
- scripts/setup-dev-vault.sh (medium + dense fixture generators; idempotent)
- docs-internal/vicinity-graph-specs/arrows.md, docs-internal/CHANGELOG.md

## Deferred (unchanged; not implemented)
OrthogonalRouting for layered; collapse-all-bidirectional-pairs; live re-routing on
drag; **web-worker routing offload** (relevant to the #QUESTION radial perf).
