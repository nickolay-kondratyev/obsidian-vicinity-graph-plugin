# DECISION — Embed-nesting resize semantics (ticket nid_1av3d7fx1072oyp5lxyhjd451_e)

Round 2 (2026-08-07): children may GROW past natural. New model = **water-filling**:
allocate the container's outer box among regions, each with a floor (natural) and a
saturation ceiling (`max`); fill by priority. Own content is high priority up to a
**cap setting** (its `max`); overflow goes to children; a title-only child is saturated
at natural (`max = natural`), an image child has a large `max`. Full context in chat and
in `docs-internal/plan/embed-nesting-resize-semantics.md` §9 (IN DISCUSSION).

Round 1 already RESOLVED (still holds): Q1 container-scoped fit factor; Q2 derive the
scale, don't persist (container box is the persisted fact); Q3 stagger via ordered
tickets.

---

## Q4 — The own-content cap: scope & units

- **Scope:** a **global setting** (caps every container's own content the same way), or a
  **per-container** value? 
  - [V1: GLOBAL setting only, Recommend: global setting — one dial, matches "every setting
    is global" in this plugin.]
- **Applies at every nesting level, or only the OUTERMOST container?** You said "outermost
  container content." 
  - Yep aligned. [Recommend: every container level uses the same global cap — simpler
    and consistent; outermost-only is a special case that's hard to explain.]
- **Units:** an absolute max own-content size in **px**, or a **multiple of the own
  content's natural size** (e.g. 2×)? 
  - Yep aligned: [Recommend: px max — same currency as every other
    size dial and the resize handles.]

Your answer: __________

## Q5 — What makes a child "able to use" more space (its `max`)?

Is the signal the node's **content kind**?
- **image / representative-image** node → large `max` (keeps using width AND height).
- **title-only**, and **outline** once fully shown → saturated: `max = natural` (takes no
  surplus).

And: does growth apply to **both width and height**, or is **width always growable** (you
said "at least width-wise") while height is gated on content kind?
[Recommend: content-kind drives it for BOTH axes — an image grows both, text grows
neither; simplest honest rule. Say if width should always be free.]

Your answer: OK after some more thought lets cross out ~~"at least width-wise"~~
Yes the signal is content kind, 
  **title-only**, and **outline** once fully shown → saturated
  **image / representative-image** node → large `max` (keep growing until we hit the max). What I am thinking off though is that when we are giving space the the outermost container once the outermost container hit its max for content, all the extra space should be evenly distributed across all the descendents.

## Q6 — v1 ambition (Pareto)

For the FIRST cut, is it acceptable to spread the overflow across the unsaturated (image)
children **proportionally / equally**, with true **"most-use-first" greedy ordering** as a
later refinement? Or is strict priority ordering essential to v1?

Recommend: proportional among unsaturated children in v1; - YEP Exactly across all descendents.


--------------------------------------------------------------------------------
ALSO can you take out references to `current_decision.md` document from tickets as it will change by the time we run them.

---

After you answer I'll finalize §9 of the design doc (fold the water-filling model into
§3–§4, retire the old "scale ≤ 1" cap) and update the ticket. Implementation stays
BLOCKED on V1 (P1–P4) regardless.
