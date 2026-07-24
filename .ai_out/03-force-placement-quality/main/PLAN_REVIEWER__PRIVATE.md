# PLAN_REVIEWER — private rehydration notes (ticket 03 force-placement-quality)

## Verdict issued
MINOR — inline edits made to DETAILED_PLANNING__PUBLIC.md; PLAN_ITERATION skippable.

## What I validated in source (so I don't re-derive)
- d3-force ^3.0.0: default link strength = 1/min(count(src),count(tgt)). Degree-1 leaf ⇒ strength already 1. Plan's Mechanism A/B split CORRECT.
- Folder grouping reachable from makeGraph: deriveFolderGroups runs in vicinityGraphToElk; makeViewSettings defaults groupByFolder:true; MIN_GROUP_MEMBER_COUNT=2. Fixture CAN build a container.
- projectedRootEdges: hub→leaf edge projected onto folder-group:container id, leaf id preserved, deduped. Leaf stays degree-1.
- NO coordinate-asserting tests. Only counts/determinism/containment. Charge/strength change won't break hidden assertions. Only overlap on 24-node hubGraph is a real regression surface (plan re-verifies it).
- setup-dev-vault.sh uses write_if_missing <<'EOF' pattern.

## The one real gap (KEY INSIGHT)
Both fixtures are hub-spoke, all spokes degree-1 ⇒ Lever 1 (pin forceLink.strength=1) changes NOTHING in either. Metric test = pure Lever-2 (charge) test. Lever 1 ships untested-by-metric; justified as correctness/doc-reconciliation for real multi-degree vaults, OR follow-up ticket for a Mechanism-A fixture. Added inline note under Lever 1 so implementer doesn't thrash expecting the metric to move.

## Inline edits I made
1. Note under Lever 1 (untested-by-fixture warning + alternatives).
2. Downgraded #QUESTION_FOR_HUMAN → "Resolved — proceed" (ticket already sanctions dev-vault mirror at outgoingDepth=2).

## Minor points left in review (not edited inline)
- Threshold false-positive: dense crowd edges can legit exceed stretch; keep crowd 4-6; don't port stretch assertion onto 24-node hubGraph.
- Metric measures projected container edge, not rendered leaf→Epictetus edge (acceptable proxy).
- "adding a node can't break it" slightly overstated (fine for frozen fixture).

## If asked to re-review after iteration
Approach is sound; do NOT reopen architecture. Only re-check: (a) fixture demonstrably fails pre-fix, (b) charge reduction keeps overlappingPairCount==0 on hubGraph AND new fixture, (c) WHY comments reconciled (charge, center-pull ~1 ref, new link-strength).
