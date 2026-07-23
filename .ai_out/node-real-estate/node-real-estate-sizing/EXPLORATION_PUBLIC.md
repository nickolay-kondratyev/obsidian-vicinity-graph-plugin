# Node Real Estate: Sizing/Rendering Exploration

> Read-only exploration for the task: reduce node horizontal width to fit label,
> reduce unused vertical height, and remove the folder-name prefix from node titles.

## 1. Node component
- `src/view/NoteNode.tsx` — custom React Flow "note" node.
  - Root div `.vicinity-graph-node` (l.76-81), `data-tier={data.tier}`.
  - Title block l.87-92. Breadcrumb: `data.breadcrumbFolder !== undefined` →
    `<span className="vicinity-graph-node__breadcrumb">{data.breadcrumbFolder}/</span>` (l.88-90) then `{data.title}` (l.91).
  - `FlowNodeData` type in `src/view/flowMapping.ts:50-70`; `breadcrumbFolder?` at l.58.
  - Doc comment (l.13-20): density adapts via CSS **container queries**, no JS measuring.

## 2. Folder prefix source
- `src/view/graphIdentity.ts:49-54` `breadcrumbFolderOf(node, isGrouped)`:
  - `undefined` if grouped or vault-root; else `VaultPathFacts.folderNameOf(node.folder)` (last segment only).
- Call sites (must agree): `flowMapping.ts:176` (RF) and `elkMapping.ts:38` (elk layout).
- Rendered `NoteNode.tsx:88-90`; styled `graph-view.css:149-153` (`color: var(--text-faint)` = grayed prefix).

## 3. Sizing (width) — the main horizontal lever
- View-layer, NOT engine. `src/view/graphIdentity.ts:69-74` `nodeDimensionsPx`:
  - `width: Math.max(node.sizePx, estimateNodeLabelWidthPx(node.title, breadcrumbFolder))`
  - `height: node.sizePx`
- `estimateNodeLabelWidthPx` in `src/view/constants.ts:43-47`:
  - `breadcrumbChars = breadcrumbFolder===undefined ? 0 : breadcrumbFolder.length+1`
  - `charCount = breadcrumbChars + title.length`
  - `Math.ceil(charCount * NODE_TITLE_CHAR_WIDTH_PX) + NODE_LABEL_HORIZONTAL_PADDING_PX`
  - `NODE_TITLE_CHAR_WIDTH_PX = 8` (constants.ts:32, deliberately generous, overshoots to avoid ellipsis)
  - `NODE_LABEL_HORIZONTAL_PADDING_PX = 20` (constants.ts:35)
- Title CSS has `-webkit-line-clamp: 2` (can wrap 2 lines) but width model assumes single line.
- Both `flowMapping.ts:177` and `elkMapping.ts:38` call `nodeDimensionsPx` — MUST stay in sync.
- Example: "highly-avoid/" (13) + title (42) = 55 chars × 8 + 20 = **460px wide** → matches the too-wide screenshot.

## 4. Sizing (height)
- Height = `node.sizePx` from engine metric score only (`graphIdentity.ts:73`).
- `src/engine/NodeSizer.ts:37-56`: score∈[0,1] → `minPx + score*(maxPx-minPx)`.
  Defaults `DEFAULT_MIN_NODE_PX=40`, `DEFAULT_MAX_NODE_PX=160` (`src/engine/constants.ts:10-11`), user-configurable.
- Centrals bypass composition: `CENTRAL_SIZE_SCORE=1` → always `maxPx` (160). The screenshot node (active/central) = 160px tall.
- Empty space: thumbnail gated `@container (min-height:104px)`, attachments `@container (min-height:72px)` (`graph-view.css:226-237`). No thumbnail/attachment ⇒ blank vertical space under the 2-line title. Height is NOT content-aware.

## 5. CSS (`src/view/graph-view.css`)
- `.vicinity-graph-node` l.72-92: `width/height:100%`, `container-type:size`, `padding: var(--size-4-2)`.
- `.vicinity-graph-node__title` l.136-147: `font-size: var(--font-ui-smaller)`, `-webkit-line-clamp:2`.
- `.vicinity-graph-node__breadcrumb` l.149-153: `color: var(--text-faint)` — remove if prefix dropped.
- Design-intent comment l.65-71 documents current width-floor + height-keyed density; update if model changes.
- No CSS min/max width/height on node — all from RF inline style via `nodeDimensionsPx`.

## 6. Tests
- `src/view/graphIdentity.test.ts` (main): `nodeDimensionsPx` cases (l.9-36) + `breadcrumbFolderOf` cases (l.38-53).
- `src/engine/NodeSizer.test.ts`: score→px mapping, centrals, min/max.
- `src/view/elkMapping.test.ts`, `src/view/flowMapping.test.ts`: check width/breadcrumb propagation.
- No visual/CSS tests (container queries, line-clamp untested).

## 7. Design-intent / anchors
- `docs-internal/plan/high-level-plan.md:53-60` "Sizing" — authoritative. l.59: score drives **height**; **width** floored to render full name; ungrouped singletons reserve extra width for `folder/` breadcrumb; pure char-count estimate, no DOM measuring.
- These behaviors are **intentional V1 design**, so this task is a deliberate design change → update this doc after.
- No `ap_XXX_E` anchors present in docs.

## Key files to change
| Concern | File:Lines | What |
|---|---|---|
| Remove prefix (render) | `NoteNode.tsx:88-90` | Delete breadcrumb span |
| Remove prefix (CSS) | `graph-view.css:149-153` | Retire `.vicinity-graph-node__breadcrumb` |
| Prefix compute | `graphIdentity.ts:49-54` | Stop computing / threading |
| Prefix threading RF | `flowMapping.ts:58,176,185,287-298` | `breadcrumbFolder` field/param |
| Prefix threading elk | `elkMapping.ts:6,38` | Uses `breadcrumbFolderOf` |
| Width formula | `constants.ts:24-47` | Tune `NODE_TITLE_CHAR_WIDTH_PX=8`, padding, wrap |
| Width computed | `graphIdentity.ts:56-74` | `nodeDimensionsPx` |
| Height source | `NodeSizer.ts:37-56`; `engine/constants.ts:10-11` | max px / content-aware |
| Tests | `graphIdentity.test.ts`, `elkMapping.test.ts`, `flowMapping.test.ts` | update breadcrumb/width |
| Doc | `high-level-plan.md:59` | update Sizing section |
