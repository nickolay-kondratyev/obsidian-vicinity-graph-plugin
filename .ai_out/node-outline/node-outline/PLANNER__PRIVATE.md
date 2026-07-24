# PLANNER__PRIVATE — node-outline

Rehydration memory. Public deliverables (same dir): `DETAILED_PLANNING__PUBLIC.md`
(the plan) and `PLAN_ITERATION__PUBLIC.md` (review dispositions).

**Status after iteration 2: plan is APPROVED-SHAPE / READY FOR IMPLEMENTATION.
Zero open `#QUESTION_FOR_HUMAN`. Nothing implemented yet.**

## Source facts verified (do not re-read unless suspicious)

### Verified by iteration 1
| Fact | Where |
|---|---|
| `FileMetadata` = folder/sizeBytes/frontmatterTitle?/isNodeBearing/attachments; doc says "ADAPTER truth" | `src/engine/LinkProvider.ts:9-29` |
| `getFileMetadata` assembles it; `frontmatterTitleOf` gates on `extension !== "md"`; `attachmentsOf` = non-node-bearing `resolvedOutgoingPaths` | `src/adapters/ObsidianLinkProvider.ts:111-123,131-148,206-211` |
| `resolvedOutgoingPaths` markdown branch resolves `ReferenceOrder.orderedLinkTexts` via `getFirstLinkpathDest`, then dedupes | same, `:150-174` |
| `ReferenceOrder.orderedLinkTexts` = frontmatter links first, then body links+embeds by `position.start.offset` (offset then DISCARDED) | `src/adapters/ReferenceOrder.ts` |
| `CachedMetadataPort` has links/embeds/frontmatterLinks/frontmatter, **no headings**; `ReferencePort.position.start.offset` only | `src/adapters/obsidianPorts.ts:34-52` |
| `VicinityEngine` builds `GraphNode` as `{...traversedNode, isMain, sizeScore, sizePx}` → new `TraversedNode` fields reach `GraphNode` free | `src/engine/VicinityEngine.ts:71-88` |
| `assemble()` picks `firstImage = metadata.attachments.find(isImage)` | `src/engine/VicinityTraversal.ts:152-164` |
| `decideLayout` compares ONLY node ids, edge ids, groupByFolder, forceLayout, sizePx growth — never node data | `src/view/GraphStructureDiff.ts:24-48` |
| `decideActiveFileRebuild` is path-only | `src/view/RebuildDecision.ts` |
| `flowMapping` reads `graph.viewSettings.groupByFolder` → viewSettings already reach the view | `src/view/flowMapping.ts:148` |
| memo contract test = PRIMITIVE useMemo key for `ui.resourcePath` (no img refetch), not deep diffing | `src/view/flowMapping.test.ts:412-447` |
| `GraphViewController.openNode(path, options?)` forwards options unchanged → no controller change | `src/view/GraphViewController.ts:173-178` |
| `ControlsActionsContext.ts` doc: "React Flow instantiates nodeTypes itself, so context is the only clean channel" | `src/view/ControlsActionsContext.ts` |
| `metadataCache.on("resolved")` IS registered → debounced (500ms) rebuild | `src/view/VicinityGraphView.tsx:115` |
| tsconfig: strict + `noUncheckedIndexedAccess` + `noImplicitReturns`; `exactOptionalPropertyTypes` OFF | `tsconfig.json` |
| SETTINGS_SPEC nesting mirrors persisted shapes; `clampForceLayoutSettings` shared by sliders + parser | `src/engine/SettingsSpec.ts`, `constants.ts:76-98` |
| Settings tab: `createSection()` per card, `applyInteraction()` is the single write path | `src/view/VicinityGraphSettingTab.ts:75-77,339-360` |
| Dev-vault fixtures are `write_if_missing` heredocs — adding a NEW note works on existing vaults | `scripts/setup-dev-vault.sh` |
| e2e: `e2e/*.e2e.ts`, real Obsidian, serial, workers:1; node-click tests need BIG nodes (alpha graph) | `e2e/vicinityGraph.e2e.ts:195-238` |

### Verified by iteration 2 (me)
| Fact | Where |
|---|---|
| `export function stripHeadingForLink(heading: string): string;` — `@public`, NO `@since` → safe at minAppVersion 1.12.4. `stripHeading` sits at :6835 (matching normaliser, NOT a display formatter) | `node_modules/obsidian/obsidian.d.ts:6841` |
| `ObsidianNoteNavigator` currently `import type { App }` ONLY → adding `stripHeadingForLink` makes it a VALUE import | `src/view/ObsidianNoteNavigator.ts:1` |
| `vitest.config.ts` = `include: ["src/**/*.test.{ts,tsx}"]`, **no obsidian alias** (that's the submodule suite) → any module with a value `obsidian` import is unit-untestable here | `vitest.config.ts` |
| Nothing under `src/**/*.test.ts` imports `ObsidianNoteNavigator` (only `VicinityGraphView.tsx:15,54`) → the value import breaks nothing | grep |
| `OpenNoteOptions` = `{ newTab }` only; `openNote(path, options?)` on `NoteNavigatorPort` | `src/view/viewPorts.ts:56-67` |
| Authored CSS is an EXPLICIT LIST, not a glob → a new css file needs 1 line in `AUTHORED_CSS_FILES` | `esbuild.config.mjs:45-56` |
| Node CSS confirmed: `container-type: size`, `@container (min-height: 72px)` = attachments+pin, `(min-height: 104px)` = thumbnail; `__preview-zone` is `flex: 1 1 auto; min-height: 0`; every color an Obsidian var; no scrollbar rules exist | `src/view/graph-view.css:63-301` |
| Local-component idiom: `PinButton` / `AttachmentChip` call `useGraphUi()` THEMSELVES (no callback props from `NoteNode`); own BEM block (`vicinity-graph-pin-button`) inside a node-owned container class | `src/view/NoteNode.tsx:118-180` |
| `FileKinds` has only `isNodeBearingPath` + `isImagePath`; extension sets are module-level consts | `src/shared/FileKinds.ts` |
| e2e harness gives `page.evaluate` + `window.app` access (used for `openFile`, plugin enable, mode switch) → an `openLinkText` spy is idiomatic there | `e2e/obsidianHarness.ts:214-330` |

## Decisions (final after iteration 2)

Carried over unchanged from iteration 1: `OutlineEntry` shape (now `rawText`),
required `FileMetadata.outline`, adapter encodes image-wins as `[]`,
`ReferenceOrder.orderedReferences` as single ordering truth, array (not string)
on `FlowNodeData`, `FileKinds.isOutlineBearingPath`, 104px container-query
gating + `data-preview` preview-zone shrink, hover-only scrollbar via
`scrollbar-color` (thumb, not width), `nowheel` on the scroll container,
`openLinkText` over `eState.line`, `NoteOpenContext` + `NoteOpenPort`,
`ViewSettings.outlineMaxDepth` with a shared clamp, depth filter + limit in
`flowMapping` (filter BEFORE slice).

**Changed / added in iteration 2:**

1. **`stripHeadingForLink` in `ObsidianNoteNavigator`** (review M1). Deleted
   `nodeOpenIntent.headingLinktext` + its test. **Kept the `getFileByPath` null
   guard ahead of both branches** — `openLinkText` on a missing path can CREATE a
   note. Accepted: the navigator becomes unit-untestable (already true of every
   `Obsidian*` adapter).
2. **`OutlineEntry.text` → `rawText`.** Naming must match behaviour; `text`
   invites `{entry.text}` in JSX, which Q7 forbids.
3. **`src/view/outlineEntryLabel.ts`** (D9): 9-step ordered regex pipeline,
   empty-result falls back to raw. Explicit non-goals: `_underscore_` (would
   mangle `snake_case`), escapes, markers inside code spans, `)` in link URLs,
   `[[note#heading]]`, HTML, LaTeX. Rejected `stripHeading` for display.
4. **`src/view/outlineTree.ts`** (D10): stack-based flat→nested. Deeper level
   attaches to nearest shallower ancestor; no filler nodes; no ancestor ⇒ root.
   Safe with the depth filter (removes only deeper) and the prefix slice.
5. **`src/view/nodePreviewChoice.ts`** (D3b): `"outline" | "thumbnail" | "none"`.
   This is my answer to BOTH reviewer m5 and the parent's "re-examine image-wins"
   ask: keep the lossy `[]` encoding at the ENGINE SEAM (no consumer can tell the
   difference; a discriminated `preview` on `FileMetadata` would have to swallow
   `firstImagePath`/`imageCount` too), make the 3-way choice explicit at the VIEW,
   which is the layer that actually makes it.
6. **`src/view/NodeOutline.tsx`** (Q9) with props `{ notePath, entries }` — NO
   callback prop. Rejected `onSelectHeading` because it routes every future
   interaction back through `NoteNode`'s props (the coupling Q9 forbids) and
   breaks the `PinButton`/`AttachmentChip` idiom. Own BEM block
   `vicinity-graph-outline{,__list,__item,__entry}`.
7. **Nested `<ul>`, not a `data-level` padding ladder** (Q8). Full list reset
   (`margin/padding/list-style`) is load-bearing; ONE nesting knob:
   `.__list .__list { padding-inline-start: var(--size-4-2) }` (8px).
8. **`src/view/node-outline.css`** + 1 line in `esbuild.config.mjs`. The ONE
   exception: the `display: block` density line stays in `graph-view.css`'s
   existing 104px block so the LOD ladder is readable in one place.
9. **e2e 57 re-scoped** (review M3): spy on `app.workspace.openLinkText` inside
   `page.evaluate` → assert the linktext WE build (E2) + active file (E3). Dropped
   the cursor-line assertion entirely; Obsidian's scroll/flash goes to a MANUAL
   dev-vault check in Step 9.
10. **Cut** vacuous tests (old 8, old 32). **Kept** old test 13 against the
    reviewer's optional cut — different unit from the `FileKinds` test, guards the
    Q4 "excluded from outlines ≠ excluded from graph" confusion.
11. Steps 9 → 10 (new Step 7 = the three pure presentation modules, before JSX).

## Open threads / notes for whoever comes next

- Entry-budget arithmetic (≈3 entries at 104px, ≈6 at 160px) is CALCULATED, not
  measured. First dev-vault smoke should check it; the honest lever if cramped is
  `line-height`/font-size, NOT a new breakpoint.
- Nesting spacing (8px) is a first-iteration guess; it is deliberately a single
  CSS selector so re-tuning costs nothing.
- IMPLEMENTATION must load the `obsidian-settings` skill before writing the
  settings-tab section (Step 4).
- Ticket-convention ambiguity (`ticket` CLI `_tickets/` vs
  `docs-internal/tickets/*.md`): I use `docs-internal/tickets/` because
  CLARIFICATION says so verbatim. Re-file if the human prefers the CLI.
- If a future round asks to unify display and link text: refuse. `rawText` is the
  link key; `outlineEntryLabel` is display-only. D9 explains why.
