# Detailed Implementation Plan — step-06-controls

Primary planning deliverable. Builds on `EXPLORATION_*` (findings, not re-derived) and
`CLARIFICATION__PUBLIC.md` (binding human decisions). Target: put the built-and-tested
depth/pin/sizing/cap machinery in the user's hands via an in-view toolbar, node pin/unpin,
and a global settings tab — with the contract-heavy "which write lands where" logic isolated
as pure, unit-tested functions.

---

## 1. Problem understanding

Steps 02–05 built and tested every write primitive (`PersistenceServices.*`,
`PluginDataStore.saveGlobal*`, `DocDataMutations`), the read/assemble/resolve plumbing
(`NeighborhoodGraphBuilder` → `GraphRequestAssembler` → `NeighborhoodEngine`), and the rich
renderer. **step-06 is almost entirely UI + wiring over these.** No new engine algorithm.

Deliverables, per spec + CLARIFICATION:
- In-view **toolbar** (single React-Flow `<Panel top-left>`, collapsed by default): MAIN central +
  per-direction depth steppers always visible; pinned centrals + a sizing section behind
  disclosures; reset-to-global (unpin field) affordance + inherited-vs-pinned visual distinction on
  depth steppers.
- **Node pin/unpin**: hover-reveal button on the node + right-click context menu (both surfaces).
- **Global settings tab**: depth defaults, sizing defaults, node-cap default.
- Node cap + sizing are **GLOBAL-only in V1** (both the settings tab and the toolbar's sizing
  section write `saveGlobalView`). **Depth steppers are the only per-doc / per-central write surface.**

Constraints / assumptions:
- Sidebar home ~300px wide → vertical stack, vertical scroll, no horizontal overflow.
- `MAX_STEPPER_DEPTH = 5`, min `0` (= central only). Steppers clamp; no free text.
- Reset-to-global = write field `value = undefined` (existing delete-field semantics).
- Pin-on-toggle: an explicit change ALWAYS writes the per-doc field, even when equal to global.
- Every control round-trips through an Obsidian restart.

---

## 2. High-level architecture

Layered to keep the PURE, unit-testable core separate from Obsidian/React glue — mirroring the
existing `attachmentMenu.ts` (pure planner) + `ObsidianGraphUi` (adapter) pattern.

```
                        PURE (vitest, no obsidian/react)
  ┌───────────────────────────────────────────────────────────────────────┐
  │ settingsWritePlan.ts   planSettingsWrite(interaction, ctx) → Command   │  #2
  │ ControlsModel.ts       ControlsModelBuilder.build(inputs) → model      │  #3+#4
  │ nodePinAction.ts       planNodePinAction(tier) → pin|unpin|none        │  #6
  │ constants.ts           MAX/MIN_STEPPER_DEPTH, clampStepperDepth        │  #9
  └───────────────────────────────────────────────────────────────────────┘
             ▲ same GraphRequestInputs                 ▲ pure command
             │ (already loaded by builder)             │
  ┌──────────┴───────────────┐         ┌───────────────┴──────────────────┐
  │ NeighborhoodGraphBuilder │         │ ControlsActions (adapter)         │  executor:
  │  → GraphBuildResult      │         │  Command → PersistenceServices/   │  obsidian glue
  │    {graph, controls}     │         │  PluginDataStore + Notice +       │
  └──────────┬───────────────┘         │  controller.handleSettingsChanged │
             │ controls in snapshot    └───────────────┬──────────────────┘
  ┌──────────┴───────────────┐                         │ ControlsActionsPort (DIP)
  │ GraphViewController       │◄── handleSettingsChanged┘
  │  FlowSnapshot{...,controls}│
  └──────────┬───────────────┘
             │ useSyncExternalStore
  ┌──────────┴───────────────────────────────────────────────────────────┐
  │ NeighborhoodGraphFlow  (provides GraphUiContext + ControlsActionsContext)│
  │   ├─ <Panel top-left> GraphToolbar (collapsible)                        │
  │   │     ├─ CentralDepthControls (MAIN + pinned) → DepthStepper ×2       │
  │   │     └─ SizingSection (disclosure, global mirror)                    │
  │   └─ NoteNode: hover PinButton + onContextMenu → ui.showNodeMenu        │
  └────────────────────────────────────────────────────────────────────────┘

  main.ts: registerView(pass pluginDataStore+persistenceServices) + addSettingTab
           + NeighborhoodGraphSettingTab (global depth/sizing/cap) → fan-out refresh
```

**Data flow for a depth change:** stepper onChange → `planSettingsWrite(interaction, {globalDepths,
globalView})` → `SettingsCommand` → `ControlsActions.apply(command)` resolves MAIN `TFile`, calls
`PersistenceServices.setDocDepthField` / `setCentralDepthField` (awaited, serialized write) →
`controller.handleSettingsChanged()` → immediate `runRebuild()` → builder re-reads fresh disk state →
new `{graph, controls}` → snapshot → toolbar + graph re-render.

---

## 3. Component / module decomposition (SRP)

### New PURE modules (unit-tested, no obsidian/react)

| File | Responsibility |
|------|----------------|
| `src/view/settingsWritePlan.ts` | `SettingsInteraction` + `SettingsCommand` unions; `planSettingsWrite(interaction, ctx)`. THE "which write lands where" contract layer (#2). |
| `src/view/ControlsModel.ts` | `ControlsModel`, `CentralControl`, `DirectionDepth` types; `ControlsModelBuilder.build(inputs)`. Central-selector list + resolved per-direction depth + inherited-vs-pinned flag (#3+#4). |
| `src/view/nodePinAction.ts` | `planNodePinAction(tier) → {kind:"pin"\|"unpin"\|"none", title, iconId}`. Shared by hover button + context menu (#6). |
| `src/adapters/resolvePinnedDescriptors.ts` (or a shared static on the assembler) | Extracted pin-resolution/skip rule reused by `GraphRequestAssembler` AND `ControlsModelBuilder` (DRY the "skip unresolved / skip main-as-pin" business rule). |

### New ADAPTER / GLUE modules (obsidian/react — manual QA only)

| File | Responsibility |
|------|----------------|
| `src/view/ControlsActions.ts` | Implements `ControlsActionsPort`: executes a `SettingsCommand` / pin / unpin against `PersistenceServices` + `PluginDataStore`, resolves `TFile` from path, surfaces `Notice` on `not-persistable`, then calls `controller.handleSettingsChanged()`. |
| `src/view/ControlsActionsContext.ts` | React context delivering `ControlsActionsPort` to node + toolbar components (sibling of `GraphUiContext`). |
| `src/view/GraphToolbar.tsx` | `<Panel top-left>` collapsible container; renders central list + sizing disclosure. |
| `src/view/CentralDepthControls.tsx` | One row per central (MAIN + pinned): title + `DepthStepper` ×2 (out/in) + reset affordance. |
| `src/view/DepthStepper.tsx` | −/value/+ stepper; clamps via `clampStepperDepth`; inherited-vs-pinned styling; reset button when pinned. |
| `src/view/SizingSection.tsx` | Disclosure: per-metric toggle + weight, minPx/maxPx, depthDecayK — writes GLOBAL (mirror of settings tab). |
| `src/view/NeighborhoodGraphSettingTab.ts` | `extends PluginSettingTab`: global depth defaults, sizing, node-cap. Seeds from `PluginDataStore`; writes `saveGlobalDepths`/`saveGlobalView`; fans out refresh. |
| `src/view/graph-view.css` (EDIT) | Toolbar / stepper / pin-button / disclosure / inherited-vs-pinned styles. |

### Extended EXISTING files

| File | Change |
|------|--------|
| `src/view/viewPorts.ts` | Add `ControlsActionsPort`; extend `GraphUiPort` with `showNodeMenu` + `showNotice`; add `GraphBuildResult` (or place near controller). |
| `src/view/flowMapping.ts` | Add `docid?: string` to `FlowNodeData` (present on centrals) — needed for unpin. |
| `src/adapters/NeighborhoodGraphBuilder.ts` | `build()` returns `GraphBuildResult{graph, controls} \| null`; compute `controls` via `ControlsModelBuilder.build(inputs)` (same assembled inputs). |
| `src/view/GraphViewController.ts` | `GraphSourcePort.build` returns result; store `controls`, publish in `FlowSnapshot`; add `handleSettingsChanged()` (immediate rebuild). |
| `src/view/NeighborhoodGraphView.tsx` | ctor gains `pluginDataStore` + `persistenceServices`; construct `ControlsActions`; expose `refresh()`; pass actions to flow. |
| `src/view/NeighborhoodGraphFlow.tsx` | Provide `ControlsActionsContext`; render `<GraphToolbar>` in a `<Panel top-left>`; thread `controls` from snapshot. |
| `src/view/NoteNode.tsx` | Hover `PinButton` (`nodrag nopan`, stopPropagation) + `onContextMenu` → `ui.showNodeMenu`. |
| `src/view/ObsidianGraphUi.ts` | Implement `showNodeMenu` (native `Menu`) + `showNotice` (`Notice`). |
| `src/main.ts` | registerView passes new deps; `addSettingTab`; refresh fan-out helper. |

---

## 4. The settings-write layer as PURE functions (#2 — primary test target)

`src/view/settingsWritePlan.ts`. Mirrors `DocDataMutations`' role: it decides WHICH persistence
call + field + value; it does NOT touch Obsidian.

```ts
export type SettingsInteraction =
  | { kind: "main-depth";    direction: Direction; value: number | undefined }   // undefined = reset
  | { kind: "central-depth"; centralDocid: string; direction: Direction; value: number | undefined }
  | { kind: "global-depth";  direction: Direction; value: number }
  | { kind: "global-cap";    value: number }
  | { kind: "global-sizing"; sizing: SizingSettings };

export type SettingsCommand =
  | { kind: "doc-depth-field";     field: keyof DepthOverride; value: number | undefined }   // → setDocDepthField(mainFile,...)
  | { kind: "central-depth-field"; centralDocid: string; field: keyof DepthOverride; value: number | undefined } // → setCentralDepthField(mainFile,...)
  | { kind: "global-depths"; depths: DepthSettings }   // → saveGlobalDepths (whole object)
  | { kind: "global-view";   view: ViewSettings };     // → saveGlobalView (whole object)

export interface SettingsWriteContext {  // current globals, so whole-object commands can merge one field
  readonly globalDepths: DepthSettings;
  readonly globalView: ViewSettings;
}

export function planSettingsWrite(i: SettingsInteraction, ctx: SettingsWriteContext): SettingsCommand;
```

Rules encoded (each an acceptance test):
- `direction → field`: `"outgoing"→"outgoingDepth"`, `"incoming"→"incomingDepth"` (a tiny pure helper; POLS — easy to invert).
- `main-depth` → `doc-depth-field` (executor targets MAIN file); reset carries `value: undefined`.
- `central-depth` → `central-depth-field` with `centralDocid` (executor targets MAIN file's `centralDepths`).
- `global-depth` → `global-depths` command whose payload is `{...ctx.globalDepths, [field]: value}`.
- `global-cap` → `global-view` command `{...ctx.globalView, nodeCap: value}`.
- `global-sizing` → `global-view` command `{...ctx.globalView, sizing}`.
- **Pin-on-toggle at this layer:** the planner NEVER inspects whether `value === global` — it always
  emits the write. (The executor always persists; `DocDataMutations` handles field presence.)

**The executor** `ControlsActions.apply(command, mainPath)` is thin glue (switch → the matching
`PersistenceServices`/`PluginDataStore` call, resolve `TFile` for doc commands, Notice on
`not-persistable`, then `handleSettingsChanged`). Not unit-tested (obsidian) — manual QA + typecheck.

**Where `mainPath` comes from at apply time:** both `doc-depth-field` and `central-depth-field` target
the MAIN file, but the current main path lives in `GraphViewController.mainPath` (private). Rather than
plumb it through React/interactions, expose a pure `GraphViewController.currentMainPath(): string | null`
(a plain string getter — keeps the controller obsidian-free per §6) and have `ControlsActions` read it
inside `apply`. If `currentMainPath()` is `null` the command is a no-op. This is the ONE new controller
surface beyond `handleSettingsChanged()`.

---

## 5. Inherited-vs-pinned derivation (#3) + central-selector model (#4)

**These are ONE pure module** (`ControlsModel.ts`): the central-selector list already needs the
per-direction resolved depth *and* the pinned/inherited flag, and both come from the same inputs.

### Approaches considered

1. **Thread override-presence through the engine output.** Rejected: pollutes the pure engine with
   a UI concern (SRP violation), adds a field to `GraphNode`/`DepthTag`, ripples across the whole
   pipeline for one UI badge. Poor ROI.
2. **View-layer pure fn diffing resolved depth vs global.** Rejected as the *presence* source:
   pin-on-toggle means a pinned field can equal global — value-diff would wrongly show "inherited".
   Diffing values is a lie about pin state.
3. **RECOMMENDED — pure `ControlsModelBuilder` over the already-loaded `GraphRequestInputs`,
   presence-based.** The builder already loads MAIN's `DocData` (own `depths` + `centralDepths`) and
   each pinned central's own `DocData`; presence in those objects is the ground truth. No new IO, no
   engine change, colocated vitest. This is also the read path for #4 (see below) and DRY-shares pin
   resolution with the assembler.

### Model shape

```ts
export interface DirectionDepth {
  readonly value: number;      // fully-resolved (what the graph used)
  readonly pinned: boolean;    // presence in THIS control's own override layer
}
export interface CentralControl {
  readonly kind: "main" | "pinned";
  readonly path: string;
  readonly title: string;      // basename
  readonly docid?: string;     // present for pinned (and MAIN when persistable)
  readonly persistable: boolean; // MAIN may be false → steppers disabled + Notice on write
  readonly outgoing: DirectionDepth;
  readonly incoming: DirectionDepth;
}
export interface ControlsModel {
  readonly centrals: readonly CentralControl[];   // MAIN first, then pinned (assembler order)
}
```

### Resolution rules (mirror `GraphRequestAssembler` EXACTLY)
- **MAIN row** (single override layer = `mainDocData.depths`):
  - `value = mainDocData.depths?.[field] ?? global[field]`.
  - `pinned = mainDocData.depths?.[field] !== undefined` (presence — honors value 0 and value==global).
- **Pinned central X row** (layer this control writes = `mainDocData.centralDepths[X.docid]`; effective
  value also considers X's own depths, matching the assembler merge `{...own, ...centralDepths[X]}`):
  - `value = mainDocData.centralDepths?.[X.docid]?.[field] ?? xOwnDocData.depths?.[field] ?? global[field]`.
  - `pinned = mainDocData.centralDepths?.[X.docid]?.[field] !== undefined` (the layer THIS control
    owns; see #QUESTION_FOR_HUMAN Q-A on the own-depths edge case).
- Pin resolution (which centrals appear) uses the SHARED `resolvePinnedDescriptors(inputs)` so the
  toolbar list and the graph agree: skip unresolved paths, skip main-as-pin.
- **DRY the `value` (not just the pin list):** the resolved `value` above re-states the assembler's
  per-pin merge (`{...own, ...centralDepths[X]}`) AND `TraversalSettingsResolver`'s `override ?? global`
  fallback. To keep "value SHOWN in the toolbar == value USED by the graph" a STRUCTURAL guarantee (not
  two parallel `?? ?? ` chains that can silently drift), the shared extraction should ALSO expose the
  per-root merged `DepthOverride`, and `ControlsModelBuilder` should derive `value` via
  `TraversalSettingsResolver.resolveForRoot(global, mergedOverride)[field]`. `pinned` stays a SEPARATE
  presence check on the owned layer (the resolver can't express it). See review Important-1.
- **`persistable` derivation:** mirror the builder's load gate, NOT a bare `mainDocId !== null` — the
  builder only loads `mainDocData` when `mainDocId !== null && DocPersistEligibility.isFilenameSafeDocId`.
  An unsafe-foreign-docid MAIN has `mainDocId !== null` but no doc-data and its writes are refused; set
  `persistable` from the same gate so steppers disable consistently (else they look editable but Notice
  on write). Thread the eligibility verdict (or a precomputed boolean) into `GraphRequestInputs`.

### Read path for #4 (where the toolbar gets loaded DocData)
`NeighborhoodGraphBuilder.build` already assembles `GraphRequestInputs` (mainDocData, docDataByDocid,
pins, globals). Change `build` to return `GraphBuildResult{graph, controls}` where
`controls = ControlsModelBuilder.build(inputs)` — **single disk read, no race, no new DocDataStore
method.** Controller stores `controls` and publishes it in `FlowSnapshot`. The toolbar reads
`snapshot.controls`; empty snapshot → `controls.centrals = []` (toolbar renders nothing or a stub).

---

## 6. Rebuild wiring (#5)

- **New entry point** `GraphViewController.handleSettingsChanged()`: bypasses
  `decideActiveFileRebuild` (settings changes are not file changes), clears any pending debounce,
  and calls `void this.runRebuild()` immediately against the current `mainPath`.
- **Immediate, NOT debounced.** Justification: `rebuildToken` latest-wins already discards stale
  rebuilds under stepper spamming; `DocDataStore.update` serializes per-docid writes; `PluginDataStore`
  updates in-memory synchronously. The executor **awaits the persistence write before calling
  `handleSettingsChanged`**, so the subsequent `graphBuilder.build` re-reads fresh state. With
  `MAX_STEPPER_DEPTH = 5` the click burst is tiny — debounce would add state/complexity for no
  correctness gain (PARETO). (If a future perf issue appears, `REBUILD_DEBOUNCE_MS` is already the
  reusable knob — noted, not built.)
- **Plumbing:** `NeighborhoodGraphView` ctor grows `pluginDataStore` + `persistenceServices`;
  `main.ts` `registerView` callback passes them; the view builds `ControlsActions(controller,
  persistenceServices, pluginDataStore, app)` and hands the port to `NeighborhoodGraphFlow`, which
  provides it via `ControlsActionsContext`. **`GraphViewController` itself stays obsidian-free** — it
  only exposes `handleSettingsChanged()`; the write calls live in the `ControlsActions` adapter.

**Ripple to note:** `GraphSourcePort.build` return type changes → update `FakeGraphSource` +
`graphOf` + `resolveBuild(index, graph)` in `GraphViewController.test.ts` to return `{graph, controls}`
(controls can be an empty model in those tests — they exercise rebuild concurrency, not controls).
**Also `main.ts` `logNeighborhoodGraph`** (the debug command) calls `graphBuilder.build(...)` and reads
`graph.nodes/edges/hiddenNodeCountsByFolder` directly — it must destructure `{ graph }` from the new
result (compile break otherwise). Add to the Phase-B step-6 edit set.

---

## 7. Pin / unpin on nodes (#6)

- **Shared pure decision** `planNodePinAction(tier)`:
  - `"main"` → `{kind:"none"}` (MAIN not pinnable).
  - `"regular"` → `{kind:"pin", title:"Pin to graph", iconId:"pin"}`.
  - `"pinned-central"` → `{kind:"unpin", title:"Unpin from graph", iconId:"pin-off"}`.
  Drives BOTH the hover button and the context-menu entry (one source of truth, DRY).
- **Hover button** (`NoteNode.tsx`): a `button.nodrag.nopan` revealed on node hover (CSS
  `:hover` opacity; hidden otherwise), `onClick` → `stopPropagation()` → `actions.pinNode(path)` /
  `actions.unpinNode(docid)`. Mirrors the `AttachmentChip` escape-hatch pattern.
- **Context menu** (`NoteNode.onContextMenu`): `preventDefault` + `stopPropagation`; if action kind is
  `"none"` do nothing; else `ui.showNodeMenu({ nativeEvent, entry:{ title, iconId, onClick } })`.
  `ObsidianGraphUi.showNodeMenu` builds a native `Menu` (mirrors `showAttachmentMenu`) with one item
  → `showAtMouseEvent`. The `onClick` closure carries the resolved `actions.pinNode/unpinNode` call, so
  `ObsidianGraphUi` needs no reference to the actions port.
- **docid for unpin:** add `docid?` to `FlowNodeData` (from `GraphNode.docid`, present on centrals).
- **not-persistable:** `ControlsActions.pinNode` resolves the `TFile`, calls
  `persistenceServices.pinDoc(file)`, and on `identity.kind === "not-persistable"` calls
  `ui.showNotice("This note can't be pinned (no stable id).")`. Then `handleSettingsChanged()`.

---

## 8. Global settings tab (#7)

`NeighborhoodGraphSettingTab extends PluginSettingTab`, registered in `main.ts` via
`this.addSettingTab(new NeighborhoodGraphSettingTab(this.app, this))`.

Controls (seed from `pluginDataStore.globalDepths()/globalView()`):
- **Global depth defaults**: outgoing / incoming (clamped 0..MAX_STEPPER_DEPTH) → `saveGlobalDepths`.
- **Sizing defaults**: per-metric enable + weight (5 metrics), minPx/maxPx, depthDecayK → `saveGlobalView`.
- **Node cap**: number → `saveGlobalView` (GLOBAL-only per CLARIFICATION Q4).

**Refresh open views after a settings-tab write:** expose `NeighborhoodGraphView.refresh()`
(`= () => this.controller?.handleSettingsChanged()`); after each save, the tab calls a plugin helper
`refreshOpenViews()` that iterates `app.workspace.getLeavesOfType(VIEW_TYPE)` and calls
`(leaf.view as NeighborhoodGraphView).refresh()`. Obsidian-idiomatic, no bespoke emitter (see Q-C).

The toolbar's `SizingSection` is an in-view mirror using the SAME `planSettingsWrite` `global-sizing`/
`global-cap`(cap stays tab-only) commands → identical write path, zero duplicated write logic.

---

## 9. CSS (#8)

Edit **`src/view/graph-view.css`** only (never generated `styles.css`). New BEM-ish blocks:
`neighborhood-graph-toolbar`, `...__header`/`__body`/`__section`, `neighborhood-graph-stepper`
(`__button`/`__value`/`__reset`), `neighborhood-graph-pin-button`, `neighborhood-graph-sizing-*`.
Rules:
- All colors from Obsidian theme vars (`--background-*`, `--text-*`, `--interactive-accent`,
  `--radius-*`, `--size-4-*`) — plugin ships zero colors.
- Inherited-vs-pinned: pinned value uses `--text-normal` + an accent marker (e.g. left border /
  filled dot `--interactive-accent`); inherited uses `--text-muted` (visually recedes). Reset button
  visible only when `pinned`.
- Toolbar: `max-width` ~ 260px, `max-height` with `overflow-y:auto`, compact `--font-ui-small`;
  collapsed state renders header only. No horizontal overflow at 300px (wrap / scroll internally).
- Pin button: hidden (`opacity:0`) until `.neighborhood-graph-node:hover`, `nodrag nopan`.

---

## 10. Constants (#9)

`src/view/constants.ts` (UI input bounds — the engine honors any depth; this is an affordance limit):
```ts
export const MIN_STEPPER_DEPTH = 0;   // 0 = central only, no expansion that direction
export const MAX_STEPPER_DEPTH = 5;   // CLARIFICATION Q2
```
`clampStepperDepth(value): number` (pure, colocated with `ControlsModel` or its own tiny module) —
`Math.min(MAX, Math.max(MIN, Math.round(value)))`. Used by every stepper + the settings-tab depth inputs.

---

## 11. Testing / acceptance criteria (#10)

BDD style (`describe("<Unit> <topic>") { it("WHEN ... THEN ...") }`), colocated `.test.ts`,
plain-node env, obsidian faked via ports (never imported). One behavioral focus per `it`.

### 11.1 `settingsWritePlan.test.ts` (PURE — primary contract target)
- WHEN main-depth outgoing value 3 THEN command `{doc-depth-field, field:"outgoingDepth", value:3}`.
- WHEN main-depth incoming reset (undefined) THEN `{doc-depth-field, field:"incomingDepth", value:undefined}`.
- WHEN main-depth value EQUALS global THEN a write command is STILL emitted (pin-on-toggle — no suppression).
- WHEN central-depth THEN `{central-depth-field, centralDocid, field, value}` (incl. reset=undefined).
- WHEN global-depth outgoing value 2 with ctx.globalDepths={1,1} THEN `{global-depths, depths:{outgoingDepth:2, incomingDepth:1}}`.
- WHEN global-cap value 50 THEN `{global-view, view:{...ctx.globalView, nodeCap:50}}`.
- WHEN global-sizing THEN `{global-view, view:{...ctx.globalView, sizing}}`.
- direction→field mapping: outgoing→outgoingDepth, incoming→incomingDepth (guards inversion).

### 11.2 `ControlsModel.test.ts` (PURE — inherited-vs-pinned + selector list)
- MAIN no depths → both directions `{value:global, pinned:false}`.
- MAIN depths.outgoingDepth=3 → outgoing `{3, pinned:true}`, incoming inherited.
- **MAIN depths.outgoingDepth=1 while global=1 → outgoing `{1, pinned:true}`** (presence, not value-diff — critical).
- MAIN depths.outgoingDepth=0 → `{0, pinned:true}` (value 0 honored).
- Pinned X own depths.outgoing=3, MAIN.centralDepths[X] absent → `{value:3, pinned:false}` (own layer, not this control's layer — see Q-A).
- Pinned X: MAIN.centralDepths[X].outgoing=2 over X.own.outgoing=3 → `{value:2, pinned:true}` (centralDepths wins per field).
- Pinned X: neither → `{value:global, pinned:false}`.
- List: MAIN row first (`kind:"main"`), pinned rows follow; unresolved pins skipped; main-as-pin skipped.
- Title = basename of path; `persistable=false` when mainDocId is null.

### 11.3 `nodePinAction.test.ts` (PURE)
- tier "main" → none; "regular" → pin; "pinned-central" → unpin (assert title + iconId too).

### 11.4 Depth clamp (PURE) — in `ControlsModel.test.ts` or `clampStepperDepth.test.ts`
- -1→0, 0→0, 3→3, 5→5, 6→5, 2.4→2 (round).

### 11.5 Engine-level scenario (the step's headline test) — BOTH levels
**(a) Persistence/assembler round-trip** in `GraphRequestAssembler.test.ts` (or a new
`CentralDepthRoundTrip.test.ts`): using real `DocDataMutations`:
- `setCentralDepthField(Ydoc, X, "outgoingDepth", 3)` + `"incomingDepth", 3` → assemble with MAIN=Y →
  `depthOverridesByRoot.get(Xpath)` = `{outgoingDepth:3, incomingDepth:3}`.
- assemble with MAIN=Z (Z has no centralDepths[X]) → X's override = X's OWN depths only.
- assemble with MAIN=Y again (same Ydoc) → X override identical to first (exact restoration).
- Assert **X's own `DocData` is byte-identical throughout** (only Ydoc.centralDepths mutated).

**(b) Engine end-to-end** in `NeighborhoodEngine.test.ts`: `FakeLinkProvider` vault where X reaches
neighbors at hop 1/2/3. Build the three requests (Y-main-X-adjusted-3, Z-main, Y-main-again) and
assert X's visible neighborhood / `depthTags` max depth = 3 in builds 1 & 3, and = X's own depth in
build 2. Proves the BFS actually re-explores X at the adjusted depth end-to-end.

### 11.6 UI glue NOT unit-tested (manual QA only)
React components (`GraphToolbar`, `CentralDepthControls`, `DepthStepper`, `SizingSection`,
`NoteNode` hover/context handlers), `ControlsActions` executor (obsidian file resolution + Notice),
`ObsidianGraphUi.showNodeMenu/showNotice`, `NeighborhoodGraphSettingTab`, `NeighborhoodGraphView`
wiring, `main.ts` registration, CSS. Rationale: repo convention forbids importing obsidian in tests;
these are thin glue over the tested pure layers. Covered by §13 checklist.

---

## 12. Sub-step sequencing (#11 — build + commit incrementally)

**Phase A — pure planners + tests (no wiring; fully green in isolation):**
1. `constants.ts`: `MIN/MAX_STEPPER_DEPTH` + `clampStepperDepth` (+ test).
2. `settingsWritePlan.ts` (+ test §11.1).
3. `nodePinAction.ts` (+ test §11.3).
4. Extract `resolvePinnedDescriptors` (shared); `ControlsModel.ts` + `ControlsModelBuilder` (+ test §11.2).
5. Scenario tests §11.5 (a) + (b) — proves engine/persistence support before any UI exists.

**Phase B — builder + controller + plumbing:**
6. `NeighborhoodGraphBuilder.build` → `GraphBuildResult{graph, controls}`; `GraphSourcePort` + controller
   publish `controls`; add `handleSettingsChanged()`. Update `GraphViewController.test.ts` fake.
7. Add `docid?` to `FlowNodeData` in `flowMapping.ts` (+ update `flowMapping.test.ts`).
8. `ControlsActions` adapter + `ControlsActionsPort`; plumb `pluginDataStore`+`persistenceServices` into
   `NeighborhoodGraphView` ctor + `main.ts` `registerView`; add `view.refresh()`.

**Phase C — in-view UI + CSS:**
9. `ControlsActionsContext` + provide in `NeighborhoodGraphFlow`; render `<Panel top-left>` shell.
10. `GraphToolbar` + `CentralDepthControls` + `DepthStepper` (reset + inherited/pinned) + `SizingSection`.
11. `NoteNode` hover `PinButton` + `onContextMenu`; `ObsidianGraphUi.showNodeMenu` + `showNotice`.
12. `graph-view.css` toolbar/stepper/pin/disclosure/inherited-pinned styles.

**Phase D — settings tab:**
13. `NeighborhoodGraphSettingTab` + `addSettingTab` + `refreshOpenViews()` fan-out.

**Phase E — QA:** run §13 checklist through an Obsidian restart.

Each phase is independently committable; Phase A commits carry the contract tests that de-risk the rest.

---

## 13. Manual QA checklist (#12 — every control round-trips through restart)

1. MAIN outbound stepper +/− → graph re-expands; restart → value persists.
2. MAIN incoming stepper independent of outbound.
3. Reset MAIN depth (unpin field) → falls back to global; row shows "inherited" styling.
4. Inherited-vs-pinned styling distinct at a glance for pinned vs inherited depths.
5. Pin a regular node via hover button → becomes pinned-central (dashed accent), appears in toolbar list; restart → persists.
6. Pin via right-click context menu (same result).
7. Unpin via hover button AND via context menu.
8. Pin a doc that can't get a docid → Notice shown, nothing persisted, no pinned-central added.
9. Scenario: at MAIN Y, adjust pinned X depth to 3 → X re-explores at 3; switch active file to Z, then
   back to Y → view identical to before; open X as its own MAIN → X's own depth unchanged.
10. Sizing section (toolbar): toggle a metric / change weight / min-max → node sizes change globally; restart persists.
11. Settings tab: change node cap → truncation changes in open view (refresh fan-out) ; restart persists.
12. Settings tab: change global depth defaults → new/inherited docs use them; open view refreshes.
13. Toolbar collapse/expand; pinned-centrals + sizing disclosures open/close; at ~300px sidebar width no
    horizontal overflow, toolbar scrolls vertically when tall.
14. Steppers clamp at 0 (min) and 5 (max); no free-text entry.

---

## 14. Out of scope (#13 — reaffirmed V2)

- **Per-view sizing overrides** — the resolver cascade supports them, but the UI writes sizing GLOBAL only.
- **Per-doc node cap** — cap is GLOBAL-only in V1 (CLARIFICATION Q4); resolver cascade unused by UI.
- **User-assignable folder colors** — V2.
- **Node drag reposition** — already out (step-05 decision).

---

## 15. Open questions for the human (#QUESTION_FOR_HUMAN)

Recommended defaults given so implementation is NOT blocked; confirm or redirect.

- **#QUESTION_FOR_HUMAN Q-A (design, main one):** For a pinned central X that ALSO carries its OWN
  depth override (set earlier while X was MAIN), how should the pinned-central stepper at MAIN Y show
  "pinned" and what does its reset clear? **Recommended default:** the stepper's `pinned` badge
  reflects the layer THIS control writes — `Y.centralDepths[X][dir]` — while the displayed value is the
  full resolution (`centralDepths[X] ?? X.own ?? global`); reset clears only `Y.centralDepths[X][dir]`
  (X's own settings untouched, matching the scenario test). Consequence: a central pinned only via its
  OWN depths reads as "inherited" at Y even though its value ≠ global. This is consistent (reset always
  visibly removes exactly this control's contribution) but is a UX judgment call.

- **#QUESTION_FOR_HUMAN Q-B (minor):** Sizing mirror parity — should the in-view sizing disclosure expose
  the FULL set (5 metric toggles + weights, minPx/maxPx, depthDecayK) identically to the settings tab,
  or a reduced subset? **Recommended default:** full parity in a scrollable disclosure (CLARIFICATION Q5
  calls it "an in-view mirror of the settings-tab sizing controls").

- **#QUESTION_FOR_HUMAN Q-C (minor):** Should settings-tab writes immediately refresh already-open graph
  views? **Recommended default:** yes, via `getLeavesOfType(VIEW_TYPE) → view.refresh()` fan-out (no
  bespoke emitter).
