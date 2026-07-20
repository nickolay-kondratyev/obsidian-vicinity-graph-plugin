# Ticket: Node / group drag-to-reposition — decide scope

**Status:** CLOSED — **out of V1** (human decision 2026-07-20). Drag explicitly
disabled (`nodesDraggable={false}` in `NeighborhoodGraphFlow.tsx`) so nodes don't
half-drag-and-snap-back. Reopen if repositioning is wanted post-V1 (see scope
notes below for what it would take).
**Origin:** step-05 human smoke run (2026-07-20), QA_CHECKLIST §2 (chip inert for
drag) and §3 (drag group moves members). Human: "we dont have drag working right
now."

## Context

The QA_CHECKLIST carried two items that assume nodes can be dragged:
- §2: "dragging a node starting on a chip does not drag/pan" — the human was
  confused by this item because dragging isn't a feature yet.
- §3: "dragging the group container moves its members with it" — marked NO.

**Manual node/group repositioning was never a step-05 requirement** (not in the
step-05 spec scope). React Flow leaves `nodesDraggable` at its default, but any
drag is immediately overwritten by the next elk relayout and nothing persists
positions — so effectively there is no usable drag today.

## Decision (2026-07-20): out of V1

Manual repositioning is **not a V1 feature**. `nodesDraggable={false}` is now set
so the read-only graph never shows half-working drag. The two drag items in the
step-05 QA_CHECKLIST (§2 chip-inert-for-drag, §3 drag-group-moves-members) are
therefore moot for V1.

If repositioning is wanted later, it needs (this is why it isn't a quick add):
- Position persistence (per MAIN? per doc?) that survives rebuilds, AND
- A layout mode that reuses human-placed positions instead of re-running elk, AND
- Child/parent (group) drag semantics.

## References

- `.ai_out/step-05-rich-rendering/main/QA_CHECKLIST.md` §2, §3
- `src/view/NeighborhoodGraphFlow.tsx` (React Flow config)
- `docs-internal/plan/steps/step-05-rich-rendering.md` (scope — drag not listed)
