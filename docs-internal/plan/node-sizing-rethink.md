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
- **Stored shape (no migration — not published yet):**
  `data.json` gains a docid-keyed map, and `PERSISTED_SHAPE_VERSION` does
  **NOT** bump (corrected 2026-08-04; this line first said "bump"). The map is
  ADDITIVE: a file written before it existed just lacks the key and gets the
  empty map per field, whereas a bump discards that file's settings AND its
  pins wholesale. Bumping is reserved for a REMOVED/renamed key — the standing
  call in `nid_8p0nn2g34d97finokwlz3u1dt_e`, re-affirmed against a key rename
  in `nid_fay1hu5sxcoygizopkkg0f0d7_e`.

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

## 5. Decisions (owner-answered 2026-08-03, decide ticket closed)

- **Q1 — DECIDED: size-to-fit rendered content**, clamped by the min/max
  dials. The owner went further than the original option (b): the **metric
  dials are removed entirely** (own-file-size, total-linker-size,
  backlink-count, outlink-count, depth-decay). Size reflects the usefulness
  of the content the node shows — a title-only node sizes to fit just its
  title. `minPx`/`maxPx` stay, as clamps.
  - ~~Open implementation point~~ **SETTLED** (engine ticket, 2026-08-04):
    the "higher size score" truncation tiebreak was DROPPED — no hidden
    content score; distance-to-MAIN takes over as the depth tiebreak
    (`NodePriorityChain`). A hidden score would have made truncation depend on
    invisible content statistics, the exact smell Q1 removed from sizing.
  - The preference-independence rule ("`sizePx` must not depend on the
    resolved preview kind") is superseded by design: size now legitimately
    follows displayed content, so a content-preference flip may relayout.
- **Q2 — DECIDED: yes.** Centrals/pinned get the normal computed size floored
  at a modest named prominence constant; no more forced maxPx.
- **Q3 — DECIDED: yes.** A manual resize may exceed global `maxPx` / undercut
  `minPx` (hard sanity bounds only).
- **Q4 — DECIDED: confirmed.** Resize moves pixels only; truncation (whether
  to show the node at all) is unaffected.
- **Q5 — DECIDED: silent.** Frontmatter id is written whenever an id is
  needed to save; no confirmation prompt.
- **NEW (owner addition) — "Title only" content option**: a fourth
  `NodePreviewPreference` value (`title-only`) rendering just the title, both
  as a global setting and as a per-node override choice.

## 6. Ticket breakdown (created from the origin ticket)

1. `nid_o5hz7ilcauwe2acqdfh6pcuam_e` **decide** — Q1–Q5. **Closed**, answers
   recorded above and in its notes.
2. `nid_cx5zoz7ptucg9nxalibv0mbjb_e` **engine: content-aware sizing** —
   remove metric dials + central bypass, size-to-fit with prominence floor,
   settle the truncation-tiebreak point. **Done** (2026-08-04): content fit
   estimated engine-side in `NodeSizer.contentFitPx` (deliberate deviation
   from the "view mapping" note here — `GraphNode.sizePx` stays the one
   number downstream reads); tiebreak dropped (see §5); no version bump.
3. `nid_lwionnvohw9k58jw7a2dybht2_e` **persistence: docid-keyed per-node
   overrides in data.json** — shape, parser (no version bump — see §4),
   `PersistenceServices` write path reusing the pin eligibility seam.
4. `nid_qjsj5mth2phdqctbm0vfx9elw_e` **view: drag-to-resize via
   NodeResizer** — commit on release, deferred relayout. Depends on 3.
5. `nid_9hx6okamx3yt0rg9iad2f4151_e` **view: hover gear + per-node content
   override [Inherit | Title only | Outline | Image]**. Depends on 3 and 6.
6. `nid_jcxzhexfaksge2arjzca3w7ff_e` **settings: global "Title only" node
   preview preference** — enum value, copy, chooser, bare-title rendering.
