---
closed_iso: 2026-08-31T19:21:09Z
id: nid_sfuzpgpyjyr3wrtzuk8q5ttvt_e
title: Investigate whether images have metadata in obsidian index to be able to know
  which notes and canvases link to the images
status: closed
deps: []
links: []
created_iso: '2026-08-31T19:17:08Z'
status_updated_iso: 2026-08-31T19:21:09Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Outcome CONCISE ./docs-internal/research/how-are-images-indexed.md which at the top states whether images are properly indexed in obsidian indexes, such that would allow us to see which notes and canvases are linking to particular image (OR NOT).

## Resolution (2026-08-31)

Findings written to `docs-internal/research/how-are-images-indexed.md`. Answer is split by source kind:

- **Notes → image: YES from Obsidian core.** Image is a destination in `metadataCache.resolvedLinks[note][image]` and `getBacklinksForFile(imageTFile)` returns the referencing notes; `getFileCache(note).embeds/.links` carry positioned per-reference entries. So "which notes link/embed this image" is answerable from the core index directly (kind-blind: links and embeds are merged).
- **Canvases → image: NO from Obsidian core.** `.canvas` is JSON; core does not index canvas references into `resolvedLinks`, `getFileCache`, or `getBacklinksForFile`. Must parse canvas JSON yourself.
- **Net for this plugin: BOTH covered.** `ObsidianLinkProvider` already supplements core backlinks with its own canvas parse (`CanvasFallbackParser` + `CanvasParseCache` → `canvasIncomingByPath`), so an image's incoming set can include both notes and canvases.

Caveats documented: reverse index is kind-blind (can't tell embed vs link for an image without per-note `getFileCache` or our canvas parser's `linkKind`), and `resolvedLinks` fills asynchronously after boot.
