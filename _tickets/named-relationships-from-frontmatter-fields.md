---
session_ids: [{"a": "claude", "type": "execution", "id": "cf851652-75e3-434d-806f-a7f08a8831bc"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_ibx7hmt6cvmjh5rydi2aiyab9_e
title: "Named relationships from frontmatter fields"
status: in_progress
deps: [nid_wldz7yfjecf9fuwtlezlbde9s_e]
links: []
created_iso: 2026-08-17T16:44:24Z
status_updated_iso: 2026-08-18T01:40:54Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [named-relationships]
---

Part of the named-relationships set. Read the PLAN first: `_tickets/add-ability-for-named-relationships.md` (closed plan ticket nid_fg66tanwkoyq3cqs1wdxagn21_e) — full syntax spec, signed-off decisions, architecture. Repo conventions: `CLAUDE.md` (layering view→adapters→engine, BDD tests, settings machinery).

Frontmatter link-valued fields are named relationships: `up: "[[parent]]"` → THIS_NOTE --up--> parent (Breadcrumbs-style vaults keep hierarchy here). Obsidian metadataCache exposes `frontmatterLinks` with field KEY + link target — ZERO file reading and no `::` parsing.

Merge frontmatter-sourced statements as another source feeding the same engine port / LinkProvider merge as inline statements (own focused ticket per sign-off). Scalar-valued frontmatter fields are attributes — ignored. Key naming: field key is the relation name verbatim; list-valued fields (`up: [ "[[a]]", "[[b]]" ]`) yield one relation per target (frontmatterLinks already flattens with `key.N` — strip the index suffix).

Tests: fake provider fixtures + parity with inline statements in edge assembly.

