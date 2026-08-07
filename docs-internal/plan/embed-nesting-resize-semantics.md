# Embed-nesting resize semantics — design & plan

Ticket: `nid_1av3d7fx1072oyp5lxyhjd451_e` (workstream). Follow-up from embed-nesting
decision **Q8** (`nid_e79vxubva52s9gq24idypb77x_e`). Consumes the V1 nesting feature
(P1–P4: `nid_r3qiyd7xx3bund6f73wf5h0vd_e`, `nid_1moqnutin09drbiyxkd3l7r5k_e`,
`nid_qy5rc7sq261z23bp79bk8wsem_e`, `nid_jbsbfqqxyy1brm26ul7873v5h_e`).

> **STATUS: PLAN — not implemented; all decisions RESOLVED 2026-08-07.** V1 embed-nesting
> (P1–P4) is still open; this workstream is blocked on it. Design is settled: the internal
> split is **derived, not persisted** (§4.1), children may grow past natural via a
> **water-filling** allocation with a **global px cap** on own content (§9). Net effect:
> **no new persisted field, no schema/version bump** — the only new persisted-ish thing is
> one global settings dial (the cap). Once V1 ships, implement Phase A → B → C.

---

## 1. Owner vision (Q8, 2026-08-07)

`n1` embeds `n2`; `n2` embeds `n3` and `n4`. The graph draws one nesting tree: `n1`
renders **its own** representative image/title/outline, and *below* that the nested
stack `[n2[n3 n4]]`.

1. **Container resize → own content.** Scaling `n1` up grows `n1`'s **direct content
   region** (its image), *not* the nested `[n2…]` stack.
2. **Child resize → auto-upsize the chain.** Resizing `n3` so it pushes past `n2`'s
   edge auto-grows `n2`, and `n2` past `n1`'s edge auto-grows `n1`.
3. **Container downsize → scale internal nodes down.** Shrinking `n1` past the point
   where its own content is already minimal pushes on the nested stack and scales it
   down too.

---

## 2. V1 geometry we build on (from P3)

- Node id = vault path (`graphIdentity.ts`). Container becomes a **compound elk node**
  like a folder group; children stack **vertically in embed order**; the container
  **auto-sizes from elk + padding**. `extractElkDimensionsById` covers nested containers.
- `NoteNode.tsx`: container renders its own title/outline/image **above** a children
  region **below**. V1 **disables** `NodeResizeControl` on containers and nested
  children and **ignores** size overrides while nested.
- Today's box source: `nodeDimensionsPx(node)` (`graphIdentity.ts:102`) — a size
  override wins **verbatim**; otherwise auto (`sizePx` height, label-snug width).
- Override shape: `NodeSizeOverridePx { widthPx, heightPx }` on `NodeOverride.sizePx`
  (`types.ts:252`), persisted per-docid in `data.json` `nodeOverrides` via
  `NodeOverrideChange` + `PluginDataStore` (merge over the entry read FRESH there).
- Drag-resize commit plumbing already exists: `nodeResize.ts`
  (`NODE_RESIZE_BOUNDS`, `resizeEndToOverride`, `isResizeGestureChange`),
  `NodeResizeControl` wiring in `NoteNode.tsx`, the "screen-ahead" reseed +
  `GuardedWriteOutcome` policy (CLAUDE.md). We **reuse** all of it — this workstream
  changes only *what a committed box maps to*, not how a commit is plumbed.

---

## 3. Core model — "the override is a node's OUTER box; the internal split is DERIVED"

Two ideas make every behavior fall out cleanly and answer all the ticket's open
questions:

> **(a) A `sizePx` override is always the node's OUTER rendered box — the box the user
> dragged the handle to.** For a leaf that outer box *is* its own content. For a
> container it is the whole box *including* the nested stack below. The override's
> meaning ("this is how big this node is on screen") is therefore identical whether the
> node is nested or standalone.
>
> **(b) Inside a container, the split — how much of the box is the container's own
> content (image) vs the children region, and the children's fit `scale` — is DERIVED
> on every rebuild, never stored.** It is a pure function of `(container outer box,
> children natural sizes)`. Because the durable fact (the container's box) is
> persisted, the derived scale is deterministic and is never "lost" on a repaint.

Concretely, split today's single function and add a derivation:

- `nodeOwnContentDimensionsPx(node)` — the node's own-content box: today's
  `nodeDimensionsPx` body for a leaf (override wins verbatim; else auto). For a
  *container*, this is its own **natural** content box (auto), used as the own-region's
  preferred size before the split.
- `deriveContainerLayout(outerBox, ownNatural, childrenNatural)` (pure) → `{ ownBox,
  childrenScale }`, per axis:
  - `outerBox` = container override if present, else `ownNatural ⊕ childrenNatural`
    (V1 auto-grow).
  - surplus first to own content: `ownBox = clamp(outerBox − childrenNatural, ownMin, …)`.
  - `childrenScale = clamp((outerBox − ownBox) / childrenNatural, minScale, 1)` — `< 1`
    only when the box can't hold the natural stack (#3); recovers to `1` as room
    returns. **NOTE (2026-08-07): the `≤ 1` cap here is SUPERSEDED by §9** — the owner
    now wants children to grow *past* natural once the container's own content hits a
    cap. The split becomes a water-filling allocation (§9, DECIDED); this simple formula
    remains the down-direction (#3) special case.
- Layout (elk): the compound container node's total = `outerBox`; the children region
  is laid out at `childrenScale`; `NoteNode` styles its own-content region to `ownBox`.

This is the same "compose/derive, don't store the aggregate" discipline the codebase
already uses for folder groups and for `PluginDataStore` merging one field over a fresh
read. **No new persisted field** — the container's existing `sizePx` override carries
everything.

### Why each owner behavior then falls out

- **#1 Container grows own content.** A container-resize drag persists the new
  `outerBox`. On the next `deriveContainerLayout`, surplus above `childrenNatural` goes
  to `ownBox` (children stay at scale 1). Extra space lands on the image.
- **#2 Child resize auto-upsizes the chain.** A nested child is a node with its own
  `sizePx`. Its drag-resize writes a bigger own box → `childrenNatural` grows. If the
  container is **un-sized** (no override), its `outerBox` auto-grows to fit — V1
  auto-grow, free, up the chain. If the container **is** explicitly sized, the child
  would otherwise be scaled back down; so a *child-handle* commit also **bumps the
  ancestor `outerBox` overrides outward** just enough to keep the child at its own size
  (§4 asymmetry). Either way the container edge moves out.
- **#3 Container downsize scales children.** A container-resize drag persists a smaller
  `outerBox`; once it's below `ownMin + childrenNatural`, `deriveContainerLayout` yields
  `childrenScale < 1` and the stack shrinks to fit. Child own-sizes are **untouched**;
  the scale is derived, so it holds across repaints. See §4.

### Answers to the ticket's open questions

- **Override vs auto-grow minimums.** The container's `outerBox` is one box with a floor
  of `ownMin` (`childrenScale` absorbs the rest). Un-sized → `outerBox = ownNatural ⊕
  childrenNatural` (V1 auto-grow). A child growing raises `childrenNatural`, which raises
  an un-sized container's `outerBox` and, for a sized container, is handled by the #2
  ancestor-bump. No independent "children floor" fights the override.
- **Nested vs standalone meaning** — same box either way (idea (a)); V1's "ignore
  overrides while nested" is **dropped**.
- **Child-scaling persisted or visual** — **derived, not persisted** (idea (b) / §4.1).

---

## 4. Container downsize (#3) — DECIDED

When the user drags a container **below** `ownMin + childrenNatural`, the own region is
at its floor and the deficit comes out of the children stack via the derived
`childrenScale < 1`. Child own-`sizePx` is never rewritten.

### 4.1 Decision (owner, 2026-08-07)

- **Q1 — how to scale children down: (B) container-scoped fit factor.** A `childrenScale`
  applied to the *rendered* children region only; each child's own `sizePx` is left
  alone. Owner: *"the child size changes while it's in the container — if the container
  pushes on the child it can be smaller than its overridden size; if the container has
  room, the child uses it [back up to its own size]. Grabbing the child's OWN handle is
  recorded on the child; a change due to the container is not."*
- **Q2 — persist the scale or derive it: DERIVE (visual, not persisted).** The scale is
  **not** stored and **not** lost. Owner: *"the container SIZE wins."* The persisted
  fact is the container's `outerBox`; `childrenScale = f(outerBox, childrenNatural)` is
  recomputed every rebuild, so it is deterministic across repaints with **no new
  `NodeOverride` field and no schema/`version` bump**. Editing a child elsewhere (e.g.
  as the central node) changes the child's own size; returning to the container view
  simply re-derives the fit — the container box still wins.
- **4a — rewrite child overrides — REJECTED** (recorded for posterity): mutating a
  child's standalone size as a side effect of resizing an ancestor is a POLS violation
  and cascades writes.

This is strictly simpler than a stored scale: fewer persisted fields, no migration
surface, and no way for a stored scale to drift out of sync with the container box.

---

## 5. Touchpoints (as of planning)

| File | Change |
|------|--------|
| `src/view/graphIdentity.ts` | Split `nodeDimensionsPx` → `nodeOwnContentDimensionsPx` (own region) + add pure `deriveContainerLayout(outerBox, ownNatural, childrenNatural) → {ownBox, childrenScale}`. Container `outerBox` = override or auto (`ownNatural ⊕ childrenNatural`). |
| `src/view/elkMapping.ts` | Compound container total = `outerBox`; children region laid out at `childrenScale`; `extractElkDimensionsById` returns the outer box for containers. |
| `src/view/NoteNode.tsx` | Re-enable `NodeResizeControl` on containers **and** nested children (V1 disabled both); own-content region styled to `ownBox`; children region rendered at `childrenScale`. |
| `src/view/nodeResize.ts` | Container drag commit → persist `outerBox` as the container's `sizePx` (existing shape). Child-handle commit → persist child `sizePx`; if it overflows an explicitly-sized ancestor, bump that ancestor's `outerBox` outward (#2). Down-drag needs no special commit — the smaller `outerBox` alone yields `childrenScale < 1` at derive time. `NODE_RESIZE_BOUNDS` unchanged. |
| `src/engine/types.ts` / `src/persistence` | **No change** — the derived-scale decision (§4.1) adds no persisted field. The container's existing `NodeSizeOverridePx` carries the whole outer box; `#2` ancestor bumps reuse the existing `NodeOverrideChange` `sizePx` write. |
| `src/view/layoutFit.ts` + `GraphStructureDiff.ts` | A resize that changes any node's `sizePx` (leaf, child, or container outer box) is a **relayout** (fit must see the composed container total incl. the derived scale, not the own box). |
| `src/view/settingsRows.ts` / reset menu (`planResetSizeAction`) | "Reset size" clears the node's `sizePx` — on a container that drops its `outerBox` back to auto (own ⊕ children, scale 1); on a nested child, the chain re-auto-grows. One rule, no new field to clear. |

---

## 6. Phased implementation plan (AFTER V1 ships + decisions land)

Both phases are **no-schema-change** (§4.1). Phase B builds directly on Phase A's
`deriveContainerLayout`; keep them as ordered tickets so their view-layer edits don't
collide (see §8).

**Phase A — #1 + #2 (the 80%).**
1. Failing BDD unit tests: `nodeOwnContentDimensionsPx` returns today's values for a
   standalone node; `deriveContainerLayout` gives surplus to `ownBox` and keeps
   `childrenScale = 1` when the box holds the natural stack; a bigger nested child grows
   an un-sized container's outer box up the chain; a child-handle commit that overflows a
   sized ancestor bumps that ancestor's `outerBox` outward.
2. Split `graphIdentity.ts` + add `deriveContainerLayout`; compose in `elkMapping.ts`;
   re-enable `NodeResizeControl` for containers + nested children in `NoteNode.tsx`;
   container/child commit mappings in `nodeResize.ts`; relayout classification in
   `GraphStructureDiff.ts` / `layoutFit.ts`.
3. Reset menu covers the container + nested-child cases (one `sizePx` clear).
4. `npm run check` + `npm test` green; **`npm run test:e2e`** (view-layer DOM/CSS — required
   per CLAUDE.md): grow a container → image region grows, stack fixed; grow a nested
   child → container chain upsizes; reset → auto size returns.

**Phase B — #3 container downsize (derived scale, no persistence).**
1. Failing tests: a container `outerBox` below `ownMin + childrenNatural` yields
   `childrenScale < 1`; child own-`sizePx` unchanged; the scale **re-derives** to the
   same value after a rebuild (proving nothing needed persisting); `childrenScale`
   recovers to 1 (never > 1) as the box grows back.
2. `elkMapping` lays out the children region at `childrenScale`; `NoteNode` renders it.
   No `types.ts` / persistence change.
3. e2e: shrink a container past its stack → nested nodes scale down and **hold across a
   repaint** (fan-out / relayout).

**Phase C — children grow past natural (§9 water-filling + global cap).**
1. New global px cap setting: a `SETTINGS_SPEC` leaf through the ONE pipeline (row,
   accessor, tab + panel presenters, spec tripwire) — the spec-coverage suite forces it
   to be wired.
2. Failing tests for the allocator (pure, in `graphIdentity`/a sibling): own content
   grows only to the cap; overflow past the cap splits **evenly across all unsaturated
   descendants**; a title-only / fully-shown-outline descendant is saturated and takes
   nothing; an image descendant grows on both axes; the whole thing is derived (survives a
   repaint) and still stores nothing per node.
3. e2e: give the outermost container lots of room → its image grows to the cap, then the
   nested image nodes grow evenly while title-only nodes stay put.

---

## 7. Testing posture

BDD, one behavior per test, colocated. Pure geometry (`nodeOwnContentDimensionsPx`,
`deriveContainerLayout`, the commit mappings, the §9 water-filling allocation) is
fixture-tested in the view-pure modules (`graphIdentity`, `elkMapping`, `nodeResize`) —
keep correctness in the tested core, `NoteNode` thin. jsdom component tests for the
container/child resize handles rendering. `npm run test:e2e` before calling any rendered
change done. **No new persisted per-node shape**, so the persistence tripwires are
untouched — assert only that a container `sizePx` override round-trips unchanged (it
already does; the container just interprets it as an outer box). The Phase C **global cap**
is the one addition to `SETTINGS_SPEC`, so it rides the existing `settingsProductDefaults`
/ spec-coverage tripwires like every other dial.

---

## 8. Ticket sequencing (Q3, owner OK'd staggering)

Dependency chain, to keep view-layer edits from colliding:

```
P1 (embedOrder) → P2 (nesting forest) → P3 (render nested + compound elk)
                                              → THIS workstream, Phase A (#1+#2)
                                                    → Phase B (#3 downsize)
                                                          → Phase C (children grow, §9)
```

- This workstream now carries `deps: [P3]` (`nid_qy5rc7sq261z23bp79bk8wsem_e`) — it
  cannot start until containers render.
- Phases A, B, C touch the same view modules (`graphIdentity`, `elkMapping`, `nodeResize`,
  and for C the settings pipeline); they are **ordered sub-tickets** (C `deps` B `deps` A
  `deps` P3) so each rebases on the last instead of merge-conflicting. Created 2026-08-07:
  - **Phase A** `nid_rju51kn8sndg0v4dvxvwzdkap_e` (#1+#2)
  - **Phase B** `nid_wi1x92hhm65wemtcrqzbc33aw_e` (#3 downsize)
  - **Phase C** `nid_0bvt1rkun36xtcmo5df9btm92_e` (children grow + cap, §9)

---

## 9. Children may grow — the water-filling model (owner 2026-08-07, DECIDED)

The owner refined the vision: nested nodes should be able to grow **past their natural
size**, not just shrink. The mechanism generalizes §3's split into an allocation with
per-region appetites, plus one global cap.

**Model.** A container's `outerBox` is an area to hand out among competing regions — the
container's **own content** and the nodes in its subtree. Each region has:
- a **floor** = its natural (content-fit / own-override) size;
- a **ceiling `max`** = its saturation point — where more space stops helping.

Allocation:
1. Every region gets its floor first.
2. **Own content** of the (outermost) container takes surplus next, up to the **cap**
   (§9.1 Q4 — a global px setting). This bounds #1 ("primarily to direct content") so the
   image can't eat *all* the room.
3. **Overflow past the cap is spread EVENLY across ALL descendants in the subtree**
   (Q5/Q6) — not per level, one flat pool over the whole tree. Only **unsaturated**
   descendants take a share; each descendant's own content is itself bounded by the same
   global cap (a descendant at cap drops out, its share redistributes — v1 may skip the
   redistribute and just even-split the unsaturated set; see Q6).
4. Deficit (box below the floors) → the §3 `childrenScale < 1` shrink (#3), unchanged.

So the own-content **cap** is own-content's `max`; §3's retired "`≤ 1`" cap becomes "a
node's ceiling is its appetite, not its natural size." Everything else (derive-not-persist,
container box wins, **no schema change**) is untouched — this only enriches the *derive*
step; the persisted fact is still the container's outer box.

### 9.1 Decisions (owner, 2026-08-07)

- **Q4 — the own-content cap: GLOBAL px setting, every level.** One new `SETTINGS_SPEC`
  leaf (a `BoundedNumberSpec`, px), capping every container's own content the same way at
  every nesting level. Flows through the ONE settings pipeline (row → accessor → tab +
  panel presenters → spec tripwire) like every other dial. **No `NodeOverride` field**, so
  the whole workstream stays schema-clean.
- **Q5 — appetite signal: content KIND, BOTH axes.** ("at least width-wise" is dropped —
  width is *not* special.) **image / representative-image** → large `max`, keeps growing
  (both width and height) until the cap. **title-only**, and **outline once fully shown**
  → **saturated**, `max = natural`, takes no surplus. The node's content kind (the same
  `NodePreviewPreference` / representative-image signal the renderer already resolves) is
  the appetite.
- **Q6 — distribution: EVEN across all unsaturated descendants.** The surplus beyond the
  outermost's own-content cap is divided **equally among all unsaturated descendant nodes
  of the whole subtree** (not proportional-by-size, not per-level, not priority-ordered).
  True "most-use-first" greedy ordering and cap-driven redistribution are later refinements.

**Sequencing.** This children-grow allocator is the natural **Phase C** — Phase A (#1+#2)
and Phase B (#3 shrink) don't need it; ship them first, then layer the appetite model +
the global cap setting on top. With Q4 = global setting, **Phase C adds no persistence
either** — only a new global settings dial.
