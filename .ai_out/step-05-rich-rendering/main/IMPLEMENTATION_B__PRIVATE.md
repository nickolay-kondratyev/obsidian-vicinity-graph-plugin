# IMPLEMENTATION_B__PRIVATE — step-05 Phase B (rendering & interactions)

Working memory for IMPLEMENTATION_B (UX/UI implementation with self-plan). Rehydrate from here.

## Design Plan

**Goal**: Rich React Flow rendering for the neighborhood graph — nodes that answer "what is this note" without opening it — plus native Obsidian interactions (hover preview, ctrl-click new tab, attachment menus), all themed by Obsidian CSS variables.

**Design Direction**:
- Tone: utilitarian, native-Obsidian. The graph must look like part of Obsidian, not a web widget. Zero own-brand colors — every color is an Obsidian theme var.
- Information density: adaptive. Node square size (40-160px) is engine truth; content density adapts to size via CSS container queries (small = title only; medium += icon strip; large += thumbnail). CSS-only, no JS measuring.
- Key design thesis: tier is communicated by border treatment (weight + style + accent color), never color alone (a11y). Folder identity via neutral group containers + muted breadcrumb prefix on ungrouped nodes.

**Visual Hierarchy**:
1. Primary: MAIN node (2px solid accent ring + heavier title), thumbnails.
2. Secondary: pinned-central (2px dashed accent ring), node titles, group labels.
3. Tertiary: breadcrumb folder prefix (--text-faint), icon strip chips, badges, edges (--text-faint stroke).

**Component Plan**:
- `NoteNode.tsx` — custom RF node: hidden handles (top target / bottom source, matches elk DOWN), breadcrumb+title, lazy thumbnail + "+N" image badge, icon-strip chips (nodrag/nopan buttons → native Menu). data-tier / data-path hooks.
- `FolderGroupNode.tsx` — neutral container: --background-secondary fill, subtle border, folder-name label, "+N" hidden badge. data-folder hook.
- `NeighborhoodEdge.tsx` — BaseEdge with path from pure `edgeGeometry.ts` (straight; quadratic offset-right-of-travel when hasOpposite → pairs mirror), ArrowClosed markerEnd, count badge (only count>1) via EdgeLabelRenderer.
- Corner overlay badge — RF `<Panel position="top-right">` pill "+N hidden", title attr = per-folder breakdown (root formatted "(vault root)").
- `GraphUiContext` — React context providing `GraphUiPort` to node components.

**Ports (DIP)**:
- `NoteNavigatorPort.openNote(path, options?: {newTab})` — getLeaf(true) on newTab. Controller `openNode(path, options?)` passthrough (keeps folder-group guard).
- NEW `GraphUiPort` (viewPorts.ts): `resourcePath(path): string|null` (vault.getFileByPath + getResourcePath), `showHoverPreview({nativeEvent,targetEl,path})` (workspace.trigger "hover-link", adapter implements HoverParent), `showAttachmentMenu({nativeEvent,paths})` (native Menu, items open via getLeaf(false).openFile), `renderIcon(el, iconId)` (setIcon — keeps obsidian imports out of .tsx entirely).
- NEW adapter `ObsidianGraphUi.ts`. `ObsidianNoteNavigator` stays navigation-only (POLS naming).
- main.ts: `registerHoverLinkSource(VIEW_TYPE, {display, defaultMod:false})`.

**Pure logic (vitest, BDD)**:
- `edgeGeometry.ts` — `edgePathFor(sx,sy,tx,ty,hasOpposite)` → {path, labelX, labelY}. EDGE_PAIR_CURVATURE_PX perpendicular control-point offset to the RIGHT of travel; label at quadratic midpoint (0.25 P0 + 0.5 C + 0.25 P2).
- `badgeText.ts` — plusNText, hiddenOverlayText ("+N hidden"), orphanBreakdownTitle (root "" → "(vault root)"), extraImageCountText (null when imageCount<2).
- `attachmentIcons.ts` — extension → lucide icon id (image exts → "file-image", pdf → "file-text", csv/xlsx → "file-spreadsheet", audio → "file-audio", video → "file-video", zip → "file-archive", "" and unknown → "file"), aria/tooltip label (handles "" extension → "no extension"; closes review NIT-1).
- elkMapping: containers get `elk.padding` layoutOption (top room for group label) — constant in constants.ts, new test (existing tests only assert ids — safe).
- flowMapping: `interface FlowNodeData/FlowGroupData` → `type` aliases (implicit index signature ⇒ satisfies RF `Node<TData extends Record<string,unknown>>` without casts). No behavior change.

**Stable e2e hooks (Phase C contract)** — see PUBLIC file; classes `neighborhood-graph-node[__*]`, `neighborhood-graph-group[__*]`, `neighborhood-graph-edge__count-badge`, `neighborhood-graph-overlay-badge`, data-tier/data-path/data-folder/data-extension/data-count.

**Implementation Steps**: ALL DONE (2026-07-18).
1. [x] Read all required docs + code (see Facts below).
2. [x] Pure helpers + tests — commit 737cb24.
3. [x] Ports/adapters + controller options + main.ts hover source — committed.
4. [x] Components + Flow wiring + CSS — committed.
5. [x] QA_CHECKLIST.md + PUBLIC file + gates: npm test 447/42 files main + 69/6 sublib, check 0, build 0 (main.js 1,846,549 B; styles.css 26,748 B). Controller gained a newTab-passthrough test (FakeNavigator records options).

**Post-completion notes for a future clone**:
- RF v12 auto-elevates edges with parented endpoints (`getElevatedEdgeZIndex` in @xyflow/system) — do NOT add manual edge zIndex.
- e2e hook contract table lives in IMPLEMENTATION_B__PUBLIC.md — treat as frozen for Phase C.
- Container-query thresholds: strip ≥72px, thumbnail ≥104px (`--ng-thumbnail-height: 56px`).
- groupHiddenTitleText added to badgeText (group badge tooltip copy).

## Facts discovered (don't re-derive)
- RF arrowhead + edge stroke both key off `--xy-edge-stroke` (style.css L193-198) → theme once on `.neighborhood-graph-flow`.
- elkMapping.test.ts asserts container children/edge IDS only — adding layoutOptions to containers is safe; add explicit padding test.
- Obsidian Menu: `new Menu().addItem(i => i.setTitle().setIcon().onClick()).showAtMouseEvent(evt)`.
- HoverParent = `{ hoverPopover: HoverPopover | null }`; `registerHoverLinkSource` exists (Plugin method, since 1.1.0).
- Fake navigators in controller tests implement `openNote(path)` — still structurally assignable after optional-options widening.
- Node square 40-160px; wrapper gets inline width/height → container-type: size on inner root works.
- Interactive children need RF classes `nodrag nopan` + stopPropagation.
- MY_DEEP_MEM resolves to /Users/nkondrat/vintrin-env/config/claude/ai_input/deep (symlinked path works on this box).
- No repo CLAUDE.md. Never edit styles.css (generated). Don't touch docs-internal/CHANGELOG.md.

## Container query thresholds (named in CSS comments)
- min-height 72px → icon strip visible.
- min-height 104px → thumbnail visible (fixed height 56px, object-fit cover).
- Below: title only. Title clamp 2 lines (3 on large), font-ui-smaller.

## Files touched (planned)
src/view/: edgeGeometry.ts(+test), badgeText.ts(+test), attachmentIcons.ts(+test), flowMapping.ts, elkMapping.ts(+test), constants.ts, viewPorts.ts, ObsidianNoteNavigator.ts, ObsidianGraphUi.ts (new), GraphViewController.ts, GraphUiContext.ts (new), NoteNode.tsx (new), FolderGroupNode.tsx (new), NeighborhoodEdge.tsx (new), NeighborhoodGraphFlow.tsx, NeighborhoodGraphView.tsx, graph-view.css; src/main.ts; .ai_out QA_CHECKLIST.md + PUBLIC/PRIVATE.
