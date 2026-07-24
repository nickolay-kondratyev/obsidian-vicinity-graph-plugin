# EXPLORATION — Engine ports / adapters data flow (per-note metadata → rendered node)

> Produced by EXPLORE sub-agent (read-only). Paths are repo-relative unless noted.

## 1. `LinkProvider` port and sibling types

`src/engine/LinkProvider.ts`
- `FileMetadata` interface (lines 9–29): `folder`, `sizeBytes`, `frontmatterTitle?`, `isNodeBearing`, `attachments: readonly AttachmentRef[]`. Doc comment (lines 3–8) frames this as "ADAPTER truth" — the provider, not the engine, owns eligibility/attachment rules.
- `LinkProvider` interface (lines 40–54): `getOutgoingLinks(path)`, `getIncomingLinks(path)`, `getFileMetadata(path): FileMetadata | undefined`, `getLinkCount(source, target)`. "THE sole seam between the pure engine and Obsidian" (line 32), synchronous by design.

No sibling ports exist — `LinkProvider` is the only engine-facing port. A new `outline` field would be added to `FileMetadata`, analogous to `frontmatterTitle` / `attachments`.

`FakeLinkProvider` (`src/engine/FakeLinkProvider.ts`): declarative `FakeFileSpec`/`FakeVaultSpec` fixtures (lines 8–24); builds `FileMetadata` in `declareFile` (lines 88–102). New per-note field needs (a) optional field on `FakeFileSpec`, (b) wiring into the constructed `metadata`, mirroring `frontmatterTitle`.

## 2. Obsidian-side adapter: `ObsidianLinkProvider`

`src/adapters/ObsidianLinkProvider.ts`
- `getFileMetadata` (lines 111–123) assembles `FileMetadata`:
  `folder: asFolderPath(engineFolderOf(file))`, `sizeBytes: file.stat.size`, `frontmatterTitle: this.frontmatterTitleOf(file)`, `isNodeBearing: FileKinds.isNodeBearingPath(file.path)`, `attachments: this.attachmentsOf(path)`.
- `frontmatterTitleOf` (lines 131–148) already reads `metadataCache.getFileCache(file)?.frontmatter` — the existing precedent for reading extra `CachedMetadataPort` fields, gated on `file.extension !== MARKDOWN_EXTENSION`.
- `resolvedOutgoingPaths` (lines 150–174) reads `getFileCache(file)`; `ReferenceOrder.orderedLinkTexts(cache)` consumes `cache.links`, `cache.embeds`, `cache.frontmatterLinks` (`src/adapters/ReferenceOrder.ts:15–20`).
- **`headings` is NOT read anywhere.** `CachedMetadataPort` does not declare it.

`src/adapters/obsidianPorts.ts`
- `ReferencePort` (35–38): `link: string`, `position.start.offset: number`.
- `CachedMetadataPort` (46–52): `links?`, `embeds?`, `frontmatterLinks?`, `frontmatter?`. **No `headings`.**
  Obsidian's real `CachedMetadata` has `headings?: HeadingCache[]`, `HeadingCache = { heading: string; level: number; position: Pos }`, `Pos.start/end = { line, col, offset }`.
  Work needed: add a `HeadingPort` + `headings?: readonly HeadingPort[]` to `CachedMetadataPort`. `FakeObsidianPorts` (`src/adapters/FakeObsidianPorts.ts:22–23, 76–97`) already exposes injectable `fileCaches?: Record<string, CachedMetadataPort>` — heading fixtures are a trivial addition.

## 3. File type discrimination (markdown vs canvas vs excalidraw)

**No `kind`/`fileType` discriminant exists** on `GraphNode`, `TraversedNode`, or `FlowNodeData`. Inferred ad hoc:
- `src/shared/VaultPathFacts.ts` — pure `extensionOf(path)` (11–15), engine+adapter safe.
- `src/shared/FileKinds.ts` — `NODE_BEARING_EXTENSIONS = {"md","canvas"}` (8), `IMAGE_EXTENSIONS` (11); `isNodeBearingPath` / `isImagePath`.
- `ObsidianLinkProvider.ts`: `MARKDOWN_EXTENSION="md"`, `CANVAS_EXTENSION="canvas"` (11–12) checked inline (132, 97, 156, 160).
- **Excalidraw is NOT specially typed** — `.excalidraw.md` is plain markdown to this codebase; it only appears as a path-exclusion regex example in test fixtures (`PathExclusionMatcher.test.ts:41`, `persistedShapes.test.ts:71`).

Precedent for markdown-only gating: early-return like `frontmatterTitleOf`.

## 4. Image/preview resolution — exact path, position info

Pipeline: `ObsidianLinkProvider.attachmentsOf` → `FileMetadata.attachments` → `VicinityTraversal.assemble` picks first image → `GraphNode.firstImagePath` → `flowMapping.toFlowNodeData` → `FlowNodeData.firstImagePath` → `NoteNode.tsx` resolves URL.

- `attachmentsOf` (206–211): filters `resolvedOutgoingPaths(path)` to non-node-bearing targets → `{ path, isImage: FileKinds.isImagePath(target) }`, **in reference order** (`ReferenceOrder.ts` doc comment says ordering "drives `FileMetadata.attachments` and thereby `firstImagePath`").
- `src/engine/VicinityTraversal.ts:152,164`:
  `const firstImage = metadata.attachments.find((a) => a.isImage); … firstImagePath: firstImage?.path`
  i.e. **first image among embeds/links in document order** — not frontmatter cover-image. Frontmatter links come first, then body links+embeds merged by offset.
- `GraphNode.firstImagePath?: VaultPath` — `src/engine/types.ts:91`.
- `flowMapping.ts:291` spreads `firstImagePath` onto `FlowNodeData` only if defined.
- `NoteNode.tsx:27–30`: `ui.resourcePath(data.firstImagePath)` via `GraphUiContext`.

**Position info**: `ReferencePort.position.start.offset` exists and is used for ordering (`ReferenceOrder.ts:18`) but is discarded afterwards — never carried into `AttachmentRef`. Real `HeadingCache.position` carries `{line,col,offset}`; `ReferencePort` only declares `offset`, so a `HeadingPort` carrying `line` is needed if line numbers are required.

## 5. Node view-model assembly (where an `outline` field lands)

1. **Engine internal** — `TraversedNode` (`VicinityTraversal.ts:25–37`): has `attachments`, `firstImagePath`.
2. **Engine output** — `GraphNode` (`src/engine/types.ts:73–96`): `title`, `folder`, `sizeBytes`, `attachments`, `firstImagePath`, `sizePx`, `sizeScore`, …
3. **View-model** — `FlowNodeData` (`src/view/flowMapping.ts:37–59`), deliberately a type alias (RF's `Record<string, unknown>` constraint, comment 30–36). `toFlowNodeData` (280–295) is the single `GraphNode → FlowNodeData` mapping site.
4. Rendered in `src/view/NoteNode.tsx` via `data.<field>`; Obsidian API calls (e.g. jump-to-heading) go through `GraphUiContext` / `ObsidianGraphUi.ts`.

## 6. Persistence

Per-node derived render data is **never persisted** — recomputed each rebuild (`src/adapters/VicinityGraphBuilder.ts:36–70`). Only settings/overrides persist:
- `PluginData` (`src/persistence/persistedShapes.ts:42–49`), `DocData` (56–64), both `readonly version: number`, `PERSISTED_SHAPE_VERSION = 2` (33); mismatch degrades to defaults (`parsePluginData`/`parseDocData`, 87–113).
- **No version bump needed** for an outline (live-recomputed class of data).
- `src/adapters/CanvasParseCache.ts` caches parsed `.canvas` JSON in memory only — irrelevant to headings (`getFileCache` is already live/synchronous).

## 7. Test conventions

BDD `describe` / `it("WHEN … THEN …")` throughout. Model new tests on:
- `src/adapters/ObsidianLinkProvider.test.ts` — adapter level, `FakeObsidianPorts` declarative fixtures (`FakeObsidianPorts.ts:20–33`); mirror the "frontmatter display title" block (218–260) and attachments test (173).
- `src/engine/VicinityTraversal.test.ts:221–230` — engine level via `FakeLinkProvider`, asserts `firstImagePath` presence/absence.
- `src/view/flowMapping.test.ts:416–445` — view-model mapping; documents the "stable primitive for `useMemo`" contract for `firstImagePath`.
- `src/engine/importGuard.test.ts` — enforces engine/shared purity by source scanning.

## Layering constraints / risks

1. **Engine purity guard**: `outline` shapes in `src/engine/` must be plain POJOs — no Obsidian `HeadingCache`/`Pos` leakage. Mirror `AttachmentRef`.
2. **`CachedMetadataPort` widening** is adapter-layer (safe); the adapter must translate `HeadingCache[]` → engine's own `HeadingOutlineEntry[]`, as it already does `frontmatter → frontmatterTitle`.
3. **Markdown-only gate**: canvas has no `headings`; early-return like `frontmatterTitleOf` (line 132).
4. **No `metadataCache.on("changed"/"resolve")` listener** in `main.ts` — rebuilds trigger only on active-file switch, rename, delete (`RebuildDecision.ts`, `main.ts:120,125`). Editing headings in the open note will NOT refresh its own outline without a new trigger. **UX gap to flag.**
5. **View-model stability contract**: `flowMapping.test.ts:416–445` pins `firstImagePath` as a primitive string so `useMemo` deps stay stable. An `outline` **array** needs primitive flattening or careful memoization to avoid defeating diffing (`GraphStructureDiff.ts`, `RebuildDecision.ts`).
6. **`FileMetadata` is per-file, not per-node** — computed for every visited file including ones later filtered out. Reading `.headings` off the already-fetched cache is free I/O-wise, but large outline arrays on every visited node bloat memory/diff cost → consider truncation at the adapter boundary.
