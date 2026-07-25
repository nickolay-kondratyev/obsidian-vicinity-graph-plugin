# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC

Ticket `nid_a7uwpxayt6w5vdnw8ogwskwvh_e` — drop non-finite obstacle geometry before it reaches
libavoid. Branch `edge-routing__08-nonfinite-geometry`.

## What was done

`extractEdgeRoutingInput` (`src/view/edgeRouting.ts`) now builds ONE `RoutingObstacle` candidate per
node and skips it unless every coordinate passes `Number.isFinite` (new module-private
`hasFiniteGeometry`). The skipped node's id never enters `obstacleIds`, so the pre-existing
id-membership pass drops every edge touching it — no second edge-side filter, no new discipline.

Structural note: the obstacle literal moved from two `obstacles.push({...})` calls into a `let
obstacle: RoutingObstacle` assigned in both branches, so the finiteness check is written ONCE for
both obstacle kinds (DRY) instead of duplicated per branch.

## Decisions and rationale

- **One shared guard, not per-branch checks** — the note and folder-group branches differ only in
  where the numbers come from; the validity rule is identical.
- **No logging / no diagnostic added.** Extraction stays pure (its whole point: testable without
  wasm), and the caller's existing `console.debug("vicinity-graph: edge routing pass", { obstacleCount,
  edgeCount, … })` already reports the counts a dropped obstacle would move. Adding a second
  reporting channel for a case whose real fix is upstream clamping (see follow-up below) is not the
  80/20 play. Rejected deliberately; revisit if the follow-up ticket is not taken.
- **No clamping / sentinel geometry.** Follows the file's established "skip it, never throw" rule.
- **No real-wasm test.** Feeding non-finite geometry to the shared Emscripten module would abort it
  and poison every later test in the file. The session-survival guard pair at the end of the
  real-wasm `describe` was left untouched and still runs last.
- **`route()`'s throw left as is.** It remains the correct contract-violation signal; extraction now
  additionally guarantees the contract for non-finite geometry.

## Files changed

- `src/view/edgeRouting.ts`
  - `extractEdgeRoutingInput` doc comment: states the new contract (the old "post-layout this never
    fires" claim was removed — it is not true of the finiteness case).
  - obstacle loop: candidate + `hasFiniteGeometry` guard.
  - new `hasFiniteGeometry` with the WHY comment (abort mechanics, load-once singleton, the live
    upstream path, and the WHY-NOT for guarding inside `route()`). This is the single place the
    reachability finding is recorded — not duplicated elsewhere.
  - `AvoidArena.dispose()`: the stale forward reference to this ticket now says the residual is
    closed at the source, and points at `hasFiniteGeometry`.
- `src/view/edgeRouting.test.ts` — 4 new tests + a `withBrokenGeometry` fixture helper in the
  existing `describe("extractEdgeRoutingInput")` block.

## Tests added (all BDD, pure, no wasm)

1. WHEN a note's size is non-finite THEN it is skipped as an obstacle
2. WHEN a note's position is non-finite THEN it is skipped as an obstacle
3. WHEN an obstacle is dropped for non-finite geometry THEN edges touching it are dropped too
   (this is the one that protects against `route()`'s "no registered shape" throw)
4. WHEN a folder group's elk dimensions are non-finite THEN it is skipped as an obstacle

Non-vacuity verified empirically: with the guard temporarily disabled, **all 4 FAIL**.
(Test 4 initially used a single-member folder, which `vicinityGraphToFlow` does not wrap in a
folder-group at all — so it passed with the guard disabled, i.e. it was vacuous. Fixed to use a
two-member folder before the final run.)

## Verified results

- `npm run check` → exit 0 (`tsc -noEmit`, strict).
- `npm test` → exit 0, **68 files / 912 tests passed**, 0 failed, 0 skipped-as-unavailable in the
  real-wasm block (the libavoid node build loaded and all 16 wasm tests ran).

## Reachability verdict: the explorer's claim HOLDS

Verified by reading the code (no test added — that would enshrine the buggy sizing):

- `src/engine/NodeSizer.ts:143` — `normalized.set(path, 1 / (1 + this.k * node.minDepth));` — no
  zero-denominator guard. `k = -1`, `minDepth = 1` ⇒ `Infinity`.
- `src/engine/NodeSizer.ts:52` — `sizePx: settings.minPx + score * (settings.maxPx - settings.minPx)`
  propagates it; `src/view/graphIdentity.ts:52-57` `nodeDimensionsPx` yields `width/height = Infinity`.
- `src/engine/SettingsSpec.ts:153` — `depthDecayK: { default: 1 }`, a bare `DefaultSpec<number>` with
  no bounds; there is **no `clampSizingSettings`** (only `clampForceLayoutSettings`,
  `src/engine/constants.ts:99`). `src/persistence/persistedShapes.ts:184` accepts any finite value.
- `src/view/SizingSection.tsx:87-93` + `SizingNumber` at `:121-125` — the only guard is
  `!Number.isNaN(valueAsNumber)`; the `min={0}` attribute is advisory, so a typed `-1` is accepted.

One correction/addition to the explorer's report: the **Obsidian settings tab** path is NOT equally
open — `VicinityGraphSettingTab.addSizingNumber` (`src/view/VicinityGraphSettingTab.ts:464-469`)
enforces `parsed >= min`, so `-1` is rejected there. The React sizing panel is the live entry point.

**Second, independent non-finite path found (also for the follow-up ticket):** both settings paths
accept `Infinity` for `minPx`/`maxPx` — `Number("1e999") === Infinity`, which is neither `NaN` nor
`< min`, so it passes `addSizingNumber`'s `!Number.isNaN(parsed) && parsed >= min` AND
`SizingNumber`'s NaN-only check, giving `sizePx = Infinity` with no depth-decay involvement.

Per scope, `NodeSizer.ts` and the settings clamping were NOT modified. TOP_LEVEL_AGENT owns filing
the follow-up (suggested scope: a `clampSizingSettings` + a zero-denominator guard in
`DepthDecayMetric`, applied on both the persistence and UI write paths).

## Process note

While verifying non-vacuity I ran `git checkout -- src/view/edgeRouting.ts` to undo a temporary
guard-disabling edit; it reverted the whole file. All four edits were re-applied and both
`npm run check` and `npm test` were re-run green afterwards on the final tree.
