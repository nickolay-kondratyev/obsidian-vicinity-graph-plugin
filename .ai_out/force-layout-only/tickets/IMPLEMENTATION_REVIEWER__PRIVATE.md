# IMPLEMENTATION_REVIEWER — PRIVATE notes (force-layout-only)

Commit reviewed: `e68a86a` (HEAD). HEAD~1 = pre-impl, HEAD~2 = exploration only.

## Method
- Ran gates myself: `npm run check` → exit 0; `npm test` → exit 0, 56 files / 697 tests.
  Logs in `.tmp/review-check.log`, `.tmp/review-test.log`.
- Full-tree grep for all forbidden symbols → only legit residue (see PUBLIC #1).
- Read full production diff + all test diffs + fixtures.

## Key verifications (evidence)
- **elkMapping.ts collapse**: dropped `mode` var. Prev code branched on
  `mode === "layered"` in 3 spots; force was the else-branch in all 3, so the
  collapse == force's old behavior. Container opts always `{...ELK_GROUP_MEMBER_OPTIONS, padding}`,
  rootEdges always `projectedRootEdges(...)`, root always `{...ELK_FORCE_ROOT_OPTIONS}`.
- **d3 refinement gate**: `GraphLayoutRunner.ts` (untouched, not in diff) gates on
  `graph.layoutOptions?.["elk.algorithm"] === ELK_FORCE_ROOT_OPTIONS["elk.algorithm"]`.
  Root is always force now → always refines → identical to old force path. GOOD.
- **constants.ts**: ELK_FORCE_ROOT_OPTIONS `{algorithm:force, spacing.nodeNode:40}`
  unchanged; ELK_GROUP_MEMBER_OPTIONS unchanged; ELK_DIRECTION="DOWN" kept (used by
  group-member layered pass). Deleted ELK_LAYER_SPACING/ELK_LAYERED_ROOT_OPTIONS/
  ELK_RADIAL_ROOT_OPTIONS/ELK_ROOT_OPTIONS_BY_MODE. Docs reworded, no value change.
- **GraphViewController.ts**: gate `if (!edgeRouting || isRoutingSkippedLayout(mode))`
  → `if (!graph.viewSettings.edgeRouting)`. Dead const+fn removed. LayoutMode import gone.
- **GraphStructureDiff.ts**: removed layoutMode relayout term + doc. Fine — no mode to diff.
- **persistedShapes.ts**: dropped LAYOUT_MODES import + layoutMode parse block. No version bump.
  New test: `{version, globalView:{layoutMode:"radial", nodeCap:7}}` → not toHaveProperty layoutMode,
  nodeCap===7. Proves degradation. version only equality-checked in parsers (confirmed by
  implementer claim + consistent with 3 prior no-bump additive changes).
- **Tests removed**: ElkLayout radial hub+folder blocks; D3ForceLayout radial-comparison +
  non-force pass-through; GraphViewController radial-skip; settingsWritePlan global-layout;
  GraphStructureDiff layoutMode-switch. All genuine layered/radial behavior tests — ticket
  explicitly human-approves removal.
- **Crucial re-derivation**: elkMapping.test cross-boundary edge expectation changed
  `["notes/a.md->solo/only.md","root.md->notes/a.md"]` (raw, old implicit-layered default)
  → `["folder-group:notes->solo/only.md","root.md->folder-group:notes"]` (projected, force).
  Matches production projectedRootEdges. NOT faked.
- **Dead imports**: spot-checked ElkLayout.test (asFolderPath×4, extractElkDimensionsById×2,
  extractElkPositions×4 still used), D3ForceLayout.test (extractElkPositions used ×3),
  GraphViewController.test (withLayoutMode import removed, withEdgeRouting kept & used).
  noUnusedLocals not enabled in tsconfig, but no unused imports found anyway.
- **Docs**: architecture-map layout-modes line → force-seed + group layered. arrows.md
  radial routing-skip bullet + web-worker follow-up removed; routing gated solely on edgeRouting.
  CHANGELOG left (historical). high-level-plan/README never mentioned modes (grep clean).
- **Engine purity**: no new obsidian/react imports; importGuard test still green.

## Verdict: APPROVE. 0 blocking. Gates green. No production changes made by reviewer.
