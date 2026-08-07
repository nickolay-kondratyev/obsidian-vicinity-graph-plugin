# Embed-nesting resize semantics — design & plan

Ticket: `nid_1av3d7fx1072oyp5lxyhjd451_e` (workstream). Follow-up from embed-nesting
decision **Q8** (`nid_e79vxubva52s9gq24idypb77x_e`). Consumes the V1 nesting feature
(P1–P4: `nid_r3qiyd7xx3bund6f73wf5h0vd_e`, `nid_1moqnutin09drbiyxkd3l7r5k_e`,
`nid_qy5rc7sq261z23bp79bk8wsem_e`, `nid_jbsbfqqxyy1brm26ul7873v5h_e`).

> **STATUS: PLAN — not implemented.** V1 embed-nesting (P1–P4) is still open; this
> workstream is blocked on it. Two data-model decisions below need human approval
> (see `.ai_out/_current_decision/current_decision.md`). Once V1 ships and the
> decisions land, implement Phase A then Phase B.

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

## 3. Core model — "the override always sizes a node's OWN content"

The one idea that makes every behavior fall out cleanly, and answers the ticket's
first open question:

> **A persisted `sizePx` override always describes the node's OWN direct-content box
> (title / outline / representative image), never the aggregate box that includes
> descendants.** Standalone, the own-content box *is* the whole node. As a container,
> layout adds the children region *below* it. So the override travels **unchanged**
> between the nested and standalone states — it means the same thing in both.

Concretely, split today's single function in two:

- `nodeOwnContentDimensionsPx(node)` — exactly today's `nodeDimensionsPx` body
  (override wins verbatim; else auto). This is the node's own region, and the box a
  standalone (non-container, non-nested) node renders at. **Unchanged semantics.**
- Layout composition (elk): `containerTotal = ownContent ⊕verticalStack⊕ childrenRegion + padding`,
  where `childrenRegion` is elk-auto-sized from the child boxes (each child recursing
  the same rule). The React Flow container node height = elk-derived total; the
  own-content region *inside* `NoteNode` is styled to `ownContent.height`.

This is the same "compose, don't store the aggregate" discipline the codebase already
uses for folder groups and for `PluginDataStore` merging one field over a fresh read.

### Why each owner behavior then falls out

- **#1 Container grows own content.** A container-resize drag reports a *total* box.
  On commit compute `newOwn = draggedTotal − childrenRegion` (per axis), clamp to
  `≥ ownMin`, persist as the container's **own** `sizePx`. The children region is
  pinned to the children's intrinsic sizes, so all the extra space lands on the own
  region. Matches "extra space → the image."
- **#2 Child resize auto-upsizes the chain.** A nested child is just a node with its
  own override. Enabling its drag-resize writes a bigger own `sizePx`; the next
  relayout re-derives `childrenRegion` → container auto-grows → its parent's
  `childrenRegion` grows → up the chain. **This is V1 auto-grow already** — we only
  need to *enable* child resize + relayout on commit. No bespoke upsize code.
- **#3 Container downsize scales children.** The genuinely hard one — §4.

### Answers to the remaining open questions

- **Override vs auto-grow minimums.** They are independent floors on independent
  regions: an override sets the *own* region (clamped `≥ ownMin`); auto-grow sets the
  *children* region (from child boxes, each `≥` its own floor). Total = sum. An
  override can never shrink the container below its children region (that is what #3 /
  §4 governs), and never below `ownMin`.
- **Nested vs standalone meaning** — resolved by the core model above: same meaning,
  so V1's "ignore overrides while nested" is *dropped* — a nested node with an
  override renders its own region at that override, and layout composes around it.

---

## 4. The hard case: container downsize (#3) — needs a decision

When the user drags a container **below** `ownMin + childrenRegion`, the own region is
already at its floor. Further shrink must come out of the children stack. Three options:

- **4a — Rewrite child overrides (rejected).** Proportionally shrink each nested
  child's persisted own `sizePx`. Cascading writes; mutates a child's *standalone*
  size as a side effect of resizing an unrelated ancestor — a POLS violation ("I
  shrank n1, why did n3 change size everywhere?"). Rejected.
- **4b — Container-scoped visual `childrenScale` (recommended).** The container carries
  a scale factor `s ∈ (0,1]` applied to the *rendered* children region only; child
  own-overrides untouched. `s = min(1, availableChildrenHeight / naturalChildrenHeight)`
  when the drag pushes below the natural stack. It is a container property, not a child
  fact — so it composes down one level and never leaks to a child's standalone view.
- **4c — Defer #3 entirely (Pareto fallback).** Ship #1 + #2 (the 80%): container
  grows own content; child resize auto-upsizes the chain. Clamp container drag at
  `ownMin + childrenRegion` (cannot shrink past the stack). Revisit #3 if it's missed.

**Sub-decision for 4b — persist the scale?**
- *Persist* (`childrenScale` on the container's `NodeOverride`): survives rebuild /
  relayout; without it the down-scale **snaps back** on the next repaint (surprising).
  Cost: a new persisted field (schema `version` bump; clean-break per CLAUDE.md since
  unpublished).
- *Visual-only*: no schema change, but lost on any relayout — likely reads as a bug.

**Recommendation: 4b, persisted.** It is the only option that (a) honors the owner's
"scales the internal nodes down too" literally, (b) keeps a child's standalone size
sacrosanct, and (c) is stable across repaints. If the human wants the smallest V-next,
fall back to **4c** and file a follow-up for #3.

---

## 5. Touchpoints (as of planning)

| File | Change |
|------|--------|
| `src/view/graphIdentity.ts` | Split `nodeDimensionsPx` → `nodeOwnContentDimensionsPx` (own region) + a composition seam; container total derives from elk, not from the override verbatim. |
| `src/view/elkMapping.ts` | Compound container total = own ⊕ children-stack + padding; apply `childrenScale` (4b) to the children region; `extractElkDimensionsById` returns own-vs-total consistently. |
| `src/view/NoteNode.tsx` | Re-enable `NodeResizeControl` on containers **and** nested children (V1 disabled both); own-content region styled to `ownContent.height`; children region honors `childrenScale`. |
| `src/view/nodeResize.ts` | New commit mappings: container drag → `newOwn = total − childrenRegion` (clamp `≥ ownMin`); below-floor drag → `childrenScale` (4b). `NODE_RESIZE_BOUNDS` unchanged for own region. |
| `src/engine/types.ts` | (4b-persisted only) add `childrenScale?` to `NodeOverride`; bump persisted `version`. |
| `src/persistence` (`PluginDataStore`, `NodeOverrideChange`) | (4b-persisted only) new one-field change for `childrenScale`, merged over the fresh entry — same rule as `sizePx`. `runGuarded` failure policy reused. |
| `src/view/layoutFit.ts` + `GraphStructureDiff.ts` | A resize that changes a container's own region or `childrenScale`, or any nested-child box, is a **relayout** (fit check must see the composed container total, not the own box). |
| `src/view/settingsRows.ts` / reset menu (`planResetSizeAction`) | "Reset size" on a container clears own `sizePx` **and** `childrenScale`; on a nested child clears its own `sizePx` (chain re-auto-grows). |

---

## 6. Phased implementation plan (AFTER V1 ships + decisions land)

**Phase A — #1 + #2 (the 80%), no schema change.**
1. Failing BDD unit tests: `nodeOwnContentDimensionsPx` returns today's values for a
   standalone node; a container's elk total = own ⊕ children + padding; a bigger nested
   child grows the container total up the chain; container drag commit maps
   `total − childrenRegion → own`, clamped `≥ ownMin`.
2. Split `graphIdentity.ts`; compose in `elkMapping.ts`; re-enable `NodeResizeControl`
   for containers + nested children in `NoteNode.tsx`; container/child commit mappings
   in `nodeResize.ts`; relayout classification in `GraphStructureDiff.ts` / `layoutFit.ts`.
3. Reset menu covers the container + nested-child cases.
4. `npm run check` + `npm test` green; **`npm run test:e2e`** (view-layer DOM/CSS — required
   per CLAUDE.md): grow a container → image region grows, stack fixed; grow a nested
   child → container chain upsizes; reset → auto size returns.

**Phase B — #3 container downsize (4b).** Gate on the §4 decision.
1. Failing tests: dragging a container below `ownMin + childrenRegion` yields
   `childrenScale < 1`; child own-overrides unchanged; (persisted) `childrenScale`
   round-trips and resets; the down-scale survives a rebuild.
2. `elkMapping` applies the scale; `nodeResize` commit computes it; (persisted)
   `types.ts` field + `NodeOverrideChange` + `PluginDataStore` merge + `version` bump.
3. e2e: shrink a container past its stack → nested nodes scale down and hold across a
   repaint.

---

## 7. Testing posture

BDD, one behavior per test, colocated. Pure geometry (own-vs-total composition, commit
mappings, scale math) is fixture-tested in the view-pure modules (`graphIdentity`,
`elkMapping`, `nodeResize`) — keep correctness in the tested core, `NoteNode` thin.
jsdom component tests for the container resize handles rendering. `npm run test:e2e`
before calling any rendered change done. A `childrenScale` schema field (4b-persisted)
must round-trip through the `settingsProductDefaults`/persistence tripwires like every
other persisted shape.
