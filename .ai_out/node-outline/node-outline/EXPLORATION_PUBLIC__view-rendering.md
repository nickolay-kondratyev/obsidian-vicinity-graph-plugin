# Exploration: Node rendering & sizing pipeline (view layer)

Repo: obsidian-vicinity-graph-plugin. Read-only exploration for a PLANNER
adding a "markdown outline preview" inside graph nodes as an alternative to
the existing image preview.

Stack: React 18.3.1 + `@xyflow/react` (React Flow) 12.11.2, TypeScript,
strict layering: `src/engine` (pure, obsidian-free) → `src/adapters`
(obsidian → engine port implementations) → `src/view` (React + RF, pure
mapping modules kept `@xyflow/react`-free, only `.tsx` files import RF/React).

---

## 1. React node components

### `src/view/NoteNode.tsx` — the rich note-card renderer

- `export const NoteNode = memo(function NoteNode({ data }: NodeProps<NoteNodeType>): ReactElement` — `NoteNode.tsx:24`.
  - Only `data` is destructured from `NodeProps`. **Width/height are NOT read
    as props** — see §3 for how sizing reaches the DOM instead.
  - `NoteNodeType = Node<FlowNodeData, "note">` (`NoteNode.tsx:22`), registered
    under the RF node-type key `"note"`.
- JSX structure (`NoteNode.tsx:75-109`):
  ```
  <div className="vicinity-graph-node" data-tier={data.tier} data-path={data.path} onContextMenu=...>
    <PinButton .../>                              // hover-reveal pin/unpin chip, top-right
    <Handle type="target" position={Top} .../>      // invisible RF edge anchor
    <div className="vicinity-graph-node__preview-zone" onMouseEnter={onPreviewEnter}>
      <div className="vicinity-graph-node__title" title={data.title}>{data.title}</div>
      {thumbnailUrl !== null && (
        <div className="vicinity-graph-node__thumbnail">
          <img src={thumbnailUrl} alt="" loading="lazy" draggable={false} />
          {extraImages !== null && <span className="...thumbnail-badge">{extraImages}</span>}
        </div>
      )}
    </div>
    {data.attachmentGroups.length > 0 && (
      <div className="vicinity-graph-node__attachments">{/* AttachmentChip per group */}</div>
    )}
    <Handle type="source" position={Bottom} .../>
  </div>
  ```
- Content regions, top to bottom: pin button (absolute-positioned overlay) →
  title → thumbnail (conditional) → attachment icon strip (conditional).
  `preview-zone` wraps title+thumbnail as ONE hover target for Obsidian's
  native page-preview popover (deliberately excludes the pin button and
  attachment chips — see the big comment at `NoteNode.tsx:58-63`).
- `PinButton` and `AttachmentChip` are local unexported components
  (`NoteNode.tsx:118-180`) — small, self-contained, each stops click
  propagation (`nodrag nopan`) so they don't trigger the node's `onNodeClick`
  (open note) or start an RF drag/pan.
- Comparable sibling: `src/view/FolderGroupNode.tsx` — same `memo` +
  `NodeProps<FolderGroupNodeType>` pattern, much simpler (label + "+N" badge,
  no data-driven content regions, no container queries).

### Data contract: `FlowNodeData` (`src/view/flowMapping.ts:37-59`)

```ts
export type FlowNodeData = {
	readonly path: string;
	readonly title: string;
	readonly docid?: string;
	readonly tier: NodeTier;                 // "main" | "pinned-central" | "regular"
	readonly isPinned: boolean;
	readonly sizePx: number;                 // engine-driven square edge (px)
	readonly sizeScore: number;              // [0,1] composed score
	readonly folder: string;
	readonly firstImagePath?: string;        // thumbnail candidate (vault path)
	readonly imageCount: number;             // total images among attachments
	readonly attachmentGroups: readonly AttachmentIconGroup[];
};
```
Note: it's a **type alias, not an interface** — deliberate, so it satisfies
RF's `Record<string, unknown>` constraint on node `data` without casts
(comment at `flowMapping.ts:30-36`). Any new field (e.g. an outline array)
should follow the same alias-not-interface convention if added directly to
this type.

`sizePx` / `sizeScore` ride along in `data` but are **not currently used by
NoteNode** — sizing is consumed structurally via CSS container queries (§3),
not read in JS by the component today. They're the "engine's opinion of size"
for anything a planner might want to gate content on numerically instead of
via CSS thresholds.

---

## 2. Image/thumbnail preview — full data flow

1. **Engine capture** (`src/engine/VicinityTraversal.ts`):
   - `TraversedNode.firstImagePath?: VaultPath` (`:36`) and
     `TraversedNode.attachments: readonly AttachmentRef[]` (`:35`).
   - Computed in `assemble()` (`:152-164`): `const firstImage =
     metadata.attachments.find((attachment) => attachment.isImage);` then
     `firstImagePath: firstImage?.path`.
   - `GraphNode` (public engine type, `src/engine/types.ts:73-89`) echoes both
     `firstImagePath?: VaultPath` (`:91`, in the surrounding block — see file)
     and `attachments: readonly AttachmentRef[]` (`:89`).
2. **Adapter source of `attachments`**: `src/adapters/ObsidianLinkProvider.ts`
   — `getFileMetadata()` (`:111-123`) calls `this.attachmentsOf(path)`
   (`:207-211`): "Attachments = outgoing references to non-node-bearing
   files, in reference order," each tagged `isImage: FileKinds.isImagePath(target)`.
   `FileKinds` lives at `src/shared/FileKinds.ts` (extension allow-list,
   `:10` comment: "Attachment extensions rendered as thumbnails (drives
   `firstImagePath`)").
3. **View mapping** (`src/view/flowMapping.ts`, `toFlowNodeData` `:280-295`):
   ```ts
   ...(node.firstImagePath === undefined ? {} : { firstImagePath: node.firstImagePath }),
   imageCount: node.attachments.filter((attachment) => attachment.isImage).length,
   ```
   `imageCount` is a fresh re-derivation from `attachments`, not echoed from
   the engine — i.e. the view independently counts images rather than trusting
   an engine-supplied count.
4. **Render** (`NoteNode.tsx:27-30, 90-98`):
   ```ts
   const thumbnailUrl = useMemo(
     () => (data.firstImagePath === undefined ? null : ui.resourcePath(data.firstImagePath)),
     [ui, data.firstImagePath],
   );
   ```
   `ui.resourcePath` is `GraphUiPort.resourcePath(path): string | null`
   (`src/view/viewPorts.ts:108`), implemented in `src/view/ObsidianGraphUi.ts:26-29`
   via `this.app.vault.getResourcePath(file)` (Obsidian's `app://` URL for a
   vault file — works for `<img src>` directly, no fetch needed).
   `extraImages = extraImageCountText(data.imageCount)` (badgeText.ts) drives
   the "+N" badge when `imageCount > 1`.
   The `<img>` only renders when `thumbnailUrl !== null`; it is also gated
   visually by CSS (`display: none` below a height threshold — §3/§4).

**Key seam for an outline alternative**: the analogous data field would sit
next to `firstImagePath`/`imageCount` in `FlowNodeData`, sourced from a new
`TraversedNode`/`GraphNode` field, computed in `ObsidianLinkProvider` (or a
new adapter method) from `metadataCache.getFileCache(file)?.headings` (no
existing heading/outline code anywhere in the repo — confirmed by a
repo-wide grep for `heading|outline`, zero real hits besides `Setting.setHeading()` calls unrelated to notes).

---

## 3. Node sizing

### Where `sizePx` comes from (engine, obsidian-free)

- `src/engine/NodeSizer.ts` — `NodeSizer.computeSizes()` (`:37-56`) composes
  enabled/weighted metrics (`own-file-size`, `total-linker-size`,
  `backlink-count`, `outlink-count`, `depth-decay` — registry at `:77-84`)
  into a `sizeScore ∈ [0,1]`, then:
  ```ts
  sizePx: settings.minPx + score * (settings.maxPx - settings.minPx)
  ```
  Centrals (MAIN + pinned) bypass composition and get `CENTRAL_SIZE_SCORE` →
  effectively `maxPx`.
- Defaults: `minPx: 40`, `maxPx: 160` (`src/engine/SettingsSpec.ts:136-137`,
  re-exported as `DEFAULT_MIN_NODE_PX` / `DEFAULT_MAX_NODE_PX` in
  `src/engine/constants.ts:25-26`). User-configurable via the Sizing section
  of the toolbar/settings tab (`src/view/SizingSection.tsx`,
  `src/view/sizingMetrics.ts` — label/order metadata only, not the math).

### Width/height derivation (view mapping)

- `src/view/graphIdentity.ts` — `nodeDimensionsPx(node)`:
  ```ts
  width: Math.max(node.sizePx, Math.min(NODE_MAX_LABEL_WIDTH_PX, estimateNodeLabelWidthPx(node.title))),
  height: node.sizePx,
  ```
  So **height == sizePx always** (a square baseline); width is the max of
  that square and a snug title-fit estimate, capped at
  `NODE_MAX_LABEL_WIDTH_PX = 250` (`src/view/constants.ts:50`, comment: "a bit
  above the 160px engine max HEIGHT so a long title gets some horizontal room
  before wrapping"). `estimateNodeLabelWidthPx` (`constants.ts:57-59`) is a
  **character-count heuristic**, not a DOM measurement — "the view stays
  pure (no DOM)."
- `vicinityGraphToFlow()` (`flowMapping.ts:147-187`) calls
  `nodeDimensionsPx(node)` per note and puts `width`/`height` directly on the
  `NoteFlowNode` (`FlowNodeBase.width/height`, `flowMapping.ts:79-80`).
- `VicinityGraphFlow.tsx` → `toReactFlowNode()` (`:145-160`) passes them to RF
  as **both** the RF `Node.width/height` fields AND an inline `style: {
  width, height }` (`:151-153`, comment: "Explicit RF dimensions (not just
  style) ... culling and fitView then know every node's rect WITHOUT waiting
  for a DOM measurement pass").

### Is size known to the React component at render time?

**No — not via props.** `NoteNode` destructures only `{ data }` from
`NodeProps<NoteNodeType>`; it never reads `width`/`height`/`style` off its own
node. The `100% / 100%` sizing happens implicitly: RF sets the wrapping
`.react-flow__node` DOM element's actual pixel size from the `Node.style`
object computed in `toReactFlowNode`, and `.vicinity-graph-node` (the
component's own root div) is `width: 100%; height: 100%` in CSS
(`graph-view.css:77-78`) so it fills that ambient box. A planner wanting
JS-side size branching would need to either (a) add `sizePx` (already present
in `data`!) as the decision input instead of true rendered pixels, or (b) pull
real box size via RF's `useStore` / `useNodesData` / a `ResizeObserver`
(no existing precedent for this in the codebase — see §6, "no JS measuring"
is a stated design constraint, `NoteNode.tsx:18` doc comment and the CSS
comment at `graph-view.css:66-70`).

**Yes — via CSS.** The actual "how much space is available" signal at
render/paint time lives in **CSS container queries**, not React:
```css
.vicinity-graph-node {
  container-type: size;   /* graph-view.css:75 */
  ...
}
@container (min-height: 72px)  { .vicinity-graph-node__attachments { display: flex; } }
@container (min-height: 104px) { .vicinity-graph-node__thumbnail  { display: block; } }
```
(`graph-view.css:222-231`). This is the existing level-of-detail mechanism:
small nodes show title only; ≥72px height also shows the attachment strip
(and the pin button, `graph-view.css:279-283`); ≥104px additionally shows the
thumbnail. **An outline preview would most naturally plug into this same
container-query ladder** (e.g. its own `@container` breakpoint), keeping with
the "no JS measuring" rule — or, if outline needs JS branching (e.g. to decide
how many heading lines to render), the `sizePx`/`sizeScore` fields already
riding in `data` are the cheapest available proxy, though they reflect the
engine's *decided* size, not RF's actual on-screen pixel size after
zoom/pan (those are the same in local px terms since RF scales via CSS
transform on the whole pane, not by resizing nodes — zoom does not change a
node's local content-box size).

---

## 4. CSS files under `src/view/*.css`

Two files, both **hand-authored SOURCE** — the shipped `styles.css` is
generated at build time as `@xyflow/react` base CSS + these files
concatenated (comment: `esbuild.config.mjs`, `graph-view.css:1-4`, "Edit here,
never edit `styles.css` directly").

- `src/view/graph-view.css` (780 lines) — the graph pane, node, edge, and
  toolbar styles. Relevant sections for this task:
  - `===== note nodes =====` (`:63-237`): node card box model, title clamp
    (`-webkit-line-clamp: 4`), thumbnail box (`object-fit: contain`,
    `flex: 1 1 var(--vicinity-graph-thumbnail-height)` so a taller node grows
    the image into spare space), attachment strip, container-query density
    thresholds (`:220-231`), hover/selection ring (`:94-106`), tier borders
    (`data-tier="main"|"pinned-central"`, `:108-118`).
  - `===== hover pin/unpin button =====` (`:239-301`): shows the
    `pointer-events:none`-while-hidden pattern needed for any new
    absolutely-positioned overlay chip.
  - Theming convention (stated at top, `:6-9`): **every color is an Obsidian
    CSS variable** (`--background-*`, `--text-*`, `--interactive-accent`,
    `--radius-*`, `--size-4-*`, `--font-*`) — "the plugin ships zero colors of
    its own." Any new outline-preview styling must follow this (no literal
    hex/rgb).
- `src/view/settings-tab.css` — settings-tab-only styles (toolbar/global
  settings tab chrome), not relevant to node content.

No existing scrollbar-specific rules were found in either file (`grep
scroll` → only `.vicinity-graph-toolbar__body { overflow-y: auto; ... }`,
`graph-view.css:451-459`, for the toolbar panel, not any node region). An
outline preview with more content than fits (long note, many headings) would
need to introduce its own scroll/overflow treatment inside the node — no
precedent to copy for "outline scrolling inside a fixed 40–160px box"; the
existing model instead **hides** overflow (`.vicinity-graph-node { overflow:
hidden }`, `:87`) and clamps text rather than scrolling.

---

## 5. Click handlers / note-opening seam

- **Node click → open note**: `VicinityGraphFlow.tsx:43-48`:
  ```ts
  const onNodeClick = useCallback<NodeMouseHandler>(
    (event, node) => controller.openNode(node.id, { newTab: event.ctrlKey || event.metaKey }),
    [controller],
  );
  ```
  wired onto `<ReactFlow onNodeClick={onNodeClick} ...>` (`:67`) — a single
  handler for the WHOLE canvas, not per-node in `NoteNode`. `node.id` is the
  vault path (folder-group ids are filtered out downstream).
- **Controller**: `GraphViewController.openNode(path, options?)`
  (`GraphViewController.ts:173-178`):
  ```ts
  openNode(path: string, options?: OpenNoteOptions): void {
    if (isFolderGroupId(path)) return;
    this.navigator.openNote(path, options);
  }
  ```
- **Navigator (real obsidian adapter)**: `ObsidianNoteNavigator.openNote()`
  (`src/view/ObsidianNoteNavigator.ts:18-24`):
  ```ts
  openNote(path: string, options?: OpenNoteOptions): void {
    const file = this.app.vault.getFileByPath(path);
    if (file === null) return;
    void this.app.workspace.getLeaf(options?.newTab === true).openFile(file);
  }
  ```
  `OpenNoteOptions` (`viewPorts.ts:57-60`) currently carries **only**
  `newTab: boolean`. **No existing seam to open at a specific heading/line**:
  `openFile()` is called with no second argument; Obsidian's `WorkspaceLeaf
  .openFile(file, openState?)` supports an `{ eState: { line, ... } }` (or
  similar) second argument for scroll-to-position, but this plugin does not
  use it anywhere. Adding "click a heading in the outline preview → open at
  that heading" would require: (a) extending `OpenNoteOptions` with an
  optional target (line number / heading id), (b) threading it through
  `GraphViewController.openNode` → `NoteNavigatorPort.openNote` →
  `ObsidianNoteNavigator`'s `openFile(file, { eState: {...} })` call, and (c)
  a new click target inside `NoteNode`'s outline region that calls this
  (currently `onNodeClick` is canvas-level via RF, not per-DOM-node in
  `NoteNode` — a heading click would need its own `stopPropagation()`-guarded
  handler the way `PinButton`/`AttachmentChip` already do, to avoid
  double-firing the node's own open-note click).
- **Hover preview** (separate from click): `NoteNode.tsx:64-73`,
  `onPreviewEnter` calls `ui.showHoverPreview(...)` → `ObsidianGraphUi
  .showHoverPreview()` (`ObsidianGraphUi.ts:31-40`) triggers Obsidian's
  native `hover-link` event scoped to `.vicinity-graph-node__preview-zone`
  only (title + thumbnail), explicitly excluding attachment chips/pin button
  as a "dead zone" so the popover never covers an affordance being clicked
  (`NoteNode.tsx:58-63` comment). An outline preview region would need the
  same consideration: if it should also arm the popover, it belongs inside
  `preview-zone`; if it has its own clickable heading rows, it should NOT
  (or must guard each row like `AttachmentChip` does).
- **Right-click menu**: `onContextMenu` (`NoteNode.tsx:45-56`) → single pin/
  unpin entry via `ui.showNodeMenu`. Not outline-related, but the pattern
  (`event.preventDefault(); event.stopPropagation();` then
  `ui.showNodeMenu(...)`) is the template for any new native `Menu` addition.

---

## 6. React Flow specifics

- **Node-type registry**: `VicinityGraphFlow.tsx:26`:
  ```ts
  const NODE_TYPES: NodeTypes = { note: NoteNode, "folder-group": FolderGroupNode };
  ```
  Declared as a **module-level constant** (not recreated per render) — RF
  requires stable `nodeTypes`/`edgeTypes` identity to avoid an "it looks like
  you've created a new nodeTypes or edgeTypes object" warning + wasted
  remounts. Any new node type (unlikely needed here — outline is content
  inside the existing `"note"` type) must follow this pattern.
- **Memoization**: both `NoteNode` and `FolderGroupNode` are wrapped in
  `React.memo(...)` (default shallow-prop-equality memo — RF re-renders a
  node only when its `data`/`position`/etc. object identity changes). Any new
  field added to `FlowNodeData` must be produced with a **stable-by-content**
  value in `flowMapping.ts` (already the case: `toFlowNodeData` builds a
  fresh object per graph rebuild, so this is consistent with how
  `firstImagePath`/`attachmentGroups` already work — no extra memo work
  needed for a new outline field beyond what's already there).
- **Viewport culling**: `onlyRenderVisibleElements` prop
  (`VicinityGraphFlow.tsx:91`) — only nodes intersecting the pan/zoom
  viewport are mounted in the DOM (perf, especially with `<img>` thumbnails).
  Relies on every node carrying **explicit width/height** set at mapping
  time (§3) so RF can cull without a DOM measurement pass — an outline
  preview must NOT change a node's declared `width`/`height` after mount (no
  dynamic resize-to-fit-content), or culling/`fitView` math breaks.
- **No existing zoom-dependent / level-of-detail JS logic.** Repo-wide grep
  for `zoom|useViewport` in `src/view` found no per-node zoom branching
  anywhere — the ONLY LOD mechanism is the CSS container-query height ladder
  in §3/§4. RF's zoom is a CSS-transform scale on the whole pane; it does not
  change a node's local (container-query) pixel dimensions, so `sizePx`
  (engine-decided) and container-query breakpoints are zoom-invariant by
  construction — a planner should keep any new LOD gate on **node height**
  (`sizePx`/CSS), not on zoom level, to stay consistent with the existing
  design.
- **`fitView`**: driven by `FitViewOnLayoutChange` (`VicinityGraphFlow.tsx:120-143`),
  keyed on `snapshot.layoutVersion`. Not directly relevant to node content,
  but a reminder that node width/height changes trigger this to refit — an
  outline preview should stay within the mapping-time `width`/`height` box
  (§3 risk above), not grow it, unless a planner deliberately wants outline
  content to also affect layout/relayout (`SIZE_RELAYOUT_THRESHOLD`,
  `constants.ts:14-20`, only fires on `sizePx` growth >100%, itself an
  engine-level, not outline-level, concept).

---

## Constraints / risks for a planner to weigh

1. **No DOM measurement anywhere in this component tree** — it's a stated
   design rule (`NoteNode.tsx:18`, `graph-view.css:66-70`). An outline
   preview that needs to know "how many heading lines fit" should prefer CSS
   (`-webkit-line-clamp`, `overflow: hidden`, container queries) over a
   `ResizeObserver`/JS measurement, to stay consistent.
2. **No existing heading/outline data anywhere in the codebase** (engine,
   adapters, or view) — this is a greenfield addition. The natural adapter
   seam is `ObsidianLinkProvider.getFileMetadata()`
   (`src/adapters/ObsidianLinkProvider.ts:111-123`), which already calls
   `this.metadataCache.getFileCache(file)` for frontmatter (`:135`) — the
   same `CachedMetadata` object also exposes `.headings` at runtime
   (Obsidian API), so no new metadata-cache read is needed, only a new field
   extraction alongside the existing frontmatter one.
3. **Width is capped independent of height** (`NODE_MAX_LABEL_WIDTH_PX =
   250`, only driven by title length, not content) — an outline preview
   cannot grow the node's width; it only gets whatever width the title
   estimate produced.
4. **Height is capped at `maxPx` (default 160, user-configurable)** — even a
   "big enough" node has a hard ceiling; outline preview must render inside a
   ≤160px-tall (default) box with several other regions (title, possibly
   attachment strip) competing for the same vertical container-query budget.
5. **`OpenNoteOptions` has no position/heading field today** — "click a
   heading to jump there" needs new plumbing through `viewPorts.ts` →
   `GraphViewController` → `ObsidianNoteNavigator` (§5), not just a NoteNode
   change.
6. **Mutual exclusivity vs. image preview**: the task says outline is "an
   alternative to the existing image preview," implying some selection logic
   (setting, per-node fallback, or replacing the container-query thumbnail
   block). `firstImagePath`/`thumbnailUrl` gating (`NoteNode.tsx:27-30,
   90-98`) and its container-query reveal (`graph-view.css:227-231`) are the
   two places such a toggle would need to interact with.
7. **`nodesDraggable={false}` / `nodesConnectable={false}`** — the graph is
   read-only by design (`VicinityGraphFlow.tsx:69-73` comment); any new
   interactive element inside the outline block (e.g. clickable heading rows)
   must use the same `nodrag nopan` + `event.stopPropagation()` escape hatch
   already used by `PinButton`/`AttachmentChip` (`NoteNode.tsx:132-136,
   160-163`).
