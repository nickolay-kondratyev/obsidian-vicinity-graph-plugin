# IMPLEMENTATION — step-06-controls

## Phase A — pure planners + shared extraction + scenario tests (COMPLETE)

Scope: the pure, unit-tested core only. NO React, NO obsidian imports, NO controller/view wiring.
Everything below is consumable by Phases B/C/D and the reviewer.

### Files added

| Path | Public surface |
|------|----------------|
| `src/view/constants.ts` (EXTENDED) | `MIN_STEPPER_DEPTH = 0`, `MAX_STEPPER_DEPTH = 5`, `clampStepperDepth(value: number): number` (`Math.min(MAX, Math.max(MIN, Math.round(value)))`). Existing exports untouched. |
| `src/view/clampStepperDepth.test.ts` | §11.4 cases (-1→0, 0→0, 3→3, 5→5, 6→5, 2.4→2). |
| `src/view/settingsWritePlan.ts` | `SettingsInteraction`, `SettingsCommand` unions; `SettingsWriteContext`; `planSettingsWrite(i, ctx): SettingsCommand`. |
| `src/view/settingsWritePlan.test.ts` | §11.1 incl. pin-on-toggle (value==global still writes) + direction→field mapping. |
| `src/view/nodePinAction.ts` | `NodePinAction` union; `planNodePinAction(tier: NodeTier): NodePinAction`. |
| `src/view/nodePinAction.test.ts` | §11.3 (asserts title + iconId). |
| `src/adapters/resolvePinnedDescriptors.ts` | `PinnedResolutionInputs`, `ResolvedPinnedRoot`, `PinnedRootResolver.resolve(inputs): readonly ResolvedPinnedRoot[]`. The SHARED skip-rule. |
| `src/view/ControlsModel.ts` | `DirectionDepth`, `CentralControl`, `ControlsModel`; `ControlsModelBuilder.build(inputs: GraphRequestInputs): ControlsModel`. |
| `src/view/ControlsModel.test.ts` | §11.2 (presence-when-equals-global, value 0, Q-A own-depths-reads-inherited, centralDepths-wins, list order/skips, persistable gate). |
| `src/adapters/CentralDepthRoundTrip.test.ts` | §11.5(a) assembler round-trip with real `DocDataMutations`. |

### Files changed (minimal, behavior-preserving)

| Path | Change |
|------|--------|
| `src/adapters/GraphRequestAssembler.ts` | `GraphRequestInputs` gains `mainPersistable: boolean`. `assemble` now calls `PinnedRootResolver.resolve(inputs)` once (extracted skip-rule + per-root merged override); `depthOverrides`/`pinnedViewOverrides` consume `ResolvedPinnedRoot[]`. Same output. |
| `src/adapters/NeighborhoodGraphBuilder.ts` | Computes `mainPersistable = mainDocId !== null && DocPersistEligibility.isFilenameSafeDocId(mainDocId)` and passes it into the assembler inputs. |
| `src/adapters/GraphRequestAssembler.test.ts` | `inputs()` helper adds `mainPersistable: true`. |
| `src/engine/NeighborhoodEngine.test.ts` | Appended §11.5(b) `describe` (pinned-central depth re-exploration end-to-end). |

### Public signatures (for consuming phases)

```ts
// settingsWritePlan.ts
type SettingsInteraction =
  | { kind: "main-depth"; direction: Direction; value: number | undefined }
  | { kind: "central-depth"; centralDocid: string; direction: Direction; value: number | undefined }
  | { kind: "global-depth"; direction: Direction; value: number }
  | { kind: "global-cap"; value: number }
  | { kind: "global-sizing"; sizing: SizingSettings };
type SettingsCommand =
  | { kind: "doc-depth-field"; field: keyof DepthOverride; value: number | undefined }
  | { kind: "central-depth-field"; centralDocid: string; field: keyof DepthOverride; value: number | undefined }
  | { kind: "global-depths"; depths: DepthSettings }
  | { kind: "global-view"; view: ViewSettings };
interface SettingsWriteContext { globalDepths: DepthSettings; globalView: ViewSettings }
function planSettingsWrite(i: SettingsInteraction, ctx: SettingsWriteContext): SettingsCommand;

// nodePinAction.ts
type NodePinAction =
  | { kind: "none" }
  | { kind: "pin"; title: string; iconId: string }     // "Pin to graph" / "pin"
  | { kind: "unpin"; title: string; iconId: string };  // "Unpin from graph" / "pin-off"
function planNodePinAction(tier: NodeTier): NodePinAction;

// ControlsModel.ts
interface DirectionDepth { value: number; pinned: boolean }
interface CentralControl {
  kind: "main" | "pinned"; path: string; title: string; docid?: string;
  persistable: boolean; outgoing: DirectionDepth; incoming: DirectionDepth;
}
interface ControlsModel { centrals: readonly CentralControl[] }  // MAIN first, then pins
class ControlsModelBuilder { static build(inputs: GraphRequestInputs): ControlsModel }

// resolvePinnedDescriptors.ts
interface ResolvedPinnedRoot {
  descriptor: PinnedNodeDescriptor;
  mergedDepthOverride: DepthOverride;        // {...own, ...MAIN.centralDepths[docid]} — feeds resolver
  mainAdjustedDepthOverride: DepthOverride;  // ONLY MAIN.centralDepths[docid] — presence = pinned
}
class PinnedRootResolver { static resolve(inputs: PinnedResolutionInputs): readonly ResolvedPinnedRoot[] }
```

### Key design decisions

1. **DRY value vs. pinned (plan §5, review Important-1).** The toolbar `value` is derived through
   `TraversalSettingsResolver.resolveForRoot(global, effectiveOverride)[field]` — the SAME function the
   engine uses — so "value shown == value graphed" is structural. `pinned` is a SEPARATE per-field
   presence check on the OWNED layer, which the resolver cannot express (a pinned value can equal global).

2. **One shared skip-rule (plan §3/§5).** `PinnedRootResolver.resolve` is the single copy of
   "skip unresolved / skip main-as-pin", reused by the assembler AND the ControlsModelBuilder. The
   assembler was refactored to call it once (previously it iterated pins twice). Output is unchanged
   (verified by the pre-existing assembler tests).

3. **`persistable` mirrors the load gate (plan §5, task item 4).** Threaded a precomputed
   `mainPersistable: boolean` through `GraphRequestInputs` rather than deriving from bare
   `mainDocId !== null` — an unsafe-foreign-docid MAIN has a non-null docid but is NOT persistable.
   Every `CentralControl.persistable` (MAIN and pinned rows alike) uses this single flag, because ALL
   depth writes land on the MAIN file (own depths → `setDocDepthField`; a pinned central's depth →
   MAIN's `centralDepths` → `setCentralDepthField`). MAIN row exposes `docid` only when persistable.

4. **Q-A layer semantics (CLARIFICATION round 2).** For a pinned central X carrying its own depth,
   the `pinned` flag reflects ONLY `MAIN.centralDepths[X]` (`mainAdjustedDepthOverride`), while `value`
   is the full resolution. Consequence (as designed): X pinned only via its OWN depths reads
   "inherited" at MAIN Y though value ≠ global. Covered by a dedicated test.

### Deviations from the plan
- None material. The plan floated `resolvePinnedDescriptors` as "a shared static on the assembler OR a
  new module" — chose the standalone module `src/adapters/resolvePinnedDescriptors.ts` (class
  `PinnedRootResolver`) so both the assembler and the view builder import it without a cycle. The class
  name is `PinnedRootResolver` (file name kept as the plan's `resolvePinnedDescriptors.ts`).

### Test results
- New pure tests: 42 passing (clamp 6, settingsWritePlan 12, nodePinAction 3, ControlsModel 17, +
  assembler helper unchanged 4... counted within suites).
- Scenario: round-trip 4, engine re-exploration 3.
- **Full suite: 48 files, 491 tests passing. `npm run check` (tsc -noEmit): clean.**

## Phase B — builder + controller + plumbing (COMPLETE)

Wires the Phase-A pure `ControlsModel` into the live rebuild pipeline and adds the obsidian executor.
No React UI, no CSS, no settings tab yet (Phase C/D).

### Files added
| Path | Public surface |
|------|----------------|
| `src/view/ControlsActions.ts` | `class ControlsActions implements ControlsActionsPort`. Ctor `(controller, persistenceServices, pluginDataStore, app)`. Obsidian glue: switches a `SettingsCommand` onto `PersistenceServices`/`PluginDataStore`, resolves the MAIN `TFile` via `controller.currentMainPath()`, `Notice` on `not-persistable`, then `controller.handleSettingsChanged()`. Not unit-tested (glue) — typechecks. |

### Files changed
| Path | Change |
|------|--------|
| `src/view/viewPorts.ts` | `GraphSourcePort.build` → `Promise<GraphBuildResult \| null>`. Added `GraphBuildResult` + `ControlsActionsPort`. |
| `src/adapters/NeighborhoodGraphBuilder.ts` | `build` returns `{ graph, controls }`; one `inputs` object feeds `GraphRequestAssembler.assemble` AND `ControlsModelBuilder.build` (single disk read). |
| `src/view/GraphViewController.ts` | `FlowSnapshot.controls`; store/publish `controls`; new `handleSettingsChanged()` (immediate rebuild) + `currentMainPath()`. Stays obsidian-free. |
| `src/view/flowMapping.ts` | `FlowNodeData.docid?: string` (from `GraphNode.docid`, on centrals). |
| `src/view/NeighborhoodGraphView.tsx` | ctor gains `pluginDataStore` + `persistenceServices`; builds `ControlsActions`; `refresh()`; `getControlsActions()`. |
| `src/main.ts` | `registerView` passes the two new deps; `logNeighborhoodGraph` destructures `{ graph }`. |
| `GraphViewController.test.ts`, `NeighborhoodGraphBuilder.test.ts`, `flowMapping.test.ts` | Updated for the new return shape; +5 tests (settings-changed rebuild ×3, docid ×2). |

### New public signatures
```ts
// viewPorts.ts
interface GraphBuildResult { graph: NeighborhoodGraph; controls: ControlsModel }
interface GraphSourcePort { build(mainPath: string): Promise<GraphBuildResult | null> }
interface ControlsActionsPort {
  applySettings(command: SettingsCommand): Promise<void>;
  pinNode(path: string): Promise<void>;
  unpinNode(docid: string): Promise<void>;
}
// GraphViewController.ts
interface FlowSnapshot { /* …existing… */ controls: ControlsModel }
handleSettingsChanged(): void   // immediate rebuild, bypasses decideActiveFileRebuild, clears debounce
currentMainPath(): string | null
// NeighborhoodGraphView.tsx
refresh(): void                            // → controller.handleSettingsChanged(); settings-tab fan-out
getControlsActions(): ControlsActionsPort | null
// flowMapping.ts
type FlowNodeData = { …; docid?: string; … }
```

### How Phase C consumes Phase B
- Toolbar model = `snapshot.controls` (MAIN first; empty view → `centrals: []`).
- Actions = `view.getControlsActions()` → provide via a (Phase-C) `ControlsActionsContext`; wire into the flow render.
- Unpin docid = `FlowNodeData.docid`.
- `planSettingsWrite` context (globals) is NOT in the snapshot yet — Phase C threads it (React builds the
  `SettingsCommand`; `applySettings` only executes).

### Deviation
- `ControlsActions` uses `new Notice(...)` directly (obsidian glue file) rather than a `GraphUiPort.showNotice`
  port (plan §7) — one fewer port dependency for Phase B (KISS). Phase C may still add `showNotice` if a node
  surface needs it.

### Test results (Phase B)
- **Full suite: 48 files, 496 tests passing. `npm run check` (tsc -noEmit): clean. Zero regressions.**

## Phase C — in-view toolbar UI + node pin affordances + CSS (COMPLETE)

Renders the tested pure layers as the user-facing toolbar and node pin/unpin. No settings tab yet (Phase D).

### Components added
| Path | Responsibility |
|------|----------------|
| `src/view/ControlsActionsContext.ts` | React context (sibling of `GraphUiContext`) delivering `ControlsActionsPort`; `useControlsActions()`. |
| `src/view/DepthStepper.tsx` | Presentational `−/value/+` + reset. Clamps via `clampStepperDepth`; emits `number \| undefined`. `data-pinned`/`data-disabled` drive inherited-vs-pinned + disabled CSS; reset hidden unless `pinned`. |
| `src/view/CentralDepthControls.tsx` | One central row → builds `SettingsInteraction` (`main-depth`/`central-depth`) → `planSettingsWrite(_, ctx)` → `actions.applySettings`. NO business rule. |
| `src/view/SizingSection.tsx` | `<details>` mirror of the tab's sizing controls (5 metrics + weights, min/max px, depthDecayK). CONTROLLED off `view.sizing`; every edit → whole-object `global-sizing` write. |
| `src/view/GraphToolbar.tsx` | The `<Panel top-left>` body: native `<details>` (collapsed by default). MAIN row always visible; pinned centrals + sizing each behind a disclosure (CLARIFICATION Q1). `nowheel nodrag nopan`. |

### Existing files changed
| Path | Change |
|------|--------|
| `src/view/ControlsModel.ts` | **`ControlsModel` now also carries `globalDepths: DepthSettings` + `globalView: ViewSettings`** — the single source for the `planSettingsWrite` ctx and the sizing form seed (builder already loaded them; no React re-read/dup). |
| `src/view/GraphViewController.ts` (+`.test.ts`) | `EMPTY_CONTROLS` seeds those globals from `EngineDefaults`. |
| `src/view/viewPorts.ts` | Added `NodeMenuEntry` + `NodeMenuRequest`; `GraphUiPort.showNodeMenu(request)`. |
| `src/view/ObsidianGraphUi.ts` | Implemented `showNodeMenu` (native `Menu`, item `onClick` = the carried pin/unpin closure). |
| `src/view/NoteNode.tsx` | Hover `PinButton` (`nodrag nopan`) + `onContextMenu` → `ui.showNodeMenu`; both share `planNodePinAction(data.tier)`; routes `actions.pinNode(path)`/`unpinNode(docid)`. |
| `src/view/NeighborhoodGraphFlow.tsx` | New `actions` prop; provides `ControlsActionsContext`; renders `<Panel top-left><GraphToolbar/></Panel>`. |
| `src/view/NeighborhoodGraphView.tsx` | Passes `actions={controlsActions}` into the flow. |
| `src/view/graph-view.css` | Toolbar/stepper/pin-button/disclosure/sizing blocks — ALL theme vars (zero own colors), ~260px, body scrolls vertically. |

### ControlsModel extension (the one pure-surface change)
```ts
interface ControlsModel {
  readonly centrals: readonly CentralControl[];
  readonly globalDepths: DepthSettings;   // NEW — planSettingsWrite ctx
  readonly globalView: ViewSettings;      // NEW — ctx + SizingSection seed
}
```
`GraphToolbar` derives `ctx = { globalDepths: controls.globalDepths, globalView: controls.globalView }` once
and threads it to both `CentralDepthControls` and `SizingSection`.

### How Phase D (settings tab) reuses this
- **Same write path, zero duplication:** the tab builds `global-depth`/`global-cap`/`global-sizing`
  `SettingsInteraction`s → `planSettingsWrite(_, ctx)` → `pluginDataStore.saveGlobal*`. The tab's `ctx` comes
  from `pluginDataStore.globalDepths()`/`globalView()` directly (it is outside the React tree). `SizingSection`'s
  field-set + labels (`METRICS` order, whole-object `global-sizing` merge) are the reference for the tab's
  sizing controls; the tab uses obsidian `Setting` widgets rather than reusing the TSX component.
- `NeighborhoodGraphView.refresh()` (Phase B) is the fan-out target; `main.ts` iterates
  `getLeavesOfType(VIEW_TYPE_NEIGHBORHOOD_GRAPH)` after each global save.

### Deviations
- **Pinned centrals behind a disclosure** (MAIN always visible), honoring binding CLARIFICATION Q1 over the
  task's item-10 phrasing ("pinned depth controls always visible"). One-line structural revert in `GraphToolbar`
  if the human prefers always-visible.
- No `showNotice` port added: the not-persistable/not-pinnable `Notice` is emitted inside `ControlsActions`
  (Phase B). `GraphUiPort` gained only `showNodeMenu`.

### Test / gate results (Phase C)
- **Full suite: 48 files, 497 tests passing** (+1: ControlsModel global-context). `npm run check` (tsc): clean.
  `node esbuild.config.mjs production`: OK (CSS bundled into `styles.css`, verified). Zero regressions.

---

### Left for later phases (NOT started)
- Phase D: `NeighborhoodGraphSettingTab` + `addSettingTab` + `refreshOpenViews()` fan-out (`view.refresh()`).
