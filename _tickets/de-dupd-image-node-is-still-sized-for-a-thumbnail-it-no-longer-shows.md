---
closed_iso: 2026-08-14T22:59:10Z
session_ids: [{"a": "claude", "type": "execution", "id": "7840c348-f59a-4384-a943-5ee2e8e22899"}, {"a": "claude", "type": "review", "id": "c6ed06c5-f512-47cf-b020-5e9c8355a453"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_psgov2t1d2s8d7rk2qvux02zb_e
title: "De-dup'd image node is still sized for a thumbnail it no longer shows"
status: closed
deps: []
links: [nid_ivt836nuelyse1c0epp86d36z_e]
created_iso: 2026-08-14T19:35:53Z
status_updated_iso: 2026-08-14T22:59:10Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [graph-sizing]
---

The image de-dup added on branch nid_ivt836nuelyse1c0epp86d36z_e (src/view/duplicateImageThumbnails.ts + src/view/flowMapping.ts) suppresses a duplicate image thumbnail in the VIEW only. The pure engine sizer (src/engine/NodeSizer.ts, `computeSizes`/`resolvePreview`) knows nothing of the de-dup: it still resolves the suppressed node's preview to "thumbnail" via `hasImage: node.firstImagePath !== undefined`, so it sizes that node with `ESTIMATED_THUMBNAIL_SLOT_PX` and floors it at `minImageHeightPx` (NodeSizer.ts:80-89, :130-131).

Result: a suppressed node whose preview falls back to "none" (embeds the shared image but has no rendered outline and is not central) renders a LARGE EMPTY box — sized/floored for an image it does not display. A loser that falls back to "outline" is merely oversized. This is exactly the "empty box" the codebase elsewhere is careful to avoid (see the `renderedOutline` WHY comment in src/view/flowMapping.ts and resolvePreview in NodeSizer.ts). It is likely to occur in the ticket's own use case: a cluster of notes embedding the same cover image.

WHY not fixed on-branch: making the sizer de-dup-aware crosses the layering boundary (sizer is pure engine; "which nodes were going to display the image" is a VIEW decision depending on view state) and would break the invariant that sizePx does not move on preview-preference flips. It needs a design decision (e.g. let the view shrink a suppressed node post-sizing, or thread a de-dup signal into sizing) — a judgment call the original ticket did not settle.

Repro: two notes embedding the same image, neither with headings, global preview preference Auto/Image; the lower-in-hierarchy one is suppressed and paints a tall empty node. Add a failing view/e2e test first, then decide the fix.

---

## Resolution (2026-08-14)

**Decision — make the pure engine sizer de-dup-aware (the ticket's "thread a de-dup signal into sizing" option), NOT the view-shrink option.** Rationale:

- `sizePx` is the SINGLE box-size source read by all four view consumers of `nodeDimensionsPx` (flowMapping, elkMapping, layoutFit, GraphStructureDiff). Fixing the height in the engine means every consumer just works; a view-side post-sizing shrink would have to be threaded through all four or they'd drift.
- It PRESERVES the deliberately-designed invariant "a per-node CONTENT-override flip moves no pixels / no relayout" (`nodePreviewChoice.ts`, `NodeSizer` doc): the sizer judges thumbnail candidacy on the GLOBAL preference only, exactly as it already resolves every other preview decision, so the suppressed set is independent of content overrides.

### What changed
- **Moved** `duplicateImageThumbnails.ts` (+ its test) from `src/view/` to `src/engine/` — the algorithm is pure and now has TWO consumers (the sizer and the view mapping). Exported from `src/engine/index.ts`; `flowMapping.ts` imports it from `../engine`. Header comment rewritten (it no longer "only exists in the view").
- **`NodeSizer.computeSizes`** now runs a first pass (`suppressedThumbnails`) that resolves each node's GLOBAL-preference preview kind, feeds candidates to `suppressedDuplicateThumbnails`, and gets the suppressed set; the sizing pass then treats a suppressed node as `hasImage=false`, so it falls back through its image-less ladder (no thumbnail slot, no `minImageHeightPx` floor). `resolvePreview` gained an explicit `hasImage` param.
- **`VicinityEngine.build`** reordered: truncate FIRST, then size the VISIBLE (post-truncation) node subset. The truncator's ranking is size-independent so this is safe, and it makes the sizer's de-dup set exactly the visible set the view de-dups over — a winner truncated away no longer strands a surviving loser sized for an image it now shows.

### Tests
- Failing-first regression suite in `src/engine/NodeSizer.test.ts` → "NodeSizer duplicate-image de-dup sizing": the suppressed loser sits BELOW `minImageHeightPx` (was floored at 180 → now 90, its image-less title+attachment-chip fit); the surviving owner still gets the image floor; a sole embedder is unaffected.
- Full `npm test` (2046 pass), `npm run check` (0 errors), `npm run build` all green.

### Why no e2e
This is a PURE engine sizing change (the box height is engine `sizePx`, consumed uniformly by the view). Per CLAUDE.md ("Pure engine/persistence changes stay on `npm test`") the engine unit test is the correct regression home; the de-dup feature itself shipped with no e2e. The only view edit was an import-path change.

### Known residual (documented, accepted, rarer than the bug fixed)
Where a per-node CONTENT override is set on a node in a duplicate-image cluster, the sizer's (override-blind) suppressed set can differ from the view's (override-aware) one, yielding a mild MIS-size (never the empty box). This is the same pre-existing sizer-vs-content-override divergence already documented on `NodeSizer` / `nodePreviewChoice`, and is the price of keeping the no-relayout-on-content-flip invariant.


## Notes

**2026-08-14T23:01:33Z**

__READY_AS_IS__: Engine-side de-dup sizing fix is correct, layering-clean, truncate-then-size reorder is safe (truncator size-independent); check + 2046 tests green; documented residual is a ticket-settled design call.
