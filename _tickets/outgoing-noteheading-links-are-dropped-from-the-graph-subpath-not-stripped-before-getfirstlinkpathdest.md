---
id: nid_kfk1vkf9marllfnnmqybgcdh1_e
title: "Outgoing [[note#heading]] links are dropped from the graph (subpath not stripped before getFirstLinkpathDest)"
status: open
deps: []
links: [nid_wu4gfieqps2uw9l8f4wab1abq_e]
created_iso: 2026-10-22T16:30:33Z
status_updated_iso: 2026-10-22T16:30:33Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [bug, adapters]
---

## Problem

A body link with a subpath — `[[note#Heading]]`, `[[note#^block]]`, `[[note#Heading|alias]]` — never becomes an OUTGOING edge: the target note is missing from the vicinity graph unless something else (a backlink, a plain `[[note]]`) brings it in.

Root cause: Obsidian's `cache.links[].link` keeps the subpath (`note#Heading`, alias stripped), and the adapters hand that text straight to `metadataCache.getFirstLinkpathDest`, which does NOT resolve subpaths. Verified in real Obsidian 1.12.7 during the review of ticket nid_wu4gfieqps2uw9l8f4wab1abq_e: for source text `extends::[[named-link-subpath#Section|that section]]`, `getFirstLinkpathDest("named-link-subpath#Section", src)` → `undefined`, `getFirstLinkpathDest("named-link-subpath", src)` → `named-link-subpath.md`, and `resolvedLinks[src]` DOES count `named-link-subpath.md: 1`. The rendered graph showed only source + the two subpath-free targets.

Affected callers (raw cache link text passed to resolution):
- `src/adapters/ObsidianLinkProvider.ts` `resolveReference()` (used by `outgoingReferencesOf` for traversal AND by `referencesImageAbove`/attachments).
- `src/adapters/ObsidianLinkOccurrenceProvider.ts` (~line 59, `getFirstLinkpathDest(reference.link, …)`).

Already fixed (same pattern) on branch of nid_wu4gfieqps2uw9l8f4wab1abq_e: `src/adapters/EdgeRelationLabeler.ts` strips via `Wikilinks.partsOf(link).target` (`src/shared/Wikilinks.ts`). Use the same helper; note a pure-subpath same-file link (`[[#Heading]]`) yields target `""` and must not resolve to anything.

Also check `src/adapters/FakeObsidianPorts.ts`-based fixtures: they key `resolutions` by the bare name, so tests never exercised a subpath — add one per fixed caller.

## Acceptance
- Unit tests: a `[[target#Heading|alias]]` body link yields an outgoing reference / occurrence to `target`.
- e2e (`e2e/namedLink.e2e.ts`): add a third fixture line `It also extends::[[named-link-subpath#Section|that section]].` (+ target note `named-link-subpath.md` with `# Section`) and expect relations `["extends", "improves", "uses"]` — fails today because the target node is absent.
- `npm run check`, `npm test`, `npm run test:e2e` green.

