---
id: nid_t0x7ap99djfuzvz5p261ao7rn_e
title: "e2e-measure that Obsidian routes '!' references into cache.embeds (the assumption LinkKind provenance rests on)"
status: open
deps: []
links: [nid_fay1hu5sxcoygizopkkg0f0d7_e]
created_iso: 2026-07-30T04:14:02Z
status_updated_iso: 2026-07-30T04:14:02Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [canvas, e2e, link-kinds]
---

Our link/embed kind for markdown comes ENTIRELY from array provenance: a reference in `cache.embeds` is an embed, one in `cache.links` is a link (src/adapters/ReferenceOrder.ts). That rests on an UNMEASURED assumption about Obsidian: that core routes exactly the `!`-prefixed references into `embeds`.

A unit test cannot falsify this — the fixture author decides both arrays, so any such test is circular. One WAS written during ticket nid_fay1hu5sxcoygizopkkg0f0d7_e Stage 1 and deleted in review for exactly that reason (it derived the cache arrays from `original.startsWith("!")` and then asserted the kinds equal `original.startsWith("!")`).

The honest tripwire is a real-Obsidian measurement, alongside the existing e2e/canvasMarkdownLinkIndexing.e2e.ts: open a note containing `[[a]]`, `![[b]]`, `[c](c.md)`, `![d](d.png)` and a frontmatter property link, read `app.metadataCache.getFileCache(file)`, and assert which of `.links` / `.embeds` / `.frontmatterLinks` each landed in, cross-checked against each Reference.original prefix. `original` is documented but flagged "Not available on Publish" — the e2e is also the place to find out whether it is populated on desktop.

Low priority: if the assumption were wrong, embed-ness would be visibly wrong everywhere in the graph, so the blast radius is loud rather than silent.

## Acceptance Criteria

One e2e spec in e2e/ that reads a real Obsidian file cache and asserts the provenance-vs-"!"-prefix agreement for wikilink, embed, markdown-style link, image embed and frontmatter property link.

