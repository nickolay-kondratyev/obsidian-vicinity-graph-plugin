# DECISION — Embed-nesting resize semantics (ticket nid_1av3d7fx1072oyp5lxyhjd451_e)

> **RESOLVED 2026-08-07.** Q1 = (B) container-scoped fit factor. Q2 = **DERIVE, do not
> persist** — the container's outer-box size is the persisted fact; children scale is
> recomputed each rebuild, so it is never lost and needs **no new schema field**. Q3 =
> stagger via ordered tickets (deps chain in the design doc §8). Answers folded into
> `docs-internal/plan/embed-nesting-resize-semantics.md` (§3–§4, §8) and the ticket
> body. Implementation still BLOCKED on V1 (P1–P4). Questions kept below for the record.

Full design: `docs-internal/plan/embed-nesting-resize-semantics.md`.

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

- **(B) Container-scoped `childrenScale` [RECOMMENDED]** — a scale factor on the
  container applied to the rendered children region only; child own-sizes untouched.
  - YES I like this. The child sizes changes while its in the container. So if container pushes on the child it can be smaller that its overriden size, if the container has room to grow the child might as well use it. 
    - For now when we grab the actual size handle of the child and move it, then that is recorded on the child though, but if its due to container changes then its not.


## Q2 — If B: persist the `childrenScale`, or visual-only?

- **Persist [RECOMMENDED]** — survives rebuild/relayout (needs a new `NodeOverride`
  field + a persisted `version` bump; clean break, no migration since unpublished).
- **Visual-only** — no schema change, but the down-scale is lost on the next repaint
  (likely reads as a bug).

HUMAN: Can you help me understand why it would be lost? if we auto adjust children to always "FIT the container?" What I am getting at is that the container SIZE wins. IF we change the child while its within the container we would have changes the container size as well. IF we change the childs size while its outside container (lets say we go to the child and change it as central node), when we come back to the container view the container wins again. Hence, I am wondering whether we can hold off on the complexity of storing the permutation like sizing for now. While still retaining a good customer experience.  


## Q3 — Sequencing

I am fine with staggering if you want to go through and add some `deps` between id tickets that would be a good call to avoid any merge conflicts etc.

---

After you answer, reply here or in chat. I'll fold the answers into the design doc and
the ticket, and leave the ticket OPEN (implementation waits on V1).
