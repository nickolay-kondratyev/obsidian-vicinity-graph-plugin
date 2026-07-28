# Architecture Map

Code-oriented companion to [`plan/high-level-plan.md`](./plan/high-level-plan.md)
(the design source of truth). This file maps **directories → responsibility**
and states the layering rules the build/tests enforce.

## Layering (strict, inward-pointing dependencies)

```
view  ──▶  adapters  ──▶  engine  (pure core)
  │            │             ▲
  └── persistence ───────────┘   (engine defines port types; adapters/persistence implement)
```

- **`src/engine/`** — the pure vicinity-graph core. Synchronous, side-effect
  free. **MUST NOT import `obsidian`, `obsidian-id-lib`, `react`, or
  `react-dom`.** Obsidian reaches it only through the `LinkProvider` seam.
  Enforced by `src/engine/importGuard.test.ts` (the repo has no ESLint yet).
  `src/shared/` is guarded by the same rule. Public API is re-exported from
  `src/engine/index.ts` — import from there, not deep paths.
- **`src/adapters/`** — bridges Obsidian ↔ engine. `ObsidianLinkProvider`
  (resolvedLinks + backlinks), canvas capability detection + fallback parser,
  `VicinityGraphBuilder` (per-rebuild orchestration), docid ↔ path translation.
- **`src/persistence/`** — JSON storage. Globals + pinned set in `data.json`
  (`PluginDataStore`); per-doc settings as one file per doc at
  `.obsidian/plugins/<id>/doc-data/<docid>.json` (`DocDataStore`). Delayed,
  chunked `OrphanSweeper`. Every persisted shape carries a `version` field.
- **`src/view/`** — React 18 mounted in an Obsidian `ItemView`. Rendering,
  toolbar controls, layout. `GraphViewController.ts` owns the rebuild pipeline
  `events → engine → structural diff → layout → React Flow` and is the **only**
  view class that touches Obsidian + the async engine (latest-wins via a
  monotonic rebuild token); `VicinityGraphView.tsx` stays a thin lifecycle shell.
  `GraphViewOpener.ts` owns WHERE the single graph view lives (right sidebar vs a
  main-area split-down) and moves it between the two.
- **`src/main.ts`** — plugin entry: wires the object graph in `onload`,
  registers the view/commands/vault-lifecycle handlers, schedules the sweep.

## Key seams (interfaces — extend by adding implementations, not editing)

- `engine/LinkProvider.ts` — the sole Obsidian→engine boundary; canvas
  detection lives here. It reports **facts, not decisions**: e.g.
  `FileMetadata.imagePrecedesOutline` says where the note's first image sits
  relative to its first heading, and `view/nodePreviewChoice.ts` alone owns the
  resulting outline-vs-image precedence (one pure function, honouring the global
  `nodePreviewPreference`).
- `view/viewPorts.ts` — `GraphSourcePort`, `GraphLayoutPort`, `NoteNavigatorPort`
  (opens a note, optionally at a `heading` — the RAW heading text; the adapter
  sanitises it into a link subpath), and `NoteOpenPort`, the one-method slice
  node components reach through `NoteOpenContext` (React Flow instantiates them,
  so context is the only channel). `NodeOutline.tsx` owns in-node outline
  rendering — the tree/label/markup decisions and `node-outline.css`.
  Refresh reach is two ports: `OwningViewPort` rebuilds just the view that owns
  the controls panel, `ViewsRefreshPort` (implemented in `main.ts` over
  `refreshOpenViews()`) rebuilds every open view — which one a settings write
  uses is the pure `view/settingsWriteScope.ts` decision.
- `persistence/storagePorts.ts`, `adapters/obsidianPorts.ts` — testable seams,
  each with a `Fake*` implementation used by unit tests.

## Layout stack (`src/view/`)

- **elkjs** (`ElkLayoutRunner`, `elkMapping.ts`) — hierarchical/compound layout
  so folder groups nest correctly. The root runs elk's `force` algorithm as a
  seed; folder-group members are packed with elk `rectpacking` internally
  (density, not edge flow — intra-group edges are re-routed by `edgeRouting.ts`).
- **d3-force** (`d3ForceRefinement.ts`) — force-mode refinement.
- **libavoid-js** (`edgeRouting.ts`, `libavoidLoader.ts`) — orthogonal edge
  routing (WASM; see build note below).
- Structural diff (`GraphStructureDiff.ts`) skips relayout when structure is
  unchanged; a node growing past `SIZE_RELAYOUT_THRESHOLD` forces a full relayout.

## Build note: libavoid WASM

`libavoid-js` ships a sidecar `dist/libavoid.wasm` that Obsidian's bundle can't
fetch at runtime, so `esbuild.config.mjs` maps a virtual `libavoid-wasm` import
to the on-disk wasm and inlines it as **base64** (`loader['.wasm'] = 'base64'`).
`obsidian-id-lib` is **bundled** (not external); only `obsidian` is a types-only
external. See `src/types/libavoidWasm.d.ts`.
