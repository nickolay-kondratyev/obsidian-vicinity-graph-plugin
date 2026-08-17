---
id: nid_82g9goy92k9ciyy64m1r6jofe_e
title: "Reusable incremental vault index infrastructure"
status: open
deps: []
links: []
created_iso: 2026-08-17T16:44:24Z
status_updated_iso: 2026-08-17T16:44:24Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [named-relationships]
---

Part of the named-relationships set. Read the PLAN first: `_tickets/add-ability-for-named-relationships.md` (closed plan ticket nid_fg66tanwkoyq3cqs1wdxagn21_e) — full syntax spec, signed-off decisions, architecture. Repo conventions: `CLAUDE.md` (layering view→adapters→engine, BDD tests, settings machinery).

Build REUSABLE session-held vault-wide derived-index infrastructure (adapters layer): first consumer is the named-relationships index, but design + document it so future vault-wide derived indexes reuse the build/maintain machinery (explicit sign-off requirement).

- Initial scan on plugin load: bounded concurrency (~8-16) over ONLY files that have links OR embeds per metadataCache (`getFileCache().links` / `.embeds`) — a statement's target run always contains `[[x]]` or `![[x]]`, and `rel::![[x]]` lands in `embeds`, NOT `links`, so gating on links alone would silently skip embed-only files. Files with neither are skipped without reading a byte. `vault.cachedRead` for content.
- Never blocks plugin load; graph builds AWAIT index readiness (precedent: async `ObsidianLinkProvider.create` in src/adapters/ObsidianLinkProvider.ts and lazy PerDocStore warm-up).
- Freshness: `metadataCache.on("changed")` (callback provides file CONTENT — zero extra reads → re-parse just that file), `vault.on("delete")` (drop entry; a delete handler already exists for forgetDocs — sit beside it), `vault.on("rename")` REKEYS the renamed file's own entry (old path → new path). Obsidian rewriting links only fires `changed` on the WRITER files pointing at the renamed one; the renamed file's content may be untouched, so without the rekey its entry stays stale under the old path.
- REPLACE-WHOLE-ENTRY semantics per file (no diffing) — trivially correct under any event ordering, including events racing the initial scan.
- Session-held only, NEVER persisted (derived data, same stance as folder relations).

Tests for scan gating, event-driven replacement, and readiness sequencing.

