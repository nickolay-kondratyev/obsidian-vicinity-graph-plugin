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
  (resolvedLinks + backlinks), the canvas parser (run for EVERY canvas),
  `VicinityGraphBuilder` (per-rebuild orchestration), docid ↔ path translation.
- **`src/persistence/`** — JSON storage, TWO-TIER (ticket
  `nid_8f8ey41extajt08zphwwxhnwq_e`). `data.json` (`PluginDataStore`) holds the
  truly-global CONFIG: the settings dials + ONE docid-keyed map, the global pinned
  set (a pin is config, not vault content — Obsidian manages what is pinned). The
  per-doc / per-main FACTS moved OFF `data.json` onto the per-file `VaultFileStore`,
  owned by `PerDocStore` (`PerDocStore.ts`): `per_file/<docid>.json`, one file per
  doc, each an optional SUBJECT override (`nodeOverrides`: `sizePx` / `content`) +
  its MAIN-context `localPins`, syncing as vault content. **Nothing is
  per-document as a SETTING** — an override is a global fact about a doc, like a
  pin. `PerDocStore` is the in-memory-authoritative, warm-once mirror of that
  directory (the per-file analogue of `PluginDataStore`), with a `target → mains`
  reverse index for cheap target-side delete pruning; a `localControls` section is
  reserved for a future per-main dials layer (ticket
  `nid_rnghlzs0uejjlbd5a4bjkq7eg_e`). `DocIdMapWarmer` is THE path↔docid scanner
  (one instance, wired in `main.ts`): the read path warms exactly the docids a
  build needs — the pinned set's (from `PluginDataStore`) UNIONED with the per-file
  store's (`PerDocStore.keyedDocids()`) — so pins, overrides and local pins render
  on the FIRST build after a restart. The delayed, chunked `OrphanSweeper` reuses
  the same walk to prune entries in EVERY docid-keyed map whose doc no longer
  resolves, through TWO `forgetDocs` calls side by side — `PluginDataStore` (pins)
  and `PerDocStore` (overrides + localPins, both MAIN-key and target positions) —
  the ONE conceptual choke point spanning both tiers, which the live
  `vault.on('delete')` handler also uses. Every persisted shape carries a
  `version` field.
  `VaultFileStore` (`VaultFileStore.ts`) is that SECOND, domain-agnostic store — a
  `<relPath> ↔ parsed payload` tree of versioned JSON files under the VAULT ROOT
  (`.plugin_data/vicinity_graph/`, NOT `.obsidian/`), so it syncs as vault
  content. It sits on `VaultFsPort` (`vaultFsPort.ts`; real `VaultAdapterFsPort`
  wraps `vault.adapter`, `FakeVaultFsPort` for tests) the way `PluginDataStore`
  sits on `PluginDataPort`. Every file is a `{ "v1": <payload> }` envelope
  (dispatch on WHICH `vN` key, so a future non-additive shape is TOLD APART, not
  guessed); writes are atomic (`.tmp` sibling → rename over target) and
  keys-sorted (diff-stable for hand merges); per-relPath write serialisation
  (`Map<relPath, SerialPromiseChain>`) so same-key writes never interleave while
  different keys write in parallel. An unreadable file (conflict markers,
  truncation, unknown version key) is QUARANTINED — renamed to
  `<base>_malformed_<ts><ext>` (injected `clock` → `quarantineTimestamp.ts`,
  collision-safe `_2`…), the user is told ONCE via `UserNoticePort`, and the
  entry reads as ABSENT. Never deletes the user's bytes. `PerDocStore` is its ONE
  domain consumer today (the per-doc facts above); the primitive stays
  domain-agnostic so a future consumer is a new caller, not an edit here.
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
  relative to its first heading, and `engine/nodePreviewKind.ts` alone owns the
  resulting outline-vs-image precedence (one pure function, honouring the global
  `nodePreviewPreference`).
- `view/viewPorts.ts` — `GraphSourcePort`, `GraphLayoutPort`, `NoteNavigatorPort`
  (opens a note, optionally at a `heading` — the RAW heading text; the adapter
  sanitises it into a link subpath), and `NoteOpenPort`, the one-method slice
  node components reach through `NoteOpenContext` (React Flow instantiates them,
  so context is the only channel). `NodeOutline.tsx` owns in-node outline
  rendering — the tree/label/markup decisions and `node-outline.css`.
  `LinkPreviewPort` is the link-preview seam (parent ticket
  `nid_tohotgq2s92dvd1iov1rd0umv_e`): an edge click reaches
  `GraphViewController.openEdgePreview` (the async
  `LinkOccurrenceProvider` queries stay in the controller), which builds a pure
  `linkPreviewModel.ts` model and hands it to the port; `LinkPreviewOverlayStore`
  implements it as an external store `VicinityGraphFlow` renders as the in-graph
  slide-out `LinkPreviewDrawer` (ticket `nid_5j9mygfywppaiakuim3utf6r2_e` —
  which pane edge it slides from is a CSS container query on the pane's aspect
  ratio; pane click / Esc / close / GO dismiss it). The occurrence data comes from
  `engine/LinkOccurrenceProvider.ts` (engine-defined port), implemented per
  query by `adapters/LiveLinkOccurrenceProvider.ts` over a fresh
  `ObsidianLinkProvider` snapshot; `FakeLinkOccurrenceProvider` is its test
  double.
  Refresh reach is ONE port: `ViewsRefreshPort` (implemented in `main.ts` over
  `refreshOpenViews()`) rebuilds every open view. `UserNoticePort` is the same
  shape for the one user-visible message surface (`Notice`, also implemented in
  `main.ts`) — its producers are the pipeline's `write()` failure policy and
  `ControlsActions`' pin refusal, and `main.ts` is the ONLY file constructing
  `Notice`; `FakeViewsRefresh` / `FakeUserNotices` are their test doubles. Every settings write is global,
  so there is no narrower reach to choose — the write-scope classifier and the
  owning-view port went with the per-doc layer.
- `view/settingsWritePipeline.ts` — **THE settings write path**, one instance per
  plugin (`main.ts`), shared by the settings tab and every controls panel. It owns
  serialisation (`shared/SerialPromiseChain.ts`), the merge base (globals read
  FRESH inside the serialised slot), the persist switch, and the
  `ViewsRefreshPort` fan-out. Surfaces send a `SettingsInteraction` naming ONE
  field — never a ready-made command, never a whole slice — because a merge base
  captured before the write reverts whatever sibling field moved in between.
  It also owns the ONE failure policy: a rejected persist is caught in
  `write()`, reported ONCE through `UserNoticePort` (copy from
  `view/settingsWriteFailureNotice.ts`, which reads the failed row's declared label
  or the reset scope's) and never re-thrown — call sites `void` their write
  promises, and a throw would strand the rest of a debounce window. So a resolved
  write promise means "attempted and reported", not "stored"; the fan-out runs
  either way, so views repaint what the STORE holds — which after a rejected persist
  is still the value that never reached disk (`PluginDataStore` moves in-memory
  state before the write; whether it should roll back is ticket
  `nid_biwdtykvazsk3ejcqqli8o9j7_e`). There is no snap-back, which is exactly why
  the notice is the only signal. No try/catch belongs at a call site — the three
  pre-existing ones (`useOptimisticValue`, the tab's `settlePendingWrites`,
  `SettingsResetSequence.tolerating`) guard their own INJECTED seams, not this
  policy, and each says so.
  Companion pieces: `settingsResetSequence.ts` (restore-defaults ORDER: flush
  typed edits → write defaults → flush again → drain the chain → rebuild the
  controls; the last three run even when the write failed) and
  `optimisticValue.ts` + `useOptimisticValue.ts` (panel controls answer input
  immediately; the store wins as soon as it holds what the LATEST request will
  actually store — a clamped row passes that clamp in, so "the clamp left the
  value where it already was" releases too — or a value that is neither the
  burst's baseline nor one of the burst's own requests).
  Typed tab rows reach it through `DebouncedSettingsWrites`
  (`SETTINGS_WRITE_DEBOUNCE_MS`, ONE settle window shared by every typed row), so an
  e2e spec that TYPES must settle that window: `e2e/settingsWriteWindow.ts`
  (`SettingsWriteWindow`) is THE pattern — poll for a write that should land, a
  sentinel-edit ordering barrier for one that should not, and
  `expectFlushedAheadOfWindow` for the leave-the-field flushes. Copy it; never sleep
  for the debounce.
- `view/settingsRows.ts` — **THE settings row contract**: `SETTINGS_GROUPS` declares
  every section (heading, order, which one opens in the panel) and every ROW
  (label, description, control kind, and `disabledWhen` — accepted only on the
  `DEPENDENCY_AWARE_CONTROL_KINDS` whose presenters honour it), plus
  `SettingsRowNames`, the one accessible-naming convention. The settings tab and the
  controls panel are two PRESENTERS over it — `VicinityGraphSettingTab.addRow()` and
  `SettingsRowView.tsx` each dispatch on `row.control.kind` in a `switch` closed by
  `unhandledRowControl`, so a new control kind is a compile error in both (the tab's
  arm returns `void`, so that `default` is not decoration — without it a missing case
  falls through and renders nothing). Obsidian's `Setting` API
  cannot mount in React, so the two renderers stay; only markup is duplicated.
  Pure (no `obsidian`/`react`), because `e2e/settingsBaseline.ts` reads it too.
  Complements `settingsSectionFields.ts`, which answers the different question
  "which FIELDS does this section's restore-defaults clear".
  Guard: `settingsRowParity.test.ts`.
- `view/settingsRowAccessors.ts` — **the VALUE half of that contract**, one accessor
  per control kind: `{read(state), bounds, settlesAt, interaction(value)}` (+ `accept`
  on typed rows). Presenters are markup plus one accessor call — they never name an
  engine range table or clamp. `SettingsRowBounds` demands a `max` (every spec leaf
  is fully bounded), so a track control can never fall back to the range default. A SIBLING of `settingsRows.ts` (different reason
  to change, and it keeps the engine ranges out of the module e2e imports). Guards:
  `settingsRowAccessors.test.ts`, `settingsRowDepthClamp.test.ts`, and the
  `ACCESSOR_OWNED_SYMBOLS` scan in `settingsRowParity.test.ts`.
- `engine/SettingsSpec.ts` — **THE settings VALUE contract**: `SETTINGS_SPEC` declares
  every field's default and bounds, and the settings suites ITERATE it (parse,
  round-trip, reset, bounds) rather than restating values. Guard:
  `engine/settingsProductDefaults.test.ts` is the ONE place literal defaults/ranges
  may be written — an id-keyed table over every spec leaf, so a moved default, a new
  leaf and a deleted leaf all fail there and nowhere else.
- `persistence/storagePorts.ts`, `persistence/vaultFsPort.ts`,
  `adapters/obsidianPorts.ts` — testable seams, each with a `Fake*`
  implementation used by unit tests.

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
  A node the user RESIZED is judged instead by `layoutFit.ts` — a relayout only
  if its new box no longer fits where the rendered layout put it.

## Build note: libavoid WASM

`libavoid-js` ships a sidecar `dist/libavoid.wasm` that Obsidian's bundle can't
fetch at runtime, so `esbuild.config.mjs` maps a virtual `libavoid-wasm` import
to the on-disk wasm and inlines it as **base64** (`loader['.wasm'] = 'base64'`).
`obsidian-id-lib` is **bundled** (not external); only `obsidian` is a types-only
external. See `src/types/libavoidWasm.d.ts`.
