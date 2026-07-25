# Exploration: node content decision paths (outline vs image vs excerpt vs none)

Scope: map the EXACT current code that decides what a node's content-preview
slot renders. No implementation proposed. All refs are `file:line` as of the
current working tree (commit under `main`, `ObsidianLinkProvider.ts` last
touched 2026-07-24 per `ls -la`).

## 1. Where content is extracted (adapter) and the data shapes

- **Data extraction happens in one adapter method**:
  `ObsidianLinkProvider.getFileMetadata()` —
  `src/adapters/ObsidianLinkProvider.ts:117-136`. One `getFileCache` read per
  file feeds title, outline and outgoing-reference ordering together (comment
  at `ObsidianLinkProvider.ts:122-126`).
  - `outline` ← `this.outlineOf(file, cache, references)` (`:134`)
  - `attachments` ← `this.attachmentsOf(file, references)` (`:133`), which is
    ALL outgoing references to non-node-bearing files, image or not
    (`AttachmentRef.isImage`), in reference order.
  - No separate "excerpt/text" extraction exists anywhere in the codebase —
    grep for "excerpt" across `src/` returns nothing. The only body content
    surfaced to a node is the heading outline (or nothing).

- **Reference ordering** — `src/adapters/ReferenceOrder.ts`:
  `ReferenceOrder.orderedReferences(cache)` (`:39-47`) merges frontmatter links
  (offset sentinel `FRONTMATTER_REFERENCE_OFFSET = -1`, `:19`) with body
  `links`+`embeds` sorted ascending by `position.start.offset`. This is the
  ONLY place that knows "where in the document" a reference sits, and it is
  shared between the outline's image rule and outgoing-link resolution
  (comment `ReferenceOrder.ts:21-27`).

- **Types/shapes (engine, pure, branded)** — `src/engine/types.ts`:
  - `VaultPath` brand: `:12`
  - `AttachmentRef { path: VaultPath; isImage: boolean }`: `:45-47`
  - `OutlineEntry { rawText: string; level: number }`: `:53-64` — `rawText` is
    RAW heading text (inline markdown intact); never render directly (comment
    `:56-61`).
  - `GraphNode.outline: readonly OutlineEntry[]` (`:110`), `GraphNode.firstImagePath?: VaultPath`
    (`:111`, "first image among attachments in provider order").
  - `FileMetadata` (adapter↔engine seam) — `src/engine/LinkProvider.ts:9-56`
    (not fully quoted here; carries `outline`, `attachments`, etc., mirrored
    by `ObsidianLinkProvider.getFileMetadata`'s return object).
  - `ViewSettings.outlineMaxDepth: number` — `src/engine/types.ts:253`
    ("view-layer knob: the engine carries it, the view's mapping applies it").

- **Traversal echo (engine)** — `src/engine/VicinityTraversal.ts`:
  - `TraversedNode.outline` / `.firstImagePath`: `:35-36`.
  - Assembly, per node: `:151-169` —
    `const firstImage = metadata.attachments.find(a => a.isImage);` (`:157`,
    text loosely paraphrased — see exact line) then
    `outline: metadata.outline, firstImagePath: firstImage?.path` (`:167-168`).
    **Trap**: `firstImagePath` is derived independently from `attachments`
    (always the true first image, regardless of the image-vs-outline rule);
    `outline` is whatever the adapter already decided (possibly `[]`).

- **View mapping (engine GraphNode → React Flow node data)** —
  `src/view/flowMapping.ts`:
  - `FlowNodeData.outline` / `.firstImagePath`: `:63,66` (comment `:59-64`:
    "Empty when the note offers none (including when its image wins — the
    adapter decided that)").
  - `toFlowNodeData()` — `:290-311`: applies `outlineMaxDepth` filter then
    `OUTLINE_RENDER_LIMIT` slice (`:304-306`): `node.outline.filter(entry =>
    entry.level <= outlineMaxDepth).slice(0, OUTLINE_RENDER_LIMIT)`. Comment
    at `:302-303`: "Filter THEN slice: a depth-2 view of a note with 60 deep
    headings must still find its shallow ones."
    `OUTLINE_RENDER_LIMIT = 40` — `src/view/constants.ts:68`.

## 2. The image-before-outline precedence rule — WHERE and HOW

**It lives entirely in the adapter, at metadata-extraction time — NOT in the
engine, NOT in the view, NOT in the node component.** By the time a
`GraphNode`/`FlowNodeData` exists, the decision is already baked in and
irreversible: the discarded headings are never even materialized downstream.

- **Function**: `ObsidianLinkProvider.outlineOf(file, cache, references)` —
  `src/adapters/ObsidianLinkProvider.ts:145-166`.
  ```
  145  private outlineOf(
  146      file: VaultFilePort,
  147      cache: CachedMetadataPort | null,
  148      references: readonly OrderedReference[] | null,
  149  ): readonly OutlineEntry[] {
  150      if (!FileKinds.isOutlineBearingPath(file.path) || cache === null) {
  151          return [];
  152      }
  153      const headings = cache.headings ?? [];
  154      const firstHeading = headings[0];
  155      if (firstHeading === undefined) {
  156          return [];
  157      }
  158      const firstHeadingOffset = firstHeading.position.start.offset;
  159      if (references !== null && this.referencesImageAbove(firstHeadingOffset, file.path, references)) {
  160          return []; // The image wins.
  161      }
  162      return headings.map((heading) => ({ rawText: heading.heading, level: heading.level }));
  163  }
  ```
  (line numbers approximate ±1 from the read; see file directly — anchor
  comment "The image wins." sits at `:162`.)

- **Helper**: `ObsidianLinkProvider.referencesImageAbove(offsetLimit, path, references)` —
  `:179-190`. Scans `references` (already ascending by offset) and returns
  `true` on the first RESOLVED reference below `offsetLimit` whose resolved
  target `FileKinds.isImagePath`. Deliberately resolves only references above
  the limit — "an unresolvable `![[missing.png]]` cannot suppress the outline
  while producing no thumbnail" (`:174-177`).

- **Inputs to the rule**: `cache.headings[0].position.start.offset` (first
  heading's character offset) vs. the offset of the first RESOLVED image
  reference (via `ReferenceOrder.orderedReferences` +
  `metadataCache.getFirstLinkpathDest`). Frontmatter images always win
  (`FRONTMATTER_REFERENCE_OFFSET = -1` < any heading offset).

- **Consequence for the view layer**: `nodePreviewChoice.ts` (below) never
  re-derives this rule — its own doc-comment says so explicitly.

- **Downstream "which slot wins" (view)** —
  `src/view/nodePreviewChoice.ts:20-25`:
  ```ts
  export function nodePreviewKind({ outlineEntryCount, hasImage }: NodePreviewInput): NodePreviewKind {
      if (outlineEntryCount > 0) {
          return "outline";
      }
      return hasImage ? "thumbnail" : "none";
  }
  ```
  Doc-comment (`:14-19`): "The outline wins when it has entries — the ADAPTER
  already applied the image-vs-outline rule (an image before the first
  heading yields no entries at all), so entries reaching the view mean the
  outline won." I.e. this function's `outlineEntryCount > 0` branch is
  logically dead code for "image wins" notes — it can never see entries for
  those, because the adapter deleted them upstream.
  - Consumed at `src/view/NoteNode.tsx:36-39` (`preview = nodePreviewKind({
    outlineEntryCount: data.outline.length, hasImage: data.firstImagePath !== undefined })`).

## 3. The "fits" logic (does the outline/thumbnail get room to render)

There is **no JS/engine "does the outline fit" computation**. "Fits" is
implemented purely as a CSS container-query density ladder keyed off the
node's engine-driven pixel height (`sizePx`, 40–160px per `SettingsSpec`
sizing bounds) — no JS measuring (comment `src/view/NoteNode.tsx:19-20`:
"content density adapts to the node's engine-driven height via CSS container
queries — no JS measuring").

- **Node box height** = `GraphNode.sizePx` verbatim —
  `src/view/graphIdentity.ts:53-59` (`nodeDimensionsPx`): `height: node.sizePx`.
  `sizePx` itself comes from the engine's sizing pipeline (`NodeSizer.ts`,
  not detailed here — out of scope, no outline/image interaction).

- **CSS container**: `.vicinity-graph-node { container-type: size; ... }` —
  `src/view/graph-view.css:72-92`. Comment (`:65-71`): "content density
  adapts to the engine-driven height (40–160px) purely in CSS — small nodes
  show the title only, medium ones add the attachment strip, large ones add
  the thumbnail."

- **Density thresholds** — `src/view/graph-view.css:220-256`:
  - `.vicinity-graph-outline { display: none; }` by default (`:225-227`,
    deliberately co-located with the reveal rule — see comment `:220-224`
    about stylesheet-concatenation-order bugs from a past incident).
  - `@container (min-height: 72px)` (`:232-236`): reveals the attachment
    icon strip only.
  - `@container (min-height: 104px)` (`:237-256`): reveals
    `.vicinity-graph-node__thumbnail` (`:238-240`) AND `.vicinity-graph-outline`
    (`:243-245`) — mutually exclusive via `data-preview` (only one is ever
    present in the DOM per node, see §4). Also collapses the title zone's
    flex-grow when `data-preview="outline"` so the outline (not the title
    zone) absorbs spare height (`:253-255`).
  - Comment `:229-231`: "72px ≈ two title lines + one chip row; 104px
    additionally fits the fixed-height thumbnail OR the outline that
    replaces it (mutually exclusive — same slot)."

- **If the outline's OWN content overflows** its slot (more headings than
  vertical room even above 104px): it scrolls, it does not get truncated by
  JS. `src/view/node-outline.css:17-30`: `.vicinity-graph-outline { flex: 1 1
  auto; min-height: 0; overflow-y: auto; ... scrollbar-color: transparent
  transparent; }` (hover reveals the thumb, `:31-33`). Per-entry ellipsis is
  separate CSS on each row: `.vicinity-graph-outline__entry { white-space:
  nowrap; overflow: hidden; text-overflow: ellipsis; }` (`:52-71`).

- **Two JS-side caps exist but are not "fits" logic** — they bound how much
  data REACHES the DOM, independent of node height:
  1. `outlineMaxDepth` (1–6, default 2) — user setting, filters by heading
     level, applied in `flowMapping.ts:304`.
  2. `OUTLINE_RENDER_LIMIT = 40` — hard render cap, `flowMapping.ts:305-306`,
     `src/view/constants.ts:68`.

- **README's own framing** (`README.md:138-146`) matches this exactly: "A
  node tall enough to have room shows one preview... The outline is a nested
  list capped by the Outline depth setting. It scrolls when it does not fit
  (the scrollbar appears on hover)." I.e. "fits" in product terms = the
  104px container-query gate; overflow WITHIN that gate scrolls, it is never
  computed/truncated in JS.

## 4. React node component(s) and the engine → view data flow

- **`src/view/NoteNode.tsx`** — the note node component (`NoteNode`,
  `:26-123`). Computes `preview = nodePreviewKind(...)` once (`:36-39`) and
  stamps it as `data-preview={preview}` on the root div (`:88`) — the single
  source the CSS density ladder keys off for outline-vs-thumbnail exclusivity.
  Renders:
  - Thumbnail block only `{preview === "thumbnail" && thumbnailUrl !== null && (...)}`
    (`:99-107`), inside `.vicinity-graph-node__preview-zone` (title + thumbnail
    share this zone, which also arms Obsidian's native hover preview,
    `:66-81`).
  - `{preview === "outline" && <NodeOutline notePath={data.path} entries={data.outline} />}`
    (`:112`) — a SIBLING of the preview zone, not nested inside it (comment
    `:109-111`: outline rows are clickable and must stay a hover dead zone for
    the native preview).

- **`src/view/NodeOutline.tsx`** — owns ALL outline-only rendering: tree
  build (`buildOutlineTree`, `src/view/outlineTree.ts`), label stripping
  (`outlineEntryLabel`, `src/view/outlineEntryLabel.ts`), the scroll
  container, click-to-open-at-heading (`useNoteOpen().openNote(...)`,
  `:82-89`). Explicitly kept separate from `NoteNode` per architecture-map's
  "Key seams" note: `NodeOutline.tsx` owns in-node outline rendering — the
  tree/label/markup decisions and `node-outline.css`.
  - `NodeOutlineProps.entries` doc (`:25-30`): "Depth-filtered, budget-capped
    entries in DOCUMENT ORDER, with RAW heading text" — i.e. `NodeOutline`
    receives an already-fully-decided flat array; it does zero
    precedence/fit logic itself.

- **Full flow, engine → view, for content**:
  1. `ObsidianLinkProvider.getFileMetadata` (adapter) decides outline-vs-image
     per note, populates `FileMetadata.{outline, attachments}`
     (`src/adapters/ObsidianLinkProvider.ts:117-166`).
  2. `VicinityTraversal.assemble` (engine, pure) echoes `outline` and derives
     `firstImagePath` from `attachments` onto `TraversedNode`
     (`src/engine/VicinityTraversal.ts:151-169`).
  3. `VicinityEngine` (not detailed; pure pass-through, see
     `VicinityEngine.test.ts:296-311` "outline pass-through") copies
     `TraversedNode` → `GraphNode` — `outline`/`firstImagePath` untouched.
  4. `vicinityGraphToFlow` → `toFlowNodeData` (view, pure) applies
     `outlineMaxDepth` filter + `OUTLINE_RENDER_LIMIT` slice, maps
     `firstImagePath` straight through (`src/view/flowMapping.ts:290-311`).
  5. `NoteNode` (React, `src/view/NoteNode.tsx`) calls `nodePreviewKind`
     (`src/view/nodePreviewChoice.ts`) to choose the slot, renders
     accordingly; `NodeOutline` renders the outline's internals.
  6. CSS (`graph-view.css` + `node-outline.css`) gates VISIBILITY by node
     height via container queries — independent of steps 1–5.

## 5. Existing tests capturing this behavior (must not break)

- **`src/adapters/ObsidianLinkProvider.test.ts`** — `describe("ObsidianLinkProvider note outline", ...)` (`:274` onward). Key cases:
  - `:354` "WHEN the note's first image is embedded BEFORE the first heading
    THEN the outline is empty (the image wins)" — the CORE precedence
    assertion this feature must override/extend.
  - `:368` "...AFTER the first heading THEN the outline carries the headings".
  - `:382` "...FRONTMATTER link THEN the outline is empty" (frontmatter always
    above all headings).
  - `:396` "...image and no headings THEN the outline is empty".
  - `:408` "...NON-image attachment precedes...but the first image follows...
    THEN the outline carries the headings" (non-image attachments never
    trigger the rule).
  - `:286,308,312,323,328,336,340,426` — baseline outline-extraction and
    attachment-ordering cases (canvas/excalidraw/no-cache/no-headings/etc.),
    unrelated to the image rule but sharing the same method.

- **`src/view/nodePreviewChoice.test.ts`** (all 3 cases, `:5-17`) — pins the
  view-layer slot-selection contract: entries>0 → outline; else image → 
  thumbnail; else none. Any override setting that lets the outline win over
  an available image (or vice versa) when both exist must still satisfy this
  contract's INPUT shape (`outlineEntryCount`, `hasImage`), which — per the
  current design — depends on the adapter having produced non-empty entries
  in the first place. If the override is implemented at the view layer, this
  function likely needs new inputs/logic; these three tests describe its
  CURRENT (pre-feature) behavior exactly.

- **`src/view/flowMapping.test.ts`**:
  - `describe("vicinityGraphToFlow outline mapping", ...)` (`:458` onward):
    depth filter (`:474-483`), render limit (`:485-491`), filter-then-slice
    ordering (`:493-502`), empty-outline pass-through (`:505-506`), and
    critically `:509-520` "WHEN a node has BOTH an outline and a first image
    THEN firstImagePath is still mapped" — confirms `firstImagePath` mapping
    is INDEPENDENT of outline presence today (this is the seam a precedence
    override would need).
  - `:133-143` — `imageCount`/`firstImagePath` basic mapping.
  - `:60-61,363-364` — fixture nodes with empty outline/0 imageCount baseline.

- **`src/engine/VicinityTraversal.test.ts`**:
  - `:221,224-230` — `firstImagePath` presence/absence from `attachments`.
  - `describe("VicinityTraversal outline echo", ...)` `:368-383` — outline is
    echoed verbatim from `FileMetadata.outline` onto `TraversedNode.outline`
    (no re-derivation of the image rule in the engine — confirms trap in §2).

- **`src/engine/VicinityEngine.test.ts`**:
  - `:100` — `firstImagePath` reaches `GraphNode`.
  - `describe("VicinityEngine outline pass-through", ...)` `:296-311` —
    engine copies `outline` through untouched; comment `:299` explicitly:
    "the spread-through guard: GraphNode gets `outline` only because
    VicinityEngine copies the traversed node."

- **No component-level test exists for `NoteNode.tsx` or `NodeOutline.tsx`**
  (no `NoteNode.test.tsx` / `NodeOutline.test.tsx` in the repo) — the
  precedence behavior at the React-rendering level is currently ONLY tested
  indirectly via `nodePreviewChoice.test.ts` (pure function) plus the CSS
  (untested by `npm test`, which is vitest/jsdom, not visual).

## 6. `docs-internal/plan/high-level-plan.md` — node content / precedence

Direct quotes (this file is the design source of truth per `CLAUDE.md`):

> Line 7: "**Nodes that carry information.** Title, first image thumbnail,
> attachment icons, folder identity, visual emphasis by relevance. A node
> should tell you what the note is before you open it."

> Line 92: "Custom node component: title, **first image as thumbnail**
> (lazy-loaded, fixed height, "+N" badge for more), **icon strip per
> attachment extension with counts**... Everything past the first image loads
> lazily; rely on React Flow viewport culling."

> Line 93 (the load-bearing paragraph): "**In-node markdown outline** shares
> the thumbnail's preview slot: a node above the 104px container-query
> threshold shows EITHER its heading outline OR its first image, decided by
> document position (an image before the first heading wins — the documented
> "show the picture" escape hatch). Rendered as a real nested list, capped by
> the global **Outline depth** setting (1–6, default 2) plus a render budget,
> scrollable with a hover-only scrollbar and per-entry ellipsis. Owned by a
> dedicated `NodeOutline` component so the UI can be iterated independently of
> node rendering."

> Line 97: "...hover fires Obsidian's `hover-link` for native page previews —
> scoped to the note's content zone (title + thumbnail), so the interactive
> tiles below (attachment chips, pin button) stay a hover dead zone..."

No other section of the plan revisits this precedence; it is stated once,
at the phase-5 (rendering) design level, and treated as final/settled
(matches the "documented escape hatch" framing repeated in the adapter,
settings tab, and README).

**README.md** (user-facing; not `docs-internal` but directly describes this
behavior and should stay consistent with any change):
- `:64-65` "Outline depth — how many markdown heading levels a node's outline
  shows (1–6, default 2: sections plus subsections, which is what fits a
  node). See Node contents below. There is no on/off switch."
- `:137-146`: "### Node contents / A node tall enough to have room shows
  **one** preview: either the note's **heading outline** or its **first
  image**, never both. — **Which one you get is decided by document
  position.** If the note's first image sits **before** its first heading,
  the node shows the **image**; otherwise it shows the **outline**. That is
  the escape hatch — move the image above the first heading to say "show the
  picture for this note". — The outline is a **nested list** capped by the
  *Outline depth* setting. It scrolls when it does not fit..."

**Settings tab source doc-comment** (not the plan, but states the same
design intent as a deliberate constraint) —
`src/view/VicinityGraphSettingTab.ts:313-319`: "No enable/disable toggle by
design (CLARIFICATION Q2): a note shows its image instead of its outline by
putting that image before the first heading." This is the exact sentence the
new pill/segmented setting is meant to supersede/extend — it currently reads
as a closed design decision, not a placeholder.

## Surprises / traps for whoever implements the feature

1. **The rule deletes data, it doesn't just deprioritize it.** When the image
   wins, `ObsidianLinkProvider.outlineOf` returns `[]` BEFORE ever mapping
   `headings` to `OutlineEntry[]` (`ObsidianLinkProvider.ts:159-161`). The
   actual heading text/levels are never computed or stored anywhere
   downstream for that note. A per-node "show outline anyway" override would
   need the adapter to always compute+return the outline, and push the
   precedence decision to the engine/view (i.e. move logic, not just gate it).
   This also affects `FakeLinkProvider.ts` (`:19-23`) whose fixture spec
   documents that IT does not re-derive the rule either — fixtures currently
   assume the caller already decided.

2. **`firstImagePath` is unconditional.** It is derived straight from
   `metadata.attachments` (always fully resolved) independent of the outline
   rule (`VicinityTraversal.ts:157,168`; confirmed by
   `flowMapping.test.ts:509-520` "outline AND image, firstImagePath still
   mapped"). So the "image" side of any new setting already has everything it
   needs at the view layer; only the "outline" side is currently starved of
   data when the image won upstream.

3. **`nodePreviewKind`'s `outlineEntryCount > 0` branch is currently dead for
   "image-wins" notes** — by construction, per its own doc-comment. Any
   change that makes the outline available even when an image precedes it
   will, for the first time, make this branch reachable in that case — which
   is exactly the seam the new setting would use, but it means the function's
   existing tests (`nodePreviewChoice.test.ts`) describe a narrower reality
   than the code will need to support afterward.

4. **"Fits" is not computed — it's a static CSS breakpoint (104px).** There
   is no JS notion of "does the outline fit given N entries." A precedence
   setting that says "show outline when it fits" cannot reuse any existing
   fits-computation; it would need to either reuse the 104px container-query
   threshold as its own definition of "fits" (simplest, matches existing
   product framing in README `:138`) or invent a new measurement. Nothing in
   the current code measures actual rendered outline height vs. available
   node height.

5. **The setting name space (`ViewSettings`) already has the right shape for
   a new field**: `outlineMaxDepth` is a plain field resolved by
   `ViewSettingsResolver.resolve` (`src/engine/ViewSettingsResolver.ts:31-54`)
   through the MAIN-override → pinned-override → global cascade, each field
   independent (absence = inherit). A "content preference" field would slot
   in the same way — but it currently has NO ANALOGUE for something that
   needs adapter-level cooperation (unlike `outlineMaxDepth`, which is pure
   view-layer filtering of already-complete data).

6. **No React component tests exist for `NoteNode`/`NodeOutline`** — behavior
   changes here are currently verifiable only via the pure functions
   (`nodePreviewChoice`, `flowMapping`, `ObsidianLinkProvider`/`VicinityTraversal`/`VicinityEngine`
   outline/image tests) plus CSS, which vitest does not exercise. Any new
   precedence logic should keep living in a pure, unit-testable function per
   repo convention (`CLAUDE.md`: "Pure engine/persistence logic is
   fixture-tested via `Fake*` providers — keep correctness in the tested
   core, adapters thin").

7. **Settings-tab doc-comment currently asserts "no enable/disable toggle by
   design"** (`VicinityGraphSettingTab.ts:313-319`) and the README calls the
   image-before-heading behavior "the escape hatch" — i.e. existing docs
   describe the CURRENT behavior as an intentional, closed design point, not
   a stopgap. Any new setting/docs need to reconcile with (or explicitly
   supersede) this language, not silently contradict it.
