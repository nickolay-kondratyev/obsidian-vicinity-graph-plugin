---
closed_iso: 2026-08-12T17:20:11Z
id: nid_sjojyvd55emyry45qynphei7o_e
title: "PLAN: frontmatter-id links (deps/links fields referencing note ids)"
status: closed
deps: []
links: [nid_zklwx8uxsk3bzvgcbnm3wvvj9_e]
created_iso: 2026-08-12T17:19:16Z
status_updated_iso: 2026-08-12T17:20:11Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

HIGH-LEVEL PLAN for the frontmatter-id links feature. This ticket is CLOSED on purpose: it is the design record; implementation happens in the tickets that depend on it. Originating ticket: nid_zklwx8uxsk3bzvgcbnm3wvvj9_e (_tickets/add-ability-to-have-frontmatter-field-link-to-ids.md).

# Goal
Notes can reference other notes by frontmatter id, e.g.

```yaml
deps: [note-id-1]
links: [note-id-2, note-id-3]
```

where `note-id-1` is the value of the `id:` frontmatter field of another note. These references must appear as edges in the vicinity graph, in BOTH directions (outgoing id-refs AND incoming "who references my id"), riding the EXISTING link channels and budgets (linkDepthOut / linkDepthIn / nodeCap). No new traversal channel, no new depth dial.

# Human decisions (locked 2026-08-12)
- Q1: which fields are id-ref fields is a SETTING listing individual field names, DEFAULT EMPTY (feature off until the user adds fields). The settings row must carry info text explaining the feature.
- Q2: both directions (outgoing + incoming).
- Q3: KISS edge appearance — id-ref edges are ordinary `kind: "link"` edges, visually identical to wikilink edges. Distinct styling is a separate backlog ticket.
- Q4: accept scalar (`deps: note-id-1`) and list (`deps: [a, b]`) values, strings only (quoted YAML strings arrive already unquoted from the cache); silently skip ids with no owning note; skip self-references (no self-edge).

# Feasibility facts (verified in code)
- Obsidian caches frontmatter: `app.metadataCache.getFileCache(file).frontmatter`. `src/adapters/ObsidianLinkProvider.ts` already reads it (frontmatterTitleOf, ~line 402). NO vault file reads are needed — the ticket's STOP condition ("do not read entire vault") is satisfied by a cache-only reverse index.
- For markdown notes the frontmatter `id` field IS the docid written by `stable-ids-for-obsidian` (see node_modules/stable-ids-for-obsidian/dist/FrontmatterDocIdStore.d.ts). We READ that field only; stable-ids remains the sole writer.
- Traversal: `src/engine/VicinityTraversal.ts` runs one BFS per (root x channel), channels `outgoing-link | outgoing-embed | incoming` (src/engine/types.ts:46), neighbors from `LinkProvider.getOutgoingReferences` / `getIncomingLinks` (src/engine/LinkProvider.ts:112-148). Edge kinds derived in src/engine/EdgeAssembly.ts.

# Design (80/20)
ENGINE STAYS UNTOUCHED. The feature lives entirely in the adapter layer: `src/adapters/ObsidianLinkProvider.ts` merges id-ref neighbors into the streams it already serves:
- `getOutgoingReferences(path)`: additionally resolve the configured fields of `path`'s cached frontmatter through an id->path reverse index, emitting `{ target, kind: "link" }` refs (dedup against existing refs is unnecessary — EdgeAssembly already merges per-pair counts, but avoid double-emitting the same target from multiple configured fields).
- `getIncomingLinks(path)`: additionally return referrers of `path`'s own id from the reverse referrer index.
- `getLinkCount(source, target)`: include id-ref occurrences so edge counts stay truthful.

New adapter component `FrontmatterIdIndex` (src/adapters/): two maps built in ONE cache-only pass over `vault.getMarkdownFiles()` + `getFileCache`:
- ownerByIdMap: id -> VaultPath (from each note's `id:` field). Duplicate id claim: deterministic winner (lexicographically smallest path), KISS.
- referrersByIdMap: referenced-id -> Set<VaultPath> (from the CONFIGURED fields of every note).
Warm LAZILY on first graph build (mirroring PerDocStore's lazy warm pattern), keep fresh via `metadataCache.on('changed')` + vault delete/rename events. When the configured field list is EMPTY the index does not build and the provider adds nothing (feature fully off = zero cost).
The configured field list reaches the adapter from settings at build time (same route the provider gets its other config).

# Settings
One new spec leaf, string-valued: comma-separated frontmatter field names (working name `idRefFields`), default `""`. This is the first NON-NUMBER settings leaf, so it likely needs a new row control kind (`text`) through the declared-row machinery: src/view/settingsRows.ts (SETTINGS_GROUPS), both presenters' switch on row.control.kind, src/view/settingsRowAccessors.ts, plus the tripwire suites (settingsRowSpecCoverage, settingsRowParity, settingsProductDefaults id-keyed table). Info text explaining the feature goes in the row's declared description. Typed field commits on COMMIT (blur/debounce), never per keystroke, per repo convention.

# Ticket breakdown
1. Settings ticket: spec leaf + text row (must land FIRST — the spec-coverage tripwire fails a leaf without a declared row, and the adapter ticket reads the leaf).
2. Adapter ticket: FrontmatterIdIndex + ObsidianLinkProvider merge + e2e (deps on 1).
3. Backlog: distinct styling for id-ref edges (separate ticket, low priority).

# Testing expectations
- Adapter unit tests (BDD WHEN/THEN) for index build, scalar/list/quoted values, non-string skip, unresolved-id skip, self-ref skip, duplicate-id determinism, cache-change refresh, empty-field-list = inert.
- Settings suites pick the leaf up by walking SETTINGS_SPEC; defaults/bounds land in src/engine/settingsProductDefaults.test.ts only.
- e2e (npm run test:e2e): vault fixture with id-ref notes; configure the field via the settings UI (settle through e2e/settingsWriteWindow.ts, never sleep); assert the edge renders both directions.

