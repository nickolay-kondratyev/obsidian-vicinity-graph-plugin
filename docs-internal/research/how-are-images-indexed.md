# Research: how are images indexed (can we find what links to an image)?

**Answer — split by source kind:**

- **Notes → image: YES, from Obsidian core.** An image referenced from a
  markdown note (`![[img.png]]`, `[[img.png]]`, or a markdown `![](img.png)`)
  IS indexed. The image file appears as a *destination* in
  `metadataCache.resolvedLinks[notePath][imagePath]`, and
  `metadataCache.getBacklinksForFile(imageTFile)` returns the referencing notes.
  So "which notes link/embed this image" is answerable directly from the core
  index, with no vault-wide scan.
- **Canvases → image: NO, not from Obsidian core.** `.canvas` files are JSON,
  not markdown. Core does **not** index their node references into
  `resolvedLinks` / `unresolvedLinks`, `getFileCache()` (no `links`/`embeds`
  for canvas), or `getBacklinksForFile`. A canvas that embeds an image is
  invisible to every core link index. To know "which canvases embed this image"
  you must **parse the canvas JSON yourself**.

**Net for this plugin:** we already cover BOTH. `getIncomingLinks(imagePath)`
would return notes (core backlinks) **and** canvases (our own parse) — because
the plugin supplements core with `CanvasFallbackParser` + `CanvasParseCache`,
building `canvasIncomingByPath` (target path → canvases). Core alone covers
notes only.

---

## Details

### What core indexes (notes)

- `MetadataCache.resolvedLinks: Record<sourcePath, Record<destPath, count>>` —
  destinations include attachments/images, and the count **merges links and
  embeds** (kind-blind: it cannot tell `[[img.png]]` from `![[img.png]]`).
  Inverting this map (target → sources) yields an image's referrers; this
  plugin's `ObsidianLinkProvider.invertResolvedLinks()` is exactly that.
- `MetadataCache.getFileCache(note).embeds` / `.links` — per-reference entries
  with `link` text **and byte offset/position**, so a note's references to an
  image are positioned (offsets power the plugin's link-preview snippets).
- `MetadataCache.getBacklinksForFile(file)` — undocumented but present on
  current builds; the plugin's authoritative backlink source per node
  (`BacklinksAdapter`), with the resolvedLinks inversion as the fallback when
  absent. Works for a non-markdown target (an image) too, since the referrers
  are markdown notes.
- Resolution: `getFirstLinkpathDest(linkText, sourcePath)` resolves an image
  link text to its `TFile` (shortest-path / relative rules), so a note's image
  reference resolves to a concrete image path.

### Why canvases are excluded from core (and how the plugin fills the gap)

- Canvas is stored as JSON; core's markdown-oriented link indexer never reads
  it, so canvas references (including canvas file-nodes pointing at an image and
  text-node embeds) never enter `resolvedLinks` or the backlinks API.
- The plugin parses **every** canvas at provider build
  (`ObsidianLinkProvider.create` → `CanvasParseCache.referencesOf`), resolves
  each reference through the SAME `getFirstLinkpathDest` / literal-path lookup
  core uses, and records target → canvases in `canvasIncomingByPath`. Image
  targets are kept like any other (resolution is kind-blind), so an image's
  incoming set includes the canvases that embed it.

### Caveats

- **Kind is not distinguished by core for the reverse question.** resolvedLinks
  and getBacklinksForFile merge plain links and embeds. If we ever need
  "embedded vs merely linked" for an image, core's reverse index can't say it;
  only per-note `getFileCache().embeds` vs `.links` (or, for canvases, our
  parser's `linkKind`) distinguishes them.
- **Boot timing.** `resolvedLinks` fills asynchronously after indexing (the
  `resolve` / `changed` events); early queries may under-report until the cache
  settles. Not image-specific — it applies to all link queries.
