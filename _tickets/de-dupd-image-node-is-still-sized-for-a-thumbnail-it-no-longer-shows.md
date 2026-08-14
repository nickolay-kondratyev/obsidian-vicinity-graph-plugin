---
id: nid_psgov2t1d2s8d7rk2qvux02zb_e
title: "De-dup'd image node is still sized for a thumbnail it no longer shows"
status: open
deps: []
links: [nid_ivt836nuelyse1c0epp86d36z_e]
created_iso: 2026-08-14T19:35:53Z
status_updated_iso: 2026-08-14T19:35:53Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [graph-sizing]
---

The image de-dup added on branch nid_ivt836nuelyse1c0epp86d36z_e (src/view/duplicateImageThumbnails.ts + src/view/flowMapping.ts) suppresses a duplicate image thumbnail in the VIEW only. The pure engine sizer (src/engine/NodeSizer.ts, `computeSizes`/`resolvePreview`) knows nothing of the de-dup: it still resolves the suppressed node's preview to "thumbnail" via `hasImage: node.firstImagePath !== undefined`, so it sizes that node with `ESTIMATED_THUMBNAIL_SLOT_PX` and floors it at `minImageHeightPx` (NodeSizer.ts:80-89, :130-131).

Result: a suppressed node whose preview falls back to "none" (embeds the shared image but has no rendered outline and is not central) renders a LARGE EMPTY box — sized/floored for an image it does not display. A loser that falls back to "outline" is merely oversized. This is exactly the "empty box" the codebase elsewhere is careful to avoid (see the `renderedOutline` WHY comment in src/view/flowMapping.ts and resolvePreview in NodeSizer.ts). It is likely to occur in the ticket's own use case: a cluster of notes embedding the same cover image.

WHY not fixed on-branch: making the sizer de-dup-aware crosses the layering boundary (sizer is pure engine; "which nodes were going to display the image" is a VIEW decision depending on view state) and would break the invariant that sizePx does not move on preview-preference flips. It needs a design decision (e.g. let the view shrink a suppressed node post-sizing, or thread a de-dup signal into sizing) — a judgment call the original ticket did not settle.

Repro: two notes embedding the same image, neither with headings, global preview preference Auto/Image; the lower-in-hierarchy one is suppressed and paints a tall empty node. Add a failing view/e2e test first, then decide the fix.

