---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_phu0llxhfptse000j66ezrhh3_e
title: "Adapter: frontmatter-id reverse index + id-ref edges in ObsidianLinkProvider"
status: in_progress
deps: [nid_dthnhlzp0wzxqhcozj3f8ih5h_e]
links: []
created_iso: 2026-08-12T17:19:54Z
status_updated_iso: 2026-08-12T18:30:57Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Part 2 of the frontmatter-id links feature. Read the plan first: ticket nid_sjojyvd55emyry45qynphei7o_e (_tickets/plan-frontmatter-id-links-depslinks-fields-referencing-note-ids.md). DEPENDS on the settings ticket nid_dthnhlzp0wzxqhcozj3f8ih5h_e (spec leaf `idRefFields` + canonical parse helper must already exist).

Make id-references render as graph edges, BOTH directions, riding the existing link channels/budgets. ENGINE STAYS UNTOUCHED (src/engine/ purity guard applies) — all work in src/adapters/.

Scope:
- New `FrontmatterIdIndex` class in src/adapters/: cache-only (app.metadataCache.getFileCache + vault.getMarkdownFiles(), NEVER file reads) building (a) ownerByIdMap: id -> VaultPath from each note's `id:` frontmatter field; (b) referrersByIdMap: referenced-id -> Set<VaultPath> from the CONFIGURED fields. Lazy warm on first graph build (mirror PerDocStore's lazy-warm pattern); refreshed on metadataCache `changed` + vault delete/rename. Empty configured field list => index inert, zero cost.
- Value handling (locked decisions): accept scalar and list values; strings only (quoted YAML strings arrive unquoted from the cache; skip numbers/objects); skip unresolved ids silently; skip self-references; duplicate id claims resolve deterministically (lexicographically smallest path).
- Merge into src/adapters/ObsidianLinkProvider.ts: getOutgoingReferences additionally emits `{ target, kind: "link" }` for resolved id-refs (dedup targets emitted twice via multiple configured fields); getIncomingLinks additionally returns referrers of the note's own id; getLinkCount includes id-ref occurrences. Note: the frontmatter `id` field is written by stable-ids-for-obsidian — this feature READS it only.
- Tests (BDD WHEN/THEN, one behavior per test): index build from fake metadata, scalar/list/quoted, non-string skip, unresolved skip, self-ref skip, duplicate-id determinism, cache-change refresh, empty-list inert, provider merge for both directions and link counts.
- e2e (npm run test:e2e): vault fixture where note A has `deps: [<id of B>]`; set the settings field through the UI (settle via e2e/settingsWriteWindow.ts, never sleep); assert A->B edge appears when A is active AND when B is active (incoming direction).
- Update README.md (user-facing feature description) and docs-internal/plan/high-level-plan.md if it enumerates edge sources.

