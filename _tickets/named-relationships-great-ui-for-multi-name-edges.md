---
id: nid_1ycy9aszptp9fih76equxtcqa_e
title: "Named relationships: GREAT UI for multi-name edges"
status: open
deps: [nid_wnagjm2j144u0jsgixpcmmpar_e]
links: []
created_iso: 2026-08-17T16:44:24Z
status_updated_iso: 2026-08-17T16:44:24Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [named-relationships, ui]
---

Part of the named-relationships set. Read the PLAN first: `_tickets/add-ability-for-named-relationships.md` (closed plan ticket nid_fg66tanwkoyq3cqs1wdxagn21_e) — full syntax spec, signed-off decisions, architecture. Repo conventions: `CLAUDE.md` (layering view→adapters→engine, BDD tests, settings machinery).

Design-quality presentation when one drawn edge carries SEVERAL relation names (explicit sign-off: all names shown ON the edge, and this deserves focused design work — load the UI skill / ${MY_DEEP_MEM}/my-frontend-design.md before coding).

Scope (presentation only, no data-model changes): legibility across zoom levels; label collision with React Flow edge paths; truncation when a pair has many names; how names attach to DIRECTION on a collapsed bidirectional edge (A→B names vs B→A names on one edge); coexistence with the count badge; light/dark via Obsidian theme variables.

Iterate with screenshots into .out/ (never source-controlled). e2e for final behavior.

