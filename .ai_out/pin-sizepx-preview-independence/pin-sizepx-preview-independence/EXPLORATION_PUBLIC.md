# EXPLORATION — sizePx vs nodePreviewPreference

Findings from a read-only sweep. Signatures quoted below were read from source;
re-verify before relying on an exact line number.

## 1. `src/engine/NodeSizer.ts`

```ts
export interface NodeSize {
  readonly sizeScore: number;
  readonly sizePx: number;
}

export class NodeSizer {
  constructor(private readonly provider: LinkProvider) {}
  computeSizes(
    nodes: ReadonlyMap<VaultPath, TraversedNode>,
    rawSettings: SizingSettings,
  ): ReadonlyMap<VaultPath, NodeSize>
}

// exported only for its own guard test:
export class DepthDecayMetric implements SizeMetric { /* … */ }
```

**Key structural fact:** `computeSizes` takes `SizingSettings`
(`{ metrics, depthDecayK, minPx, maxPx }`) — **not** `ViewSettings`. So
`nodePreviewPreference` is unreachable at that boundary *today*.
`sizePx = minPx + score * (maxPx - minPx)`; centrals bypass metrics
(`CENTRAL_SIZE_SCORE` → `maxPx`).

## 2. `src/engine/NodeSizer.test.ts` — style

- vitest `describe/expect/it`; `FakeLinkProvider` / `FakeVaultSpec`,
  `VicinityTraversal`, `EngineDefaults`, `asVaultPath`.
- Local helpers: `sizingWith(enabled, depthDecayK = 1)` (builds off
  `EngineDefaults.sizingSettings()`), `sizeAll(spec, settings, rootPaths?)`,
  `score(sizes, path)`.
- BDD: `it("WHEN … THEN …")`, grouped under `describe("NodeSizer <topic>")`.
- Closest analog for a cross-cutting `sizePx` invariant: the existing
  `NodeSizer hostile sizing settings (sizePx stays finite)` block, which uses an
  `everySizePx(settings)` helper plus `it.each`.

## 3. `nodePreviewPreference`

- `src/engine/types.ts` — `export type NodePreviewPreference = "auto" | "outline" | "image";`
  plus a `NODE_PREVIEW_PREFERENCES` const array (with an exhaustiveness assertion)
  — **iterate that array in the test rather than hardcoding three literals**, so a
  fourth value is covered automatically.
- On `ViewSettings`: `readonly nodePreviewPreference: NodePreviewPreference;`
- Default `"auto"`, declared in `SETTINGS_SPEC` (`src/engine/SettingsSpec.ts`);
  `SettingsDefaults.ts` is a discoverability re-export.
- Read at: `ViewSettingsResolver.ts` (cascade), `persistence/persistedShapes.ts`,
  `view/flowMapping.ts` (`toFlowNodeData` → `nodePreviewKind`),
  `view/settingsResetPlan.ts`, `view/settingsWritePlan.ts`,
  `view/VicinityGraphSettingTab.ts`, `view/nodePreviewChoice.ts`.
  **Never** read in `NodeSizer.ts`.
- `VicinityEngine.build()` calls
  `new NodeSizer(this.provider).computeSizes(traversal.nodes, viewSettings.sizing)`
  — only the `sizing` sub-object crosses into sizing.

## 4. `nodeDimensionsPx`

Lives in **`src/view/graphIdentity.ts`** (the ticket says `flowMapping.ts`, which
merely imports it):

```ts
export function nodeDimensionsPx(node: GraphNode): NodeDimensions {
  return {
    width: Math.max(node.sizePx, Math.min(NODE_MAX_LABEL_WIDTH_PX, estimateNodeLabelWidthPx(node.title))),
    height: node.sizePx,
  };
}
```

Takes a `GraphNode` only — no settings. Tested in `src/view/graphIdentity.test.ts`
via `makeNode` from `./testFixtures/graphFixtures`.

## 5. The pointer that generated this ticket

`src/view/GraphStructureDiff.test.ts` (~:47-60) —
`it("WHEN two builds differ ONLY in nodePreviewPreference THEN it reuses the layout")`.
Its comment explicitly says the fixture's `sizePx` is fixed, so a future
size↔preview coupling "would slip past HERE and needs pinning where sizePx is
computed instead". `SIZE_RELAYOUT_THRESHOLD` is in `src/view/constants.ts`.

## 6. Reusable fixtures

- `src/view/testFixtures/graphFixtures.ts`: `makeNode`, `makeEdge`, `makeGraph`
  (internal `makeViewSettings()` yields a full `ViewSettings`, preference `"auto"`).
- `src/engine/FakeLinkProvider.ts` + `FakeVaultSpec`.
- `EngineDefaults.sizingSettings()` / `EngineDefaults.viewSettings()` in
  `src/engine/constants.ts`.
- `src/engine/VicinityEngine.test.ts` helpers: `fixtureProvider()`,
  `buildRequest(overrides)`, `build(overrides)`, `node(graph, path)`.

## 7. Open tension for the implementer

Because `computeSizes` never accepts `ViewSettings`, a NodeSizer-suite test must
vary the preference on a **full `ViewSettings`** and feed `viewSettings.sizing`
into the sizer — that is what makes the assertion meaningful rather than
tautological. The ticket's acceptance criterion (test in the NodeSizer suite,
all preference values, identical `sizePx`) is binding regardless.

A `VicinityEngine`-level counterpart (build twice varying only the preference,
assert identical `sizePx` per node) additionally covers the
`ViewSettingsResolver → NodeSizer` seam, which is where a real regression
(someone routing `viewSettings` wholesale into a new size metric) would surface.
