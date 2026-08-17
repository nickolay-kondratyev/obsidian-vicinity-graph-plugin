---
id: nid_wldz7yfjecf9fuwtlezlbde9s_e
title: "Named relationships: adapter index + LinkProvider merge"
status: open
deps: [nid_0bhqajvtdq3joblfdzgqogw0x_e, nid_ufbtmywzbsyn2gwrx7bi0ww08_e, nid_82g9goy92k9ciyy64m1r6jofe_e]
links: []
created_iso: 2026-08-17T16:44:24Z
status_updated_iso: 2026-08-17T16:44:24Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [named-relationships]
---

Part of the named-relationships set. Read the PLAN first: `_tickets/add-ability-for-named-relationships.md` (closed plan ticket nid_fg66tanwkoyq3cqs1wdxagn21_e) — full syntax spec, signed-off decisions, architecture. Repo conventions: `CLAUDE.md` (layering view→adapters→engine, BDD tests, settings machinery).

Compose the pieces in the adapters layer: run the pure statement parser over the reusable vault index infrastructure to maintain the named-relationships index, implement the engine port defined in the engine ticket, and merge named relations into `ObsidianLinkProvider` (src/adapters/ObsidianLinkProvider.ts) streams — same precedent as frontmatter-id links (a distinct edge source merged in the adapter).

Covers: serving named links to plain + named channels (either-budget union), named embeds to embed + named channels, exposing statement positions/provenance for the flyout, and rel-note occurrence data for folding. Wire graph builds to await index readiness.

