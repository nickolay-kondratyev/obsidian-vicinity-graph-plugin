# PLANNER__PRIVATE — node-outline

Rehydration memory. Public deliverable: `DETAILED_PLANNING__PUBLIC.md` (same dir).
Status at write time: plan complete, 2 open `#QUESTION_FOR_HUMAN`, nothing implemented.

## Source facts I verified myself (do not re-read unless suspicious)

| Fact | Where |
|---|---|
| `FileMetadata` = folder/sizeBytes/frontmatterTitle?/isNodeBearing/attachments; doc says "ADAPTER truth" | `src/engine/LinkProvider.ts:9-29` |
| `getFileMetadata` assembles it; `frontmatterTitleOf` gates on `file.extension !== "md"`; `attachmentsOf` = non-node-bearing `resolvedOutgoingPaths` | `src/adapters/ObsidianLinkProvider.ts:111-123,131-148,206-211` |
| `resolvedOutgoingPaths` markdown branch resolves `ReferenceOrder.orderedLinkTexts` via `getFirstLinkpathDest`, then dedupes | same, `:150-174` |
| `ReferenceOrder.orderedLinkTexts` = frontmatter links first, then body links+embeds sorted by `position.start.offset` (offset then DISCARDED) | `src/adapters/ReferenceOrder.ts` |
| `CachedMetadataPort` has links/embeds/frontmatterLinks/frontmatter, **no headings**; `ReferencePort.position.start.offset` only | `src/adapters/obsidianPorts.ts:34-52` |
| `VicinityEngine` builds `GraphNode` as `{...traversedNode, isMain, sizeScore, sizePx}` → a new `TraversedNode` field flows to `GraphNode` for free | `src/engine/VicinityEngine.ts:71-88` |
| `assemble()` picks `firstImage = metadata.attachments.find(isImage)` | `src/engine/VicinityTraversal.ts:152-164` |
| `decideLayout` compares ONLY node ids, edge ids, groupByFolder, forceLayout fields, sizePx growth — never node data | `src/view/GraphStructureDiff.ts:24-48` |
| `decideActiveFileRebuild` is path-only | `src/view/RebuildDecision.ts` |
| `flowMapping` reads `graph.viewSettings.groupByFolder` → **viewSettings already reach the view** | `src/view/flowMapping.ts:148` |
| memo contract test is about a PRIMITIVE useMemo key for `ui.resourcePath` (no img refetch), not deep diffing | `src/view/flowMapping.test.ts:412-447` |
| Node CSS: `container-type: size`, thumbnail revealed at `@container (min-height: 104px)`, attachments+pin at 72px; every color is an Obsidian var; no scrollbar rules exist yet | `src/view/graph-view.css:63-301` |
| `PinButton`/`AttachmentChip` = local components, `nodrag nopan` + `event.stopPropagation()` so the RF canvas-level `onNodeClick` does not double-fire | `src/view/NoteNode.tsx:118-180` |
| `onNodeClick` is canvas-level: `controller.openNode(node.id, {newTab: ctrlKey||metaKey})` | `src/view/VicinityGraphFlow.tsx:43-48` |
| `GraphViewController.openNode(path, options?)` forwards options unchanged → **no controller change needed** | `src/view/GraphViewController.ts:173-178` |
| `OpenNoteOptions` = `{newTab}` only; `ObsidianNoteNavigator` calls `getLeaf(newTab).openFile(file)` | `src/view/viewPorts.ts:56-67`, `ObsidianNoteNavigator.ts:18-24` |
| `ControlsActionsContext.ts` doc: "React Flow instantiates nodeTypes components itself, so context is the only clean channel" — the precedent for `NoteOpenContext` | `src/view/ControlsActionsContext.ts` |
| `obsidian.d.ts`: `OpenViewState.eState?: Record<string, unknown>` (untyped → `line` is undocumented); `openLinkText(linktext, sourcePath, newLeaf?, openViewState?)` is public/documented | `node_modules/obsidian/obsidian.d.ts:4756-4765, 7914` |
| **`metadataCache.on("resolved")` IS registered** → debounced (500ms) rebuild on vault content change | `src/view/VicinityGraphView.tsx:115`, `GraphViewController.handleMetadataResolved` |
| tsconfig: strict + `noUncheckedIndexedAccess` + `noImplicitReturns`; **`exactOptionalPropertyTypes` is OFF** | `tsconfig.json` |
| SETTINGS_SPEC nesting mirrors persisted shapes; `clampForceLayoutSettings` shared by sliders + parser | `src/engine/SettingsSpec.ts`, `constants.ts:76-98` |
| Settings tab: `createSection()` per card, `applyInteraction()` is the single write path | `src/view/VicinityGraphSettingTab.ts:75-77,339-360` |
| Dev-vault fixtures are `write_if_missing` heredocs — adding a NEW note file works on existing vaults | `scripts/setup-dev-vault.sh` |
| e2e: `e2e/*.e2e.ts`, real Obsidian, serial, workers:1; node-click tests must use BIG nodes (alpha graph) | `e2e/vicinityGraph.e2e.ts:195-238` |

## Decisions (final) + what I rejected and why

1. **`OutlineEntry = { text, level }`** — no `line`/`offset`. Follows from D6.
   Rejected branded types (ceremony, no bug to catch).
2. **`FileMetadata.outline` required `readonly OutlineEntry[]`, `[]` = none.**
   Mirrors `attachments`. Rejected optional (undefined branches × 3 layers).
3. **Adapter encodes the image-vs-outline rule by returning `[]`.** Rejected a
   second `firstImagePrecedesFirstHeading` boolean (2 fields × 3 hops) and
   rejected `AttachmentRef.offset` (bloats a hot type, leaks positions into the
   engine). Frontmatter image = `offset -1` ⇒ always "before" ⇒ image wins.
4. **`ReferenceOrder.orderedReferences()`** is the single ordering truth;
   `orderedLinkTexts` becomes its projection. `ObsidianLinkProvider` gets
   `orderedMarkdownReferences` so the resolve pass is shared between the existing
   attachments path and the new first-image-offset lookup (no duplicated
   resolution knowledge).
5. **Array on `FlowNodeData`, never a flattened primitive.** Full justification in
   the public plan §D1 (nothing deep-compares node data; encode/decode would be a
   DRY + delimiter hazard).
6. **Eligibility → `FileKinds.isOutlineBearingPath`** (+ `isMarkdownPath`, adopted
   in `ObsidianLinkProvider` to kill its local literal). Rejected a `kind`
   discriminant on GraphNode.
7. **Gating = the EXISTING 104px container query**, same slot as the thumbnail
   (mutually exclusive). ≈3 entries at 104px, ≈6 at 160px. Rejected a new 88px
   breakpoint (one-entry scroll list looks broken) and any JS measurement.
   `data-preview="outline"` on the node root makes `__preview-zone` `flex: 0 0 auto`
   so the outline gets the slack (rejected `:has()` — attribute matches the
   existing `data-tier` idiom).
8. **Scrollbar: transparent THUMB by default, colored on `:hover` of the node**,
   via standard `scrollbar-width: thin` + `scrollbar-color`. Zero reflow.
   Rejected width 0→6px (re-ellipsises every row on hover) and
   `scrollbar-gutter: stable` (permanently spends 6px).
9. **`nowheel` (RF class) on the `<ul>`** — a React `onWheel` + stopPropagation
   canNOT stop d3-zoom (native listener on the pane fires before React's root
   delegation). Accepted: wheel over a non-overflowing outline does nothing.
10. **Open at heading = `workspace.openLinkText("path#Heading", path, newTab)`**,
    NOT `openFile(file, {eState:{line}})`. Documented API; works in reading view;
    no stale line numbers; keeps `OutlineEntry` free of positions. Accepted cost:
    duplicate heading text → first match (same as any `[[Note#Heading]]` link);
    `#` inside a heading degrades to opening at the top.
11. **Pure module `src/view/nodeOpenIntent.ts`**: `opensInNewTab`,
    `outlineEntryOpenOptions`, `headingLinktext`. Also DRYs the ctrl/cmd rule now
    inlined in `VicinityGraphFlow`.
12. **`NoteOpenContext` + `NoteOpenPort`** to reach the navigator from inside a
    node. Rejected putting `openNote` on `GraphUiPort` (its doc explicitly splits
    navigation out — SRP) and rejected `data-*` sniffing in `onNodeClick`.
13. **Setting lives on `ViewSettings.outlineMaxDepth`** (globalView cascade), NOT
    a `nodeExclusion`-shaped top-level global. Decisive reason: `graph.viewSettings`
    is already the transport into `flowMapping`, where the depth filter runs; a
    global-only shape reaches the engine but not the view. Clamp `[1,6]` shared by
    parser + slider (`clampOutlineMaxDepth`), so hand-edited `0` cannot become a
    hidden off-switch (would contradict "no enable/disable setting").
14. **Depth filter + `OUTLINE_RENDER_LIMIT = 40` both in `flowMapping`**, filter
    BEFORE slice. Rejected an adapter-side entry cap: applied before the depth
    filter it would silently hide a deep-heading note's shallow headings.
15. **Thumbnail suppression lives in the component** (`!showsOutline &&`), keeping
    `firstImagePath` honest ("this note's first image"). Mapping test 34 pins it.

## Open threads

- Q1 (public): settings slider vs hard-coded depth 2. If "hard-code", drop Step 4
  entirely and inline `DEFAULT_OUTLINE_MAX_DEPTH` in `flowMapping`.
- Q2 (public): the `metadataCache.on("resolved")` discovery contradicts
  CLARIFICATION Q3's premise → ticket should be "verify/tighten", not "add".
- Ticket-convention ambiguity flagged by exploration (`ticket` CLI `_tickets/` vs
  `docs-internal/tickets/*.md`): I chose `docs-internal/tickets/` because the
  clarification says so verbatim. If the human prefers the CLI, re-file.
- IMPLEMENTATION should load the `obsidian-settings` skill before writing the new
  settings section (placement/copy/altitude), per exploration §2.
- Unverified by me: exact pixel budget claims (≈3 entries at 104px) are arithmetic
  from the CSS, not measured. First dev-vault smoke should sanity-check them; if
  3 entries feel too cramped, the honest lever is the entry `line-height`/font,
  not a new breakpoint.

## Snippets I worked out (reuse verbatim if still valid)

```tsx
// NoteNode.tsx
const showsOutline = data.outline.length > 0;
// root: data-preview={showsOutline ? "outline" : "thumbnail"}
// preview-zone keeps title; thumbnail block guarded by `!showsOutline &&`
{showsOutline && (
  <ul className="vicinity-graph-node__outline nowheel nodrag nopan" aria-label="Note outline">
    {data.outline.map((entry, index) => (
      <li key={index}><OutlineEntryRow path={data.path} entry={entry} /></li>
    ))}
  </ul>
)}
```

```css
.vicinity-graph-node__outline {
	display: none; flex: 1 1 auto; min-height: 0;
	margin: 0; padding: 0; list-style: none;
	overflow-y: auto; overflow-x: hidden;
	scrollbar-width: thin; scrollbar-color: transparent transparent;
}
.vicinity-graph-node:hover .vicinity-graph-node__outline {
	scrollbar-color: var(--background-modifier-border-hover) transparent;
}
.vicinity-graph-node[data-preview="outline"] .vicinity-graph-node__preview-zone { flex: 0 0 auto; }
.vicinity-graph-node__outline-entry {
	display: block; width: 100%; height: auto; padding: 0; text-align: left;
	font-size: var(--font-smallest); line-height: 1.4; color: var(--text-muted);
	background: none; border: none; box-shadow: none; cursor: pointer;
	white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.vicinity-graph-node__outline-entry[data-level="2"] { padding-inline-start: var(--size-4-1); }
/* …levels 3–6 = calc(N * var(--size-4-1)); finite domain, written out on purpose */
@container (min-height: 104px) { .vicinity-graph-node__outline { display: block; } }
```

```ts
// ObsidianLinkProvider (sketch)
private outlineOf(file: VaultFilePort, cache: CachedMetadataPort | null): readonly OutlineEntry[] {
	if (!FileKinds.isOutlineBearingPath(file.path) || cache === null) return EMPTY_OUTLINE;
	const headings = cache.headings ?? [];
	const first = headings[0];                       // noUncheckedIndexedAccess
	if (first === undefined) return EMPTY_OUTLINE;
	const imageOffset = this.firstImageOffsetOf(file.path, cache);
	if (imageOffset !== undefined && imageOffset < first.position.start.offset) return EMPTY_OUTLINE;
	return headings.map((h) => ({ text: h.heading, level: h.level }));
}
```
