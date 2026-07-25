# EXPLORATION_PUBLIC — controls-panel global settings write does not fan out

Ticket `nid_u36pqr4zljs44jt42lk9ln8ry_e`. Findings gathered read-only; file:line refs are from `main` @ a14972a.

## 1. `ControlsActions` — `src/view/ControlsActions.ts`
- `class ControlsActions implements ControlsActionsPort` (:29). Ctor deps (:30-35): `controller: GraphViewController`, `persistenceServices: PersistenceServices`, `pluginDataStore: PluginDataStore`, `app: App`. One of the few view files allowed to import `obsidian` (uses `Notice`, `app.vault.getFileByPath`).
- API (mirrors `ControlsActionsPort`, `src/view/viewPorts.ts:37-45`): `applySettings(command)` (:37), `pinNode(path)` (:42), `unpinNode(docid)` (:51). All three end with `this.controller.handleSettingsChanged()` — the single-view rebuild.

```ts
async applySettings(command: SettingsCommand): Promise<void> {
    await this.executeSettings(command);
    this.controller.handleSettingsChanged();     // ControlsActions.ts:37-40 — the bug
}
```

- Scope discrimination lives in `private executeSettings(command)` (:56-89), switching on `command.kind`:
  - **PER-DOC**: `"doc-depth-field"` → `persistenceServices.setDocDepthField(mainFile, …)`; `"central-depth-field"` → `setCentralDepthField(mainFile, …)`. Both resolve MAIN via `controller.currentMainPath()` (`private mainFile()` :92); silent no-op when MAIN is null.
  - **GLOBAL**: `"global-depths"` → `pluginDataStore.saveGlobalDepths`; `"global-view"` → `saveGlobalView`; `"node-exclusion"` → `saveNodeExclusion`.
  - So the scope predicate is just the command kind: 3 global kinds vs 2 per-doc kinds. **Precedent for the same partition**: `VicinityGraphSettingTab.persist()` (`src/view/VicinityGraphSettingTab.ts:545-560`) handles the 3 global kinds and `return`s for the 2 per-doc kinds.
- `pinNode`/`unpinNode` write the GLOBAL pinned set (`data.json` via `PluginDataStore`) — arguably also fan-out-worthy; the ticket's acceptance criteria names only settings writes. **Decide explicitly.**
- Command model: `src/view/settingsWritePlan.ts` — `SettingsInteraction` (:26-49), `SettingsCommand` (:52-65), `SettingsWriteContext` (:68-72), pure `planSettingsWrite(interaction, ctx)` (:74). Every `global-*` interaction maps to one of the 3 global commands; `main-depth`/`central-depth` map to the 2 per-doc commands.

## 2. Controls-panel sections that write settings
All rendered by `GraphToolbar` (`src/view/GraphToolbar.tsx:26-57`), which builds ONE `SettingsWriteContext` from the snapshot's `ControlsModel`:

```ts
const ctx = { globalDepths: controls.globalDepths, globalView: controls.globalView, nodeExclusion: controls.nodeExclusion }; // :30-34
<NodeExclusionSection ctx={ctx} excludedNodeCount={controls.excludedNodeCount} />   // :53
<SizingSection view={controls.globalView} ctx={ctx} />                              // :54
<NodeContentsSection view={controls.globalView} ctx={ctx} />                        // :56
<ForceLayoutSection view={controls.globalView} ctx={ctx} />                         // :57
```

- Snapshot flow: `VicinityGraphFlow.tsx:40` `useSyncExternalStore(controller.subscribe, controller.getSnapshot)`; `:112` `<GraphToolbar controls={snapshot.controls} />`. `VicinityGraphFlow` provides `ControlsActionsContext` from its `actions` prop.
- Each section calls `useControlsActions()` then `actions.applySettings(planSettingsWrite(...))`:
  - `SizingSection.tsx:28-37` (`global-sizing`), controlled off `view.sizing`.
  - `ForceLayoutSection.tsx:34-45` (`global-force-layout`), sliders read `view.forceLayout[field]`.
  - `NodeContentsSection.tsx:33-43` (`global-node-preview`); radiogroup `checked` derived from `view.nodePreviewPreference`, `useId()` for per-mount group name (comment :34-39 already anticipates two graph views) — **this is why the second view visibly shows the wrong segment**.
  - `NodeExclusionSection.tsx:29-36` (`global-node-exclusion`).
  - Depth steppers (`DepthStepper.tsx` / `CentralDepthControls.tsx`) emit the PER-DOC `main-depth`/`central-depth` interactions.
- Inputs are 100% controlled off `snapshot.controls` ⇒ a stale second view is stale **UI**, not just a stale graph.

## 3. `GraphViewController.handleSettingsChanged()` — `src/view/GraphViewController.ts:160-163`
```ts
handleSettingsChanged(): void { this.clearDebounce(); void this.runRebuild(); }
```
`runRebuild()` → `graphBuilder.build(mainPath)` → `GraphBuildResult { graph, controls }` (`viewPorts.ts:21-24`) → structural diff → elk/d3 layout → `setSnapshot()` (:375-381) notifying `useSyncExternalStore`. Latest-wins via `rebuildToken`. `currentMainPath()` :166. Controller holds ONLY `NoteNavigatorPort`, `GraphSourcePort`, `GraphLayoutPort`, `EdgeRouter` (ctor :111-116) — **no plugin/app/workspace reference, deliberately** (`viewPorts.ts` header: "ZERO obsidian / elkjs / builder runtime coupling").

## 4. `refreshOpenViews()` — `src/main.ts:95-102`
```ts
refreshOpenViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_VICINITY_GRAPH)) {
        const { view } = leaf;
        if (view instanceof VicinityGraphView) { view.refresh(); }
    }
}
```
- Doc comment: "Obsidian-idiomatic fan-out … No bespoke event emitter" (step-06 Q-C).
- `VicinityGraphView.refresh()` (`src/view/VicinityGraphView.tsx:84-86`) = `this.controller?.handleSettingsChanged()`.
- Callers today: `VicinityGraphSettingTab.ts:512` (`applyInteraction`), `:526` (`applyReset`); e2e `e2e/obsidianHarness.ts:330`, `e2e/settingsUxVisual.e2e.ts:79`.
- **Plugin seam availability**: the view does NOT hold a plugin reference. `main.ts:66-69` registers `(leaf) => new VicinityGraphView(leaf, this.graphBuilder, this.pluginDataStore, this.persistenceServices)`; view ctor `VicinityGraphView.tsx:32-38` takes exactly those. `ControlsActions` is constructed in `VicinityGraphView.onOpen()` (`:64`) with `(controller, persistenceServices, pluginDataStore, app)` — so `app` (hence `app.workspace`) IS reachable, but no plugin instance and no refresh callback exists below `main.ts`. The settings tab, by contrast, holds `this.plugin`.

## 5. Existing tests
- **There is no `ControlsActions.test.ts`** — `ControlsActions` is currently untested. It imports the `obsidian` runtime; `vitest.config.ts` has no obsidian alias/mock and `src/**/__mocks__` does not exist ⇒ a new test needs `vi.mock("obsidian", …)` for `Notice`, **or** the fan-out seam must be injectable so tests avoid `Notice` paths.
- Nearest style/fakes:
  - `src/view/GraphViewController.test.ts` — BDD `WHEN … THEN …`, in-file structural fakes (`FakeGraphSource` :52+, fake layout/navigator/edge-router), deferred-promise concurrency control, `EMPTY_CONTROLS` literal (:15-22) from `EngineDefaults`.
  - Pure planner tests: `src/view/settingsWritePlan.test.ts`, `settingsResetPlan.test.ts`, `nodePinAction.test.ts`.
  - Reusable fakes: `src/persistence/FakePluginDataPort.ts`, `FakeFileStorage.ts`, `src/adapters/FakeObsidianPorts.ts`, `FakeDocIdPort.ts`, `src/engine/FakeLinkProvider.ts`. Fixtures: `src/view/testFixtures/graphFixtures.ts`.
  - CLAUDE.md: "Each port has a `Fake*` for tests"; colocated `*.test.ts`, BDD, one behavior per test, prefer starting from a failing test.

## 6. Existing "refresh all views" abstraction
- **None.** `grep -rn "RefreshPort|refreshAll|ViewRefresh|refreshViews"` over `src` and `e2e` = zero hits. The only fan-out is the concrete `VicinityGraphPlugin.refreshOpenViews()`.
- Layering (CLAUDE.md:16-21, `docs-internal/architecture-map.md:7-33`): `view → adapters → engine(pure)`; engine/shared may not import obsidian/react (guarded by `src/engine/importGuard.test.ts`); `GraphViewController.ts` is "the only view class touching Obsidian + the async engine"; `VicinityGraphView.tsx` "stays a thin lifecycle shell"; `src/main.ts` wires the object graph. "Extend via new interface implementations (OCP), not by editing existing seams." View-layer ports live in `src/view/viewPorts.ts` (types-only) with a `Fake*` per port. Precedent for a small obsidian-facing view adapter parameterised by view type: `ObsidianGraphUi(this.app, VIEW_TYPE_VICINITY_GRAPH)` (`VicinityGraphView.tsx:60`).

## 7. Related tickets
- `_tickets/a-controls-panel-settings-write-does-not-refresh-other-open-graph-views.md` — THIS bug.
- `docs-internal/tickets/ticket-controls-optimistic-input-latency.md` — same files; in-view sections build writes from the one-rebuild-behind snapshot while the settings tab reads globals fresh. A fan-out fix must not conflict with the eventual optimistic-local-value fix.
- `docs-internal/tickets/ticket-e2e-view-type-constant-dedup.md` — relevant if a new module needs `VIEW_TYPE_VICINITY_GRAPH`.
- `_tickets/vicinity-rename-view-type-string-changed-reopen-stale-panes-in-existing-dev-vaults.md` — same view-type constant.

## 8. Settings scope model (`docs-internal/plan/high-level-plan.md`)
- :66-68 — "Settings split into two classes: **Traversal settings (depth)**: per-root … **View settings (sizing, grouping, cap)**: one per view … global underneath."
- :64 "Sizing is global-only in V1"; :44 node exclusion is "a global (not per-doc) list"; :70 pin-on-toggle writes a per-doc entry per field.
- :77 per-doc = one file per docid under `.obsidian/plugins/<id>/doc-data/`; globals + pinned set = `data.json` (`PluginDataStore`).

## Seam options
1. **Port injected down from `main.ts`** (best fit for layering + OCP): add e.g. `interface ViewsRefreshPort { refreshAllViews(): void }` to `src/view/viewPorts.ts`, implement in `main.ts` (delegating to existing `refreshOpenViews()`), thread `registerView` → `VicinityGraphView` ctor → `new ControlsActions(...)`. `applySettings` calls the port for global kinds, `controller.handleSettingsChanged()` for per-doc kinds. Touches `main.ts:66-69` + view ctor; trivially fakeable ("records which views were refreshed").
2. **Reuse `this.app` inside `ControlsActions`**: iterate `app.workspace.getLeavesOfType(...)` and call `view.refresh()` — no wiring changes, but duplicates main.ts fan-out, couples `ControlsActions` → `VicinityGraphView` (cycle risk: the view already imports `ControlsActions`), harder to unit-test.
3. **Pure scope classifier + thin executor**: small pure helper (e.g. `isGlobalScope(command)` next to `settingsWritePlan.ts`, unit-tested in isolation); `ControlsActions` branches on it. Pairs with (1), keeps the decision out of the obsidian executor, matching the existing planner/executor split.
4. **`pinNode`/`unpinNode`** also write global state — a deliberate decision to record.
5. Once the port exists, `VicinityGraphView.refresh()` and the settings tab's `plugin.refreshOpenViews()` keep working unchanged.
