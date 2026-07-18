# IMPLEMENTATION_B__PUBLIC — step-05 Phase B (rendering & interactions)

Status: **DONE**. Gates green. No `#QUESTION_FOR_HUMAN`. Commits on `main`: `737cb24` (pure helpers), `41f23a7` (ports/adapters), `83cf286` (components + CSS), `1a13953` (closeout).

## Gate results (exact)
- `npm test`: **447 passed / 42 files** (main) + **69 passed / 6 files** (sublib) — exit 0. Phase A baseline 423 → +24 new tests, zero removed/weakened.
- `npm run check` (tsc -noEmit): exit 0.
- `npm run build`: exit 0 — `main.js` 1,846,549 B, `styles.css` 26,748 B (regenerated; includes new graph-view.css).

## Design plan (as executed)
- **Tone**: native-Obsidian utilitarian. ZERO plugin-own colors — every color is an Obsidian theme var (`--background-*`, `--text-*`, `--interactive-accent`), plus RF chrome rethemed through its published `--xy-*` custom properties. Light/dark/community themes need no plugin changes.
- **Thesis**: tier is border *weight + style* + accent (MAIN = 2px solid accent + semibold title; pinned-central = 2px dashed accent; regular = 1px hairline) — never hue alone (a11y). Node content **density adapts to the engine-driven 40–160px square via CSS container queries** (small: title only; ≥72px: + attachment strip; ≥104px: + thumbnail) — CSS-only, no JS measuring.
- **Hierarchy**: MAIN/thumbnails primary; titles/group labels secondary; breadcrumbs, chips, badges, edges tertiary (`--text-faint`/`--text-muted`).

## What shipped (files + why)

### New pure modules (RF-free, BDD-vitest)
- `src/view/edgeGeometry.ts` (+test) — `edgePathFor(...)`: straight line, or quadratic bowed `EDGE_PAIR_CURVATURE_PX` to the RIGHT of own travel when `hasOpposite` (pairs mirror automatically); label at curve midpoint; degenerate zero-length guard.
- `src/view/badgeText.ts` (+test) — ALL badge/tooltip copy: `plusNText` "+N", `hiddenOverlayText` "+N hidden", `linkCountBadgeText` "×N" (null at 1), `extraImageCountText` (null at ≤1 image), `groupHiddenTitleText`, `orphanBreakdownTitle` (root folder → `(vault root)`).
- `src/view/attachmentIcons.ts` (+test) — extension → lucide icon id (`file-image`/`file-text`/`file-spreadsheet`/`file-audio`/`file-video`/`file-archive`, fallback `file`) + `attachmentGroupLabel` ("2 png files", `""` → "1 file (no extension)" — closes review NIT-1).

### Ports & adapters (DIP — no obsidian import in any `.tsx`/controller)
- `src/view/viewPorts.ts` — `NoteNavigatorPort.openNote(path, options?: OpenNoteOptions {newTab})`; NEW **`GraphUiPort`**: `resourcePath(path)`, `showHoverPreview({nativeEvent,targetEl,path})`, `showAttachmentMenu({nativeEvent,paths})`, `renderIcon(el, iconId)`.
- `src/view/ObsidianNoteNavigator.ts` — `newTab` → `getLeaf(true)` (Q2); stays navigation-only (SRP).
- NEW `src/view/ObsidianGraphUi.ts` — `vault.getResourcePath`, `hover-link` trigger (class implements `HoverParent`), native `Menu` (entries titled `basenameOf`, icon per extension, open via `getLeaf(false).openFile` = Obsidian default handling, Q3), `setIcon`.
- `src/view/GraphViewController.ts` — `openNode(path, options?)` passthrough (folder-group guard intact; +1 behavior test).
- `src/main.ts` — `registerHoverLinkSource(VIEW_TYPE, {display:"Neighborhood graph", defaultMod:false})` → listed in Page-preview settings.
- `src/shared/VaultPathFacts.ts` — `basenameOf` made public (menu titles).

### Components (`@xyflow/react` confined to `.tsx`)
- NEW `src/view/NoteNode.tsx` — breadcrumb (`<folder>/` muted) + title (2-line clamp, `title` attr), lazy thumbnail (`loading="lazy"`, fixed 56px height, cover-crop, "+N" badge), attachment chips (`button` + `nodrag nopan` + `stopPropagation`, icon via `renderIcon` ref effect, aria-label/tooltip); hidden `Handle`s top(target)/bottom(source) matching elk `DOWN`.
- NEW `src/view/FolderGroupNode.tsx` — neutral container + folder-name label + "+N" badge (hiddenCount>0). NO folder colors (human decision).
- NEW `src/view/NeighborhoodEdge.tsx` — `BaseEdge` on `edgePathFor` path, `markerEnd` threaded, "×N" badge via `EdgeLabelRenderer` (count>1 only).
- NEW `src/view/GraphUiContext.ts` — context + `useGraphUi()` (throws outside provider); RF instantiates nodeTypes itself so context is the only clean channel.
- `src/view/NeighborhoodGraphFlow.tsx` — `nodeTypes {note, folder-group}` / `edgeTypes {neighborhood}` (module constants), `markerEnd: ArrowClosed` (18px const), ctrl/cmd-click → `{newTab:true}`, `onNodeMouseEnter` → hover preview (groups skipped), corner overlay via RF `<Panel position="top-right">` (renders only when total>0; `title` = breakdown), `nodesConnectable={false}`, context provider.
- `src/view/NeighborhoodGraphView.tsx` — constructs `ObsidianGraphUi(app, VIEW_TYPE)` and passes `ui` prop.

### Mapping tweaks
- `src/view/flowMapping.ts` — `FlowNodeData`/`FlowGroupData` interface → **type alias** (implicit index signature satisfies RF `Node<TData extends Record<string,unknown>>` — zero casts at the render boundary). No behavior change.
- `src/view/elkMapping.ts` + `constants.ts` — folder containers get `"elk.padding": ELK_GROUP_PADDING` (`[top=36,left/bottom/right=16]`) so the group label never underlaps members (+test). Implements Phase A decision #7.

### CSS — `src/view/graph-view.css` ONLY (styles.css regenerates)
Sections: RF chrome retheme (`--xy-edge-stroke` themes BOTH edge paths and arrowheads; controls/background/attribution vars), note nodes (container queries, tiers, focus/selected accent ring replacing browser outline), chips (explicit reset of Obsidian's global button styling), groups (`color-mix` 70% translucent secondary fill w/ solid fallback — edges under containers stay legible), edge/group/overlay badges (shared pill ruleset), centered empty state.

## Decisions affecting Phase C — STABLE e2e hooks (contract)
| Feature | Selector |
|---|---|
| Note node root | `.neighborhood-graph-node` with `data-tier="main"\|"pinned-central"\|"regular"`, `data-path="<vault path>"` |
| Title / breadcrumb | `.neighborhood-graph-node__title` / `.neighborhood-graph-node__breadcrumb` (breadcrumb text = `<folderName>/`) |
| Thumbnail / +N images | `.neighborhood-graph-node__thumbnail img` / `.neighborhood-graph-node__thumbnail-badge` |
| Icon strip chip | `button.neighborhood-graph-attachment` with `data-extension`; count in `.neighborhood-graph-attachment__count`; aria-label "N ext file(s)" |
| Group container | `.neighborhood-graph-group` with `data-folder="<folder path>"`; label `.neighborhood-graph-group__label`; badge `.neighborhood-graph-group__badge` (text "+N") |
| Edge count badge | `.neighborhood-graph-edge__count-badge` with `data-count` (text "×N"; ABSENT when count = 1) |
| Corner overlay | `.neighborhood-graph-overlay-badge` (text "+N hidden"; `title` = per-folder breakdown lines "folder — N hidden"; ABSENT when nothing orphan-hidden) |
| Edge direction | RF `marker-end` on `.react-flow__edge-path` (ArrowClosed defs present in svg) |
| RF node wrappers | `.react-flow__node-note`, `.react-flow__node-folder-group` (RF-derived from type names — treat as secondary to the classes above) |

Other Phase C facts: exact badge/tooltip strings come from `badgeText.ts` (import it in assertions rather than re-typing copy); hover fires Obsidian `hover-link` (needs Page preview core plugin enabled); ctrl/cmd-click → new tab; dev-vault fixtures cannot reach the 100-node cap, so truncation badges need synthetic fixtures if e2e wants them positive-tested.

## Rejected alternatives
- **Text-only extension chips instead of icons** — spec explicitly says icons; icon + count + tooltip keeps both scannability and precision.
- **`setIcon` imported directly in `.tsx`** — would breach the "no obsidian in tsx" convention; routed through `GraphUiPort.renderIcon` instead (also keeps components fake-able).
- **Widening `ObsidianNoteNavigator` with menu/hover/icons** — naming would lie (navigator ≠ menus); separate `ObsidianGraphUi` adapter (OCP/SRP).
- **JS-measured adaptive node content** — CSS container queries do it declaratively (Electron Chromium supports them); zero render-loop cost.
- **Custom offset-sign field for paired edges** — Phase A's `hasOpposite` + right-of-own-travel bow mirrors pairs for free (tested).
- **Explicit edge `zIndex` for intra-group edges** — unnecessary: RF v12 auto-elevates edges whose endpoints have a `parentId` (verified in `@xyflow/system` `getElevatedEdgeZIndex`); translucent group fill added as belt-and-braces.

## Known limitations / TODOs left
- No TODO comments left in code.
- Visual verification in a live Obsidian is pending the human smoke run — checklist at `.ai_out/step-05-rich-rendering/main/QA_CHECKLIST.md` (**NOT executed** — Obsidian cannot launch here; honestly marked as such). Pinned-central styling ships but is not human-triggerable until step-06's pin affordance.
- Truncation badges are unit-tested but not manually producible in the dev vault (100-node cap, no settings UI until step 06) — see checklist §6.
- Playwright e2e = Phase C (not started here, per phase plan).

## Manual-QA checklist location
`.ai_out/step-05-rich-rendering/main/QA_CHECKLIST.md`

(No `#QUESTION_FOR_HUMAN` items.)
