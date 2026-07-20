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

### Left for later phases (NOT started)
- Phase B: `NeighborhoodGraphBuilder.build` → `GraphBuildResult{graph, controls}` (call
  `ControlsModelBuilder.build(inputs)` on the SAME assembled inputs); `GraphSourcePort` + controller
  publish `controls`; `handleSettingsChanged()`; `docid?` on `FlowNodeData`; `ControlsActions` adapter
  (executor for `SettingsCommand`/pin/unpin) + `ControlsActionsPort`; view ctor deps. NOTE: `main.ts`
  `logNeighborhoodGraph` and `GraphViewController.test.ts` fakes must destructure `{ graph }` from the
  new build result (compile break otherwise).
- Phase C: in-view React toolbar + CSS.
- Phase D: settings tab + refresh fan-out.
