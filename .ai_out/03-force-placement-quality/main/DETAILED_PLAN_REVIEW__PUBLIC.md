# Plan Review — 03 Force placement quality

VERDICT: MINOR — inline adjustments made, PLAN_ITERATION can be skipped

## Executive Summary
The plan is fundamentally sound: the d3-force root-cause reasoning is correct, the empirical failing-first posture is the right discipline for a layout heuristic, the normalized edge-stretch metric is robust, and the two-pure-constant fix is properly minimal with correct deferral of the risky levers. The one substantive gap — that neither proposed fixture actually exercises Lever 1 (strength-pin), so the metric is entirely a Lever-2 (charge) test — was half-acknowledged; I sharpened it inline. Two surgical inline edits made (Lever 1 clarification + resolving the already-answered human question). No approach/architecture change required.

## Verification performed (claims validated against source)
- **d3 default link strength** (`d3-force ^3.0.0`, confirmed in `package.json`): `1/min(count(source),count(target))`. For the degree-1 Enchiridion leaf, `min(deg(hub),1)=1` ⇒ strength already `1`. **Plan's Mechanism-A/B split is correct.**
- **Folder grouping IS reachable from `makeGraph`**: `vicinityGraphToElk` → `deriveFolderGroups` runs unconditionally, `makeViewSettings` defaults `groupByFolder: true`, `MIN_GROUP_MEMBER_COUNT = 2` (`src/view/folderGrouping.ts:25`). A 2-member folder yields a container. **The plan's fixture can reproduce the large-container projection without the engine — confirmed.**
- **Edge projection** (`elkMapping.ts:86` `projectedRootEdges`): the hub→leaf edge is projected onto `folder-group:p/ep` (container id) with the leaf id preserved; the container accumulates/dedupes multiple edges, but the LEAF side stays degree-1 ⇒ strength stays 1. **Matches the real Enchiridion topology.**
- **No coordinate-asserting tests exist** — only `overlappingPairCount==0`, determinism (`toEqual` two runs), container-dimension/containment, and `positions.size` counts. **Changing `D3_FORCE_CHARGE_STRENGTH` / pinning strength cannot silently break a hidden position assertion.** Overlap on `hubGraph()` (24 neighbours) is the only real regression surface for the charge change — the plan already mandates re-verifying it.
- **`setup-dev-vault.sh`** uses the `write_if_missing PATH <<'EOF'` idempotent pattern the plan relies on — confirmed.

## Critical Issues (BLOCKERS)
None.

## Major Concerns
None that change the approach. The single notable gap is downgraded to a clarification (below) because it does not alter architecture, steps, or scope — Lever 1 remains a defensible ride-along fix.

## Simplification Opportunities / Clarifications (applied inline)
1. **[Clarity — applied inline under Lever 1] Lever 1 (pin `forceLink.strength`) is not exercised by either fixture.** Both `hubGraph()` and the proposed `strandedHubGraph()` are hub-and-spoke; every non-hub node is degree-1 ⇒ strength is *already* `1/min(deg)=1`. Pinning to 1 leaves both fixtures bit-identical. **The stretch-metric test is therefore a pure Lever-2 (charge) test and proves nothing about Lever 1.** The plan said "Lever 1, baseline always" and "does NOT change the degree-1 Enchiridion's forces" — I made the consequence explicit: ship Lever 1 as a reasoned correctness/doc-reconciliation fix for real multi-degree vault edges (untested by the new metric), or file a follow-up for a Mechanism-A fixture; do NOT expect the failing-first metric to move when Lever 1 is applied. **Rationale:** prevents the implementer from thrashing when Lever 1 leaves a red metric red, and keeps the plan honest that a shipped constant change has no test coverage.
2. **[Resolved — applied inline] The `#QUESTION_FOR_HUMAN`** about the dev-vault mirror is already answered by the ticket ("bring in the required test data into the dev-vault… without the `.out/vaults/public` dependency"). Downgraded to "Resolved — proceed" so it does not gate the work.

## Minor Suggestions (not blocking, not edited inline)
- **Metric false-positive guard (threshold):** `stretch <= MAX_EDGE_STRETCH` over *every* edge is only robust if, post-fix, the crowd edges also clear MAX. A dense hub legitimately pushes spokes beyond `restingTarget` (collide forces N nodes off a single equal-radius ring), so a crowd edge can score >1 without being "stranded." The plan's empirical calibration ("start ~2.0, tighten only as far as the fix clears with margin") handles this, but the implementer should keep the crowd small enough (4–6, as specified) that the legit spread stays well under MAX, and should NOT port the stretch assertion onto the 24-neighbour `hubGraph()` (it would likely false-fail). Worth a one-line note in the test.
- **Metric measures the projected (container) edge, not the visual edge.** The rendered React Flow edge runs leaf→Epictetus (inside the container); the metric measures leaf→container-center. This is the correct level to assert (it is where the force acts, and a well-placed container implies a well-placed member), but call it out so no one mistakes the metric for a literal rendered-edge-length check.
- **Robustness claim is slightly overstated.** "Adding a node cannot break it" holds for the *frozen* fixture; a node added to a crowded ring can raise a neighbour's stretch. Fine in practice (fixture is frozen), just don't oversell per-edge normalization as immunity to all fixture growth.

## Strengths (specific)
- **Correct, non-obvious root-cause correction.** Recognizing that the degree-1 leaf's link is already full-strength — so "weak link strength" (ticket hypothesis #1) is NOT its cause — is the sharpest insight in the plan and steers away from tuning the wrong lever.
- **Empirical failing-first with an explicit "iterate the fixture until it fails pre-fix" mandate.** This is exactly right for a heuristic layout where a-priori reasoning cannot guarantee a small graph strands; the plan refuses to proceed on unproven reasoning.
- **Self-normalizing per-edge stretch metric** is robust to container size (numerator and denominator both scale with `collideRadius`), deterministic, O(edges), and matches `forceLink.distance()` exactly — a genuinely good metric choice, and the rejected centroid alternative is correctly reasoned away.
- **Determinism discipline** is threaded throughout: both fixes are pure constants (trivially deterministic), and Lever 3's re-heat is correctly flagged as the determinism-sensitive one and held in reserve.
- **Correct Pareto deferral** of Levers 3–4 and the explicit refusal to build a Playwright screenshot gate for the automated check.
- **Regression list is complete**: overlap, determinism, container dims/containment, ElkLayout determinism, `tsc` — all the surfaces a constant change touches.

## Verdict
- [ ] APPROVED
- [x] APPROVED WITH MINOR REVISIONS  (revisions applied inline; PLAN_ITERATION can be skipped)
- [ ] NEEDS REVISION
- [ ] REJECTED
