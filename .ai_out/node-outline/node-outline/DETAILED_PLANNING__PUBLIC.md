# DETAILED PLAN — Markdown heading outline inside graph nodes

Feature: `node-outline` · Branch: `node-outline` · Author: PLANNER
Inputs: `CLARIFICATION__PUBLIC.md` (binding), `EXPLORATION_PUBLIC*.md`, live source read.

---

## 1. Problem understanding

Render a note's Markdown heading outline **inside** its graph node, in the same
visual slot the first-image thumbnail occupies today, for nodes that are tall
enough to show it. Which of the two the node shows is decided by document
position: an image **before** the first heading wins (that is the human's
documented "show the picture" escape hatch); otherwise the outline wins.
Entries indent by heading level, ellipsise horizontally, scroll vertically with
a hover-only scrollbar, and open the note **at that heading** when clicked. A
global slider (1–6, default 2) caps how many heading levels render.

### Constraints taken as binding

1. `src/engine/` stays obsidian-free (import guard). Headings enter through the
   `LinkProvider` seam as engine-owned POJOs.
2. "Enough space" is a **CSS container query**, never JS measurement.
3. The node's mapping-time `width`/`height` must not change — React Flow
   culling and `fitView` depend on them (`VicinityGraphFlow.tsx:145-160`).
4. No RTL/jsdom in this repo → every decision (eligibility, image-vs-outline,
   depth filter, click target) lives in a **pure module with colocated tests**;
   DOM behaviour is Playwright-only.
5. Excalidraw (`*.excalidraw.md`) stays a graph **node**, carries **no** outline.
   Canvas has no headings at all.
6. No persisted-shape version bump (outline is recomputed per rebuild); the new
   **setting** does need parse wiring.

### Assumptions (stated, not hidden)

- Obsidian's `CachedMetadata.headings` is in document order (same assumption
  `ReferenceOrder` already makes about link offsets). We never re-sort it — if
  it were unordered the rendered outline would be wrong regardless of sorting.
- `HeadingCache.position.start.offset` and `ReferenceCache.position.start.offset`
  are the same coordinate space (byte/char offset into the file). They are.

---

## 2. Architecture — the data path

```
metadataCache.getFileCache(file).headings          (Obsidian, adapter-only)
      │  HeadingPort  (new, structural slice)
      ▼
ObsidianLinkProvider.outlineOf()                    ← eligibility + image-vs-outline rule
      │  FileMetadata.outline : readonly OutlineEntry[]        (engine POJO)
      ▼
VicinityTraversal.assemble → TraversedNode.outline
      │  (VicinityEngine already does `{...node}` → GraphNode.outline is free)
      ▼
GraphNode.outline
      │  flowMapping.toFlowNodeData: filter(level ≤ outlineMaxDepth).slice(0, LIMIT)
      ▼
FlowNodeData.outline  ──▶  NoteNode.tsx  ──▶  <ul class="…__outline">
                                   │ click → NoteOpenContext.openNote(path, {newTab, heading})
                                   ▼
                          GraphViewController.openNode → NoteNavigatorPort
                                   ▼
                          ObsidianNoteNavigator.workspace.openLinkText("path#Heading", …)
```

Nothing new is persisted. One new setting (`ViewSettings.outlineMaxDepth`)
rides the existing `globalView` object end-to-end.

---

## 3. Design decisions (with rejected alternatives)

### D1 — Data shape & flow

**Engine type** (`src/engine/types.ts`, next to `AttachmentRef`):

```ts
/** One markdown heading rendered inside a node's outline. Engine-owned POJO
 *  (no obsidian `HeadingCache` leakage — see the import guard). */
export interface OutlineEntry {
	/** Heading text as parsed by Obsidian (no leading `#`, no trailing spaces). */
	readonly text: string;
	/** Markdown heading level, 1–6. Drives BOTH the depth filter and the render indent. */
	readonly level: number;
}
```

No branded types: `text` is display copy (not an identity key) and `level` is a
plain small integer with a finite domain — branding either would be ceremony
without a compile-time bug to catch. No `line`/`offset` field: see D6, the click
target is the heading TEXT, so a position field would be dead weight and a
staleness trap.

**Port field** (`src/engine/LinkProvider.ts`, `FileMetadata`):

```ts
/**
 * Heading outline offered as this note's in-node preview, in document order.
 * EMPTY when the file has no headings, is not outline-bearing (canvas,
 * `*.excalidraw.md`), or when its FIRST IMAGE appears BEFORE its first heading
 * — the human's documented "show the picture instead" escape hatch. Provider
 * -owned exactly like `attachments`: only the adapter can see document offsets.
 */
readonly outline: readonly OutlineEntry[];
```

**Required, not optional**, mirroring `attachments`: an always-present array
means no `undefined` branches in three layers, and `[]` already means "no
outline". Immutability via `readonly` + `readonly T[]` matches every sibling.

Then `TraversedNode.outline` (echoed in `assemble()` alongside `attachments`)
and `GraphNode.outline`. `VicinityEngine` builds nodes with `{...node, …}`, so
`GraphNode` gets it for free once the type declares it.

**`CachedMetadataPort` widening** (`src/adapters/obsidianPorts.ts`) — shaped
exactly like the existing `ReferencePort` so real `CachedMetadata` still
satisfies it structurally:

```ts
/** Structural slice of a `HeadingCache`. */
export interface HeadingPort {
	readonly heading: string;
	readonly level: number;
	readonly position: { readonly start: { readonly offset: number } };
}
// on CachedMetadataPort:
readonly headings?: readonly HeadingPort[];
```

`offset` only — no `line`. D6 removes the need for line numbers, and declaring a
field we do not consume would be a lie about the port's surface.

**Array vs flattened primitive on `FlowNodeData`: ARRAY.** Justification against
the memo/diff contract:

- `decideLayout` (`GraphStructureDiff.ts:24-48`) compares **node id sets, edge id
  sets, `groupByFolder`, the `forceLayout` fields, and `sizePx` growth**. It
  never touches node data → an outline array can never flip a layout decision.
  (Step 5 adds a test that pins this.)
- `decideActiveFileRebuild` (`RebuildDecision.ts`) is path-only. Unaffected.
- `React.memo(NoteNode)` already re-renders every node on every rebuild because
  `toFlowNodeData` mints a fresh `data` object — an array field changes nothing.
- The contract pinned at `flowMapping.test.ts:412-447` is specifically about a
  **primitive `useMemo` key for a resource URL** (`firstImagePath` →
  `ui.resourcePath` → `<img src>`, "no refetch storm"). The outline resolves no
  resource and needs no `useMemo`; that contract is untouched (and its tests
  keep passing unchanged).
- **Rejected — flattening to a delimited string**: it would require an encoder
  and a decoder (duplicated knowledge, DRY violation), pick a delimiter that
  heading text can legally contain (correctness hazard), and buy nothing since
  nothing deep-compares node data. That is a hack, so it is out.

### D2 — Eligibility rule (pure, named, unit-tested)

Lives in `src/shared/FileKinds.ts` — already the single home of file-kind
classification, already pure and shared by the engine's fake and the real
adapter:

```ts
const MARKDOWN_EXTENSION = "md";
/** Excalidraw drawings are `*.excalidraw.md`: markdown to Obsidian, but the body is a
 *  generated drawing payload, not prose. They stay graph NODES (CLARIFICATION Q4) and
 *  are excluded from outline PARSING only. */
const EXCALIDRAW_SUFFIX = ".excalidraw.md";

static isMarkdownPath(path: string): boolean
/** Files whose headings may be rendered as a node outline: markdown, minus excalidraw. */
static isOutlineBearingPath(path: string): boolean
```

DRY cleanup in the same step: `ObsidianLinkProvider` deletes its local
`MARKDOWN_EXTENSION` and uses `FileKinds.isMarkdownPath(file.path)` at its two
existing sites (`frontmatterTitleOf`, `resolvedOutgoingPaths`). `CANVAS_EXTENSION`
stays local (canvas capability is adapter-specific knowledge).

Rejected: a `kind` discriminant on `GraphNode`. Nothing else in the codebase
needs it; adding one to answer a single predicate is over-engineering.

### D3 — Image-vs-outline choice (where the position comparison happens)

**The adapter decides, and encodes the decision by returning an EMPTY outline.**
Rationale: only the adapter can see document offsets; `FileMetadata` is
explicitly documented as "ADAPTER truth… the provider owns eligibility and
attachment rules"; and this keeps **one** field travelling three layers instead
of two.

Mechanics, minimal and honest:

1. `ReferenceOrder` gains the offsets it already computes and currently throws
   away — a single ordering truth, no second implementation:

```ts
/** A resolved-or-not reference in document order. Frontmatter links carry
 *  FRONTMATTER_REFERENCE_OFFSET: they sit above ALL body content. */
export interface OrderedReference { readonly link: string; readonly offset: number; }
export const FRONTMATTER_REFERENCE_OFFSET = -1;

static orderedReferences(cache): readonly OrderedReference[]
static orderedLinkTexts(cache): readonly string[]   // = orderedReferences(...).map(r => r.link)
```

2. `ObsidianLinkProvider` extracts the markdown branch of `resolvedOutgoingPaths`
   into `private orderedMarkdownReferences(path, cache): readonly ResolvedReference[]`
   (`{ path, offset }`), so **both** the existing dedup-to-paths call **and** the
   new first-image-offset lookup read one resolution pass. `resolvedOutgoingPaths`
   becomes `dedupe(orderedMarkdownReferences(...).map(r => r.path))` for markdown;
   canvas branches unchanged.
3. `outlineOf(file, cache)` returns `[]` unless `isOutlineBearingPath`, then
   compares `firstImageOffset` (first reference whose target `FileKinds.isImagePath`)
   with `headings[0].position.start.offset`.
4. `getFileMetadata` reads `getFileCache(file)` **once** and passes it to
   `frontmatterTitleOf` and `outlineOf` (removes a redundant third read).

Case table (all specified, all tested):

| Note has | Result |
|---|---|
| headings, no image | outline |
| headings, first image AFTER first heading | outline |
| headings, first image BEFORE first heading | image (outline `[]`) |
| headings, image linked in **frontmatter** | image — frontmatter is above all body content (`offset = -1`) |
| image, no headings | image (outline `[]`) |
| neither | title only (today's behaviour, unchanged) |
| non-image attachment before the first heading, first IMAGE after it | outline — the rule is about the first **image**, not the first attachment |
| depth filter removes every entry (view stage) | falls back to the image, else title only — see D4 |

**Rejected — `AttachmentRef.offset`**: bloats a type used by every attachment of
every visited file to answer one question about one of them, and leaks document
positions into the engine for no consumer. **Rejected — a second
`firstImagePrecedesFirstHeading: boolean` field on `FileMetadata`**: doubles the
plumbing (2 fields × 3 layers) and pushes a fact the adapter fully owns into the
view for re-combination.

### D4 — "Enough space" gating (CSS container queries only)

**Reuse the existing 104px breakpoint** — the one that already reveals the
thumbnail. The outline occupies the *same* preview slot and is mutually
exclusive with the thumbnail, so introducing a second threshold would create a
second LOD concept for one slot.

```css
.vicinity-graph-node__outline { display: none; }          /* base */
@container (min-height: 104px) {                          /* existing block */
	.vicinity-graph-node__thumbnail { display: block; }
	.vicinity-graph-node__outline   { display: block; }
}
```

Composition with the other regions, at the two ends of the size range
(padding `--size-4-2` ×2 = 16px, title ≈ 15px/line, chip row ≈ 20px,
entry line-height ≈ 15px at `--font-smallest`):

- 104px node with an attachment strip → ≈ 45px of slack → **≈ 3 entries**.
- 160px node (engine max) with a strip → ≈ 100px → **≈ 6 entries**.
- Below 104px: title only (+ strip ≥72px) — exactly today's ladder.

The outline uses `flex: 1 1 auto; min-height: 0` (it takes the slack and shrinks
instead of pushing the attachment strip out of the box) — deliberately **not**
the thumbnail's `min-height: 56px`, which can overflow a 104px node. When the
outline renders, `.vicinity-graph-node[data-preview="outline"] .…__preview-zone`
drops to `flex: 0 0 auto` so the title zone does not claim half the slack.

Rejected: a lower dedicated breakpoint (e.g. 88px) — a one-entry scrolling list
reads as broken. Rejected: `ResizeObserver`/`sizePx` JS branching — banned by
the node's stated design (`NoteNode.tsx:18`, `graph-view.css:66-70`).

### D5 — Overflow behaviour

**(a) Vertical — hover-only scrollbar, always scrollable.** Style the *thumb*,
not the *track width*, so nothing reflows on hover:

```css
.vicinity-graph-node__outline {
	overflow-y: auto;
	overflow-x: hidden;
	scrollbar-width: thin;
	scrollbar-color: transparent transparent;      /* invisible, still scrollable */
}
.vicinity-graph-node:hover .vicinity-graph-node__outline {
	scrollbar-color: var(--background-modifier-border-hover) transparent;
}
```

<!-- PLAN_REVIEWER: the `<ul>` needs an explicit `margin: 0; padding: 0;
     list-style: none` reset — Obsidian's base stylesheet gives lists a
     `padding-inline-start`, which would eat the ellipsis budget and fight the
     `data-level` indent ladder. Non-contentious, called out so it is not missed. -->
Standard properties only (Chromium ≥121, far below Obsidian 1.12's Electron).
On a hypothetically older runtime the scrollbar simply stays visible — graceful
degradation, not breakage. **Rejected**: `::-webkit-scrollbar { width: 0 }` →
`6px` on hover, because the content box changes width on hover and every entry
re-ellipsises (visible jitter). **Rejected**: `scrollbar-gutter: stable` — same
outcome as the thumb trick but permanently spends 6px of a ≤250px node.

**React Flow wheel handling**: React Flow's zoom is a native d3-zoom listener on
the pane, so a React `onWheel` + `stopPropagation()` would **not** stop it
(native listeners fire before React's root delegation). The supported mechanism
is RF's `nowheel` class on the scrollable element — RF checks it inside its own
wheel handler. The `<ul>` therefore carries `nowheel nodrag nopan` (same escape
hatch `PinButton`/`AttachmentChip` already use for drag/pan).
Accepted trade-off, documented in code: while the pointer is over an outline the
wheel scrolls the list instead of zooming the canvas — including when the list
does not overflow (then the wheel does nothing over that small region). Making
this conditional would require measuring overflow in JS; not worth it.

**(b) Horizontal — per-entry ellipsis.** `white-space: nowrap; overflow: hidden;
text-overflow: ellipsis` on each entry, plus `title={entry.text}` for the
tooltip. This survives the indent scheme: `padding-inline-start` shrinks the
content box and the ellipsis applies to what remains (standard CSS box
behaviour). Indent ladder is written out for levels 2–6 (`data-level` attribute)
— markdown has exactly six levels and the setting caps at 6, so the ladder is
finite; that beats an inline CSS custom property needing a TS cast.

### D6 — Click → open at heading

**Chosen: `workspace.openLinkText(\`${path}#${heading}\`, path, newTab)`.**

| | `openLinkText("path#Heading")` | `getLeaf(newTab).openFile(file, { eState: { line } })` |
|---|---|---|
| API status | **documented public API** (`obsidian.d.ts:7914`) | `eState` is typed `Record<string, unknown>` — the `line` key is **undocumented** runtime behaviour |
| Reading view | works (Obsidian scrolls + flashes the heading) | line numbers are an editor concept |
| Staleness | resolves against the live file | a stale line silently scrolls to the wrong place |
| Duplicate heading text | jumps to the **first** match | exact |
| Port surface | carries the heading **text** (already in `OutlineEntry`) | needs a `line` on `OutlineEntry` + `HeadingPort` |

Decisive: documented API + works in both editing and reading modes + no extra
position field to keep fresh. The duplicate-heading limitation is **identical to
every `[[Note#Heading]]` link in Obsidian**, so it is POLS-consistent with the
app rather than a bespoke surprise — documented in the README. A heading whose
own text contains `#` degrades to opening the note at the top (Obsidian's
subpath parser splits on `#`); it never throws.

Port change is additive (`src/view/viewPorts.ts`):

```ts
export interface OpenNoteOptions {
	readonly newTab: boolean;
	/** Heading TEXT to position at (exact `HeadingCache.heading`); absent = top of the note. */
	readonly heading?: string;
}
```

`GraphViewController.openNode` needs **no change** (it already forwards
`options`). `ObsidianNoteNavigator.openNote` branches: no heading → today's
`getLeaf(newTab).openFile(file)`; heading → `openLinkText(...)`.

**Pure decision module** (precedent: `nodePinAction.ts`) —
`src/view/nodeOpenIntent.ts`:

```ts
export interface ClickModifiers { readonly ctrlKey: boolean; readonly metaKey: boolean; }
/** Ctrl (win/linux) / cmd (mac) = new tab (CLARIFICATION Q2). ONE definition, shared by
 *  the node-body click and outline-entry clicks. */
export function opensInNewTab(modifiers: ClickModifiers): boolean;
/** Open options for a click on an OUTLINE ENTRY: same new-tab gesture + the heading. */
export function outlineEntryOpenOptions(heading: string, modifiers: ClickModifiers): OpenNoteOptions;
/** `path#Heading` — the subpath linktext Obsidian resolves for `[[Note#Heading]]`. */
export function headingLinktext(path: string, heading: string): string;
```

DRY win: `VicinityGraphFlow.onNodeClick` switches to `opensInNewTab(event)`, so
the ctrl/cmd rule exists once. Ctrl/cmd-click on an outline entry therefore
opens a **new tab at that heading** — semantics preserved.

**Double-fire prevention**: each entry is a `<button type="button">` whose
`onClick` calls `event.stopPropagation()` before opening — byte-for-byte the
pattern `PinButton`/`AttachmentChip` already use to keep RF's canvas-level
`onNodeClick` from also firing (React Flow's node click handler is attached in
the same React tree, so synthetic-event propagation is the right lever).

**Reaching the navigator from inside a node**: React Flow instantiates
`nodeTypes` components itself, so context is the only clean channel (the exact
reasoning already written on `ControlsActionsContext.ts`). Add a third,
one-method context — `src/view/NoteOpenContext.ts` — delivering a new minimal
port:

```ts
/** The slice of navigation the rich node components need. */
export interface NoteOpenPort { openNote(path: string, options: OpenNoteOptions): void; }
```

provided by `VicinityGraphFlow` as
`useMemo(() => ({ openNote: (p, o) => controller.openNode(p, o) }), [controller])`.
**Rejected**: adding `openNote` to `GraphUiPort` — its doc comment explicitly
splits navigation out of it (SRP), and violating a documented seam boundary to
save one small file is the wrong trade. **Rejected**: sniffing `data-*`
attributes off `event.target` in the canvas-level handler (implicit coupling,
anti-POLS).

### D7 — Max-depth setting

**Recommendation: a field on `ViewSettings` (the `globalView` cascade), NOT a
new top-level global-only shape.** This is the simpler option here, despite the
`nodeExclusion` precedent:

- Every touch point is one mechanical line (spec leaf, type field,
  `EngineDefaults.viewSettings()`, `parseViewOverride` branch,
  `ViewSettingsResolver.resolve()`, `planSettingsWrite` case reusing the existing
  `global-view` command). No new store method, no new command kind, no new
  `GraphRequestInputs` field.
- **Decisive**: `VicinityGraph.viewSettings` is *already* the transport that
  carries resolved view settings into `flowMapping` (`graph.viewSettings.groupByFolder`
  is read there today) — which is exactly where the depth filter must run. A
  `nodeExclusion`-shaped global would reach the engine but **not** the view, and
  would need a bespoke second path to `flowMapping`.
- Cost of cascade participation: a hand-edited per-doc `view.outlineMaxDepth`
  would be honoured. No UI writes one; the behaviour is sane if someone does.

Six touch points (per `EXPLORATION_PUBLIC__settings-and-infra.md` §1):

1. `SETTINGS_SPEC.globalView.outlineMaxDepth: { default: 2, min: 1, max: 6, step: 1 }`
   (`BoundedNumberSpec`), with the WHY on the leaf: markdown has 6 levels; 2 shows
   sections + subsections, which is what fits a ≤160px node.
2. `ViewSettings.outlineMaxDepth: number` (`src/engine/types.ts`).
3. `EngineDefaults.viewSettings()` reads `.default`;
   `constants.ts` exports `DEFAULT_OUTLINE_MAX_DEPTH`, `MIN_OUTLINE_DEPTH`,
   `MAX_OUTLINE_DEPTH`, and `clampOutlineMaxDepth(value)` — the ONE clamp shared
   by the parser and the slider (mirrors `clampForceLayoutSettings`).
4. `parseViewOverride` gains
   `...definedOnly("outlineMaxDepth", clampedOutlineDepthOrUndefined(raw["outlineMaxDepth"]))`
   — clamped, so hand-edited JSON cannot reach `0` (a silent off-switch that
   would contradict "no enable/disable setting") or `99`.
5. `ViewSettingsResolver.resolve()` gains `outlineMaxDepth: field("outlineMaxDepth")`.
6. `settingsWritePlan`: interaction `{ kind: "global-outline-depth"; value: number }`
   → existing `{ kind: "global-view", view: { ...ctx.globalView, outlineMaxDepth } }`.
7. Settings tab: new `renderNodeContent()` section (rendered after `renderSizing()`
   — contents follow size) with one slider "Outline depth", limits from the spec,
   `setDynamicTooltip()`, routing through `applyInteraction`.
   The IMPLEMENTATION should load the `obsidian-settings` skill for section
   placement/copy before writing this part.

See `#QUESTION_FOR_HUMAN` #1 on the flagged interpretation.

### D8 — Accessibility & theming

- **Colors**: `--text-muted` (idle), `--text-normal` (hover),
  `--background-modifier-hover`, `--background-modifier-border-hover` (scrollbar
  thumb), `--interactive-accent` (focus ring), `--font-smallest`, `--size-4-1`,
  `--radius-s`. Zero literal colors — light/dark just work.
- **Keyboard**: entries are real `<button>`s → focusable, Enter/Space activate,
  `:focus-visible` gets the same `box-shadow: 0 0 0 2px var(--interactive-accent)`
  ring the attachment chips use. Below the 104px threshold the region is
  `display: none`, so it is not in the tab order on small nodes (consistent with
  the pin button's ladder).
- **Semantics**: `<ul aria-label="Note outline">` / `<li>` / `<button>`;
  `title={entry.text}` on each button gives the ellipsis tooltip and the
  accessible name is the full text either way.
- **Hover-preview interaction**: the outline is a **sibling of**, not inside,
  `__preview-zone` — its rows are clickable, and the existing dead-zone rule
  (`NoteNode.tsx:58-63`) says interactive tiles must not be covered by the
  native page-preview popover.

---

## 4. Implementation steps (ordered, independently committable)

Each step ends green on `npm test` + `npm run check`. Redirect output to `.tmp/`.

### Step 1 — Outline eligibility predicate (pure)

- **Modify** `src/shared/FileKinds.ts`: add `MARKDOWN_EXTENSION`,
  `EXCALIDRAW_SUFFIX`, `isMarkdownPath`, `isOutlineBearingPath` (case-insensitive
  suffix check).
- **Modify** `src/adapters/ObsidianLinkProvider.ts`: delete the local
  `MARKDOWN_EXTENSION`, use `FileKinds.isMarkdownPath(file.path)` at both
  existing sites (behaviour-preserving; existing tests are the safety net).
- **Tests** → `src/shared/FileKinds.test.ts`.

### Step 2 — `HeadingPort` + reference offsets (adapter plumbing, no behaviour change)

- **Modify** `src/adapters/obsidianPorts.ts`: add `HeadingPort`, add
  `headings?: readonly HeadingPort[]` to `CachedMetadataPort`.
- **Modify** `src/adapters/ReferenceOrder.ts`: add `OrderedReference`,
  `FRONTMATTER_REFERENCE_OFFSET`, `orderedReferences()`; `orderedLinkTexts()`
  becomes a one-line projection of it (single ordering truth).
- **Tests** → `src/adapters/ReferenceOrder.test.ts` (existing file).

### Step 3 — Outline through the engine seam + the image-vs-outline rule

- **Modify** `src/engine/types.ts`: `OutlineEntry`; `GraphNode.outline`.
- **Modify** `src/engine/LinkProvider.ts`: `FileMetadata.outline` (+ doc comment
  from D3).
- **Modify** `src/engine/index.ts`: export `OutlineEntry`.
- **Modify** `src/engine/VicinityTraversal.ts`: `TraversedNode.outline`, echoed
  in `assemble()` next to `attachments`.
- **Modify** `src/engine/FakeLinkProvider.ts`: `FakeFileSpec.outline?`, wired in
  `declareFile` (default `[]`).
- **Modify** `src/adapters/ObsidianLinkProvider.ts`: `orderedMarkdownReferences`,
  `firstImageOffsetOf`, `outlineOf`; `getFileMetadata` reads the cache once and
  passes it down.
- **Tests** → `src/adapters/ObsidianLinkProvider.test.ts` (new "note outline"
  describe), `src/engine/VicinityTraversal.test.ts`, `src/engine/FakeLinkProvider.test.ts`.

### Step 4 — `outlineMaxDepth` setting, end to end (inert until step 5)

- **Modify** `src/engine/SettingsSpec.ts`, `src/engine/types.ts`,
  `src/engine/constants.ts` (+ `clampOutlineMaxDepth`), `src/engine/index.ts`
  (export the new constants), `src/engine/ViewSettingsResolver.ts`,
  `src/persistence/persistedShapes.ts`, `src/view/settingsWritePlan.ts`,
  `src/view/VicinityGraphSettingTab.ts`.
- **Tests** → `src/engine/SettingsSpec.test.ts`, `src/engine/settingsResolvers.test.ts`,
  `src/persistence/persistedShapes.test.ts`, `src/view/settingsWritePlan.test.ts`.

### Step 5 — View mapping: depth filter + render budget

- **Modify** `src/view/constants.ts`: `OUTLINE_RENDER_LIMIT = 40` with the WHY
  (≈3–6 entries are visible at once; 40 is ~7 screens of scroll and bounds the
  DOM per node — a generated 500-heading note cannot mount 500 buttons).
- **Modify** `src/view/flowMapping.ts`: `FlowNodeData.outline: readonly OutlineEntry[]`;
  in `toFlowNodeData`, `node.outline.filter((e) => e.level <= maxDepth).slice(0, OUTLINE_RENDER_LIMIT)`
  — filter **then** slice, so a depth-2 view of a note with 60 deep headings
  still finds its shallow ones. `maxDepth` comes from `graph.viewSettings.outlineMaxDepth`,
  threaded through `vicinityGraphToFlow` → `toFlowNodeData` (it already takes
  `mainPinned`; pass the resolved `ViewSettings` or the single number — prefer
  the number, `toFlowNodeData` needs nothing else).
- **Tests** → `src/view/flowMapping.test.ts`, `src/view/GraphStructureDiff.test.ts`.

### Step 6 — Navigation seam (heading-targeted open)

- **Add** `src/view/nodeOpenIntent.ts` (+ `.test.ts`).
- **Modify** `src/view/viewPorts.ts`: `OpenNoteOptions.heading?`, `NoteOpenPort`.
- **Add** `src/view/NoteOpenContext.ts` (mirrors `ControlsActionsContext.ts`).
- **Modify** `src/view/ObsidianNoteNavigator.ts`: heading branch via `openLinkText`.
- **Modify** `src/view/VicinityGraphFlow.tsx`: provide `NoteOpenContext`; use
  `opensInNewTab(event)` in `onNodeClick`.
- **Tests** → `src/view/nodeOpenIntent.test.ts`, `src/view/GraphViewController.test.ts`.

### Step 7 — Rendering: `NoteNode` region + CSS

<!-- PLAN_REVIEWER: `data-preview="thumbnail"` on a node that has NEITHER an outline
     NOR a `firstImagePath` is a small lie (POLS). Prefer emitting the attribute only
     when a preview region actually renders, or a third value ("none"). Only the
     `"outline"` case is styled, so either shape works. -->
- **Modify** `src/view/NoteNode.tsx`: `const showsOutline = data.outline.length > 0;`
  used for **both** `data-preview={showsOutline ? "outline" : "thumbnail"}` on the
  root and the region branch; thumbnail renders only when `!showsOutline`
  (`firstImagePath` stays honest — "this note's first image" — and the view picks
  ONE preview region, with the WHY in a comment); new local
  `OutlineEntryRow` component next to `PinButton`/`AttachmentChip`.
- **Modify** `src/view/graph-view.css`: the `===== in-node heading outline =====`
  block (D4/D5/D8), the `data-preview="outline"` preview-zone rule, and the
  `.vicinity-graph-node__outline { display: block; }` line inside the existing
  `@container (min-height: 104px)` block.
- No test (DOM) — covered by step 8.

### Step 8 — Dev-vault fixtures + Playwright e2e

- **Modify** `scripts/setup-dev-vault.sh`: `write_if_missing` two notes —
  `outline-note.md` (**≥10 headings at levels 1–2** so the list provably overflows a
  ≤160px node at the DEFAULT depth of 2 — 6 headings spread over levels 1–3 would leave
  ~4 surviving entries and tests 58/59 would pass vacuously; plus a couple of level-3
  headings for the depth assertion, a link to `note1`, and an image embedded **after**
  the first heading) and `outline-cover.md` (image embedded
  **before** the first heading). Both linked from an existing central so they
  render in a graph.
- **Add** `e2e/nodeOutline.e2e.ts` (see §5).

### Step 9 — Docs + follow-up ticket

- `README.md`: "Settings model → Global defaults" gains the **Outline depth**
  bullet; a short "Node contents" paragraph describing outline-vs-image and the
  escape hatch (put the image before the first heading); "V1 scope / limits"
  gains the two honest limitations (duplicate heading text jumps to the first
  match, like any `[[Note#Heading]]` link; `*.excalidraw.md` shows no outline).
- `docs-internal/plan/high-level-plan.md` → "Rendering and interaction": add the
  outline-preview bullet (container-query gated, mutually exclusive with the
  thumbnail, depth-capped) and extend the interactions bullet with
  "clicking an outline entry opens the note at that heading".
- `docs-internal/architecture-map.md` → "Key seams": note that
  `view/viewPorts.ts`'s `NoteNavigatorPort` now opens at an optional heading and
  that node components reach it through `NoteOpenContext`.
- **Add** `docs-internal/tickets/ticket-node-outline-live-refresh.md` (see §7).
- **Do NOT** write a `change_log` entry — TOP_LEVEL_AGENT does that once.

---

## 5. Acceptance criteria — concrete automated tests

BDD `it("WHEN … THEN …")`, one behaviour per test, colocated, `Fake*` fixtures.

### `src/shared/FileKinds.test.ts`
1. WHEN the path is `notes/a.md` THEN `isOutlineBearingPath` is true.
2. WHEN the path is `draw/x.excalidraw.md` THEN `isOutlineBearingPath` is false.
3. WHEN the path is `draw/X.Excalidraw.MD` THEN `isOutlineBearingPath` is false (case-insensitive).
4. WHEN the path is `board.canvas` THEN `isOutlineBearingPath` is false.
5. WHEN the path is `draw/x.excalidraw.md` THEN `isNodeBearingPath` is still true (Q4: excluded from parsing only).

### `src/adapters/ReferenceOrder.test.ts`
6. WHEN a cache has frontmatter and body links THEN `orderedReferences` puts frontmatter links first with `FRONTMATTER_REFERENCE_OFFSET`.
7. WHEN body links and embeds interleave THEN `orderedReferences` returns them ascending by offset.
8. WHEN `orderedLinkTexts` is called THEN it equals `orderedReferences(...).map(r => r.link)` (single ordering truth).
<!-- PLAN_REVIEWER: test 8 is a tautology — it restates the implementation
     (`orderedLinkTexts = orderedReferences().map(...)`) and can never fail
     independently. Recommend CUTTING it; the existing `orderedLinkTexts`
     ordering tests already pin the behaviour that matters. -->

### `src/adapters/ObsidianLinkProvider.test.ts` — `describe("note outline")`, `FakeObsidianPorts` fixtures
9. WHEN a markdown file's cache carries headings THEN `getFileMetadata().outline` lists their text in document order.
10. WHEN a markdown file's cache carries headings THEN each entry carries the heading's `level`.
11. WHEN the file is a `.canvas` THEN `outline` is empty.
12. WHEN the file is `*.excalidraw.md` THEN `outline` is empty.
13. WHEN the file is `*.excalidraw.md` THEN `isNodeBearing` is still true.
14. WHEN the cache has no `headings` key THEN `outline` is empty.
14b. WHEN `getFileCache` returns `null` for a markdown file THEN `outline` is empty
    (cache-miss branch — distinct from test 14's "cache present, no headings key").
    <!-- PLAN_REVIEWER: added; the `cache === null` branch was unspecified. -->
15. WHEN the note has headings and NO image THEN `outline` carries the headings.
16. WHEN the note's first image is embedded BEFORE the first heading THEN `outline` is empty (the image wins).
17. WHEN the note's first image is embedded AFTER the first heading THEN `outline` carries the headings.
18. WHEN the note's image is a FRONTMATTER link THEN `outline` is empty (frontmatter sits above all body content).
19. WHEN the note has an image and no headings THEN `outline` is empty.
20. WHEN a NON-image attachment precedes the first heading but the first image follows it THEN `outline` carries the headings.
21. WHEN a file carries an outline THEN `attachments` is unchanged — assert the full
    ORDERED array (`toEqual([...])`), not merely presence: the `resolvedOutgoingPaths`
    refactor's only real hazard is a reordering that silently moves `firstImagePath`.
    <!-- PLAN_REVIEWER: tightened from "unchanged" to an ordered-array assertion. -->

### `src/engine/FakeLinkProvider.test.ts`
22. WHEN a fixture file declares an outline THEN `getFileMetadata().outline` returns it.
23. WHEN a fixture file declares none THEN `outline` is an empty array (never `undefined`).

### `src/engine/VicinityTraversal.test.ts`
24. WHEN a visited file's metadata carries an outline THEN the traversed node echoes it.
25. WHEN it carries none THEN the traversed node's outline is empty.

### `src/engine/VicinityEngine.test.ts`
26. WHEN a graph is built THEN each `GraphNode` carries its file's outline (spread-through guard).

### `src/view/flowMapping.test.ts`
27. WHEN `outlineMaxDepth` is 2 THEN level-3+ entries are dropped from `FlowNodeData.outline`.
28. WHEN `outlineMaxDepth` is 2 THEN level-1 and level-2 entries survive in document order.
29. WHEN `outlineMaxDepth` is 6 THEN every level survives.
30. WHEN a node has more surviving entries than `OUTLINE_RENDER_LIMIT` THEN only the first `OUTLINE_RENDER_LIMIT` are mapped.
31. WHEN entries deeper than the cap outnumber the limit THEN the shallow ones still map (filter runs BEFORE slice).
32. WHEN the same node is mapped in two independent rebuilds THEN the outlines are value-equal (`toEqual`) — the diff/memo stability contract.
<!-- PLAN_REVIEWER: test 32 cannot fail — `toFlowNodeData` is pure, so two calls on
     equal input are always `toEqual`. It pins nothing. Recommend CUTTING it; test 35
     (`decideLayout` still reuses layout when only the outline changed) is the real
     stability contract. -->
33. WHEN the engine node has an empty outline THEN `FlowNodeData.outline` is `[]`, never `undefined`.
34. WHEN a node has BOTH an outline and a `firstImagePath` THEN `firstImagePath` is still mapped (the view, not the mapping, picks one region).

### `src/view/GraphStructureDiff.test.ts`
35. WHEN only a node's outline changed between rebuilds THEN `decideLayout` still returns `"reuse-layout"` (outline data never forces a relayout).

### `src/view/nodeOpenIntent.test.ts`
36. WHEN ctrl is held THEN `opensInNewTab` is true.
37. WHEN meta (cmd) is held THEN `opensInNewTab` is true.
38. WHEN no modifier is held THEN `opensInNewTab` is false.
39. WHEN an outline entry is clicked without a modifier THEN the options carry that heading and `newTab: false`.
40. WHEN an outline entry is ctrl-clicked THEN the options carry that heading and `newTab: true`.
41. WHEN a heading linktext is built THEN it is `` `${path}#${heading}` ``.

### `src/view/GraphViewController.test.ts`
42. WHEN `openNode` is called with a heading THEN the fake navigator receives that heading (pass-through guard).
43. WHEN `openNode` is called on a folder-group id THEN the navigator is not called (existing behaviour, still true with the new field).

### `src/engine/SettingsSpec.test.ts` / `settingsResolvers.test.ts`
44. WHEN `EngineDefaults.viewSettings()` is built THEN `outlineMaxDepth` equals the spec default (2).
45. WHEN a value below the spec min is clamped THEN `clampOutlineMaxDepth` returns the min.
46. WHEN a value above the spec max is clamped THEN it returns the max.
47. WHEN MAIN pins `outlineMaxDepth` THEN `ViewSettingsResolver.resolve` returns the pinned value (cascade participation).
48. WHEN nobody pins it THEN `resolve` returns the global value.

### `src/persistence/persistedShapes.test.ts`
49. WHEN `data.json` carries `globalView.outlineMaxDepth: 4` THEN `parsePluginData` round-trips 4.
50. WHEN it carries `outlineMaxDepth: 0` THEN parsing clamps it to the spec min (never a silent off-switch).
51. WHEN it carries `outlineMaxDepth: 99` THEN parsing clamps it to the spec max.
52. WHEN `outlineMaxDepth` is absent THEN the default applies.
53. WHEN `outlineMaxDepth` is a non-number THEN the default applies.

### `src/view/settingsWritePlan.test.ts`
54. WHEN a `global-outline-depth` interaction is planned THEN the command is a `global-view` write carrying the new depth.
55. WHEN it is planned THEN every other `globalView` field is preserved.

### Playwright e2e (`e2e/nodeOutline.e2e.ts`) — release gate, NOT `npm test`
These are the DOM-only behaviours no vitest test can reach (no RTL/jsdom):

56. WHEN a large node's note has headings and no leading image THEN its
    `.vicinity-graph-node__outline` renders the expected entry texts (and, at the
    default depth 2, no level-3 entry).
57. WHEN an outline entry is clicked THEN the note opens AND the active markdown
    editor's cursor line equals that heading's line
    (`app.metadataCache.getFileCache(file).headings`) — proves heading targeting,
    not merely "the note opened".
58. WHEN the node is hovered THEN the outline's computed `scrollbar-color`
    changes from the transparent idle value (hover-only scrollbar).
59. WHEN the outline overflows and the scrollbar is hidden THEN setting
    `scrollTop` still moves the list (scrolling works while invisible).
    <!-- PLAN_REVIEWER: assert `scrollHeight > clientHeight` FIRST, as an explicit
         precondition. Without it a non-overflowing fixture makes this test pass while
         proving nothing (scrollTop stays 0 and "unchanged" would read as success). -->
60. WHEN a note's first image precedes its first heading THEN that node renders
    `.vicinity-graph-node__thumbnail` and NO `.vicinity-graph-node__outline`
    (the escape hatch, end to end).

Reuse `obsidianHarness.ts`; follow the existing "click a BIG node" caveat
(`vicinityGraph.e2e.ts:195-206`) — outline entries only exist on ≥104px nodes,
so run these on the small alpha-style graph where nodes render large.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| `nowheel` swallows canvas zoom while the pointer is over an outline that does not overflow | Accepted + commented; the alternative needs JS overflow measurement |
| Duplicate heading text jumps to the first occurrence | Documented in README; identical to Obsidian's own `[[Note#Heading]]` behaviour |
| Heading text containing `#` degrades to "open at top" | Graceful, never throws; documented |
| Outline arrays are computed for every *visited* file, not just rendered ones | Bounded in practice (tens of headings × ≤ node cap); the render budget caps DOM, not memory. No adapter-side cap: a cap applied **before** the depth filter would silently hide shallow headings of a deep-heading note — a lie we refuse to ship. Revisit only with a measurement |
| Container-query `size` containment + inner scroll | `min-height: 0` on the flex child; node height is fixed by React Flow, so containment is safe |
| Refactor of `resolvedOutgoingPaths` touches the thumbnail path | Guarded by existing attachment/`firstImagePath` tests + new test 21 |
| e2e flakiness on node clicks (known: `ticket-e2e-node-click-flaky-headless.md`) | Reuse the big-node pattern; keep the new file separate so it can be quarantined |

---

## 7. Follow-up ticket (file, do NOT implement)

`docs-internal/tickets/ticket-node-outline-live-refresh.md` — debounced live
refresh of outlines while editing.

**Important correction to the exploration's premise** (transparency): the plugin
**does** already register `metadataCache.on("resolved")`
(`src/view/VicinityGraphView.tsx:115` → `controller.handleMetadataResolved()`,
debounced `REBUILD_DEBOUNCE_MS = 500`). So edited headings very likely DO refresh
after Obsidian resolves the cache — the "outlines never refresh until you switch
files" premise behind CLARIFICATION Q3 appears to be wrong. The ticket should
therefore read: *verify staleness in the dev vault; only if `resolved` proves too
laggy, add a debounced `metadataCache.on("changed")` trigger* — not "add a
missing listener". See `#QUESTION_FOR_HUMAN` #2.

---

## 8. Deliberately scoped OUT

- Outline content influencing node **width** or **height** (would break the
  mapping-time box React Flow's culling/`fitView` depend on).
- Collapsible/nested outline trees, active-heading highlighting, heading counts.
- Outlines for canvas or `*.excalidraw.md` (CLARIFICATION Q4).
- Persisting anything per-note about outlines.
- A per-doc override UI for `outlineMaxDepth` (the field cascades, but no surface
  writes one — global slider only).
- Frontmatter-driven per-note "prefer image/outline" overrides (the documented
  escape hatch is the image's position).
- The live-refresh trigger (ticket above).

---

## 9. Questions

`#QUESTION_FOR_HUMAN:` (1) Confirm the flagged interpretation in
CLARIFICATION §"Interpretation note": the feature ships with **no on/off toggle**
but **with** a global "Outline depth" slider (1–6, default 2). If you meant
literally zero new settings, say so — the depth becomes a hard-coded constant of
2 and Step 4 (7 files) is dropped entirely.

`#QUESTION_FOR_HUMAN:` (2) CLARIFICATION Q3 assumed no metadata-change trigger
exists, but `metadataCache.on("resolved")` IS wired today (debounced 500ms), so
outlines probably already refresh while you edit. Confirm the follow-up ticket
should be "verify, and only tighten if the lag is bad" rather than "add the
missing listener".
