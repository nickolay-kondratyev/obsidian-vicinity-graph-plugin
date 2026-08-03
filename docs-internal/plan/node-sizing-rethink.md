# Node sizing rethink — discussion & plan

Origin ticket: `nid_kyowb4v8v51nslbicl4szgcd5_e` ("rethink node sizing").
Status: **discussion + plan**, not implementation. Implementation is split into
the tickets listed at the bottom; the open product decisions are tracked in the
`decide`-tagged ticket and `.ai_out/_current_decision/current_decision.md`.

## 1. Problem

Today `sizePx = minPx + sizeScore * (maxPx - minPx)` where `sizeScore` is the
metric composition in `src/engine/NodeSizer.ts` (default: own-file-size only).
Two failure modes the owner called out:

- **Size ≠ importance.** Byte count is only sometimes aligned with how much a
  node deserves on screen.
- **Centrals/pinned are always huge.** `node.isCentral` bypasses metrics
  entirely (`CENTRAL_SIZE_SCORE` → maxPx), so an EMPTY central or pinned note
  still renders at maximum size.

## 2. Direction (owner's sketch, restated)

1. Default sizing moves toward **combining node content with the sizing
   dials** rather than raw byte-size alone (exact reading to be confirmed —
   see decision Q1).
2. **Drag-to-resize**: node edges are draggable to set a custom size (larger
   or smaller). Re-layout may be deferred until the resize gesture ends.
3. **Per-node overrides stored globally by docid**: frontmatter `id` for
   markdown, `metadata.frontmatter.id` for canvas; assigned lazily via
   obsidian-id-lib `ensureDocId` ONLY when an override actually needs saving.
   Overrides apply regardless of which note is central.
4. **Hover gear** at the node's bottom-right opens a per-node menu with
   `Content: [Inherit | Outline | Image]`, a per-docid override over the
   global `nodePreviewPreference` (`Inherit` = fall back to global).

## 3. What the codebase already gives us

- **Docid-keyed global persistence is a solved pattern.** Pins already do
  exactly this: `PersistenceServices` is the ONE caller of `ensureDocId`,
  `DocPersistEligibility.classify` refuses unsafe/absent ids, and `data.json`
  stores a docid-keyed list so renames are non-events. Per-node overrides are
  the same shape of data — **not** a violation of the "every setting is
  GLOBAL" decision (2026-07-29), which killed per-*view*/per-*document
  settings layers. Overrides are global facts about a doc, like pins.
- **React Flow 12 ships `NodeResizer`** (`@xyflow/react` additional
  components) — hover/selected resize handles on a custom node, with
  `onResizeEnd` for commit-on-release. No new dependency.
- **Per-node content choice is one pure function** —
  `src/view/nodePreviewChoice.ts` over `FlowNodeData.preview`; an override
  layer slots in front of the global preference without touching `NoteNode`.
- **Precedent for "pixels only, never score"**: the thumbnail floor moves
  `sizePx` but never `sizeScore`, because the score also ranks truncation
  (`NodePriorityChain`). Size overrides should follow the same rule.

## 4. Design positions (recommended, pending decisions)

- **Centrals stop bypassing metrics.** Replace the `CENTRAL_SIZE_SCORE`
  bypass with: centrals get their metric-composed score **floored at a
  modest prominence constant** (e.g. `CENTRAL_MIN_SCORE ≈ 0.35`, named
  constant, exact value tuned visually). Centrality stays visible via border
  / styling, not forced maximum size. Fixes both "avoid" bullets directly.
- **Override precedence (pixels):**
  `user per-node override > image-visibility floor > metric-derived size`.
  A per-node override is the MOST explicit intent, so it may exceed the
  global `maxPx` / undercut `minPx` (bounded by hard engine sanity bounds).
  Pending Q3.
- **Overrides move pixels only.** `sizeScore` stays pure relevance;
  truncation ranking is unaffected by a manual resize. Pending Q4.
- **Resize commits on release.** During the drag only the node's box changes
  (React Flow handles this); `onResizeEnd` persists the override via
  `runGuarded` and triggers ONE rebuild/relayout (the existing
  `SIZE_RELAYOUT_THRESHOLD` machinery makes big jumps relayout anyway).
- **Id assignment on save mutates the note.** Saving an override for an
  id-less note writes frontmatter — same behavior as pinning today, same
  refusal path (`DocPersistEligibility`) with the same notice for docs that
  cannot carry a safe id. Pending Q5 confirms silent-assign is acceptable.
- **Stored shape (clean break, no migration — not published yet):**
  `data.json` gains a docid-keyed map, `PERSISTED_SHAPE_VERSION` bump:

  ```jsonc
  "nodeOverrides": {
    "<docid>": {
      "sizePx": { "widthPx": 320, "heightPx": 180 },   // optional
      "content": "outline" | "image"                    // optional; absent = Inherit
    }
  }
  ```

  An entry with neither field is deleted (reset returns the node to inherit
  everything, and the orphan never lingers).

## 5. Open decisions (tracked in the `decide` ticket)

- **Q1** — What does "combining node content and the sizing dials" mean for
  the DEFAULT size: (a) keep metric dials, add content-derived metrics, or
  (b) size-to-fit the rendered content (outline lines / thumbnail), clamped
  by the min/max dials?
- **Q2** — Central/pinned prominence floor: agree with the
  metric-score-with-floor approach and roughly what floor?
- **Q3** — May a per-node override exceed global `maxPx` / undercut `minPx`?
- **Q4** — Confirm overrides never affect truncation ranking.
- **Q5** — Silent frontmatter id assignment on first override save (pin
  parity), or an explicit confirmation?

## 6. Ticket breakdown (created from the origin ticket)

1. **decide: node sizing rethink decisions** (`decide` tag) — Q1–Q5 above.
2. **engine: content-aware central/pinned sizing** — remove the central
   bypass per Q1/Q2. Depends on the decide ticket.
3. **persistence: docid-keyed per-node overrides in data.json** — shape,
   parser, version bump, `PersistenceServices` write path reusing the pin
   eligibility seam. Depends on the decide ticket.
4. **view: drag-to-resize nodes via React Flow NodeResizer** — commit on
   release, deferred relayout. Depends on ticket 3.
5. **view: hover gear + per-node content override (Inherit/Outline/Image)** —
   menu, override-aware `nodePreviewChoice`, reset affordance. Depends on
   ticket 3.
