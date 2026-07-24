# DETAILED PLAN — Markdown heading outline inside graph nodes

Feature: `node-outline` · Branch: `node-outline` · Author: PLANNER (iteration 2)
Inputs: `CLARIFICATION__PUBLIC.md` **incl. Round 2 + Round 3** (binding),
`DETAILED_PLAN_REVIEW__PUBLIC.md`, `EXPLORATION_PUBLIC*.md`, live source read.

> ## READINESS: **READY FOR IMPLEMENTATION**
>
> All review feedback is dispositioned (§0 + `PLAN_ITERATION__PUBLIC.md`).
> **No open `#QUESTION_FOR_HUMAN` remains** — Rounds 2 and 3 answered both prior
> questions and the reviewer's. Nothing in this plan requires a hack.

---

## 0. Response to review (`DETAILED_PLAN_REVIEW__PUBLIC.md`)

| # | Review item | Disposition | Where |
|---|---|---|---|
| M1 | Use Obsidian's `stripHeadingForLink`; drop the "`#` in a heading opens at top" defect | **INCORPORATED** — verified `obsidian.d.ts:6841`, `@public`, no `@since`. Sanitising moves into `ObsidianNoteNavigator`; `headingLinktext` + its test are **deleted** | D6, Step 6 |
| M2 | Heading text is raw markdown — decide what renders | **INCORPORATED as option (b)** — now *binding* via CLARIFICATION Q7. New pure `outlineEntryLabel` with an explicitly bounded scope; `OutlineEntry.rawText` stays raw (it is the link key) | D9, Step 7 |
| M3 | e2e "cursor line" assertion is not a real contract | **INCORPORATED, re-scoped** — we assert **our** side of the contract (the linktext handed to `openLinkText`) + that the note became active. Obsidian's scroll/cursor behaviour is Obsidian's contract, not ours; a manual dev-vault check covers the human-visible part | §5 e2e, Step 9 |
| M4 | Step 4 (depth slider) is not conditional | **INCORPORATED** — CLARIFICATION Q5 confirms. Step committed; the `#QUESTION_FOR_HUMAN` is removed | D8, Step 4 |
| M5 | Cut vacuous tests 8 and 32; sweep for more | **INCORPORATED (both cut)**; whole list swept and renumbered. Optional cut of old test 13 (excalidraw still node-bearing at the adapter) **REJECTED** — it is a different unit from the `FileKinds` test and guards the exact CLARIFICATION Q4 confusion this feature invites | §5 |
| m1 | Test 21 → ordered-array assertion | ACCEPTED (kept inline, now T21) | §5 |
| m2 | Add the `getFileCache() === null` test | ACCEPTED (now T15) | §5 |
| m3 | Cut tests 8/32 | ACCEPTED | §5 |
| m4 | `<ul>` needs a margin/padding/list-style reset | ACCEPTED — now **load-bearing**: with a nested list, Obsidian's default `padding-inline-start` would compound per level | D5, D7 |
| m5 | `data-preview="thumbnail"` on a node with no preview is a POLS lie | ACCEPTED **and upgraded** — a pure `nodePreviewKind()` helper makes the 3-way choice explicit and unit-testable (also the answer to the "image wins ≡ empty outline" re-examination) | D3b, Step 7 |
| m6 | Fixture needs ≥10 headings so overflow is provable | ACCEPTED, extended: the fixture also needs one heading carrying inline markdown (for the stripping e2e) and a nested level-2 run | Step 9 |
| m7 | e2e 59 needs a `scrollHeight > clientHeight` precondition | ACCEPTED | §5 e2e |
| — | "Image wins encoded as an EMPTY outline" — reviewer said sound, parent asked to re-examine | **KEPT at the engine seam, made explicit at the view** — see D3b for the full argument | D3b |

**New since the reviewed draft** (CLARIFICATION Round 3, binding): dedicated
`NodeOutline.tsx` component (D7), nested-list markup (D5/D7), minimal nesting
spacing (D5), display-vs-link text split (D9).

---

## 1. Problem understanding

Render a note's Markdown heading outline **inside** its graph node, in the same
visual slot the first-image thumbnail occupies today, for nodes that are tall
enough to show it. Which of the two the node shows is decided by document
position: an image **before** the first heading wins (the human's documented
"show the picture" escape hatch); otherwise the outline wins.

The outline renders as a **nested list** (structure carries the hierarchy),
with **display-stripped** heading text (no `##`, no `[[ ]]`/`**`/`` ` ``),
per-entry horizontal ellipsis, vertical scrolling with a **hover-only**
scrollbar, and a click that opens the note **at that heading**. A global slider
(1–6, default 2) caps how many heading levels render. All outline rendering
lives in a **dedicated `NodeOutline` component** so this first-iteration UI can
be reworked later without touching node rendering.

### Constraints taken as binding

1. `src/engine/` stays obsidian-free (import guard). Headings enter through the
   `LinkProvider` seam as engine-owned POJOs.
2. "Enough space" is a **CSS container query**, never JS measurement.
3. The node's mapping-time `width`/`height` must not change — React Flow
   culling and `fitView` depend on them (`VicinityGraphFlow.tsx:145-160`).
4. No RTL/jsdom in this repo → every decision (eligibility, image-vs-outline,
   depth filter, tree shape, display label, preview choice, click target) lives
   in a **pure module with colocated tests**; DOM behaviour is Playwright-only.
5. Excalidraw (`*.excalidraw.md`) stays a graph **node**, carries **no** outline.
   Canvas has no headings at all.
6. No persisted-shape version bump (outline is recomputed per rebuild); the new
   **setting** does need parse wiring.
7. **Outline rendering is a separate React component** (CLARIFICATION Q9) — a
   structural requirement, not a stylistic preference.

### Assumptions (stated, not hidden)

- Obsidian's `CachedMetadata.headings` is in document order (the same assumption
  `ReferenceOrder` already makes about link offsets). We never re-sort it.
- `HeadingCache.position.start.offset` and `ReferenceCache.position.start.offset`
  are the same coordinate space (char offset into the file). They are.
- Entry-budget arithmetic in D4 (≈3 entries at 104px, ≈6 at 160px) is computed
  from the CSS, **not measured**. First dev-vault smoke test should sanity-check
  it; if 3 feels cramped the honest lever is `line-height`/font-size, not a new
  breakpoint.

---

## 2. Architecture — the data path

```
metadataCache.getFileCache(file).headings          (Obsidian, adapter-only)
      │  HeadingPort  (new, structural slice)
      ▼
ObsidianLinkProvider.outlineOf()                    ← eligibility + image-vs-outline rule
      │  FileMetadata.outline : readonly OutlineEntry[]        (engine POJO, RAW text)
      ▼
VicinityTraversal.assemble → TraversedNode.outline
      │  (VicinityEngine already does `{...node}` → GraphNode.outline is free)
      ▼
GraphNode.outline
      │  flowMapping.toFlowNodeData: filter(level ≤ outlineMaxDepth).slice(0, LIMIT)
      ▼
FlowNodeData.outline (FLAT, raw)
      │
      ├─▶ NoteNode.tsx: nodePreviewKind({outlineLength, hasImage}) → "outline"|"thumbnail"|"none"
      │
      └─▶ NodeOutline.tsx   ← THE dedicated outline UI (CLARIFICATION Q9)
              │  buildOutlineTree(entries)      → nested <ul>/<li>
              │  outlineEntryLabel(rawText)     → display text (markdown stripped)
              │  click → useNoteOpen().openNote(path, outlineEntryOpenOptions(rawText, event))
              ▼
      GraphViewController.openNode → NoteNavigatorPort
              ▼
      ObsidianNoteNavigator: openLinkText(`${path}#${stripHeadingForLink(raw)}`, path, newTab)
```

Nothing new is persisted. One new setting (`ViewSettings.outlineMaxDepth`)
rides the existing `globalView` object end-to-end.

**The flat array is the stable contract between mapping and UI.** Tree shape,
labels and markup are *rendering details owned by `NodeOutline`* — that is what
makes CLARIFICATION Q9's "iterate later without touching node rendering" true in
practice rather than only in file layout.

---

## 3. Design decisions (with rejected alternatives)

### D1 — Data shape & flow

**Engine type** (`src/engine/types.ts`, next to `AttachmentRef`):

```ts
/** One markdown heading offered for a node's outline. Engine-owned POJO
 *  (no obsidian `HeadingCache` leakage — see the import guard). */
export interface OutlineEntry {
	/**
	 * The heading's text EXACTLY as Obsidian parsed it: the `#` marker and its
	 * surrounding whitespace are gone, but INLINE MARKDOWN IS INTACT —
	 * `[[links]]`, `**bold**`, `` `code` `` are all still present.
	 * This is the LINK KEY (see D6): the navigator sanitises it with Obsidian's
	 * own `stripHeadingForLink` to build `path#Heading`. Never render it
	 * directly — the view formats it with `outlineEntryLabel` (D9).
	 */
	readonly rawText: string;
	/** Markdown heading level, 1–6. Drives the depth filter AND the nesting (D5). */
	readonly level: number;
}
```

**Named `rawText`, not `text`** — "Behavior MUST thoroughly match Naming". A
field called `text` inside a UI-facing structure invites `{entry.text}` in JSX,
which is exactly the bug CLARIFICATION Q7 forbids. `rawText` makes
`outlineEntryLabel(entry.rawText)` read as obviously correct and `{entry.rawText}`
read as obviously wrong. Cost: zero.

No branded types: `rawText` is prose and `level` is a small integer with a finite
domain — branding either would be ceremony without a compile-time bug to catch.
No `line`/`offset` field: D6 makes the click target the heading TEXT, so a
position field would be dead weight and a staleness trap.

**Port field** (`src/engine/LinkProvider.ts`, `FileMetadata`):

```ts
/**
 * Heading outline offered as this note's in-node preview, in document order.
 * EMPTY when the file has no headings, is not outline-bearing (canvas,
 * `*.excalidraw.md`), or when its FIRST IMAGE appears BEFORE its first heading
 * — the human's documented "show the picture instead" escape hatch (D3).
 * Provider-owned exactly like `attachments`: only the adapter sees offsets.
 */
readonly outline: readonly OutlineEntry[];
```

**Required, not optional**, mirroring `attachments`: an always-present array
means no `undefined` branches in three layers, and `[]` already means "no
outline". Two implementers (`ObsidianLinkProvider`, `FakeLinkProvider`), so the
change is compile-forced.

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
field we never consume would be a lie about the port's surface.

**Array vs flattened primitive on `FlowNodeData`: ARRAY.**

- `decideLayout` (`GraphStructureDiff.ts:24-48`) compares node id sets, edge id
  sets, `groupByFolder`, the `forceLayout` fields and `sizePx` growth — never
  node data. An outline array cannot flip a layout decision (T30 pins this).
- `decideActiveFileRebuild` (`RebuildDecision.ts`) is path-only. Unaffected.
- `React.memo(NoteNode)` already re-renders every node on every rebuild because
  `toFlowNodeData` mints a fresh `data` object — an array field changes nothing.
- The contract at `flowMapping.test.ts:412-447` is about a **primitive `useMemo`
  key for a resource URL** (`firstImagePath` → `ui.resourcePath` → `<img src>`,
  "no refetch storm"). The outline resolves no resource; that contract is
  untouched and its tests keep passing unchanged.
- **Rejected — a delimited string**: needs an encoder *and* a decoder (duplicated
  knowledge), needs a delimiter heading text cannot legally contain (there is
  none), and buys nothing because nothing deep-compares node data.

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

Rejected: a `kind` discriminant on `GraphNode` — nothing else needs it.

### D3 — Image-vs-outline choice (where the position comparison happens)

**The adapter decides, and encodes the decision by returning an EMPTY outline.**
Only the adapter can see document offsets; `FileMetadata` is explicitly
documented as "ADAPTER truth… the provider owns eligibility and attachment
rules"; and this keeps **one** field travelling three layers instead of two.

Mechanics, minimal and honest:

1. `ReferenceOrder` gains the offsets it already computes and currently throws
   away — a single ordering truth, no second implementation:

```ts
/** A reference in document order. Frontmatter links carry
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
| depth filter removes every entry (view stage) | falls back to the image, else title only — see D3b |

**Rejected — `AttachmentRef.offset`**: bloats a type used by every attachment of
every visited file to answer one question about one of them, and leaks document
positions into the engine for no consumer. **Rejected — a second
`firstImagePrecedesFirstHeading: boolean` on `FileMetadata`**: doubles the
plumbing (2 fields × 3 layers) and pushes a fact the adapter fully owns into the
view for re-combination.

**Rejected — reading `cache.embeds` directly in `outlineOf`** (the "simpler"
shape): `firstImagePath` is computed from **resolved** references, so an
unresolvable `![[missing.png]]` before the first heading would suppress the
outline while producing no thumbnail — a silently blank node. Sharing one
resolution pass is what keeps the two decisions consistent.

### D3b — Re-examined: does "image wins ≡ empty outline" still hold? **YES at the seam; made EXPLICIT at the view.**

The parent asked whether the dedicated component changes this. Re-derived from
scratch:

**Keep the empty-array encoding across the engine seam.** Nothing between the
adapter and `NoteNode` can act on the difference between "this note has no
headings" and "this note has headings but its image wins" — both mean *do not
offer an outline for this note*. A discriminated `preview: {kind:"image"} |
{kind:"outline", entries}` on `FileMetadata` would have to absorb
`firstImagePath`/`imageCount` (otherwise there are two competing sources of
"what shows"), which turns a 1-field addition into a refactor of the thumbnail
path — for zero behavioural difference. That fails PARETO decisively. The
conflation is documented on the field (D1) so it is lossy-but-stated, not hidden.

**But the reviewer's m5 complaint is a real symptom, and it belongs one layer
down.** The *view* genuinely makes a three-way choice, and today the plan derived
it from `outline.length` plus a nullable path — which is how
`data-preview="thumbnail"` ended up on nodes showing no thumbnail. So the choice
becomes explicit exactly where it is made:

```ts
// src/view/nodePreviewChoice.ts   (pure, no React, unit-tested)
/** Which preview region a node renders. At most one — they share the same slot. */
export type NodePreviewKind = "outline" | "thumbnail" | "none";
/** Outline wins when it has entries (the adapter already applied the image-vs-outline
 *  rule, D3); otherwise the image, if any; otherwise the node is title-only. */
export function nodePreviewKind(input: {
	readonly outlineEntryCount: number;
	readonly hasImage: boolean;
}): NodePreviewKind;
```

`NoteNode` emits `data-preview={kind}` with all three honest values and branches
its JSX on `kind`. Net effect: one new pure 8-line module + 3 tests removes both
the POLS lie and the "derive a 3-way from a 1-way" smell, without pushing
adapter-owned facts through three layers. This is the answer to both m5 and the
re-examination.

### D4 — "Enough space" gating (CSS container queries only)

**Reuse the existing 104px breakpoint** — the one that already reveals the
thumbnail. The outline occupies the *same* preview slot and is mutually
exclusive with the thumbnail, so a second threshold would create a second
level-of-detail concept for one slot.

```css
/* graph-view.css — inside the EXISTING @container (min-height: 104px) block,
   so the whole density ladder stays readable in one place. */
@container (min-height: 104px) {
	.vicinity-graph-node__thumbnail { display: block; }
	.vicinity-graph-outline        { display: block; }   /* + pointer comment to node-outline.css */
}
```

Composition at the two ends of the size range (padding `--size-4-2` ×2 = 16px,
title ≈ 15px/line, chip row ≈ 20px, entry line-height ≈ 15px at `--font-smallest`):

- 104px node with an attachment strip → ≈ 45px of slack → **≈ 3 entries**.
- 160px node (engine max) with a strip → ≈ 100px → **≈ 6 entries**.
- Below 104px: title only (+ strip ≥72px) — exactly today's ladder.

The outline container uses `flex: 1 1 auto; min-height: 0` (takes the slack and
shrinks rather than pushing the attachment strip out of the box) — deliberately
**not** the thumbnail's `min-height: 56px`, which can overflow a 104px node. When
the outline renders, `.vicinity-graph-node[data-preview="outline"]
.vicinity-graph-node__preview-zone` drops to `flex: 0 0 auto` so the title zone
does not claim half the slack.

Rejected: a lower dedicated breakpoint (e.g. 88px) — a one-entry scrolling list
reads as broken. Rejected: `ResizeObserver`/`sizePx` JS branching — banned by the
node's stated design (`NoteNode.tsx:18`, `graph-view.css:66-70`).

### D5 — Nested list, minimal nesting spacing, and overflow

**(a) Nesting (CLARIFICATION Q8).** Hierarchy is carried by real `<ul>` nesting,
not a `data-level` padding ladder:

```
<div class="vicinity-graph-outline">            ← scroll container, nowheel/nodrag/nopan
  <ul class="vicinity-graph-outline__list" aria-label="Note outline">
    <li class="vicinity-graph-outline__item">
      <button class="vicinity-graph-outline__entry">Intro</button>
      <ul class="vicinity-graph-outline__list">                ← nested, same classes
        <li class="vicinity-graph-outline__item">
          <button class="vicinity-graph-outline__entry">Background</button>
        </li>
      </ul>
    </li>
  </ul>
</div>
```

The flat→tree transform is pure and lives in `src/view/outlineTree.ts` (D10) —
**not** in `flowMapping`, so the mapping contract stays flat and the UI can
change shape freely (CLARIFICATION Q9).

**(b) Minimal nesting spacing.** Obsidian's base stylesheet gives `ul` a
`padding-inline-start` of ~2em, which would compound *per nesting level* and eat
the ellipsis budget of a ≤250px node. So the reset is load-bearing, and the
indent is re-applied deliberately, once, on nested lists only:

```css
.vicinity-graph-outline__list {
	margin: 0;
	padding: 0;                 /* kill Obsidian's list indent (reviewer m4) */
	list-style: none;
}
/* THE nesting knob. --size-4-2 = 8px ≈ one glyph at --font-smallest: readable as
 * hierarchy, cheap enough that depth 6 costs 40px of a ~250px node. Tune HERE. */
.vicinity-graph-outline__list .vicinity-graph-outline__list {
	padding-inline-start: var(--size-4-2);
}
```

One selector = one knob for the whole hierarchy. Rejected: a per-level
`data-level` ladder (6 selectors encoding what the DOM already says — and it is
what CLARIFICATION Q8 explicitly moved away from). Rejected: an inline
`--depth` custom property (needs a TS cast on `style`, and CSS already knows the
depth from the DOM).

**(c) Vertical overflow — hover-only scrollbar, always scrollable.** Style the
*thumb*, not the *track width*, so nothing reflows on hover:

```css
.vicinity-graph-outline {
	display: none;              /* revealed at the 104px breakpoint (D4) */
	flex: 1 1 auto;
	min-height: 0;
	overflow-y: auto;
	overflow-x: hidden;
	scrollbar-width: thin;
	scrollbar-color: transparent transparent;      /* invisible, still scrollable */
}
.vicinity-graph-node:hover .vicinity-graph-outline {
	scrollbar-color: var(--background-modifier-border-hover) transparent;
}
```

Standard properties only (Chromium ≥121, far below Obsidian 1.12's Electron). On
a hypothetically older runtime the scrollbar simply stays visible — graceful
degradation, not breakage. **Rejected**: `::-webkit-scrollbar { width: 0 }` →
`6px` on hover (the content box changes width on hover, so every entry
re-ellipsises — visible jitter). **Rejected**: `scrollbar-gutter: stable` (same
outcome, but permanently spends 6px of a ≤250px node).

**React Flow wheel handling**: RF's zoom is a native d3-zoom listener on the
pane, so a React `onWheel` + `stopPropagation()` would **not** stop it (native
listeners fire before React's root delegation). The supported mechanism is RF's
`nowheel` class, checked inside RF's own wheel handler. The scroll container
therefore carries `nowheel nodrag nopan` (the same escape hatch
`PinButton`/`AttachmentChip` already use). Accepted, documented in code: while
the pointer is over an outline the wheel scrolls the list instead of zooming the
canvas — including when the list does not overflow (then the wheel does nothing
over that small region). Making it conditional would require JS overflow
measurement; not worth it.

**(d) Horizontal — per-entry ellipsis, composed with nesting.**
`white-space: nowrap; overflow: hidden; text-overflow: ellipsis` on each
`__entry` button, plus `title={label}` for the tooltip. This composes with
nesting for free: each nested `<ul>` shrinks its children's content box by 8px
and the ellipsis applies to what remains (standard CSS box behaviour). The
button must be `display: block; width: 100%` for `text-overflow` to apply
(ellipsis needs a block-level formatting context with a constrained width).

### D6 — Click → open at heading

**Chosen: `workspace.openLinkText(\`${path}#${stripHeadingForLink(raw)}\`, path, newTab)`.**

| | `openLinkText("path#Heading")` | `getLeaf(newTab).openFile(file, { eState: { line } })` |
|---|---|---|
| API status | **documented public API** (`obsidian.d.ts:7914`, `@public @since 0.16.0`) | `eState` is typed `Record<string, unknown>` — the `line` key is **undocumented** runtime behaviour |
| Reading view | works (Obsidian scrolls + flashes the heading) | line numbers are an editor concept |
| Staleness | resolves against the live file | a stale line silently scrolls to the wrong place |
| Duplicate heading text | jumps to the **first** match | exact |
| Port surface | carries the heading **text** (already in `OutlineEntry`) | needs a `line` on `OutlineEntry` + `HeadingPort` |

**Sanitising (review M1 — incorporated).** Obsidian exports the function written
for exactly this job:

```
node_modules/obsidian/obsidian.d.ts:6841  export function stripHeadingForLink(heading: string): string;
```

`@public`, no `@since` (it predates the tagging convention) → safe at
`minAppVersion 1.12.4`. Obsidian's own link autocomplete and "copy link to
heading" go through it, and `resolveSubpath` normalises with the matching
`stripHeading`. Building the subpath by hand would be *less* correct than
Obsidian is with itself. The previously accepted "`#` inside a heading degrades
to open-at-top" defect is therefore **removed from the plan**, along with the
README bullet that documented it.

Placement: the call belongs in `ObsidianNoteNavigator` — it already imports
`obsidian` and is the adapter for exactly this (`ControlsActions.ts`,
`ObsidianGraphUi.ts` set the precedent). Consequences, all deliberate:

- `nodeOpenIntent.headingLinktext` and its test are **deleted** — a pure module
  cannot import `obsidian`, and a half-sanitising pure join would be a second,
  worse truth (DRY).
- `ObsidianNoteNavigator.ts` gains a **value** import from `obsidian` (today it
  is `import type` only). Our vitest config has no `obsidian` runtime alias
  (`vitest.config.ts` includes only `src/**/*.test.*` and the alias lives in the
  submodule suite), so this module stays **unit-untestable by construction** —
  which is fine and already true of every `Obsidian*` adapter here. Its behaviour
  is covered by e2e (§5, E2 / E3). Grepped: nothing under `src/**/*.test.ts`
  imports it, so nothing breaks.
- **The `getFileByPath` null guard must stay and must cover BOTH branches.**
  `openLinkText` on a non-existent path can prompt Obsidian to *create* a note;
  today's guard is what prevents a stale graph node from creating files. Shape:

```ts
openNote(path: string, options?: OpenNoteOptions): void {
	const file = this.app.vault.getFileByPath(path);
	if (file === null) {
		return;   // stale node: never create a note as a side effect of a click
	}
	const newTab = options?.newTab === true;
	if (options?.heading === undefined) {
		void this.app.workspace.getLeaf(newTab).openFile(file);
		return;
	}
	// `stripHeadingForLink` is Obsidian's own subpath sanitiser (see D6) — it is
	// what "copy link to heading" uses, so our link resolves exactly like a
	// hand-written [[Note#Heading]].
	void this.app.workspace.openLinkText(`${path}#${stripHeadingForLink(options.heading)}`, path, newTab);
}
```

The **duplicate-heading-text** limitation stays and is kept in the README: it is
inherent, and identical to every `[[Note#Heading]]` link in Obsidian — POLS
-consistent with the app rather than a bespoke surprise.

Port change is additive (`src/view/viewPorts.ts`):

```ts
export interface OpenNoteOptions {
	readonly newTab: boolean;
	/** RAW heading text to position at (`OutlineEntry.rawText`); absent = top of the
	 *  note. The ADAPTER sanitises it for linking — callers pass it through verbatim. */
	readonly heading?: string;
}
```

`GraphViewController.openNode` needs **no change** (it already forwards
`options`).

**Pure decision module** (precedent: `nodePinAction.ts`) — `src/view/nodeOpenIntent.ts`:

```ts
export interface ClickModifiers { readonly ctrlKey: boolean; readonly metaKey: boolean; }
/** Ctrl (win/linux) / cmd (mac) = new tab. ONE definition, shared by the node-body
 *  click and outline-entry clicks. */
export function opensInNewTab(modifiers: ClickModifiers): boolean;
/** Open options for a click on an OUTLINE ENTRY: same new-tab gesture + the raw heading. */
export function outlineEntryOpenOptions(rawHeading: string, modifiers: ClickModifiers): OpenNoteOptions;
```

DRY win: `VicinityGraphFlow.onNodeClick` switches to `opensInNewTab(event)`, so
the ctrl/cmd rule exists once. Ctrl/cmd-click on an outline entry therefore
opens a **new tab at that heading** — semantics preserved.

**Double-fire prevention**: each entry is a `<button type="button">` whose
`onClick` calls `event.stopPropagation()` before opening — byte-for-byte the
pattern `PinButton`/`AttachmentChip` already use to keep RF's canvas-level
`onNodeClick` from also firing (RF attaches its node click handler in the same
React tree, so synthetic-event propagation is the right lever).

**Reaching the navigator from inside a node**: React Flow instantiates
`nodeTypes` components itself, so context is the only clean channel (the exact
reasoning already written on `ControlsActionsContext.ts`). Add a third,
one-method context — `src/view/NoteOpenContext.ts` — delivering a minimal port:

```ts
/** The slice of navigation the rich node components need. */
export interface NoteOpenPort { openNote(path: string, options: OpenNoteOptions): void; }
```

provided by `VicinityGraphFlow` as
`useMemo(() => ({ openNote: (p, o) => controller.openNode(p, o) }), [controller])`.
**Rejected**: adding `openNote` to `GraphUiPort` — its doc comment explicitly
splits navigation out of it (SRP). **Rejected**: sniffing `data-*` attributes off
`event.target` in the canvas-level handler (implicit coupling, anti-POLS).

### D7 — `NodeOutline`: the dedicated component boundary (CLARIFICATION Q9)

`src/view/NodeOutline.tsx` owns **everything** about rendering headings inside a
node: the scroll container, the nested list, the labels, the click behaviour.

```ts
export interface NodeOutlineProps {
	/** Vault path of the note this outline belongs to — the open target. */
	readonly notePath: string;
	/** Depth-filtered, budget-capped entries in DOCUMENT ORDER, raw heading text. */
	readonly entries: readonly OutlineEntry[];
}
```

**Props are a primitive + a POJO array — no `FlowNodeData`, no node internals, no
callbacks.** Two consequences that are the whole point of the boundary:

1. `NoteNode` cannot leak node concerns in (it has nothing to pass), and
2. `NodeOutline` gets its own behaviour from `useNoteOpen()` directly, so a
   future iteration (collapse toggles, middle-click, active-heading highlight,
   drag-to-reorder) is a change to **one file** — `NoteNode` never grows a prop.

**Rejected — `onSelectHeading(raw, modifiers)` callback prop.** More "pure
presentation" on paper, but it puts every future interaction back into
`NoteNode`'s prop list — the exact coupling CLARIFICATION Q9 exists to prevent.
It also breaks the established local-component idiom: `PinButton` and
`AttachmentChip` both reach for `useGraphUi()` themselves rather than taking
callbacks from `NoteNode`. Consistency + iterability both point the same way.

Internal shape (implementation detail, stated so review is cheap):

```tsx
export function NodeOutline({ notePath, entries }: NodeOutlineProps): ReactElement {
	// No useMemo: toFlowNodeData mints a fresh `entries` array on EVERY rebuild, so a
	// memo keyed on it could never hit. The work is ≤40 small regex passes.
	const tree = buildOutlineTree(entries);
	return (
		<div className="vicinity-graph-outline nowheel nodrag nopan">
			<OutlineBranch nodes={tree} notePath={notePath} isRoot />
		</div>
	);
}
// OutlineBranch: renders one <ul> (aria-label only when isRoot) and recurses per child.
// OutlineEntryButton: label = outlineEntryLabel(entry.rawText); stopPropagation; openNote.
```

**CSS gets its own file too**: `src/view/node-outline.css`, added to
`AUTHORED_CSS_FILES` in `esbuild.config.mjs` (a one-line change; the list is
explicit, not a glob). WHY: the component boundary the human mandated is hollow
if the styles stay interleaved in a 400-line node stylesheet. The **single**
exception is the density-ladder line (`display: block` at 104px), which stays in
`graph-view.css`'s existing `@container` block so the whole "what shows at what
size" ladder remains readable in one place — with a pointer comment in both
files. Container queries resolve against the nearest ancestor container
regardless of which file the rule came from, so this split is purely editorial.

### D8 — Max-depth setting (COMMITTED — CLARIFICATION Q1 + Q5)

**A field on `ViewSettings` (the `globalView` cascade), NOT a new top-level
global-only shape.** Simpler here despite the `nodeExclusion` precedent:

- Every touch point is one mechanical line (spec leaf, type field,
  `EngineDefaults.viewSettings()`, `parseViewOverride` branch,
  `ViewSettingsResolver.resolve()`, `planSettingsWrite` case reusing the existing
  `global-view` command). No new store method, no new command kind, no new
  `GraphRequestInputs` field.
- **Decisive**: `VicinityGraph.viewSettings` is *already* the transport carrying
  resolved view settings into `flowMapping` (`graph.viewSettings.groupByFolder`
  is read there today) — exactly where the depth filter must run. A
  `nodeExclusion`-shaped global would reach the engine but **not** the view.
- Cost of cascade participation: a hand-edited per-doc `view.outlineMaxDepth`
  would be honoured. No UI writes one; the behaviour is sane if someone does.

Seven touch points (per `EXPLORATION_PUBLIC__settings-and-infra.md` §1):

1. `SETTINGS_SPEC.globalView.outlineMaxDepth: { default: 2, min: 1, max: 6, step: 1 }`
   (`BoundedNumberSpec`), with the WHY on the leaf: markdown has 6 levels; 2 shows
   sections + subsections, which is what fits a ≤160px node.
2. `ViewSettings.outlineMaxDepth: number` (`src/engine/types.ts`).
3. `EngineDefaults.viewSettings()` reads `.default`; `constants.ts` exports
   `DEFAULT_OUTLINE_MAX_DEPTH`, `MIN_OUTLINE_DEPTH`, `MAX_OUTLINE_DEPTH` and
   `clampOutlineMaxDepth(value)` — the ONE clamp shared by parser and slider
   (mirrors `clampForceLayoutSettings`).
4. `parseViewOverride` gains
   `...definedOnly("outlineMaxDepth", clampedOutlineDepthOrUndefined(raw["outlineMaxDepth"]))`
   — clamped, so hand-edited JSON cannot reach `0` (a silent off-switch that
   would contradict CLARIFICATION Q2's "no enable/disable setting") or `99`.
5. `ViewSettingsResolver.resolve()` gains `outlineMaxDepth: field("outlineMaxDepth")`.
6. `settingsWritePlan`: interaction `{ kind: "global-outline-depth"; value: number }`
   → existing `{ kind: "global-view", view: { ...ctx.globalView, outlineMaxDepth } }`.
7. Settings tab: new `renderNodeContent()` section (rendered after `renderSizing()`
   — contents follow size) with one slider "Outline depth", limits read from the
   spec, `setDynamicTooltip()`, routed through `applyInteraction`.
   **IMPLEMENTATION must load the `obsidian-settings` skill** before writing this
   part (section placement, copy, altitude).

### D9 — Display text vs link text (CLARIFICATION Q7 — binding)

`HeadingCache.heading` is the heading's **source** text. `## [[Project A]] **status**`
must render as `Project A status` but must still open via `#[[Project A]] **status**`
sanitised by Obsidian. So the two are deliberately different values, produced at
different layers:

- **Link key** = `OutlineEntry.rawText`, untouched until `ObsidianNoteNavigator`
  hands it to `stripHeadingForLink` (D6).
- **Display label** = `outlineEntryLabel(rawText)`, a pure view module
  (`src/view/outlineEntryLabel.ts`, precedent: `badgeText.ts`).

**This is a small honest helper, NOT a markdown parser.** Ordered pipeline, each
step one regex pass over the string:

```ts
// 1. defensive leading marker (Obsidian already strips it; guards `## ## x`)
//    /^#{1,6}\s+/ → ""            — requires WHITESPACE, so a leading #tag survives
// 2. wikilinks & embeds: /!?\[\[([^\]]+)\]\]/g → replacer: capture.split("|").at(-1)
//    ([[a/b]] → "a/b" — what Obsidian itself displays; [[a|B]] → "B")
// 3. md links & images:  /!?\[([^\]]*)\]\([^)]*\)/g → "$1"
// 4. code spans:         /`([^`]+)`/g   → "$1"
// 5. strong:             /\*\*([^*]+)\*\*/g → "$1"
// 6. emphasis:           /\*([^*]+)\*/g     → "$1"
// 7. highlight / strike: /==([^=]+)==/g, /~~([^~]+)~~/g → "$1"
// 8. collapse /\s+/g → " ", then trim
// 9. if the result is EMPTY, return the trimmed ORIGINAL (never a blank row)
```

**Deliberately NOT handled** — stated in the module doc comment and in the
README's limits section, so nobody mistakes this for a parser:

- `_underscore emphasis_` — stripping `_` would mangle `snake_case_identifiers`,
  which are far more common in headings than underscore italics. Explicit trade.
- Backslash escapes (`\*literal\*`), and markers *inside* code spans (step 4 runs
  before 5–7, so `` `**a**` `` renders as `a`, not `**a**`).
- Markdown link URLs containing `)`, nested/unbalanced markers, HTML tags,
  footnote refs, LaTeX, `[[note#heading]]` → Obsidian's "note > heading" form.
- Anything requiring more than one left-to-right pass.

The failure mode of every unhandled case is *a few stray characters in a display
label* — never a broken link, never a crash. That is the honest boundary that
keeps this at ~25 lines instead of importing a markdown parser into a graph node.

**Rejected — `stripHeading` (obsidian)**: it is a *matching* normaliser for link
resolution, not a display formatter, and it is obsidian-only (unusable in a pure,
unit-tested module). The reviewer flagged the same trap.

**Rejected — computing the label in `flowMapping`**: it is presentation, and
baking it into `FlowNodeData` would mean the outline UI cannot change its own
text treatment without touching the mapping layer + its tests (against
CLARIFICATION Q9).

### D10 — Flat → nested tree (pure)

`src/view/outlineTree.ts`:

```ts
export interface OutlineTreeNode {
	readonly entry: OutlineEntry;
	readonly children: readonly OutlineTreeNode[];
}
/** Flat, document-ordered entries → the nesting the DOM renders (CLARIFICATION Q8).
 *  Real notes are not well-formed trees, so: a deeper level attaches to the nearest
 *  shallower ancestor (skipped levels create NO filler nodes), and an entry with no
 *  shallower ancestor is a ROOT. Document order is preserved everywhere. */
export function buildOutlineTree(entries: readonly OutlineEntry[]): readonly OutlineTreeNode[];
```

Single-pass stack algorithm: keep a stack of open nodes; for each entry pop while
`top.entry.level >= entry.level`; attach to `top.children` if the stack is
non-empty, else push to roots; then push the entry. Built with mutable arrays
internally and returned as `readonly` — no structural sharing games.

Interaction with the two earlier reductions is safe by construction: the depth
filter only removes *deeper* levels (never orphans a shallower one), and the
`OUTLINE_RENDER_LIMIT` slice takes a **prefix**, so it can only truncate a
trailing subtree, never detach a middle one.

### D11 — Accessibility & theming

- **Colors**: `--text-muted` (idle), `--text-normal` (hover),
  `--background-modifier-hover`, `--background-modifier-border-hover` (scrollbar
  thumb), `--interactive-accent` (focus ring), `--font-smallest`, `--size-4-1`,
  `--size-4-2`, `--radius-s`. Zero literal colors — light/dark just work.
- **Keyboard**: entries are real `<button>`s → focusable, Enter/Space activate,
  `:focus-visible` gets the same `box-shadow: 0 0 0 2px var(--interactive-accent)`
  ring the attachment chips use. Below the 104px threshold the region is
  `display: none`, so it is out of the tab order on small nodes (consistent with
  the pin button's ladder).
- **Semantics**: nested `<ul>`/`<li>`/`<button>`; `aria-label="Note outline"` on
  the ROOT list only (nested lists inherit context from the DOM structure —
  labelling each one would make a screen reader announce "Note outline" per
  level). `title={label}` on each button gives the ellipsis tooltip; the
  accessible name is the full label either way.
- **Hover-preview interaction**: the outline is a **sibling of**, not inside,
  `__preview-zone` — its rows are clickable, and the existing dead-zone rule
  (`NoteNode.tsx:58-63`) says interactive tiles must not be covered by the native
  page-preview popover.

---

## 4. Implementation steps (ordered, independently committable)

Each step ends green on `npm test` + `npm run check`. Redirect output to `.tmp/`.
Test ids (T*/E*) refer to §5.

### Step 1 — Outline eligibility predicate (pure)

- **Modify** `src/shared/FileKinds.ts`: add `MARKDOWN_EXTENSION`,
  `EXCALIDRAW_SUFFIX`, `isMarkdownPath`, `isOutlineBearingPath` (case-insensitive
  suffix check).
- **Modify** `src/adapters/ObsidianLinkProvider.ts`: delete the local
  `MARKDOWN_EXTENSION`, use `FileKinds.isMarkdownPath(file.path)` at both
  existing sites (behaviour-preserving; existing tests are the safety net).
- **Tests** → `src/shared/FileKinds.test.ts` (T1–T5).

### Step 2 — `HeadingPort` + reference offsets (adapter plumbing, no behaviour change)

- **Modify** `src/adapters/obsidianPorts.ts`: add `HeadingPort`, add
  `headings?: readonly HeadingPort[]` to `CachedMetadataPort`.
- **Modify** `src/adapters/ReferenceOrder.ts`: add `OrderedReference`,
  `FRONTMATTER_REFERENCE_OFFSET`, `orderedReferences()`; `orderedLinkTexts()`
  becomes a one-line projection of it (single ordering truth).
- **Tests** → `src/adapters/ReferenceOrder.test.ts` (T6–T7).

### Step 3 — Outline through the engine seam + the image-vs-outline rule

- **Modify** `src/engine/types.ts`: `OutlineEntry`; `GraphNode.outline`.
- **Modify** `src/engine/LinkProvider.ts`: `FileMetadata.outline` (+ D1 doc).
- **Modify** `src/engine/index.ts`: export `OutlineEntry`.
- **Modify** `src/engine/VicinityTraversal.ts`: `TraversedNode.outline`, echoed
  in `assemble()` next to `attachments`.
- **Modify** `src/engine/FakeLinkProvider.ts`: `FakeFileSpec.outline?`, wired in
  `declareFile` (default `[]`).
- **Modify** `src/adapters/ObsidianLinkProvider.ts`: `orderedMarkdownReferences`,
  `firstImageOffsetOf`, `outlineOf`; `getFileMetadata` reads the cache once and
  passes it down.
- **Tests** → `src/adapters/ObsidianLinkProvider.test.ts` (new `describe("note
  outline")`, T8–T21), `src/engine/FakeLinkProvider.test.ts` (T22–T23),
  `src/engine/VicinityTraversal.test.ts` (T24–T25),
  `src/engine/VicinityEngine.test.ts` (T26).

### Step 4 — `outlineMaxDepth` setting, end to end (inert until step 5)

- **Modify** `src/engine/SettingsSpec.ts`, `src/engine/types.ts`,
  `src/engine/constants.ts` (+ `clampOutlineMaxDepth`), `src/engine/index.ts`
  (export the new constants), `src/engine/ViewSettingsResolver.ts`,
  `src/persistence/persistedShapes.ts`, `src/view/settingsWritePlan.ts`,
  `src/view/VicinityGraphSettingTab.ts`.
- **Load the `obsidian-settings` skill** before writing the settings-tab section.
- **Tests** → `src/engine/SettingsSpec.test.ts`, `src/engine/settingsResolvers.test.ts`
  (T44–T48), `src/persistence/persistedShapes.test.ts` (T49–T53),
  `src/view/settingsWritePlan.test.ts` (T54–T55).

### Step 5 — View mapping: depth filter + render budget

- **Modify** `src/view/constants.ts`: `OUTLINE_RENDER_LIMIT = 40` with the WHY
  (≈3–6 entries are visible at once; 40 is ~7 screens of scroll and bounds the
  DOM per node — a generated 500-heading note must not mount 500 buttons).
- **Modify** `src/view/flowMapping.ts`: `FlowNodeData.outline: readonly OutlineEntry[]`;
  in `toFlowNodeData`,
  `node.outline.filter((e) => e.level <= maxDepth).slice(0, OUTLINE_RENDER_LIMIT)`
  — filter **then** slice, so a depth-2 view of a note with 60 deep headings still
  finds its shallow ones. `maxDepth` comes from `graph.viewSettings.outlineMaxDepth`,
  threaded through `vicinityGraphToFlow` → `toFlowNodeData` as a plain number
  (`toFlowNodeData` needs nothing else from `ViewSettings`).
- **Tests** → `src/view/flowMapping.test.ts` (T27–T29 + T31–T34… see §5),
  `src/view/GraphStructureDiff.test.ts` (T30).

### Step 6 — Navigation seam (heading-targeted open)

- **Add** `src/view/nodeOpenIntent.ts` (+ `.test.ts`) — `opensInNewTab`,
  `outlineEntryOpenOptions`. **No `headingLinktext`** (review M1).
- **Modify** `src/view/viewPorts.ts`: `OpenNoteOptions.heading?`, `NoteOpenPort`.
- **Add** `src/view/NoteOpenContext.ts` (mirrors `ControlsActionsContext.ts`).
- **Modify** `src/view/ObsidianNoteNavigator.ts`: `stripHeadingForLink` +
  `openLinkText` branch, with the `getFileByPath` guard kept ahead of both
  branches (D6).
- **Modify** `src/view/VicinityGraphFlow.tsx`: provide `NoteOpenContext`; use
  `opensInNewTab(event)` in `onNodeClick`.
- **Tests** → `src/view/nodeOpenIntent.test.ts` (T35–T39),
  `src/view/GraphViewController.test.ts` (T40–T41).

### Step 7 — Outline presentation logic (pure, no UI yet)

Three small pure modules + their tests. Committable and reviewable on its own —
this is where the correctness of the new UI actually lives, given no RTL/jsdom.

- **Add** `src/view/outlineEntryLabel.ts` (+ `.test.ts`) — D9. The doc comment
  must list the "deliberately NOT handled" set verbatim.
- **Add** `src/view/outlineTree.ts` (+ `.test.ts`) — D10.
- **Add** `src/view/nodePreviewChoice.ts` (+ `.test.ts`) — D3b.
- **Tests** → T56–T64 (label), T65–T70 (tree), T71–T73 (preview choice).

### Step 8 — Rendering: `NodeOutline` component + CSS

- **Add** `src/view/NodeOutline.tsx` — D7 (`NodeOutline`, `OutlineBranch`,
  `OutlineEntryButton`). Consumes `useNoteOpen()`; imports `buildOutlineTree`,
  `outlineEntryLabel`, `outlineEntryOpenOptions`.
- **Add** `src/view/node-outline.css` — D5(a)–(d), D11.
- **Modify** `esbuild.config.mjs`: one line in `AUTHORED_CSS_FILES`.
- **Modify** `src/view/graph-view.css`: add `.vicinity-graph-outline { display: block; }`
  inside the existing `@container (min-height: 104px)` block (+ pointer comment
  to `node-outline.css`), and the
  `[data-preview="outline"] .vicinity-graph-node__preview-zone { flex: 0 0 auto; }` rule.
- **Modify** `src/view/NoteNode.tsx` — small and mechanical:
  `const preview = nodePreviewKind({ outlineEntryCount: data.outline.length, hasImage: data.firstImagePath !== undefined });`
  → `data-preview={preview}` on the root, thumbnail block guarded by
  `preview === "thumbnail"`, and `{preview === "outline" && <NodeOutline notePath={data.path} entries={data.outline} />}`
  as a **sibling of** `__preview-zone` (D11). `firstImagePath` stays mapped and
  honest ("this note's first image"); the view picks ONE region.
- No vitest (DOM) — covered by Step 9.
- **Verify** `npm run build` regenerates `styles.css` containing the new file.

### Step 9 — Dev-vault fixtures + Playwright e2e

- **Modify** `scripts/setup-dev-vault.sh`: `write_if_missing` two notes.
  - `outline-note.md`: **≥10 headings at levels 1–2** so the list provably
    overflows a ≤160px node at the DEFAULT depth of 2 (reviewer m6), arranged so
    at least one level-1 has ≥2 level-2 children (proves nesting); **plus** two
    level-3 headings (depth assertion), **plus** one heading carrying inline
    markdown — `## Status of [[note1]] **today**` — to prove display stripping
    end to end; **plus** a link to `note1` and an image embedded **after** the
    first heading.
  - `outline-cover.md`: image embedded **before** the first heading.
  - Both linked from an existing central so they render in a graph.
- **Add** `e2e/nodeOutline.e2e.ts` (E1–E5, §5).
- **Manual dev-vault check (not automated, replaces the dropped cursor-line
  assertion)**: click an entry deep in `outline-note.md` and confirm Obsidian
  scrolls to and flashes that heading, in BOTH editing and reading view. Record
  the result in the commit message.

### Step 10 — Docs + follow-up ticket

- `README.md`:
  - "Settings model → Global defaults" gains the **Outline depth** bullet.
  - New short "Node contents" paragraph: outline-vs-image and the escape hatch
    (put the image before the first heading).
  - "V1 scope / limits" gains three honest limitations: duplicate heading text
    jumps to the first match (like any `[[Note#Heading]]` link); `*.excalidraw.md`
    shows no outline; heading **display** strips common inline markdown but is
    not a full markdown renderer (D9's not-handled list, summarised in one line).
  - **Removed vs the previous draft**: the "`#` in a heading opens at the top"
    limitation no longer exists (D6).
- `docs-internal/plan/high-level-plan.md` → "Rendering and interaction": add the
  outline-preview bullet (container-query gated, mutually exclusive with the
  thumbnail, depth-capped, nested list) and extend the interactions bullet with
  "clicking an outline entry opens the note at that heading".
- `docs-internal/architecture-map.md` → "Key seams": `view/viewPorts.ts`'s
  `NoteNavigatorPort` now opens at an optional heading; node components reach it
  through `NoteOpenContext`; `NodeOutline.tsx` owns in-node outline rendering
  (and `node-outline.css` its styles).
- **Add** `docs-internal/tickets/ticket-node-outline-live-refresh.md` (see §7).
- **Do NOT** write a `change_log` entry — TOP_LEVEL_AGENT does that once.

---

## 5. Acceptance criteria — concrete automated tests

BDD `it("WHEN … THEN …")`, one behaviour per test, colocated, `Fake*` fixtures.
**72 vitest + 6 e2e cases** (E1 is written as 3 sibling `it`s, so 8 e2e `it`s).
The reviewed draft had 55 vitest; 3 were cut (two vacuous, one deleted with
`headingLinktext`) and 20 were added for the three new pure modules mandated by
CLARIFICATION Round 3.

### `src/shared/FileKinds.test.ts`
- **T1** WHEN the path is `notes/a.md` THEN `isOutlineBearingPath` is true.
- **T2** WHEN the path is `draw/x.excalidraw.md` THEN `isOutlineBearingPath` is false.
- **T3** WHEN the path is `draw/X.Excalidraw.MD` THEN `isOutlineBearingPath` is false (case-insensitive).
- **T4** WHEN the path is `board.canvas` THEN `isOutlineBearingPath` is false.
- **T5** WHEN the path is `draw/x.excalidraw.md` THEN `isNodeBearingPath` is still true (Q4: excluded from parsing only).

### `src/adapters/ReferenceOrder.test.ts`
- **T6** WHEN a cache has frontmatter and body links THEN `orderedReferences` puts frontmatter links first with `FRONTMATTER_REFERENCE_OFFSET`.
- **T7** WHEN body links and embeds interleave THEN `orderedReferences` returns them ascending by offset.
- *(the reviewed draft's "orderedLinkTexts equals orderedReferences().map(…)" test is **cut** — it restated the implementation and could not fail independently; the existing `orderedLinkTexts` ordering tests already pin the behaviour.)*

### `src/adapters/ObsidianLinkProvider.test.ts` — `describe("note outline")`, `FakeObsidianPorts`
- **T8** WHEN a markdown file's cache carries headings THEN `getFileMetadata().outline` lists their raw text in document order.
- **T9** WHEN a markdown file's cache carries headings THEN each entry carries the heading's `level`.
- **T10** WHEN a heading's source contains inline markdown THEN `rawText` preserves it verbatim (it is the link key, D1).
- **T11** WHEN the file is a `.canvas` THEN `outline` is empty.
- **T12** WHEN the file is `*.excalidraw.md` THEN `outline` is empty.
- **T13** WHEN the file is `*.excalidraw.md` THEN `isNodeBearing` is still true. *(kept despite the reviewer's optional-cut note: different unit from T5, and it guards the exact CLARIFICATION Q4 confusion this feature invites.)*
- **T14** WHEN the cache has no `headings` key THEN `outline` is empty.
- **T15** WHEN `getFileCache` returns `null` for a markdown file THEN `outline` is empty (cache-miss branch — distinct from T14).
- **T16** WHEN the note has headings and NO image THEN `outline` carries the headings.
- **T17** WHEN the note's first image is embedded BEFORE the first heading THEN `outline` is empty (the image wins).
- **T18** WHEN the note's first image is embedded AFTER the first heading THEN `outline` carries the headings.
- **T19** WHEN the note's image is a FRONTMATTER link THEN `outline` is empty (frontmatter sits above all body content).
- **T20** WHEN the note has an image and no headings THEN `outline` is empty.
- **T20b** WHEN a NON-image attachment precedes the first heading but the first image follows it THEN `outline` carries the headings.
- **T21** WHEN a file carries an outline THEN `attachments` is unchanged — assert the full ORDERED array (`toEqual([...])`): the `resolvedOutgoingPaths` refactor's only real hazard is a reordering that silently moves `firstImagePath`.

### `src/engine/FakeLinkProvider.test.ts`
- **T22** WHEN a fixture file declares an outline THEN `getFileMetadata().outline` returns it.
- **T23** WHEN a fixture file declares none THEN `outline` is an empty array (never `undefined`).

### `src/engine/VicinityTraversal.test.ts`
- **T24** WHEN a visited file's metadata carries an outline THEN the traversed node echoes it.
- **T25** WHEN it carries none THEN the traversed node's outline is empty.

### `src/engine/VicinityEngine.test.ts`
- **T26** WHEN a graph is built THEN each `GraphNode` carries its file's outline (spread-through guard).

### `src/view/flowMapping.test.ts`
- **T27** WHEN `outlineMaxDepth` is 2 THEN level-3+ entries are dropped from `FlowNodeData.outline`.
- **T28** WHEN `outlineMaxDepth` is 2 THEN level-1 and level-2 entries survive in document order.
- **T29** WHEN `outlineMaxDepth` is 6 THEN every level survives.
- **T31** WHEN a node has more surviving entries than `OUTLINE_RENDER_LIMIT` THEN only the first `OUTLINE_RENDER_LIMIT` are mapped.
- **T32** WHEN entries deeper than the cap outnumber the limit THEN the shallow ones still map (filter runs BEFORE slice).
- **T33** WHEN the engine node has an empty outline THEN `FlowNodeData.outline` is `[]`, never `undefined`.
- **T34** WHEN a node has BOTH an outline and a `firstImagePath` THEN `firstImagePath` is still mapped (the view, not the mapping, picks one region).
- *(the reviewed draft's "two independent mappings are `toEqual`" test is **cut** — `toFlowNodeData` is pure, so it could never fail. T30 is the real stability contract.)*

### `src/view/GraphStructureDiff.test.ts`
- **T30** WHEN only a node's outline changed between rebuilds THEN `decideLayout` still returns `"reuse-layout"` (outline data never forces a relayout).

### `src/view/nodeOpenIntent.test.ts`
- **T35** WHEN ctrl is held THEN `opensInNewTab` is true.
- **T36** WHEN meta (cmd) is held THEN `opensInNewTab` is true.
- **T37** WHEN no modifier is held THEN `opensInNewTab` is false.
- **T38** WHEN an outline entry is clicked without a modifier THEN the options carry that RAW heading and `newTab: false`.
- **T39** WHEN an outline entry is ctrl-clicked THEN the options carry that RAW heading and `newTab: true`.
- *(the reviewed draft's `headingLinktext` test is **deleted** with the function — review M1.)*

### `src/view/GraphViewController.test.ts`
- **T40** WHEN `openNode` is called with a heading THEN the fake navigator receives that heading verbatim (pass-through guard — sanitising is the adapter's job).
- **T41** WHEN `openNode` is called on a folder-group id THEN the navigator is not called (existing behaviour, still true with the new field).

### `src/engine/SettingsSpec.test.ts` / `settingsResolvers.test.ts`
- **T44** WHEN `EngineDefaults.viewSettings()` is built THEN `outlineMaxDepth` equals the spec default (2).
- **T45** WHEN a value below the spec min is clamped THEN `clampOutlineMaxDepth` returns the min.
- **T46** WHEN a value above the spec max is clamped THEN it returns the max.
- **T47** WHEN MAIN pins `outlineMaxDepth` THEN `ViewSettingsResolver.resolve` returns the pinned value (cascade participation).
- **T48** WHEN nobody pins it THEN `resolve` returns the global value.

### `src/persistence/persistedShapes.test.ts`
- **T49** WHEN `data.json` carries `globalView.outlineMaxDepth: 4` THEN `parsePluginData` round-trips 4.
- **T50** WHEN it carries `outlineMaxDepth: 0` THEN parsing clamps it to the spec min (never a silent off-switch).
- **T51** WHEN it carries `outlineMaxDepth: 99` THEN parsing clamps it to the spec max.
- **T52** WHEN `outlineMaxDepth` is absent THEN the default applies.
- **T53** WHEN `outlineMaxDepth` is a non-number THEN the default applies.

### `src/view/settingsWritePlan.test.ts`
- **T54** WHEN a `global-outline-depth` interaction is planned THEN the command is a `global-view` write carrying the new depth.
- **T55** WHEN it is planned THEN every other `globalView` field is preserved.

### `src/view/outlineEntryLabel.test.ts` (NEW — CLARIFICATION Q7)
- **T56** WHEN the heading is plain prose THEN the label is that text unchanged.
- **T57** WHEN the heading contains `**bold**` THEN the label drops the asterisks.
- **T58** WHEN the heading contains a `` `code` `` span THEN the label drops the backticks.
- **T59** WHEN the heading contains `[[folder/note]]` THEN the label is `folder/note` (what Obsidian itself displays).
- **T60** WHEN the heading contains `[[note|Alias]]` THEN the label is `Alias`.
- **T61** WHEN the heading contains `[Label](https://example.com)` THEN the label is `Label`.
- **T62** WHEN the heading contains `snake_case_name` THEN the label is unchanged (underscore emphasis is deliberately NOT stripped — D9).
- **T63** WHEN stripping would leave an empty string (e.g. the heading is just `****`) THEN the raw text is returned (never a blank row).
- **T64** WHEN the raw heading begins with a stray `## ` marker THEN the label drops it (CLARIFICATION Q7's "no `##` in the display", locally verifiable).

### `src/view/outlineTree.test.ts` (NEW — CLARIFICATION Q8)
- **T65** WHEN entries are H1, H2, H2 THEN the tree is one root with two children in document order.
- **T66** WHEN entries are two H1s THEN the tree has two roots.
- **T67** WHEN the first entry is H3 THEN it is a ROOT (no synthetic ancestors are invented).
- **T68** WHEN levels jump H1 → H3 THEN the H3 is a direct child of the H1 (no filler node).
- **T69** WHEN a shallower heading follows a deeper one (H1, H3, H2) THEN the H2 becomes a child of the H1.
- **T70** WHEN the entry list is empty THEN the tree is empty.

### `src/view/nodePreviewChoice.test.ts` (NEW — D3b)
- **T71** WHEN the node has outline entries and an image THEN the preview kind is `"outline"`.
- **T72** WHEN the node has no outline entries but has an image THEN the preview kind is `"thumbnail"`.
- **T73** WHEN the node has neither THEN the preview kind is `"none"` (no preview region is claimed).

### Playwright e2e (`e2e/nodeOutline.e2e.ts`) — release gate, NOT `npm test`
DOM-only behaviours no vitest test can reach (no RTL/jsdom). Reuse
`obsidianHarness.ts`; follow the "click a BIG node" caveat
(`vicinityGraph.e2e.ts:195-206`) — outline entries only exist on ≥104px nodes,
so run these on the small alpha-style graph where nodes render large.

- **E1** WHEN a large node's note has headings and no leading image THEN
  `.vicinity-graph-outline` renders the expected entry labels, **nested**
  (assert a `.vicinity-graph-outline__list .vicinity-graph-outline__list` exists
  and contains the expected child), with **no level-3 entry** at the default
  depth of 2, and with the markdown-carrying heading rendered **stripped**
  (`Status of note1 today`, no `[[`/`**`) — one assertion per test, so this is
  written as 3 sibling `it`s in a shared `describe`.
- **E2** WHEN an outline entry is clicked THEN the plugin asks Obsidian to open
  that subpath: a pre-installed spy on `app.workspace.openLinkText` (installed
  and restored inside `page.evaluate`, delegating to the original) recorded
  `"<path>#<raw heading>"`.
  *(Re-scoped per review M3. We assert OUR side of the documented contract — the
  linktext we hand to Obsidian. Whether Obsidian then scrolls the editor, moves a
  cursor, or flashes the heading is Obsidian's contract and is not assertable in
  reading view; the reviewed draft's "editor cursor line" assertion is dropped as
  a coincidence-assertion. The human-visible behaviour is covered by Step 9's
  manual dev-vault check.)*
- **E3** WHEN an outline entry is clicked THEN that note becomes the active file
  (the click opens the note, and the canvas-level node handler did not open a
  different one).
- **E4** WHEN the node is hovered THEN the outline's computed `scrollbar-color`
  changes from the transparent idle value (hover-only scrollbar).
- **E5** WHEN the outline overflows (assert `scrollHeight > clientHeight` FIRST,
  as an explicit precondition) and the scrollbar is hidden THEN setting
  `scrollTop` still moves the list (scrolling works while invisible).
- **E6** WHEN a note's first image precedes its first heading THEN that node
  renders `.vicinity-graph-node__thumbnail` and NO `.vicinity-graph-outline`
  (the escape hatch, end to end).

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| `nowheel` swallows canvas zoom while the pointer is over an outline that does not overflow | Accepted + commented; the alternative needs JS overflow measurement |
| Duplicate heading text jumps to the first occurrence | Documented in README; identical to Obsidian's own `[[Note#Heading]]` behaviour |
| `outlineEntryLabel` leaves stray characters on markdown it does not handle (D9) | Bounded, listed in the module doc + README; worst case is cosmetic — the LINK never depends on it |
| `ObsidianNoteNavigator` becomes unit-untestable (value import of `obsidian`) | Already true of every `Obsidian*` adapter here; the heading branch is covered by e2e E2/E3 and by the manual check in Step 9 |
| Nesting spacing wrong for real notes (first iteration) | One CSS knob (D5b), one file (`node-outline.css`), no TS change — cheap to re-tune |
| Outline arrays computed for every *visited* file, not just rendered ones | Bounded in practice (tens of headings × ≤ node cap); the render budget caps DOM, not memory. **No adapter-side cap**: applied before the depth filter it would silently hide a deep-heading note's shallow headings — a lie we refuse to ship. Revisit only with a measurement |
| Container-query `size` containment + inner scroll | `min-height: 0` on the flex child; node height is fixed by React Flow, so containment is safe |
| Refactor of `resolvedOutgoingPaths` touches the thumbnail path | Guarded by existing attachment/`firstImagePath` tests + the tightened T21 |
| e2e flakiness on node clicks (known: `ticket-e2e-node-click-flaky-headless.md`) | Reuse the big-node pattern; keep the new file separate so it can be quarantined |

---

## 7. Follow-up ticket (file, do NOT implement)

`docs-internal/tickets/ticket-node-outline-live-refresh.md` — **verify-first**
(CLARIFICATION Q6, binding).

The plugin **does** already register `metadataCache.on("resolved")`
(`src/view/VicinityGraphView.tsx:115` → `controller.handleMetadataResolved()`,
debounced `REBUILD_DEBOUNCE_MS = 500`), so edited headings very likely already
refresh. The ticket therefore reads: *verify refresh latency in a real vault
while editing headings; only if `resolved` proves noticeably laggy, add a
debounced `metadataCache.on("changed")` trigger.* **No speculative work now.**

---

## 8. Deliberately scoped OUT

- Outline content influencing node **width** or **height** (would break the
  mapping-time box React Flow's culling/`fitView` depend on).
- Collapsible outline trees, active-heading highlighting, heading counts,
  drag/reorder. (The `NodeOutline` boundary exists so these are cheap later.)
- A full markdown renderer for heading text — D9's bounded stripper only.
- Outlines for canvas or `*.excalidraw.md` (CLARIFICATION Q4).
- Persisting anything per-note about outlines.
- A per-doc override UI for `outlineMaxDepth` (the field cascades, but no surface
  writes one — global slider only).
- Frontmatter-driven per-note "prefer image/outline" overrides (the documented
  escape hatch is the image's position).
- The live-refresh trigger (ticket above).

---

## 9. Questions

**None.** CLARIFICATION Rounds 2 and 3 closed both prior `#QUESTION_FOR_HUMAN`
items and the reviewer's. Nothing in this plan requires a hack.
