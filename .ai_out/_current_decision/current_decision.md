# DECISION — Embed-nesting resize semantics (ticket nid_1av3d7fx1072oyp5lxyhjd451_e)

Full design: `docs-internal/plan/embed-nesting-resize-semantics.md`. Read that first;
this file is just the questions to approve.

## Context in one paragraph

V1 embed-nesting (P1–P4) is **not built yet**, so this workstream's *implementation*
is blocked. What's ready now is the **plan**. The design rests on one clean idea: **a
persisted size override always sizes a node's OWN direct content (image/title/outline),
never the aggregate that includes its nested children.** From that, owner behavior #1
(container grows its own image) and #2 (child resize auto-upsizes the container chain)
fall out almost for free from V1's existing elk auto-grow. Behavior #3 (shrinking a
container scales the nested stack down) is the only genuinely new mechanism and needs
your call.

## Q1 — Container downsize (#3): how do we scale nested nodes down?

- **(A) Rewrite child overrides** — proportionally shrink each nested child's stored
  size. REJECTED in the plan: mutates a child's standalone size as a side effect of
  resizing an ancestor (POLS violation), cascading writes.
- **(B) Container-scoped `childrenScale` [RECOMMENDED]** — a scale factor on the
  container applied to the rendered children region only; child own-sizes untouched.
- **(C) Defer #3** — ship #1 + #2 now, clamp container drag so it can't shrink past the
  stack, revisit #3 later (Pareto fallback).

**Recommended: B.**  Your answer: __________

## Q2 — If B: persist the `childrenScale`, or visual-only?

- **Persist [RECOMMENDED]** — survives rebuild/relayout (needs a new `NodeOverride`
  field + a persisted `version` bump; clean break, no migration since unpublished).
- **Visual-only** — no schema change, but the down-scale is lost on the next repaint
  (likely reads as a bug).

**Recommended: Persist.**  Your answer: __________

## Q3 — Sequencing

The plan assumes V1 (P1–P4) ships first, then Phase A (#1+#2), then Phase B (#3).
Confirm this order, or say if you want #3 folded into Phase A. Your answer: __________

---

After you answer, reply here or in chat. I'll fold the answers into the design doc and
the ticket, and leave the ticket OPEN (implementation waits on V1).
