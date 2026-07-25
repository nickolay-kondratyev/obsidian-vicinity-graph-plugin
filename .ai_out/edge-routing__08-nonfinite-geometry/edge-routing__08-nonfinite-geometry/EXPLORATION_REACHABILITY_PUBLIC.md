# EXPLORATION_REACHABILITY_PUBLIC — can a non-finite coordinate reach `extractEdgeRoutingInput`?

> Produced by the read-only EXPLORATION_REACHABILITY sub-agent; persisted by TOP_LEVEL_AGENT.
> Line numbers as of branch base commit `6c5e1e7`. **Claims below are agent-reported and should be
> re-verified by IMPLEMENTATION before being written into permanent docs.**

## VERDICT: REACHABLE TODAY — via ordinary UI, not just corrupt persistence

The reachable path is **node SIZING, not layout**: an unguarded division in the depth-decay sizing
metric yields `Infinity` for `Depth decay k = -1` (or any `k` with `1 + k·minDepth === 0`), which
flows into `FlowNode.width/height` and straight into a `"note"` obstacle.

## Evidence chain

1. `src/engine/NodeSizer.ts:136-147` — `DepthDecayMetric.normalizedValues`:
   `normalized.set(path, 1 / (1 + this.k * node.minDepth));`
   No guard for `1 + k*minDepth === 0`. `k = -1`, `minDepth = 1` ⇒ `1/0 = Infinity`.
2. `src/engine/NodeSizer.ts:58-71` — `composeScore` sums `weight * value` / `totalWeight`;
   an `Infinity` term survives.
3. `src/engine/NodeSizer.ts:37-56` — `computeSizes`:
   `sizePx: settings.minPx + score * (settings.maxPx - settings.minPx)` ⇒ `Infinity`.
4. `src/view/graphIdentity.ts:53-58` — `nodeDimensionsPx`:
   `Math.max(node.sizePx, …)` ⇒ `width = Infinity`, `height = node.sizePx = Infinity`.
5. `src/view/flowMapping.ts:188-197` — placed unguarded on the `FlowNode` (`kind: "note"`).
6. `src/view/edgeRouting.ts:142-151` — copied verbatim into the obstacle:
   `obstacles.push({ id, x: position.x, y: position.y, widthPx: node.width, heightPx: node.height, kind: "note" })`.
7. `src/view/edgeRouting.ts:464-470` (`rectOf`) ⇒ `x2 = Infinity` ⇒ `new avoid.Rectangle(...)`
   ⇒ `processTransaction()` abort ⇒ dead wasm singleton for the session.
8. Not gated by relayout: `GraphViewController.ts:182-237` (`runRebuild`) recomputes `flow`
   (hence width/height) from current settings on **every** rebuild and always calls
   `resolveRoutes` → `extractEdgeRoutingInput:254`. `decision === "reuse-layout"` skips only the
   layout call, not sizing or routing.

## Why nothing upstream stops it

- `src/view/SizingSection.tsx:82-99` and `src/view/VicinityGraphSettingTab.ts:321-323` render
  `depthDecayK` as `<input type="number" min={0}>`. The HTML `min` attribute does not block typed
  input — it only marks `:invalid`. `onChange` accepts any parseable non-`NaN` value, so `-1` passes.
- `src/engine/SettingsSpec.ts:61,153` — `depthDecayK` is a bare `DefaultSpec<number>` (`{ default: 1 }`)
  with **no min/max/step bounds**, and there is **no `clampSizingSettings`** analogous to
  `clampForceLayoutSettings` (`src/engine/constants.ts:98-113`).
- Persistence `parseSizing` (`src/persistence/persistedShapes.ts:172-188`) rejects only non-finite
  values (`numberOrUndefined`, line 271-273). `-1` is finite ⇒ accepted un-clamped.

## Candidates investigated and RULED OUT

- **d3-force refinement** — the ticket named `src/view/D3ForceLayout.ts`, which does not exist; the
  real file is `src/view/d3ForceRefinement.ts` (`refineForceRootLayout`, lines 34-111). It uses a
  seeded LCG (`seededRandom`, 133-140) to jiggle coincident bodies apart, and its arithmetic
  (`minHalfExtent`, `linkCountOf` defaulting to `1`) avoids division by zero. Its settings are
  clamped by `clampForceLayoutSettings` on both the persistence and slider write paths
  (`ForceLayoutSection.tsx:84-96`, `<input type="range">` + explicit `Number.isNaN` guard).
  **Not reachable.**
- **ELK** — `src/view/ElkLayoutRunner.ts` is a pass-through to `elkjs` with no output validation, and
  `src/view/elkMapping.ts:137-170` (`extractElkPositions` / `extractElkDimensionsById`) uses `?? 0`,
  which does not catch `NaN`/`Infinity`. ELK is not shown to produce non-finite output from finite
  input; if fed the `Infinity`-sized node above it could propagate — a **second-order consequence of
  the same root cause**, not an independent path.
- **Persisted node positions** — do not exist. `persistedShapes.ts` persists `pins` as
  `docid + pinTimestamp` (which notes are central), never x/y or width/height. The hypothesised
  "corrupt persisted coordinates" path has no mechanism in this codebase.

## Consequence for this ticket

The extraction-level finiteness filter is **not** belt-and-braces for an unreachable case — it closes
a live path. The upstream `1/(1 + k·minDepth)` division and the missing `depthDecayK` clamp are a
SEPARATE defect (wrong node sizes, not just dead routing) and belong in a follow-up ticket.
