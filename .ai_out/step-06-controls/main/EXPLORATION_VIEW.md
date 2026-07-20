# Exploration: UI/View/Plugin-Wiring Layer for step-06-controls

## 1. Plugin entry point (`src/main.ts`)
- `NeighborhoodGraphPlugin extends Plugin` (`main.ts:24`). Public fields `persistenceServices`, `graphBuilder`, `pluginDataStore` — commented as step-06 entry points (`main.ts:25-30`).
- `onload()` (`:39-85`): builds docIdService, `pluginDataStore` (`await init()`), docDataStore, persistenceServices, graphBuilder; `registerView(VIEW_TYPE, (leaf) => new NeighborhoodGraphView(leaf, this.graphBuilder))` (`:63-66`); registers hover-link source + two commands.
- **No `PluginSettingTab` anywhere in `src/`** (grep: zero hits). Must be added from scratch, registered via `this.addSettingTab(...)`.
- Global settings load/save already works via `PluginDataStore` (`saveData`/`loadData`); settings tab just calls `pluginDataStore.saveGlobalDepths()`/`saveGlobalView()`.

## 2. View shell
- **`NeighborhoodGraphView.tsx`** — thin `ItemView`. `onOpen()` builds `ObsidianNoteNavigator`, `GraphViewController(navigator, graphBuilder, ElkLayoutRunner)`, `ObsidianGraphUi(app, VIEW_TYPE)`; mounts React root over `contentEl` rendering `<NeighborhoodGraphFlow controller ui />` in `<StrictMode>`. Wires `active-leaf-change`/`file-open`→`handleActiveFileChanged`, metadataCache `resolved`→`handleMetadataResolved`.
  - Comment (`:68-73`): "V1 persists NOTHING view-specific... no view-settings UI until step-06". `getState`/`setState` pass-throughs.
  - **Today `NeighborhoodGraphView` receives only `graphBuilder`, NOT `pluginDataStore`/`persistenceServices`** — constructor must grow; `main.ts` registerView callback updated to pass them.
- **`GraphViewController.ts`** — only class touching Obsidian + async engine; React external store (`subscribe`/`getSnapshot`).
  - State: `snapshot`, `previousGraph`, `positions`, `groupDimensions`, `mainPath: string|null` (only active file), `rebuildToken`, `debounceTimer`.
  - **No concept of pinned centrals as UI list, no depth/sizing/cap state, NO settings-change entry point.** A settings change today would NOT trigger rebuild — no `handleSettingsChanged()`. Step-06 must add one (force `runRebuild()`, bypass `decideActiveFileRebuild` gate). `graphBuilder.build(mainPath)` re-reads stores fresh every call.
  - `runRebuild()`: `graphBuilder.build(mainPath)` → structural diff (`decideLayout`) → `neighborhoodGraphToFlow` → elk (only if structure changed) → `publish()`. Latest-wins via `rebuildToken`.
  - `openNode(path, options)` — only user-interaction entry point today.
- **`NeighborhoodGraphFlow.tsx`** — `ReactFlow` render via `useSyncExternalStore`. `NODE_TYPES={note, folder-group}`, `EDGE_TYPES={neighborhood}`. Has `<Panel position="top-right">` for "+N hidden" badge (`:101-110`) — **the `@xyflow/react` `<Panel>` is the natural mechanism for the new toolbar** (e.g. `top-left`/`top-center`). `<Controls/>` also rendered. `nodesDraggable={false}`, `nodesConnectable={false}`, `multiSelectionKeyCode={null}`. `GraphUiContext.Provider value={ui}` wraps flow.
- **`GraphUiContext.ts`** — `createContext<GraphUiPort|null>`; `useGraphUi()` throws outside provider. Pattern for node components to reach Obsidian services.
- **`ObsidianGraphUi.ts`** — implements `GraphUiPort` (`resourcePath`, `showHoverPreview`, `showAttachmentMenu`, `renderIcon`) via Obsidian `Menu`+`setIcon`. **Natural place for pin/unpin menu methods + `showNotice(...)` wrapper (Obsidian `Notice`) for "can't be pinned" notice.**

## 3. Existing toolbar/menu/button patterns to reuse
- **`attachmentMenu.ts`** (+`.test.ts`) — pure planner `planAttachmentMenu(paths)→{visiblePaths, overflowText}`, consumed by `ObsidianGraphUi.showAttachmentMenu` building native `Menu` (`.addItem(...).showAtMouseEvent(event)`). **Reference pattern for node context menu with pin/unpin**: keep menu-plan pure/testable, build `Menu` only in adapter.
- **`NoteNode.tsx`** — `AttachmentChip` (`:62-91`): `<button className="... nodrag nopan" onClick>` calls `stopPropagation()`, reaches Obsidian via `useGraphUi()`. **`nodrag nopan` required on ANY interactive element inside a node** (RF drag/pan escape-hatch). Template for pin/unpin hover button.
- Node styling `data-tier="main"|"pinned-central"|"regular"` (set in `flowMapping.ts:tierOf`) already distinguishes MAIN/pinned/regular via CSS (solid vs dashed border) — basis for "offer pin vs unpin" logic; no new pinned-state plumbing needed for menu decisions.

## 4. MAIN selection & rebuild-on-settings-change
- MAIN = active file only: `handleActiveFileChanged(activePath)`→`decideActiveFileRebuild` (`RebuildDecision.ts`)→sets `mainPath`→`runRebuild()`. No user "switch MAIN" affordance (stays file-follow-driven per exit criteria).
- Settings (depth/sizing/cap/pins) NOT controller state — live in `PluginDataStore` (globals+pins) + per-doc `DocDataStore` files, read fresh every `graphBuilder.build(mainPath)`. **Any control that persists a setting just needs to trigger a rebuild after** — no new data plumbing into controller. Step-06 adds an immediate (non-debounced) rebuild trigger after each settings write.
- `handleMetadataResolved` debounces via `REBUILD_DEBOUNCE_MS` (`constants.ts`) — reusable if numeric-input dragging needs debounce.

## 5. CSS conventions & TSX patterns
- **`graph-view.css`** is authored source; **`styles.css`** (repo root) is GENERATED (xyflow base + graph-view.css via `esbuild.config.mjs`) — **never edit `styles.css`**.
- Theming rule (`graph-view.css:629-637`): **every color must come from an Obsidian theme CSS var** (`--background-*`, `--text-*`, `--interactive-accent`, `--radius-*`, `--shadow-*`, `--size-4-*`, `--font-ui-*`) — plugin ships zero colors. New toolbar CSS must follow.
- Class naming BEM-ish: `neighborhood-graph-<component>__<part>`. Tier styling via `data-*` attrs.
- RF chrome retargeted via `--xy-*` custom props on `.neighborhood-graph-flow` (`:642-658`).
- TSX: functional components, `memo(...)` for node components, narrow typed props, ports/interfaces (`viewPorts.ts`) for DIP, `.test.ts` colocated next to nearly every pure module. New "what field gets written where" logic → colocated vitest, mirroring `DocDataMutations`.

## 6. Settings→engine wiring (already built, steps 02-03)
- `PluginDataStore`: `globalDepths()`, `globalView()`, `saveGlobalDepths(DepthSettings)`, `saveGlobalView(ViewSettings)`, `pins()`, `hasPin(docid)`, `addPin(docid,ts)`, `removePins(docids)`.
- `PersistenceServices` (doc-scoped facade): `pinDoc(file)→PersistableIdentity`, `unpinDoc(docid)`, `setDocDepthField(file,field,value|undefined)`, `setDocViewField(file,field,value|undefined)`, `setCentralDepthField(mainFile,centralDocid,field,value|undefined)`. All call `ensureDocId` internally; callers branch on `kind==="not-persistable"` for notice.
- `NeighborhoodGraphBuilder`→`GraphRequestAssembler`: pure translation persisted→`GraphBuildRequest` every `build`. No settings caching.
- Types the toolbar binds to: `DepthSettings{outgoingDepth,incomingDepth}`, `DepthOverride`, `ViewSettings{nodeCap,groupByFolder,edgeVisibility,sizing}`, `SizingSettings{metrics:Record<SizeMetricId,{enabled,weight}>,depthDecayK,minPx,maxPx}` (all in `types.ts`).

## Integration gaps step-06 must close
1. `NeighborhoodGraphView` ctor / `main.ts` registerView callback must pass `pluginDataStore`+`persistenceServices` (only `graphBuilder` today).
2. `GraphViewController` needs a "settings changed → rebuild now" entry point (none today).
3. No `PluginSettingTab` — create from scratch, register in `onload()`, read/write via `PluginDataStore`.
4. No in-view toolbar/`Panel` UI — `NeighborhoodGraphFlow`'s existing `<Panel>` is the template.
5. No pin/unpin UI on nodes — `AttachmentChip` hover-button + `ObsidianGraphUi.showAttachmentMenu` native-`Menu` are templates; `PersistenceServices.pinDoc`/`unpinDoc` ready.
6. `FlowNodeData` carries `path` but not `docid` — resolve file from `path` via `app.vault.getFileByPath` in adapter layer; `tier` already tells UI whether to offer pin vs unpin.
