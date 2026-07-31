---
id: nid_1drobt9qaq3e89gt76fzghlik_e
title: "Link preview: occurrence data layer (positions + context snippets)"
status: open
deps: []
links: []
created_iso: 2026-07-31T18:49:31Z
status_updated_iso: 2026-07-31T18:49:31Z
type: task
priority: 3
assignee: nickolaykondratyev
parent: nid_tohotgq2s92dvd1iov1rd0umv_e
tags: [link-preview]
---

Part 1/4 of parent ticket nid_tohotgq2s92dvd1iov1rd0umv_e (_tickets/show-the-preview-of-the-links.md): a modal previewing a node's links/backlinks with short context, and an edge-scoped variant.

Today src/engine/LinkProvider.ts exposes only deduped target/source PATHS - no per-occurrence positions. src/adapters/ObsidianLinkProvider.ts computes per-reference document offsets internally (via src/adapters/ReferenceOrder.ts) but discards them before returning; src/adapters/BacklinksAdapter.ts extracts only source paths from the undocumented metadataCache.getBacklinksForFile even though the raw result carries per-reference position data.

Deliver (no UI in this ticket):
1. A new narrow port (follow the port + Fake* convention, layering rules in docs-internal/architecture-map.md - engine stays pure, Obsidian only in adapters), e.g. LinkOccurrenceProvider, answering for a note X:
   - outgoing link occurrences: {targetPath, position} in document order (from metadataCache file cache links/embeds - same source ReferenceOrder.ts already reads)
   - backlink occurrences grouped by source note: {sourcePath, position} (extend BacklinksAdapter shape-tolerant extraction to per-reference positions; keep its null => fallback semantics - the resolvedLinks-inversion fallback yields occurrences WITHOUT positions, model that explicitly)
   - edge-scoped query: occurrences of links source->target only (for the edge-click modal)
2. Pure context-snippet extraction module with colocated BDD tests (WHEN/THEN, one assert per test): given file text + occurrence position -> shortContext (the trimmed line containing the link) and expandedContext (surrounding paragraph or +/-N lines; named constants, no magic numbers). File text read via cachedRead on the existing seam src/adapters/obsidianPorts.ts.
3. Edge cases: canvas references have no markdown context -> occurrence with context: null; missing/renamed file -> empty result, never a throw.
4. Fake implementation of the new port for downstream tests.

## Acceptance Criteria

- Port returns per-occurrence positions for outgoing links, backlinks grouped by source, and edge-scoped (source->target) queries
- Snippet extractor covered by BDD tests incl. link at file start/end, multi-occurrence lines, canvas/null-context
- npm test and npm run check pass

