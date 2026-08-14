---
closed_iso: 2026-08-14T19:32:54Z
session_ids: [{"a": "claude", "type": "execution", "id": "e05618bf-16a9-41fc-affc-6c5d9b5d31b8"}, {"a": "claude", "type": "review", "id": "5ee4a298-6f6a-46ac-a3a5-18a104b87e08"}, {"a": "claude", "type": "test-fix", "id": "73280422-d0b6-4f22-8ce3-c951a0fb8549"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
id: nid_ivt836nuelyse1c0epp86d36z_e
title: "Dont render the same image twice in the graph"
status: closed
deps: []
links: [nid_psgov2t1d2s8d7rk2qvux02zb_e]
created_iso: 2026-08-14T19:23:31Z
status_updated_iso: 2026-08-14T19:32:54Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

Avoid rendering the same twice in the graph, 

IF one node already renders the image in the graph we should avoid rendering the same image again.

I presume this is easy addition to add this sort of filtering. 

Also as tie-breaker we should look for the note that is higher up in the folder hierarchies, the one that is higher up with the same image wins and it displayed the image. 

This rule applies only to the nodes that were going to display the image. So the 2nd node with that image for now is NOT going to display the image.
---

## Resolution (2026-08-14)

Implemented as a VIEW-layer de-dup pass — a node's thumbnail-vs-outline choice is
a view decision (`nodePreviewKind`, per-node content override, rendered
outline-depth filter), so "the nodes that were going to display the image" only
exists in the view (`flowMapping`), not the pure engine.

**What was built:**

- `src/view/duplicateImageThumbnails.ts` — new pure helper.
  `suppressedDuplicateThumbnails(candidates)` groups the nodes whose preview WOULD
  resolve to a thumbnail (`rendersThumbnail`) by `firstImagePath`; for each group
  of >=2 it keeps ONE winner and returns the losers' paths. Winner rule (the
  ticket's tie-break): fewest folder segments wins ("higher up the hierarchy");
  equal depth is broken by the vault path lexicographically, purely for
  determinism. Nodes that were NOT going to render a thumbnail (e.g. showing an
  outline) never take part — the rule applies only among would-be image nodes.
- `src/view/flowMapping.ts` — `vicinityGraphToFlow` now computes the suppressed
  set once over the full node list and passes a `suppressImage` flag into
  `toFlowNodeData`, which feeds `hasImage = firstImagePath !== undefined &&
  !suppressImage` to the preview chooser. A suppressed node re-runs the SAME
  preview ladder without the image, so it gracefully falls back to its outline (if
  offered) or title-only — it does not blank. The preview-kind assembly was
  extracted into `resolveNodePreview(node, view, hasImage)` (+ `renderedOutline`)
  so the candidate pass and the final data both go through one function.
  `firstImagePath`/`imageCount` are STILL echoed on suppressed nodes (the mapping
  reports, never deletes data) — harmless because `NoteNode` renders the thumbnail
  only when `data.preview === "thumbnail"`.

**Tests:** `src/view/duplicateImageThumbnails.test.ts` (pure winner rule +
tie-breaks) and a new `duplicate-image de-dup` describe in
`src/view/flowMapping.test.ts` (end-to-end mapping: winner keeps thumbnail, loser
-> `none`, loser with own outline under `image` pref -> `outline`, different
images untouched, suppressed node still carries the image path). `npm test` green
(1983 passing), `tsc -noEmit` clean.

**Not run here:** `npm run test:e2e` — the `e2e/` submodule is not checked out in
this environment (`git submodule status` shows it uninitialised, `e2e/` empty), so
the real-Obsidian gate could not run. The rendered surface is covered by the
`flowMapping` tests (the DOM-shaping decision) and `NoteNode` already gates the
`<img>` on `data.preview`. Anyone with the submodule should run the graph-render
e2e spec to confirm end-to-end.

**Note for next reader:** the loser still shows the shared image as an attachment
ICON in the icon strip (that is an icon, not the picture) and, if it wins nothing,
falls to title-only. If the product later wants the loser to show a DIFFERENT
image it has (its second image), that is a follow-up — today `firstImagePath` is
the only thumbnail candidate the engine surfaces.

## Notes

**2026-08-14T19:36:12Z**

__READY_AS_IS__: De-dup logic correct & tested (tsc clean, 1983 tests green). One real but cross-layer follow-up filed & linked: nid_psgov2t1d2s8d7rk2qvux02zb_e (suppressed image node still sized/floored as a thumbnail by the pure engine sizer -> oversized/empty box).
