---
id: nid_f3czh4cey22n7zc8prqadjlek_e
title: "Bound the leading-video body warm to traversed nodes (perf)"
status: open
deps: []
links: [nid_ur7veu8yqx8x6q8j6vz2z2ioa_e]
created_iso: 2026-08-07T18:14:54Z
status_updated_iso: 2026-08-07T18:14:54Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [external-preview, youtube, performance, decide]
---

When external previews are ON, `src/adapters/ObsidianLinkProvider.create` warms the leading-YouTube-hero fact by reading EVERY markdown note body once (see `src/adapters/LeadingVideoCache.ts`, mirroring `CanvasParseCache`). The mtime-keyed cache makes steady state cheap (only changed notes re-read), and a cheap `body.includes("youtu")` prefilter keeps per-file CPU trivial, but the FIRST build after plugin load (and after a large vault change) is O(vault) `cachedRead` calls. Every other provider fact is bounded by the node cap; this one is not.

WHY it is like this: `getFileMetadata` is synchronous by design (the LinkProvider contract), but the hero fact needs the note BODY (Obsidian discards external `![](url)` embeds), which is an async read — so it must be warmed up front, and `create` does not yet know which nodes the traversal will visit.

OPTIONS to bound it (decide):
1. Two-phase build: a first sync traverse finds the visible node set, then warm ONLY those bodies, then finalize sizing/preview. Bounds the read to the node cap but restructures `VicinityEngine`/`VicinityGraphBuilder`.
2. Warm concurrently (Promise.all in chunks) to cut first-build wall-clock without bounding the count.
3. Accept as-is (mtime cache + prefilter already make it a one-time cost overlapping Obsidian startup indexing).

Context: the leading-video warm is gated on `globalView.externalPreviews` in `src/adapters/VicinityGraphBuilder.ts` (OFF ⇒ zero reads), and the edge-click path (`src/adapters/LiveLinkOccurrenceProvider.ts`) passes no cache, so this cost is confined to graph builds with external previews ON. Data-model ticket that introduced it: nid_ur7veu8yqx8x6q8j6vz2z2ioa_e.

--------------------------------------------------------------------------------

I am trying to understand why we would need this if we were fine getting images from the nodes when we needed to build the graph, Why can't we just limit reading the nodes that are part of the graph when it comes to videos as well?