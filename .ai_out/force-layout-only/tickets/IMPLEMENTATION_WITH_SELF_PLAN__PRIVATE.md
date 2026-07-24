# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE memory (force-layout-only)

Ticket `01-force-layout-only-remove-layered-and-radial-layout-modes.md`.
Remove layered + radial layout modes ENTIRELY, keep only force.

## Plan / progress checklist
Engine:
- [ ] types.ts: delete LayoutMode doc+type+LAYOUT_MODES (131-142), ViewSettings.layoutMode (213)
- [ ] index.ts: drop LayoutMode type export (46), LAYOUT_MODES value export (57), DEFAULT_LAYOUT_MODE (89)
- [ ] constants.ts: drop LayoutMode import (4), DEFAULT_LAYOUT_MODE decl (41-47), usage (95)
- [ ] ViewSettingsResolver.ts: drop layoutMode field (50)
View:
- [ ] LayoutSection.tsx: DELETE file
- [ ] GraphToolbar.tsx: drop import (4) + usage (54)
- [ ] settingsWritePlan.ts: drop LayoutMode import (5), global-layout union+doc (41-42), case (97-98)
- [ ] constants.ts: drop LayoutMode import(1), ELK_LAYER_SPACING(70), ELK_LAYERED_ROOT_OPTIONS(79-85), ELK_RADIAL_ROOT_OPTIONS(94-97), ELK_ROOT_OPTIONS_BY_MODE(142-147); redoc ELK_DIRECTION + ELK_GROUP_MEMBER_OPTIONS; reword D3_FORCE_CHARGE doc radial mention
- [ ] elkMapping.ts: drop `mode` var; always ELK_GROUP_MEMBER_OPTIONS containers, always projectedRootEdges, ELK_FORCE_ROOT_OPTIONS root; rewrite docs; import swap
- [ ] GraphViewController.ts: drop LayoutMode import(1); gate → `if(!graph.viewSettings.edgeRouting)`; delete ROUTING_SKIPPED_LAYOUT_MODE + isRoutingSkippedLayout(359-371)
- [ ] GraphStructureDiff.ts: drop layoutMode compare(33-35) + doc(16)
- [ ] d3ForceRefinement.ts: reword radial prose (18)
Persistence:
- [ ] persistedShapes.ts: drop LAYOUT_MODES import(11), layoutMode parse(145-148). NO version bump.
Tests/fixtures:
- [ ] graphFixtures.ts: drop LayoutMode import, layoutMode field, withLayoutMode, reword doc
- [ ] elkMapping.test.ts: root algo layered→force; INCLUDE_CHILDREN test→undefined; folder-group cross-boundary edge expectation→projected; radial/force block→force-only, drop withLayoutMode
- [ ] ElkLayout.test.ts: convert radial hub+radial compound blocks to force; drop withLayoutMode
- [ ] D3ForceLayout.test.ts: hubGraph()→zero-arg; drop radial comparison(87-91)→other assertion; delete non-force describe(145-152)
- [ ] GraphViewController.test.ts: drop withLayoutMode import; delete radial routing-skip test(458-468)
- [ ] settingsWritePlan.test.ts: delete global-layout test(78-83)
- [ ] persistedShapes.test.ts: delete two layoutMode tests(45-53) — field gone, won't typecheck
- [ ] GraphStructureDiff.test.ts: delete layoutMode switch describe(77-84)
Docs:
- [ ] architecture-map.md:47 → force-only
- [ ] arrows.md:47-50,81 → drop radial routing-skip + web-worker follow-up

## Key force-behavior facts (verified by hand, elkMapping)
- makeNode folder default "" (root) → never grouped (singletons/root ungrouped).
- Under force, root edges are PROJECTED+deduped+flipped-outward (projectedRootEdges), containers use ELK_GROUP_MEMBER_OPTIONS (elk layered internal — STAYS).
- GraphLayoutRunner applies d3 refinement iff root algorithm === force (now always). Unchanged.
- version stays 1: only equality-checked in parse; no gated branching. No QUESTION_FOR_HUMAN.

## Status: DONE. All edits applied. `npm run check` PASS (exit 0). `npm test` PASS (56 files, 697 tests).

## Notes on tricky bits (resolved)
- elkMapping.test folder-group cross-boundary edge: expectation changed from raw
  layered pass-through `["notes/a.md->solo/only.md","root.md->notes/a.md"]` to
  force-projected `["folder-group:notes->solo/only.md","root.md->folder-group:notes"]`.
  Hand-verified against projectedRootEdges (projection + minDepth outward flip).
- ElkLayout.test: DELETED both radial describe blocks (hub + folder). Force is
  covered end-to-end in D3ForceLayout.test via GraphLayoutRunner (elk seed + d3).
  ElkLayout.test now only exercises the plain ElkLayoutRunner (force seed) on the
  base + compound fixtures (both makeGraph defaults = force). Removed unused
  `VicinityGraph` import.
- D3ForceLayout.test: hubGraph()→zero-arg; deleted radial-comparison test and the
  `boundingBoxArea` helper it uniquely used; deleted the non-force pass-through
  describe; removed unused `ElkLayoutRunner` import.
- persistedShapes.test: replaced the two layoutMode tests with ONE degradation
  test asserting a removed `layoutMode` value is dropped and siblings survive
  (acceptance: old persisted values load without error).
- No version bump (stayed 1); `version` only equality-checked, no gated branching.
- Stale tickets NOT touched (TOP_LEVEL owns lifecycle):
  layout-mode-optional-per-doc-override..., edge-routing-re-enable-radial-routing...
