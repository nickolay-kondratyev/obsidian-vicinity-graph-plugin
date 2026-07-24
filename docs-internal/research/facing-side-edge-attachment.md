# Research (parked): facing-side edge attachment on folder-group boxes

Outcome of `edge-routing__05` (closed 2026-07-24 as a **measured negative
result**, no production code changed). The symptom: a note sitting directly
beside a folder-group box gets its edge wrapped around to a far side of the box
(the Epictetus screenshot — diagnosis in `research-layout-aesthetics.md` §B1).

What shipped instead: the two KISS levers, in ticket
`edge-routing__06` (`nid_j2jwp6x9rij34kbkewo03m0mb_e`) — `setExclusive(false)`
on the group boundary pins, and reducing/exposing the libavoid shape buffer.
Everything below is what was measured and **parked**.

## 1. The negative result — pin COSTS cannot fix this

**Read this before touching `setConnectionCost` again.** All numbers from the
real `libavoid-js@0.4.5` wasm with the repo's exact router parameters
(`shapeBufferDistance 17`, `segmentPenalty 50`, `crossingPenalty 0`) and the
shipped 12-pin `BOUNDARY_PIN_SPECS`. **Independently re-run by a second agent;
every number reproduced exactly.**

| Probe | Result |
|---|---|
| Positive control | cost 100 on the facing side of a 100×100 box **does** move the attachment → the API is live and correctly bound |
| Leaf orbiting a group box (systematic scan) | **0 of 43** attachments changed |
| 400 randomised crowded scenes | **0 of 818** group attachments changed |
| Same 802 edges at cost **100 000** | still the **same 24** non-facing attachments |

**Root cause:** the wrap-arounds are **visibility-BLOCKED pins, not near-ties**.
libavoid's path cost already prefers the facing side whenever it is *reachable*;
where it wraps, the facing pins are not reachable at all (every obstacle carries
a 17px buffer, sealing the corridor). No finite cost restores a pin the router
cannot see. `portDirectionPenalty` (0 vs 100) likewise had no effect on the
blocked-corridor case.

Corollary that drove `edge-routing__06`: the buffer, not the cost model, is the
measured lever on this symptom.

## 2. The parked design — per-edge pin CLASS + keep-the-better two pass

`ShapeConnectionPin` cost is a property of a **pin on a shape**, shared by every
connector touching it — a shape with several edges cannot express "this edge
left, that one below" through costs. `ConnEnd(shape, classId)` is per **connector
end**, so the class id is the *only* per-edge pin lever libavoid exposes — and it
is a **hard filter**, not a bias. A second pass is what converts it back into a
soft preference.

- **Pass 1 (baseline)** = today's routing, all 12 pins in one shared class.
- **Pass 2 (facing)** = the same 12 pins re-classed by side; each `ConnEnd`
  requests the class of the side facing its counterpart. Group-attached edges only.
- **Keep the better** per edge: accept the facing route only when it is
  ≤ **1.30×** the baseline length (**human's value, 2026-07-24**; the probes were
  swept at 1.25).
- **Two separate routers** — never co-locate duplicate pins (shared class + side
  class at identical coordinates corrupted routing badly: 761/802 non-facing,
  +56% length).
- `setExclusive(false)` on the group pins in **both** passes, or the passes are
  not comparable.

Measured outcome: non-facing attachments **24 → 7** in the original probe;
**82 → 13** at realistic group degree; total route length −0.4% to −2.7%.
Identical routing time per pass (409ms vs 409ms over the probe set).

**Class restriction ALONE is a net loss** — 53 of 802 routes >50% longer (lassos
around a blocked facing side), total length **+4.8%**. The second pass is not
optional dressing.

### CAVEAT — every number above needs re-measuring before anyone builds this

The reviewer's M1: the probes that produced "24 → 7 / zero lassos / −0.4%"
**did not call `setExclusive(false)`** and used a **non-total facing rule** (it
returned a SHARED class on overlapping rects, for which the shape has no pins, so
libavoid dropped those edges to the shape CENTRE and emitted
`ConnEnd::assignPinVisibilityTo: … no pins with class id` warnings). Neither the
measured baseline nor the measured facing pass is the configuration such a design
would ship. Re-run the sweep in the shipped configuration first.

### Why "keep the shorter route" (no tolerance) does NOT work

Tempting — it needs no constant and can never lengthen a route. But a wrap-around
wins the baseline pass **precisely because it is shorter**; keep-shorter therefore
discards exactly the cases we want to fix.

| tolerance | non-facing (low degree) | non-facing (realistic degree) | edges longer than baseline |
|---|---|---|---|
| 1.0 (keep shorter) | 10 | **22** | 0 |
| 1.1 | 9 | 18 | 30 |
| 1.25 (probed knee) | 7 | **13** | 54 |
| 1.5 | 7 | 12 | 59 |

The metric and the goal pull in opposite directions: a detour-ratio acceptance bar
("medium holds at 1.000") is *violated by design* by any tolerance > 1.0. If this
is ever built, the acceptance bar must be **non-facing attachment count**, plus
"no edge exceeds the tolerance × its baseline length".

### "The dense fixture is untouched" is a fixture artifact

True but misleading (reviewer M4/M5): the dense fixture is *ungrouped*, so the
facing pass never runs on it. `groupByFolder` is the **default**, so a real dense
vicinity *with* groups is the common case and would pay a full second pass — and
**no grouped-dense fixture exists** in the suite. Order of magnitude from the
probes: ~137ms → ~274ms against ~1460ms layout. Reassuring, but inferred, not
measured. Likewise the proposed Epictetus e2e fixture cannot *guarantee* it
reproduces the wrap (force layout decides where the leaf lands) — it is a
screenshot/aggregate smoke case, not a regression guard.

## 3. Also parked

- **Note-square directional pins** (4 per note instead of the single centre pin).
  Revives the `edge-routing__04` perf pathology: 8 pins on all shapes measured
  **~8838ms** routing vs **~1450ms** layout (~64×). Would also need
  `setExclusive(false)`, or a dense hub caps at 4 connectors.
- **`detourRatio`-triggered re-route** — post-check clipped routes above a
  threshold and re-route once with facing-side pins. Never measured.
- **`clusterCrossingPenalty` / group boxes as clusters — INFEASIBLE.**
  `Avoid::ClusterRef` is **not bound** in `libavoid-js@0.4.5`; it would need a
  WebIDL/wasm rebuild. (Corrects the C1 bullet in `research-layout-aesthetics.md`.)
- **Bindings that ARE available** (spike answered, no rebuild needed):
  `setConnectionCost`, `setExclusive`/`isExclusive`, `directions`, and
  `Avoid.portDirectionPenalty` (enum 5, via `router.setRoutingParameter`).

## Revisit triggers

- `edge-routing__06` ships and wrap-around attachments are still a complaint.
- A grouped-dense fixture exists and shows the second pass is affordable there.
- libavoid-js gains `ClusterRef` bindings, or we take ownership of the WebIDL.
- Routing moves off the main thread (see
  `crossing-penalty-and-worker-offload.md`) — a second pass becomes cheap.
