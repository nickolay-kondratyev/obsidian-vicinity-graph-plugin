---
id: nid_o1f05i1pu3lgkmaxpbaj13x3x_e
title: "edge-routing__03-all-layouts-tuning-default-on"
status: open
deps: [nid_82xnrearif6y7fcd80y5gprkc_e]
links: []
created_iso: 2026-07-22T16:04:58Z
status_updated_iso: 2026-07-22T16:04:58Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
parent: nid_w8co2gp7cok2a2hwwsm88brfo_e
---

# Phase 3 — All layouts, parameter tuning, flip default ON, docs

Parent epic (full plan): `_tickets/edge-routing-via-libavoid-js-obstacle-avoiding-edges-for-all-layouts-force-directed-first.md` (id `nid_w8co2gp7cok2a2hwwsm88brfo_e`).
DEPENDS ON: `edge-routing__02-render-routed-edges` (`nid_82xnrearif6y7fcd80y5gprkc_e`) — routing must work end-to-end for the force layout behind the `edgeRouting` setting.

## Goal

Graduate edge routing from "force layout, opt-in" to "all layout modes, on by default", with tuned routing parameters and updated docs. This is the ship-it ticket.

## Work items

1. **All layouts**: the routing pass is downstream of `GraphLayoutRunner` (`src/view/GraphLayoutRunner.ts:14`) and layout-agnostic by design, so `layered` and `radial` should work already. Verify each mode in the dev-vault (`LayoutMode = "layered" | "radial" | "force"`, options in `src/view/constants.ts:110` `ELK_ROOT_OPTIONS_BY_MODE`) and fix what surfaces. Known risk areas:
   - `layered` mode lays folder containers out internally as `layered` with tighter packing — child-edge attachment and buffer distances may behave differently than force.
   - `radial`/`force` use `SEPARATE_CHILDREN` compound handling (`src/view/elkMapping.ts` `projectedRootEdges`) — confirm collapsed group edges attach to group shapes correctly in all modes.
2. **Tuning** (all values as NAMED CONSTANTS in one place, next to the existing edge constants in `src/view/edgeGeometry.ts` / `src/view/edgeRouting.ts` — no magic numbers):
   - `shapeBufferDistance` — clearance around obstacles; balance against node spacing so routes don't detour absurdly in dense vicinities. Relate to arrow inset constants (min 14px inset, `edgeGeometry.ts:40-42`).
   - `segmentPenalty` — fewer bends = calmer look.
   - `crossingPenalty` — reduce edge-edge crossings where cheap.
   - Evaluate on 3 dev-vault fixtures: sparse (~10 nodes), medium with folder groups, dense (~100+ nodes). Record chosen values + rationale as WHY comments.
3. **Performance sanity**: measure the routing pass wall-time on the dense fixture (console.time in dev build is fine). Budget: pass must be well under the existing elk+d3 layout time; if it is not, record numbers here and STOP for human alignment before optimizing (web-worker offload is a deliberate follow-up, not this ticket).
4. **Flip default**: `edgeRouting` default ON in `ViewSettings` defaults. Users can still disable via settings tab. Confirm the OFF path still renders straight edges (regression tests from phase 02 cover this).
5. **Docs** (stable knowledge only, succinct):
   - `docs-internal/vicinity-graph-specs/arrows.md`: add a routing section — when routes apply, fallback behavior, how bidirectional/hasOpposite interacts with routing.
   - Project `CLAUDE.md` (if it documents the view pipeline): one line for the routing pass location.
   - Release notes for next version bump: edge routing feature + `main.js` size delta (~630KB from embedded wasm, measured in phase 00).
6. **Mobile check** (manifest `isDesktopOnly: false`): if a mobile test device/simulator is available, verify wasm loads and routing renders; otherwise explicitly record "not verified on mobile" here and in release notes. Do not silently skip.

## Acceptance criteria

- [ ] All three layout modes show routed edges in dev-vault; e2e visual smoke extended to cover `layered` and `radial` (reuse phase-02 fixture pattern).
- [ ] Tuned constants committed with WHY comments; dense-fixture route quality eyeballed and screenshot recorded under `/.out`.
- [ ] Routing pass timing measured and recorded on this ticket (`ticket add-note`).
- [ ] `edgeRouting` defaults ON; OFF path verified by existing tests.
- [ ] `arrows.md` updated; release-notes entry drafted.
- [ ] Full suite green: `npm run check`, vitest, e2e.

## Explicitly deferred (create follow-up tickets if/when wanted — do NOT do here)

- `OrthogonalRouting` mode for `layered` layout.
- Collapse ALL bidirectional pairs to one line + two arrowheads (`docs-internal/vicinity-graph-specs/arrows.md:88-94` recommendation).
- Live re-routing during node drag (nodes are non-draggable today — `docs-internal/tickets/ticket-node-drag-reposition.md`).
- Web-worker routing offload (only if phase-3 timing numbers justify it).

