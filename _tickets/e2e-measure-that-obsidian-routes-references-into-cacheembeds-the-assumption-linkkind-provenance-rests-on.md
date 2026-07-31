---
closed_iso: 2026-07-31T17:50:56Z
id: nid_t0x7ap99djfuzvz5p261ao7rn_e
title: e2e-measure that Obsidian routes '!' references into cache.embeds (the assumption
  LinkKind provenance rests on)
status: closed
deps: []
links: [nid_fay1hu5sxcoygizopkkg0f0d7_e]
created_iso: '2026-07-30T04:14:02Z'
status_updated_iso: 2026-07-31T17:50:56Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [canvas, e2e, link-kinds]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-4
---
Our link/embed kind for markdown comes ENTIRELY from array provenance: a reference in `cache.embeds` is an embed, one in `cache.links` is a link (src/adapters/ReferenceOrder.ts). That rests on an UNMEASURED assumption about Obsidian: that core routes exactly the `!`-prefixed references into `embeds`.

A unit test cannot falsify this — the fixture author decides both arrays, so any such test is circular. One WAS written during ticket nid_fay1hu5sxcoygizopkkg0f0d7_e Stage 1 and deleted in review for exactly that reason (it derived the cache arrays from `original.startsWith("!")` and then asserted the kinds equal `original.startsWith("!")`).

The honest tripwire is a real-Obsidian measurement, alongside the existing e2e/canvasMarkdownLinkIndexing.e2e.ts: open a note containing `[[a]]`, `![[b]]`, `[c](c.md)`, `![d](d.png)` and a frontmatter property link, read `app.metadataCache.getFileCache(file)`, and assert which of `.links` / `.embeds` / `.frontmatterLinks` each landed in, cross-checked against each Reference.original prefix. `original` is documented but flagged "Not available on Publish" — the e2e is also the place to find out whether it is populated on desktop.

Low priority: if the assumption were wrong, embed-ness would be visibly wrong everywhere in the graph, so the blast radius is loud rather than silent.

## Acceptance Criteria

One e2e spec in e2e/ that reads a real Obsidian file cache and asserts the provenance-vs-"!"-prefix agreement for wikilink, embed, markdown-style link, image embed and frontmatter property link.

## Resolution (2026-07-31)

Added `e2e/referenceProvenance.e2e.ts` (4 tests, all passing against the pinned real Obsidian 1.12.7, headless). It launches the harness with its own `ref-provenance/` fixtures — one note carrying all five reference shapes (every destination exists in the vault) — waits for `getFileCache` to index it, and asserts:

1. `cache.links` holds exactly the plain wikilink + markdown-style link;
2. `cache.embeds` holds exactly the `![[...]]` embed + `![...](...png)` image embed;
3. `cache.frontmatterLinks` holds exactly the property link;
4. every body reference's array provenance agrees with its `Reference.original` `"!"` prefix.

Measured raw observation (printed by the spec on every run):

```json
{"links":[{"link":"wiki-target","original":"[[wiki-target]]"},{"link":"md-target.md","original":"[md](md-target.md)"}],"embeds":[{"link":"embed-target","original":"![[embed-target]]"},{"link":"image-target.png","original":"![img](image-target.png)"}],"frontmatterLinks":[{"link":"prop-target","original":"[[prop-target]]"}]}
```

So BOTH open questions are answered: core routes exactly the `!`-prefixed references into `embeds`, and `Reference.original` IS populated on desktop (the "Not available on Publish" flag does not apply here). The array-provenance basis of `src/adapters/ReferenceOrder.ts` now has a real-Obsidian tripwire; `npm run check` and `npm test` (1309 tests) stay green.
