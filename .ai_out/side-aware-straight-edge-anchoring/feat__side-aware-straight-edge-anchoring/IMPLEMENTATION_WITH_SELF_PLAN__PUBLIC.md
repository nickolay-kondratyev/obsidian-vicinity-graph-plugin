# IMPLEMENTATION — side-aware straight-edge anchoring

Ticket `nid_var2o7krxq7ribq3iofni3aw1_e`. Branch `feat/side-aware-straight-edge-anchoring`,
commit `58f5ede`. Tree clean.

## Plan (as executed)

1. `edgeGeometry.ts`: private `rectBorderPointToward` on top of the EXISTING Liang–Barsky
   `segmentRectEntryPoint` + `isStrictlyInsideRect`. No second intersection routine.
2. `edgeGeometry.ts`: exported `facingSideAnchorsFor(...)` composing the two endpoint anchors.
3. `edgeGeometry.test.ts`: 9 BDD tests.
4. `VicinityEdge.tsx`: `useInternalNode` + a `clipRectOf` helper + one `??` line.
5. `docs-internal/specs/graph/arrows.md`: new section + two amendments.
6. `npm test`, `npm run check`, `npm run test:e2e`.
7. Follow-up ticket for the stale culling comment.

## What changed and why

**Problem.** A straight (non-routed) edge anchored at each node's fixed `<Handle>` — pinned to
Top/Bottom by `NoteNode` / `FolderGroupNode`. An edge to a node on the LEFT therefore departed from
the bottom and looped back up, reading as a detour that isn't in the data. The routed path already
gets facing-side attachment for free from `clipRouteToEndpointRects`; the straight path was the
remaining offender.

**Fix.** React Flow's "floating edge" pattern: intersect the centre→centre segment with each
endpoint rect's border and feed those two points into the unchanged `edgePathFor`.

### New helper — exact signature & contract

```ts
/** Endpoint pair for a STRAIGHT edge, ABSOLUTE flow coords — the 4 values edgePathFor takes. */
export interface StraightEdgeAnchors {
	readonly sourceX: number;
	readonly sourceY: number;
	readonly targetX: number;
	readonly targetY: number;
}

export function facingSideAnchorsFor(
	sourceRect: ClipRect | undefined,
	targetRect: ClipRect | undefined,
): StraightEdgeAnchors | null;
```

Contract:

- Returns the point where the **centre→centre** segment crosses each rect's border — the anchor on
  the side each box faces.
- Returns **`null` = "keep the caller's existing handle endpoints"** when
  (a) either rect is `undefined` (React Flow has not registered the node yet), or
  (b) either centre is **strictly inside** the other rect (nested/overlapping boxes, e.g. a note
  inside its folder-group container), or (c) the crossing is indeterminate.
  Same fallback spirit as `clipRouteToEndpointRects`'s degenerate chord.
- A point exactly ON a border is not "inside" — inherited from `isStrictlyInsideRect`, consistent
  with the route clipper.
- Pure, total, never NaN. Accepting `| undefined` (rather than making the caller branch) is
  deliberate: it moves the "node not in the store" case into the **testable** layer, leaving
  `VicinityEdge` — which this repo cannot unit-test — with a single `??`.

Private support: `rectBorderPointToward(rect, toward)` = `isStrictlyInsideRect` guard +
`segmentRectEntryPoint(toward, rectCentre, rect)`, and `rectCentreOf(rect)`.

### Files modified

| File | Change |
|---|---|
| `src/view/edgeGeometry.ts` | `StraightEdgeAnchors`, `facingSideAnchorsFor`, private `rectBorderPointToward` / `rectCentreOf`. |
| `src/view/edgeGeometry.test.ts` | New describe block, 9 BDD tests. |
| `src/view/VicinityEdge.tsx` | `useInternalNode(source/target)`, `clipRectOf`, anchors spliced into the `edgePathFor` call. |
| `docs-internal/specs/graph/arrows.md` | New `## Straight (non-routed) edge anchoring`; amended the straight-line-fallback bullet and `## Test coverage`. |
| `_tickets/stale-comment-…-render-no-handle.md` | New follow-up ticket (see below). |

## Decisions & trade-offs

- **DRY, one intersection routine.** `rectBorderPointToward` inverts `segmentRectEntryPoint`'s
  contract (`from` outside, `to` inside) by passing the *other* node's centre as `from` and *this*
  rect's centre as `to`. Zero new math.
- **`edgePathFor` untouched** (signature and output bytes). The `routedGeometryFor([2 pts])` ↔
  `edgePathFor` byte-identity assertion (`edgeGeometry.test.ts:255`) and the positional call at
  `routedGeometryFor:443` both still hold. Composition happens at the call site.
- **`ClipRect` reused**, still local to `edgeGeometry.ts` — the prior deliberate decision that this
  pure-math layer imports no routing types is preserved.
- **Rects from the RF store, not the DOM.** `internals.positionAbsolute` +
  (`measured.width ?? node.width`, `measured.height ?? node.height`). `onlyRenderVisibleElements`
  unmounts culled nodes but keeps them in the store, so DOM measurement would be wrong.
- **Anchors are computed even on the routed branch** (React hooks must be unconditional, and the
  `??` is evaluated eagerly). A handful of arithmetic ops per edge per render — not worth branching
  around. Called out rather than micro-optimised.
- **Not touched:** the hidden `<Handle>`s (RF still needs them to address an edge at all), layout,
  the routed branch, the arrowhead inset constants, the edge-path CSS selector.

## CALLOUTS

1. **The ticket's stated scope is STALE — I did not chase it.** It motivates the work with the
   `edgeRouting` ViewSetting being toggled OFF and with `radial` layout / `ROUTING_SKIPPED_LAYOUT_MODE`.
   **None of those symbols exist in `src/` any more** — they were deleted by closed tickets
   `01-force-layout-only…` and `02-remove-edge-routing-setting…` (2026-07-24); routing is now
   unconditional. Nothing was reintroduced. The straight path is still reachable via: whole-pass
   router/wasm failure, an edge missing from the route map, an endpoint dropped from the routing
   input, `routedPoints.length < 2`, `hasOpposite` bowed note↔note pairs, and — the real
   justification — **the degenerate `clipRouteToEndpointRects` chord fallback
   (`edgeGeometry.ts:190-201`), which fires in NORMAL operation** on overlapping/nested rects, where
   libavoid's centre pins make that chord a centre→centre line. The spec and the commit message both
   record this correction.
   *Caveat worth knowing:* that same degenerate case (nested/overlapping rects) is exactly the case
   `facingSideAnchorsFor` returns `null` for. So the strongest motivating path is improved only when
   the boxes overlap **partially** (a facing side still exists); fully nested boxes keep today's
   handle endpoints, because there is genuinely no facing side to anchor to. I did not invent a
   heuristic to fake one — that would be a hack.

2. **User-visible behaviour change: arrowheads on straight edges now sit just OUTSIDE the box,
   pointing inward,** instead of at a handle on the top/bottom edge. This is the same look the
   routed path has had since the boundary-clip ticket (whose PUBLIC file recorded the inset
   constants as reviewed and deliberately unchanged) — so this change makes the two paths
   **consistent** rather than introducing a new look. Straight edges also no longer emerge from the
   node's top/bottom only; they radiate from whichever side faces the other node.

3. **No e2e coverage for the new behaviour, by design.** No e2e fixture can currently produce a
   non-routed edge: routing is unconditional (no setting), `ObsidianHarness` has no seam to disable
   it, and the router does not fail under e2e. I did **not** invent a hacky test-only seam. The
   existing e2e suite was run and is green (see below), which proves no regression on the routed
   path, but it does not exercise `facingSideAnchorsFor`. `e2e/selectorGuard.test.ts:205` is a
   tripwire on the edge-path selector — not touched, and it should not need to be.

4. **Tickets live in `_tickets/`, not `docs-internal/tickets/`.** My brief said the latter, but the
   `ticket` CLI writes to `_tickets/` and the parent ticket itself lives there;
   `docs-internal/tickets/` is the older set. I followed the live convention.

## Test results (verbatim)

- `npm test` → **`Test Files 81 passed (81)` / `Tests 1103 passed (1103)`**, exit 0.
  (`src/view/edgeGeometry.test.ts` alone: 49 passed, up from 40.)
- `npm run check` (`tsc -noEmit` for `src/` + `e2e/`) → exit 0, no output.
- `npm run test:e2e` → **ran successfully in this environment**: `1 skipped`, **`84 passed (55.2s)`**,
  `E2E_EXIT=0`. Includes `edgeRouting.e2e.ts` (bend detection, the `facing/` border-attachment spec)
  and `vicinityGraph.e2e.ts` (one arrowhead per edge, arrowhead theming). All exercise the ROUTED
  path — green means no regression, not coverage of the new code.

New tests (all BDD, one behaviour each, exact-integer rects so no epsilon is needed):
target RIGHT/LEFT/ABOVE/BELOW/DIAGONAL lands on the facing border; the source anchor mirrors onto
its own facing border; nested rects → `null`; missing rect → `null`; the `hasOpposite` bow is drawn
between the new border endpoints.

## Tickets filed

- `nid_ub30ndqyp6ikq76hv4ba6yqss_e` — *Stale comment: VicinityGraphFlow claims folder groups render
  no Handle*. `VicinityGraphFlow.tsx:96-99` justifies `onlyRenderVisibleElements` with "group
  parents render no `<Handle>`", but `FolderGroupNode.tsx:26-31,45-50` do render hidden ones — so
  the `forceInitialRender` rationale may no longer hold and a group container could be culled out
  from under its children. Left untouched here (the rationale needs verifying, not just the comment
  rewriting). Linked to the parent ticket.

## Not done (owned by TOP_LEVEL_AGENT)

`change_log` entry; closing ticket `nid_var2o7krxq7ribq3iofni3aw1_e`.
