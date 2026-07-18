# IMPLEMENTATION_REVIEWER_B__PRIVATE — memory for a future clone

Role: IMPLEMENTATION_REVIEWER_B, step-05 Phase B (rendering & interactions). READ-ONLY on src/tests.
Status: review COMPLETE (pass 1, 2026-07-18). Verdict: **NEEDS_ITERATION** — 1 MAJOR, 2 MINOR, 3 NIT, 0 BLOCKER. No #QUESTION_FOR_HUMAN.

## What I did (do NOT redo)
- Gates run independently: `npm test` 447/42 + sublib 69/6, `npm run check`, `npm run build` — ALL exit 0 (logs `.tmp/review-b-npm-{test,check,build}.log`). Matches implementer claims exactly. No `sanity_check.sh` in repo.
- Read: CLARIFICATION__PUBLIC, step-05 spec, IMPLEMENTATION_A/B PUBLIC, QA_CHECKLIST, `${MY_DEEP_MEM}/my-frontend-design.md` (resolves to /Users/nkondrat/vintrin-env/config/claude/ai_input/deep/my-frontend-design.md).
- Reviewed FULL diff `a7ee5ce..2b40e28` over src/+scripts/ (saved `.tmp/review-b-diff.txt`, 1376 lines). Phase B commits 737cb24, 41f23a7, 83cf286, 2b40e28.
- Verified in node_modules (KEY evidence, don't re-derive):
  - RF v12 `ReactFlow` prop default `defaultMarkerColor = '#b1b1b7'` (dist/esm/index.js ~line 3728); `createMarkerIds` in @xyflow/system (~line 1474) does `color: marker.color || defaultColor`; `ArrowClosedSymbol` (~line 2438) puts color as INLINE `stroke`/`fill` on the marker polyline → RF's stylesheet rule `.react-flow__arrowhead polyline { stroke/fill: var(--xy-edge-stroke, ...) }` (style.css lines 193-197) NEVER applies. => MAJOR-1: arrowheads are hard-coded #b1b1b7, implementer's "--xy-edge-stroke themes BOTH edge paths and arrowheads" claim is factually wrong.
  - `getElevatedEdgeZIndex` DOES exist in @xyflow/system (edge-over-group claim OK).
  - `multiSelectionKeyCode` default = Meta (mac) / Control → MINOR-1 conflict with Q2 ctrl/cmd-click.
  - deleteKeyCode='Backspace' default is harmless: controlled `nodes` without `onNodesChange` → remove changes never applied (only user handlers are called). Dragging still works (XYDrag mutates internal store directly) — did NOT flag.
- Verified clean checks (all PASS, recorded in PUBLIC): mirrored curvature math (quadratic t=0.5 = mid + normal*curv/2, mirror test present); e2e selector contract row-by-row matches rendered code; NO folder colors / zero raw hex-rgb-hsl in graph-view.css (grep exit 1); styles.css is NOT git-tracked (git ls-files empty) so build regen never dirties the tree; obsidian imports only in adapters/main/ItemView (NeighborhoodGraphView.tsx pre-existing composition root); @xyflow only in .tsx (flowMapping match = comment only); step-04 controller/diff/latest-wins untouched except openNode options passthrough (+1 behavior test, none removed); elk padding "[top=36.0,...]" tested & sufficient for label (~24px needed); Q2/Q3/Q4 compliant; QA_CHECKLIST honest + covers spec incl. light/dark; VaultPathFacts.extensionOf lower-cases (menu icons OK); resourcePath null-safe (missing file → no thumbnail, no crash).

## Findings (details in IMPLEMENTATION_REVIEW_B__PUBLIC.md)
- MAJOR-1 arrowhead theming (above). Suggested fix: CSS-only `!important` override on `.neighborhood-graph-flow .react-flow__arrowhead polyline` (stroke+fill = var(--text-faint)); !important REQUIRED to beat inline style. `defaultMarkerColor={null}` would also work behaviorally but typings say `string | undefined` → would need cast; CSS is cleaner.
- MINOR-1 ctrl/cmd-click also toggles RF multi-selection → pass `multiSelectionKeyCode={null}`.
- MINOR-2 attachment Menu unbounded for many files (no cap) — accept-or-cap decision left to implementer.
- NIT-1 hiddenOverlayText re-implements "+N" instead of using plusNText.
- NIT-2 `--ng-thumbnail-height` prefix inconsistent with neighborhood-graph-* naming.
- NIT-3 markerUnits defaults to 'strokeWidth' → 18px arrowhead scales ×1.5 (edge stroke-width) ≈ 27 effective; tune at smoke run.

## Next pass (iteration review) checklist
1. Confirm MAJOR-1 fix: CSS override present in graph-view.css, both stroke AND fill, scoped under .neighborhood-graph-flow, with WHY comment (inline-style-beats-CSS reason justifies !important). Watch: selected-edge state — path turns --xy-edge-stroke-selected(--text-muted) but overridden arrowhead stays faint; acceptable, but confirm implementer noted it.
2. Confirm MINOR-1 disposition (prop or reasoned rejection).
3. Re-run gates; re-check no test weakened.
4. PUBLIC file verdict flip to READY if MAJOR-1 addressed; MINORs are should-fix but not gating if reasoned.
