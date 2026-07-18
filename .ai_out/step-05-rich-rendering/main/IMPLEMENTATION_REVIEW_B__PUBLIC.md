# IMPLEMENTATION_REVIEW_B__PUBLIC — step-05 Phase B (rendering & interactions)

Reviewer: IMPLEMENTATION_REVIEWER_B, 2026-07-18. Scope: commits `737cb24`, `41f23a7`, `83cf286`, `2b40e28` (full diff `a7ee5ce..2b40e28` over `src/` + `scripts/`), reviewed against CLARIFICATION__PUBLIC (binding), the step-05 spec Exit criteria, and the master UI design memory.

## Verdict: **NEEDS_ITERATION** — 0 BLOCKER / 1 MAJOR / 2 MINOR / 3 NIT

No `#QUESTION_FOR_HUMAN` items.

## Gate results (run independently by reviewer)
- `npm test`: 447 passed / 42 files (main) + 69 passed / 6 files (sublib) — exit 0.
- `npm run check` (tsc -noEmit): exit 0.
- `npm run build`: exit 0. `styles.css` is not git-tracked, so the regeneration leaves the tree clean.

All match the implementer's claims. No behavior tests removed or weakened (GraphViewController.test.ts only extended; +24 new tests vs Phase A baseline).

---

## [MAJOR-1] Arrowheads are hard-coded `#b1b1b7`, not themed — the "--xy-edge-stroke themes BOTH edge paths and arrowheads" claim is factually wrong

**Where**: `src/view/NeighborhoodGraphFlow.tsx:118-124` (`toReactFlowEdge` markerEnd without `color`) + `src/view/graph-view.css` (no arrowhead rule).

**Evidence (verified in node_modules, RF v12.x)**:
- `ReactFlow` has a prop default `defaultMarkerColor = '#b1b1b7'` (`@xyflow/react/dist/esm/index.js`, `ReactFlow` signature).
- `createMarkerIds` (`@xyflow/system`, ~line 1474) assigns `color: marker.color || defaultColor` — so every marker gets `#b1b1b7` when the edge's `markerEnd` object omits `color` (ours does).
- `ArrowClosedSymbol` renders that color as **inline** `style={{stroke, fill}}` on the marker polyline. Inline style always beats RF's stylesheet fallback `.react-flow__arrowhead polyline.arrowclosed { fill: var(--xy-edge-stroke, ...) }` (style.css lines 193-197), so the CSS-custom-property path never applies for the default marker.

**Consequence**: every arrowhead ships a fixed light-gray in BOTH themes, while the edge line is `var(--text-faint)`. In dark themes especially, arrowheads will read visibly brighter than their edge lines. This violates the binding theming rule ("every color is an Obsidian theme var — the plugin ships zero colors of its own") and contradicts the CSS header comment and IMPLEMENTATION_B__PUBLIC's design claim. The light/dark QA pass would likely catch it as "arrowhead color doesn't match edge color".

**Suggested direction (CSS-only, consistent with CSS-over-JS preference)** — in `graph-view.css`:

```css
/* RF stamps its defaultMarkerColor (#b1b1b7) as an INLINE stroke/fill on the
 * arrowhead polyline; !important is the only CSS-side way to out-rank an
 * inline style and keep arrowheads on the theme's edge color. */
.neighborhood-graph-flow .react-flow__arrowhead polyline {
	stroke: var(--text-faint) !important;
	fill: var(--text-faint) !important;
}
```

Alternative (JS): pass `color` per markerEnd or `defaultMarkerColor` — but any value there must be a literal (a `var(...)` string ends up inside the marker **id** via `getMarkerId`, and `url(#…var(--x)…)` references are fragile), and the typings don't admit `null`. The CSS override is the clean fix. Note the knowingly-accepted side effect: a selected edge's path brightens to `--xy-edge-stroke-selected` while its arrowhead stays faint — acceptable for a read-only graph, worth a WHY-NOT comment.

---

## [MINOR-1] Ctrl/cmd-click (Q2 gesture) doubles as React Flow's multi-selection modifier

**Where**: `src/view/NeighborhoodGraphFlow.tsx:47-52` (onNodeClick) — RF default `multiSelectionKeyCode = isMacOs() ? 'Meta' : 'Control'` (verified in dist).

The exact gesture the human chose for "open in new tab" also toggles persistent multi-selection: after a cmd/ctrl-click the node keeps the accent selection ring (our CSS styles `.react-flow__node.selected`) even though focus moved to the new tab, and repeated ctrl-clicks accumulate a multi-selection that means nothing in a read-only graph. Suggested: `multiSelectionKeyCode={null}` on `<ReactFlow>` (one prop; selection-on-plain-click behavior is untouched).

## [MINOR-2] Attachment menu is unbounded for large groups

**Where**: `src/view/ObsidianGraphUi.ts:33-44` (`showAttachmentMenu`).

A note with e.g. 60 images produces a 60-entry native `Menu`. Obsidian clamps menus to the viewport but very long menus degrade (scroll-hunting a flat list). Not dense-fixture-realistic today, but the spec's icon-strip counts make big groups first-class. Cheap 80/20: cap entries (e.g. first 20) + a disabled trailing item "…and N more" — or consciously accept and note it in the QA checklist / follow-up ticket. Implementer's call; a reasoned "accept" disposition is fine.

---

## [NIT-1] `hiddenOverlayText` re-implements "+N"
`src/view/badgeText.ts:19-21` — `` `+${totalHiddenCount} hidden` `` should be `` `${plusNText(totalHiddenCount)} hidden` `` given `plusNText` exists two functions above (the module's stated purpose is one home for badge copy).

## [NIT-2] `--ng-thumbnail-height` breaks the naming scheme
`src/view/graph-view.css` — everything else is `neighborhood-graph-*`; the lone custom property uses an `--ng-` prefix. Rename (e.g. `--neighborhood-graph-thumbnail-height`) or drop the var (used once).

## [NIT-3] Arrowhead size is silently scaled ×1.5
`EDGE_ARROWHEAD_SIZE_PX = 18` is in `markerUnits: 'strokeWidth'` units (RF default), and the CSS sets `--xy-edge-stroke-width: 1.5` — effective arrowhead ≈ 27px-equivalent, not 18. Harmless (pure tuning), but the constant's name/comment promises px. Either set `markerUnits: 'userSpaceOnUse'` in the markerEnd or reword the constant's doc; final size judgment belongs to the human smoke run.

---

## Verified clean (checked in code, not from claims)

- **Spec/Exit-criteria coverage**: frontmatter-title rendering, breadcrumb ONLY on ungrouped non-root nodes (muted `folder/` prefix — Q compliance), lazy fixed-height thumbnail + "+N" images badge (absent at ≤1 image), per-extension icon chips with counts → native `Menu` (entries open via Obsidian default handling, Q3), tier styling `data-tier` main/pinned-central/regular via border weight+style (not hue alone — a11y-sound per design memory), size from `sizePx` (untouched engine truth), neutral group + folder label + per-group "+N" (`hiddenCount>0` only), corner `Panel` overlay "+N hidden" with per-folder `title` breakdown (absent at 0 — Q4), `MarkerType.ArrowClosed` direction arrows, "×N" badge only when count>1, ctrl/cmd-click → `{newTab:true}` → `getLeaf(true)` (Q2, behavior-tested through the controller), hover → `hover-link` with `registerHoverLinkSource` in `main.ts`.
- **Human decisions**: NO folder colors anywhere; zero raw hex/rgb/hsl in `graph-view.css` (grepped); native `Menu`, not a custom popover.
- **Edge geometry** (`src/view/edgeGeometry.ts`): right-of-travel normal is correct for screen coordinates; mirroring for the opposite edge is real (normal flips with travel direction) and explicitly tested (`backward.labelY === -forward.labelY`); label at quadratic t=0.5 (`mid + normal·curv/2`) is mathematically right; zero-length degenerate guard present.
- **Architecture**: `obsidian` imports confined to adapters (`ObsidianGraphUi`, `ObsidianNoteNavigator`), `main.ts`, and the pre-existing `NeighborhoodGraphView.tsx` composition root; `@xyflow/react` only in `.tsx`; `GraphUiPort`/`ObsidianGraphUi` split from the navigator is the right SRP cut and mirrors existing port patterns; badge copy, icon mapping, and path math all live in pure BDD-tested `.ts` modules — no logic trapped in JSX.
- **Correctness risks probed**: `resourcePath` returns null for missing files → thumbnail simply not rendered (no crash); chip `stopPropagation` + `nodrag nopan` prevent note-open/drag/pan; hidden `Handle`s match elk `DOWN` (target top / source bottom); elk group padding `[top=36,…]` is applied via layoutOptions (tested) and 36px comfortably clears the ~24px label header; edge-over-group claim verified (`getElevatedEdgeZIndex` exists in `@xyflow/system`) plus translucent `color-mix` fill with solid fallback; RF default `deleteKeyCode` is harmless here (controlled `nodes` without `onNodesChange` → remove changes are never applied).
- **Step-04 preservation**: rebuild pipeline, structural diff, reuse-layout, and latest-wins untouched (only `openNode` gains an options passthrough, with a new behavior test and none removed); empty state intact and visually improved.
- **e2e selector contract**: every row of the IMPLEMENTATION_B__PUBLIC table matches the rendered attributes/classes exactly (checked one-by-one, incl. absence conditions for ×N badge and overlay); selectors are semantic and stable.
- **QA_CHECKLIST.md**: covers every spec feature incl. light+dark pass, keyboard focus, step-04 regressions; honest "NOT EXECUTED" header and honest §6 about untestable truncation badges in the small dev vault.

## Documentation updates needed
- `IMPLEMENTATION_B__PUBLIC.md`'s CSS-section claim ("`--xy-edge-stroke` themes BOTH edge paths and arrowheads") must be corrected together with the MAJOR-1 fix, and the `graph-view.css` header comment should carry the WHY for the `!important` override.

## Final
**NEEDS_ITERATION** — fix MAJOR-1 (arrowhead theming); disposition MINOR-1/MINOR-2 (fix or reasoned rejection); NITs at implementer's discretion.
