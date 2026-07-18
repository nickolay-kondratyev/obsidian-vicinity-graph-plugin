# EXPLORATION: Step 04 — View/Plugin Plumbing

## 1. `src/main.ts` — Plugin structure & lifecycle
- `NeighborhoodGraphPlugin extends Plugin` (main.ts:24).
- Public fields wired for the view (main.ts:25-37):
  - `persistenceServices: PersistenceServices` — pin / per-doc settings writes.
  - `graphBuilder: NeighborhoodGraphBuilder` — per-rebuild orchestration; **view calls `graphBuilder.build(path)`**.
  - `pluginDataStore: PluginDataStore` — global settings + pins (data.json).
  - Private: `docIdService`, `docDataStore`, `pathDocIdMap`, `canvasParseCache`, `sweepTimer`.
- `onload()` (main.ts:39-75): builds services, registers vault handlers, schedules sweep.
  - **View registration** (main.ts:63): `this.registerView(VIEW_TYPE_NEIGHBORHOOD_GRAPH, (leaf) => new NeighborhoodGraphView(leaf));`
  - Commands (main.ts:65-74): `open-neighborhood-graph` → `activateView()`; `debug-log-neighborhood-graph`.
- `onunload()` (main.ts:77-81): clears `sweepTimer` only. Does NOT detach view leaves (implementer may add `workspace.detachLeavesOfType`).
- `activateView()` (main.ts:213-222) — reuse/extend this leaf pattern:
  ```ts
  const leaf = workspace.getLeavesOfType(VIEW_TYPE_NEIGHBORHOOD_GRAPH)[0] ?? workspace.getRightLeaf(false);
  if (leaf === null) return;
  await leaf.setViewState({ type: VIEW_TYPE_NEIGHBORHOOD_GRAPH, active: true });
  await workspace.revealLeaf(leaf);
  ```
  Right-sidebar default already matches spec.
- `logNeighborhoodGraph()` (main.ts:141-173): exact `graphBuilder.build(activeFile.path)` usage the view mirrors. Returns `NeighborhoodGraph | null`; iterates `graph.nodes`/`graph.edges`/`graph.hiddenNodeCountsByFolder`. Uses `app.workspace.getActiveFile()`.
- Event idiom: `this.registerEvent(this.app.vault.on(...))` (main.ts:92-98). For metadata-resolve debounce, view likely uses `metadataCache.on("resolved")` / `workspace.on("active-leaf-change")` / `workspace.on("file-open")`. `window.setTimeout`/`clearTimeout` used for sweep timer.

## 2. View scaffolding
`src/view/NeighborhoodGraphView.tsx`:
- `export const VIEW_TYPE_NEIGHBORHOOD_GRAPH = "neighborhood-graph-view";` (line 6).
- `class NeighborhoodGraphView extends ItemView` (line 9), `private root: Root | null`.
- `getViewType()`→const; `getDisplayText()`→"Neighborhood graph"; `getIcon()`→"network".
- `onOpen()`: `this.root = createRoot(this.contentEl); this.root.render(<StrictMode><HelloGraph/></StrictMode>)`.
- `onClose()`: `this.root?.unmount(); this.root = null`.
- **No `getState`/`setState` yet** — step-04 adds first. Constructor default `(leaf)`. **View has no ref to plugin/graphBuilder** — implementer must pass `graphBuilder`/plugin via registerView closure.

`src/view/HelloGraph.tsx`: trivial placeholder, "Replaced by the real graph view later."

## 3. Build/config
- **tsconfig.json**: `"jsx": "react-jsx"` (automatic runtime; no React import needed), target ES2021, strict, `noUncheckedIndexedAccess: true`, lib `["ES2021","DOM"]`, includes `src/**/*.tsx`, `allowSyntheticDefaultImports`, `resolveJsonModule`.
- **esbuild.config.mjs**: entry `src/main.ts`, bundle, cjs, outfile `main.js`, target es2021. Externals: `obsidian`, `electron`, `@codemirror/*`, `@lezer/*`, builtins. **React/react-dom are bundled (NOT external). New deps (react-flow, elkjs) also bundled unless externalized.** `copyToDevVaultPlugin` copies `main.js/manifest.json/styles.css` into `.dev-vault/.obsidian/plugins/<id>/` after build. `dev`=watch; `build`=`tsc -noEmit` then minified.
- **manifest.json**: id `obsidian-neighborhood-graph`, minAppVersion 1.12.4, `isDesktopOnly: false`.
- **styles.css**: only `.neighborhood-graph-hello`. React Flow needs its own base CSS — currently absent; esbuild bundles JS only (CSS import needs loader or manual copy into styles.css).

## 4. React Flow / elkjs — **NEITHER INSTALLED**
- `node_modules/@xyflow`, `reactflow`, `elkjs` all absent; no package-lock entries; no src imports.
- Present: `react@18.3.1`, `react-dom@18.3.1`, `@types/react`, `@types/react-dom`.
- Implementer must `npm install @xyflow/react elkjs` (elkjs ships own types). `package.json` is `"type":"module"`, `"private":true`.

## 5. Workspace/leaf/getState/setState patterns
- Only `activateView()` uses leaf pattern (above). `app.workspace.getActiveFile()` (main.ts:142).
- **No `getState`/`setState` overrides exist** — step-04 is first. V1 state likely = view-settings snapshot, NOT scroll/zoom.

## 6. `.dev-vault` + `scripts/`
`scripts/setup-dev-vault.sh` (`npm run setup:dev-vault`): derives PLUGIN_ID from manifest; idempotently writes fixtures note1.md (central, links note2/note3, embeds pic.png), note2.md (backlink), note3.md (leaf), test.canvas, pic.png; writes `.obsidian/*.json` (auto-enables plugin); runs `npm run build`; prints smoke instructions. Vault is gitignored. This is the manual-test harness (open/close, sidebar↔main drag, restore, two views).

## 7. Engine output shape (view must map)
`graphBuilder.build(mainPath)` → `Promise<NeighborhoodGraph | null>` (null = path unresolved).
- `NeighborhoodGraph` (types.ts:174-179): `nodes: readonly GraphNode[]`, `edges: readonly GraphEdge[]`, `hiddenNodeCountsByFolder: ReadonlyMap<FolderPath, number>`.
- `GraphNode` (types.ts:73-96): `path` (id/vault path), `docid?`, `title` (basename), `folder`, `sizeBytes`, `isCentral`, `isMain`, `depthTags`, `minDepth`, `attachments`, `firstImagePath?`, `sizeScore`, **`sizePx`** ("the stable field step-04 diffs against" — size-growth relayout trigger input).
- `GraphEdge` (types.ts:102-105): `{ source: VaultPath; target: VaultPath }`, deduped, directed.
- View should go through `graphBuilder.build()` (assembles pins/global settings/doc-data). Engine pure/synchronous, never imports obsidian/React (importGuard.test.ts). Branded types VaultPath/DocId/FolderPath with `asVaultPath`/`asFolderPath`/`asDocId`.

## 8. Persistence API (mostly step 06)
`PersistenceServices` (PersistenceServices.ts:19+): `pinDoc`, `unpinDoc`, `setDocDepthField`, `setDocViewField<K>`, `setCentralDepthField`. Available on `plugin.persistenceServices`.

## Gaps implementer must close
1. Install `@xyflow/react` + `elkjs`.
2. Decide externals (keep react-flow/elkjs bundled — no runtime provides them).
3. Add React Flow base CSS (styles.css / import).
4. Pass `graphBuilder`/plugin into `NeighborhoodGraphView` via registerView closure.
5. Implement `getState`/`setState`.
6. Wire rebuild triggers (active-leaf-change / file-open / metadataCache "resolved" debounced ~500ms).
7. Extract pure logic (structural diff w/ SIZE_RELAYOUT_THRESHOLD, engine→RF/elk mapping) into vitest modules; keep `.tsx` thin.
