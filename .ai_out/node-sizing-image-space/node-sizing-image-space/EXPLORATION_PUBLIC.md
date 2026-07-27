# Node Sizing & Node Images — Exploration Map

Repo: obsidian-vicinity-graph-plugin. All paths absolute-relative to repo root.

## 1. Node width/height computation (engine + view)

### 1a. Engine: score → pixel height (`sizePx`)
`src/engine/NodeSizer.ts`
- `NodeSizer.computeSizes()` (L37-61): clamps settings via `clampSizingSettings` (L45), builds
  the enabled/weighted metric list, then per node:
  - centrals (MAIN + pinned) bypass composition: `score = CENTRAL_SIZE_SCORE` (=1, L54, L73 in constants.ts)
  - others: `composeScore()` weighted average of enabled metrics (L63-76)
  - `sizePx = settings.minPx + score * (settings.maxPx - settings.minPx)` (L57) — THE core formula.
- Metric registry (L79-93): `own-file-size` (log1p of bytes), `total-linker-size` (log1p of
  summed incoming-linker bytes), `backlink-count`, `outlink-count` (excludes attachment links,
  L104-106), `depth-decay` (`DepthDecayMetric`, L157-168: `1 / (1 + k * minDepth)`, degrades to
  `NEUTRAL_NORMALIZED_VALUE` (0.5) on non-finite result, L160-166).
- `MinMaxNormalizedMetric` (L114-139): min-max normalizes a raw value (optionally log1p-transformed);
  if all values equal, everyone gets `NEUTRAL_NORMALIZED_VALUE` (no discrimination).
- `composeScore` (L63-76): `weightedSum / totalWeight`; if `totalWeight <= 0` → neutral (0.5).

### 1b. Constants / bounds
`src/engine/constants.ts`
- `DEFAULT_MIN_NODE_PX` / `DEFAULT_MAX_NODE_PX` (L25-26) ← `SETTINGS_SPEC.globalView.sizing.{minPx,maxPx}.default`.
- `NEUTRAL_NORMALIZED_VALUE = 0.5` (L67), `CENTRAL_SIZE_SCORE = 1` (L73).
- `SIZING_RANGES` (L139-145) covers `metricWeight`, `depthDecayK`, `minPx`, `maxPx`.
- `clampSizingSettings()` (L157-~180ish): clamps every sizing number into `SIZING_RANGES` bounds —
  the SAME table used by the settings UI and by `NodeSizer`, so out-of-range values can't reach
  layout/routing.

`src/engine/SettingsSpec.ts`
- `NODE_SIZE_PX_BOUNDS` comment (L106-112): "these numbers BECOME geometry... max 400: 2.5x the
  shipped 160 default — one node past that fills a typical vicinity pane."
- `minPx: { default: 40, ...NODE_SIZE_PX_BOUNDS }` (L185), `maxPx: { default: 160, ...NODE_SIZE_PX_BOUNDS }` (L186).
- `depthDecayK: { default: 1, min: 0, max: 10, step: 0.5 }` (L184).

### 1c. View: width estimate + final node box (no DOM measuring)
`src/view/graphIdentity.ts`
- `nodeDimensionsPx(node)` (L53-58):
  ```
  width: Math.max(node.sizePx, Math.min(NODE_MAX_LABEL_WIDTH_PX, estimateNodeLabelWidthPx(node.title))),
  height: node.sizePx,
  ```
  Height = the engine's `sizePx` verbatim (score-driven square). Width = snug title estimate,
  floored at `sizePx` (never narrower than the square) and capped at `NODE_MAX_LABEL_WIDTH_PX`.
  Comment (L45-52) stresses BOTH the elk-layout input and the rendered RF node MUST use identical
  numbers or layout positions and boxes drift.

`src/view/constants.ts`
- `NODE_TITLE_CHAR_WIDTH_PX = 7` (L48) — char-count heuristic, no DOM measurement (pure/testable).
- `NODE_LABEL_HORIZONTAL_PADDING_PX = 20` (L51).
- `NODE_MAX_LABEL_WIDTH_PX = 250` (L60) — "set a bit above the 160px engine max HEIGHT."
- `estimateNodeLabelWidthPx(title)` (L67-69): `Math.ceil(title.length * NODE_TITLE_CHAR_WIDTH_PX) + NODE_LABEL_HORIZONTAL_PADDING_PX`.
  Truncation model: title text itself is never truncated/ellipsized by this estimate — instead the
  CSS uses `-webkit-line-clamp: 4` so an over-cap title wraps onto up to 4 lines instead of widening
  the node or being cut with `…` (see `src/view/graph-view.css` `.vicinity-graph-node__title`, ~L130-148).
- `SIZE_RELAYOUT_THRESHOLD = 1.0` (constants.ts L20): a node that survives a rebuild only triggers a
  relayout if `sizePx` grew by >100% (doubled); used in `src/view/GraphViewController.ts:207`
  (`decideLayout(this.previousGraph, graph, SIZE_RELAYOUT_THRESHOLD)`), decision logic in
  `src/view/RebuildDecision.ts`. Avoids jarring re-layout on small size deltas.

### 1d. Consumers of `width`/`height`
`src/view/flowMapping.ts`
- L177-178, L188, L193-194: leaf nodes get `nodeDimensionsPx(node)`; folder-group nodes get a fixed
  `UNSIZED_GROUP_PX = 0` placeholder (L159, elk fills it in during layout).
- L315-316: `sizePx`/`sizeScore` are echoed into `FlowNodeData` (used by the React node only for
  data identity/diffing, not by CSS — actual pixel box comes from RF's `width`/`height` node fields
  set from `nodeDimensionsPx`).
- L371-384 area: comment reiterates elk echoes the leaf's input size back, so mapping stays the single
  source; group nodes only get real dimensions once elk sizes them (`elkMapping.ts`).

## 2. Image discovery, node model, and rendering

### 2a. Discovery / classification
`src/shared/FileKinds.ts`
- `IMAGE_EXTENSIONS` (L11): `png, jpg, jpeg, gif, svg, webp`.
- `FileKinds.isImagePath(path)` (L33-35): extension check via `VaultPathFacts.extensionOf`.

`src/adapters/ObsidianLinkProvider.ts`
- `attachmentsOf(file, references)` (referenced L167) builds `FileMetadata.attachments`, each with
  `isImage: FileKinds.isImagePath(target)` (L296, mapped `{ path: asVaultPath(target), isImage }`).
- L224: resolved-reference embed detection also gates on `FileKinds.isImagePath(target)` (used to
  compute `imagePrecedesOutline`, i.e. whether an image embed appears above the first heading).
- L211-216 comment: attachments/`firstImagePath` and `imagePrecedesOutline` both derive from the
  SAME resolved-reference pass (one full pass, not two).

### 2b. Engine node model
`src/engine/types.ts`
- `AttachmentRef` (~L45-48): `{ path, isImage }` — non-node-bearing file referenced by a node.
- `TraversedNode`/`GraphNode` fields (L107-117): `attachments: readonly AttachmentRef[]`,
  `firstImagePath?: VaultPath` (L110-111, "First image among attachments in provider order —
  thumbnail candidate"), `imagePrecedesOutline: boolean` (L113-117, doc-position fact feeding the
  outline-vs-thumbnail decision).
- `NodePreviewPreference` (L160-178): `"auto" | "outline" | "image"` — global 3-way preference; under
  `auto`, document position decides (image wins iff `imagePrecedesOutline`).

`src/engine/VicinityTraversal.ts`
- L157: `const firstImage = metadata.attachments.find((attachment) => attachment.isImage);` — first
  image is simply the first `isImage` attachment in provider order (no size/relevance ranking).
- L158-172 (`assemble()`): builds each `TraversedNode`, sets `firstImagePath: firstImage?.path` (L170)
  and `imagePrecedesOutline: metadata.imagePrecedesOutline` (L171), alongside `attachments: metadata.attachments` (L168).

### 2c. View mapping (engine → React Flow node data)
`src/view/flowMapping.ts`
- `FlowNodeData.firstImagePath?: string` (L72), `imageCount: number` (L73-74, "Total images among
  attachments — the thumbnail's '+N more' badge is imageCount - 1").
- L325-329 (node mapping): `hasImage: node.firstImagePath !== undefined`,
  `imagePrecedesOutline: node.imagePrecedesOutline`, spreads `firstImagePath` only when defined
  (L328), `imageCount: node.attachments.filter(a => a.isImage).length` (L329).
- Preview-slot decision made HERE (not in the component): `src/view/nodePreviewChoice.ts`
  `nodePreviewKind({ preference, outlineEntryCount, hasImage, imagePrecedesOutline })` (L25-30+):
  if `outlineEntryCount === 0` → `hasImage ? "thumbnail" : "none"` (L33-34); otherwise weighs the
  preference/position rule. Result travels as `FlowNodeData.preview` ("thumbnail" | "outline" | "none"),
  so `NoteNode` never re-decides.
- `src/view/badgeText.ts` `extraImageCountText(imageCount)` (L26-28): returns `plusNText(imageCount-1)`
  when `imageCount > 1`, else `null` — the "+N" thumbnail badge text.

### 2d. React component rendering
`src/view/NoteNode.tsx`
- L32-35: `thumbnailUrl = data.firstImagePath === undefined ? null : ui.resourcePath(data.firstImagePath)`
  (lazy — only resolved via `useMemo`, actual `<img>` uses `loading="lazy"`).
- L36: `extraImages = extraImageCountText(data.imageCount)`.
- L91-104: `.vicinity-graph-node__preview-zone` wraps title + thumbnail; thumbnail renders only when
  `data.preview === "thumbnail" && thumbnailUrl !== null` (L95-103):
  ```
  <div className="vicinity-graph-node__thumbnail">
    <img src={thumbnailUrl} alt="" loading="lazy" draggable={false} />
    {extraImages !== null && <span className="vicinity-graph-node__thumbnail-badge">{extraImages}</span>}
  </div>
  ```
  `alt=""` is deliberate — decorative, title already names the note (L97 comment).
- L108: `data.preview === "outline"` renders `<NodeOutline>` as a SIBLING (not nested) of the preview
  zone — outline and thumbnail share one preview slot but never render simultaneously.
- Component-level doc comment (L14-25) states content density adapts via CSS container queries keyed
  on the node's engine-driven height — "no JS measuring."

## 3. CSS governing image display (`src/view/graph-view.css`)

- `.vicinity-graph-node` (L72-93): `--vicinity-graph-thumbnail-height: 56px` custom property (L73);
  `container-type: size` (L75) — enables the container queries below.
- `.vicinity-graph-node__preview-zone` (L128-...): flex column, `min-height: 0` (L133) so it can
  shrink instead of overflowing the node.
- `.vicinity-graph-node__thumbnail` (L149-159):
  ```
  flex: 1 1 var(--vicinity-graph-thumbnail-height);
  min-height: var(--vicinity-graph-thumbnail-height);
  ```
  Comment (L152-154): "Grow into the node's spare vertical space ... so a tall node shows a larger
  preview instead of empty slack."
- `.vicinity-graph-node__thumbnail img` (L160-166):
  ```
  width: 100%;
  height: 100%;
  object-fit: contain;
  ```
  Comment (L164-165): "the node is a square but images are any aspect ratio" — NOTE: this is
  `object-fit: contain`, not `cover`; contradicts the resolved ticket's stated acceptance criterion
  of "fixed-height cropped cover" (see §5) — worth flagging as a possible drift/inconsistency.
- `.vicinity-graph-node__thumbnail-badge` (L168-174) — the "+N" pill, `line-height: 1.6` etc.
- Density/container-query ladder (L229-260ish):
  - `@container (min-height: 72px)` (L232-236) — "two title lines + one chip row."
  - `@container (min-height: 104px)` (L237-...) — additionally fits the fixed-height thumbnail OR
    outline (L237-253): thumbnail visibility keyed here; comment (L246-253) explains the outline and
    thumbnail share one preview slot and only the outline should flex-grow into spare height (not the
    thumbnail, to keep the attachment strip pinned to the node's bottom).
- Title itself: `.vicinity-graph-node__title` truncation/wrap styling around L128-148 (line-height
  1.25, `-webkit-line-clamp: 4` per the `graphIdentity.ts`/plan reference — confirm exact selector
  block near L139-148 if editing).

## 4. Existing tests covering sizing

`src/engine/NodeSizer.test.ts`
- `describe("NodeSizer own-file-size metric")` (L42+): top/bottom normalized scores (L54,59), log1p
  outlier damping (L64), all-zero-byte neutral scoring (L70), single-node graph no-NaN (L79).
- `describe("NodeSizer link-based metrics")` (L85+): backlink-count highest score (L98),
  total-linker-size drives score (L103), outlink-count excludes attachment links (L109).
- `describe("NodeSizer depth-decay metric")` (L117+): k=1 → depth-2 scores `1/(1+2)` (L124), k=4
  steepens decay (L133).
- `describe("NodeSizer hostile sizing settings (sizePx stays finite)")` (L156+): non-central minDepth
  ≥1 guard (L188), Infinity metric weight still yields finite sizePx (L208).
- `describe("DepthDecayMetric is total for an unvetted k")` (L219+): k=-1 vanishing denominator →
  neutral, not Infinity (L234); k=Infinity → neutral, not NaN (L238).
- `describe("NodeSizer metric composition")` (L243+): disabled metric contributes 0 (L254), weighted
  average correctness (L260), no-metric-enabled → neutral (L267), score→pixel endpoint honoring (L272).
- `describe("NodeSizer central sizing")` (L279+): centrals always top score regardless of metrics
  (L280), disconnected pinned central still gets central sizing (L296).
- `describe("NodeSizer node preview preference independence")` (L325+): varying `nodePreviewPreference`
  never changes `sizeScore`/`sizePx` (L342) — guards the "preview flip stays a data-only refresh"
  invariant referenced in the high-level plan (§ "sizePx deliberately does NOT depend on the preference").

`src/view/graphIdentity.test.ts`
- L13+ `describe("nodeDimensionsPx")`: square dims for short title (L16, `{width:160, height:160}`),
  width = `estimateNodeLabelWidthPx` for a medium title (L21), width strictly between `sizePx` and cap
  for a title that needs more room (L25-26), width pins to `NODE_MAX_LABEL_WIDTH_PX` for an
  over-length title (L29-31), height stays `sizePx` regardless (L36, `height: 40`).

`src/engine/sizingSettings.test.ts`, `src/engine/settingsResolvers.test.ts` — settings-cascade tests
touching sizing fields (not read in depth this pass; grep them for `minPx`/`maxPx`/`metrics` cascade
behavior if pursuing the settings-resolution path).

`src/view/sizingInput.test.ts` — parses raw sizing-input strings (empty/whitespace/Infinity/negative
handling) for the settings UI, not the engine formula itself (L4-26).

`src/view/sizingMetrics.ts` / no dedicated test file found for it — it's just the presentation-order
label table (`SIZING_METRICS`, L16-22) shared by `SizingSection` and `VicinityGraphSettingTab`.

## 5. Related ticket

`docs-internal/tickets/ticket-dev-vault-recognizable-thumbnail.md`
- Status: RESOLVED (2026-07-21). Origin: step-05 human smoke run, QA_CHECKLIST §1 thumbnail item.
- Swapped the dev-vault's synthetic placeholder image for two small real (NASA, public-domain)
  JPEGs so a human could actually judge the thumbnail render.
- States the still-to-verify acceptance criteria (L18-19): "fixed-height cropped cover, appears only
  once the node is large enough, no spurious '+N' badge for a single image" — NOTE the CSS today
  (`graph-view.css` L166) uses `object-fit: contain`, not "cropped cover"; this ticket's phrasing may
  predate a later change to `contain`, or the acceptance text is stale — flag for reconciliation if
  redesigning thumbnail sizing/cropping.
- No other ticket under `docs-internal/tickets/` mentions node sizing/pixel dimensions directly; the
  two `ticket-settings-*-baseline-tests-stale-after-*` tickets are about settings-spec/node-spacing
  test staleness, tangential to sizing but not about the sizing formula itself.

## 6. Plan / architecture doc excerpts

`docs-internal/plan/high-level-plan.md`
- L7: "Nodes that carry information. Title, first image thumbnail, attachment icons, folder identity,
  visual emphasis by relevance."
- L18: "Sizing configuration is global only; per-view sizing overrides come later."
- L42: "minDepth = minimum across all roots and directions drives sizing decay and truncation priority."
- L54-61 ("### Sizing" section) — the canonical prose spec of the formula:
  - L58: sizing controls live behind an expandable section.
  - L59: pinned nodes get central-node sizing even when disconnected from MAIN.
  - L60: "The composed score drives a node's height; its width snugly fits the title on one line —
    floored at the score-driven square and capped at `NODE_MAX_LABEL_WIDTH_PX` (~250px)... wraps onto
    the 4 lines the title CSS allows (`-webkit-line-clamp: 4`), rather than ellipsizing. The width is
    a pure char-count estimate in the view mapping (`nodeDimensionsPx`) — no DOM measuring."
  - L61: "Sizing is global-only in V1."
  - L68: view-settings cascade note (sizing is one of the per-view-eligible fields; V1 cascade has
    little to arbitrate since sizing is global today).
- L95-97 (rendering section): "first image as thumbnail (lazy-loaded, fixed height, '+N' badge for
  more)"; the outline/thumbnail shared-slot rule, `auto|outline|image` preference, and the
  "document position still decides" default; L97 explicitly: "`sizePx` deliberately does NOT depend
  on the preference — a flip stays a data-only refresh instead of crossing `SIZE_RELAYOUT_THRESHOLD`."
- L112, L120, L128, L130, L132, L138: phase breakdown mentioning sizing engine (Phase 1), rich
  rendering/thumbnails (Phase 5), expandable sizing controls (Phase 6), image-loading perf pass
  (Phase 7), and per-view sizing overrides as a stated future/out-of-scope item (L138).

`docs-internal/architecture-map.md`
- L40-42: "`FileMetadata.imagePrecedesOutline` says where the note's first image sits [relative to
  the first heading]... resulting outline-vs-image precedence [is] one pure function, honouring the
  global [preference]." (Confirms the fact-vs-decision split: adapter reports the fact, view decides.)
- No dedicated "sizing" section beyond this; the architecture map is otherwise organized around
  module boundaries (engine purity, LinkProvider seam) rather than the sizing formula itself — the
  high-level-plan.md "### Sizing" section (above) is the authoritative narrative doc for the formula.

## Key files quick-reference

- Formula (score→px): `src/engine/NodeSizer.ts:57`
- Bounds/defaults: `src/engine/SettingsSpec.ts:106-112,185-186`, `src/engine/constants.ts:24-26,67,73,139-145`
- Width estimate/cap: `src/view/graphIdentity.ts:53-58`, `src/view/constants.ts:48,51,60,67-69`
- Relayout threshold: `src/view/constants.ts:20`, `src/view/GraphViewController.ts:207`
- Image discovery: `src/shared/FileKinds.ts:11,33-35`, `src/adapters/ObsidianLinkProvider.ts:167,211-224,296`
- Node model fields: `src/engine/types.ts:107-117,160-178`, `src/engine/VicinityTraversal.ts:157-172`
- View mapping: `src/view/flowMapping.ts:72-74,325-329`, `src/view/nodePreviewChoice.ts:25-34`, `src/view/badgeText.ts:26-28`
- Component: `src/view/NoteNode.tsx:32-36,91-104`
- CSS: `src/view/graph-view.css:72-93,128-166,229-260`
