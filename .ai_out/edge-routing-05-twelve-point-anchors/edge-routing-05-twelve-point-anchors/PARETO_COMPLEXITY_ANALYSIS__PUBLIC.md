# PARETO_COMPLEXITY_ANALYSIS__PUBLIC — 12-point edge-routing anchors

## Pareto Assessment: PROCEED — verdict **JUSTIFIED**

**Value Delivered:** Removes corner attachment points on folder-group boxes so an edge
that terminates at a box no longer visually reads as continuing *past* it. Directly and
fully solves the stated problem.

**Complexity Cost:** Minimal and localized. Production change is a data edit to
`BOUNDARY_PIN_SPECS` (8 entries → 12) plus 2 named fraction constants and comment
rewrites in one file (`src/view/edgeRouting.ts`). No new abstractions, no algorithm/cost-model
change, no new config, no cascading edits. Test file grows by ~90 lines.

**Ratio:** High.

## Findings

### 1. Proportionality — CONFIRMED small
The diff (`git diff HEAD~4 -- src/`) touches exactly two files. Production surface is inert
data + constants + doc comments — precisely the "localized to `BOUNDARY_PIN_SPECS` + new
fraction constants" scope promised in the CLARIFICATION. Untouched-per-plan items
(`CENTRE_PIN_SPEC`, note-square branch, `visDirsFor`, cost model, arena, router) are in fact
untouched. No gold-plating. The group-only scope correctly preserves the perf-driven
edge-routing__04 decision, so no perf risk is revived.

### 2. Over-engineering — NONE material
- Exporting `BOUNDARY_PIN_SPECS` + `BoundaryPinSpec` widens the module's public surface, but
  only to let a pure, no-wasm spec-lock test assert the geometry directly. The data is inert;
  coupling risk is nil. Acceptable and arguably the right call (locks the contract without
  paying real-wasm cost on every run).
- The pure spec test's helpers (`sidePinOf`, `OUTWARD_DIR`, `SidePin`) are slightly elaborate
  for a 12-element array — a hand-written expected-array `toEqual` would be terser. This is a
  minor, defensible style choice (it asserts the *invariant* rather than the literal), not
  worth reworking. Not flagged as a blocker.
- Test count (4 pure + 2 real-wasm) is proportionate: one locks structure cheaply, one proves
  the actual behavioral guarantee (corner clearance) end-to-end through real libavoid. No
  redundant or speculative tests.

### 3. Under-delivery — NONE
The core behavioral guarantee (no endpoint attaches at a corner) is covered by a real-WASM
test on diagonally-offset boxes, where the tolerance (12px) cleanly separates the new ~25px
clearance from the old 0px. The reviewer's optional "on-face" extra assertion was correctly
declined per PARETO — corner-clearance is the stated contract and the pure spec test already
locks the full face geometry. No hidden risk left uncovered.

### 4. Follow-up tickets
**None recommended.** The obvious "should corners be removed on note squares too?" question is
already answered and documented: note squares intentionally keep the single centre pin for
perf reasons (edge-routing__04), and the WHY-NOT rationale is preserved in-code. Reopening it
would revive the perf pathology for no clear user value — not worth a ticket unless note-square
attachment ambiguity is ever observed in practice.

## Recommendation
Proceed as-is. Complexity is proportionate to value; the change stayed a small, data-level edit
with adequate, non-redundant test coverage and no speculative generality.
