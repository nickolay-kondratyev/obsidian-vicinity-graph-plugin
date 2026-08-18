---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_wnagjm2j144u0jsgixpcmmpar_e
title: "Named relationships: edge labels + flyout breakdown (view)"
status: in_progress
deps: [nid_wldz7yfjecf9fuwtlezlbde9s_e]
links: []
created_iso: 2026-08-17T16:44:24Z
status_updated_iso: 2026-08-18T01:54:13Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [named-relationships]
---

Part of the named-relationships set. Read the PLAN first: `_tickets/add-ability-for-named-relationships.md` (closed plan ticket nid_fg66tanwkoyq3cqs1wdxagn21_e) — full syntax spec, signed-off decisions, architecture. Repo conventions: `CLAUDE.md` (layering view→adapters→engine, BDD tests, settings machinery).

View layer, V1 rendering:
- Edge shows ALL its relation names (simple readable rendering — e.g. stacked/joined label; the dedicated GREAT-UI ticket iterates on presentation). A relation WITH a qualifier renders as `supports [X] but not strongly` — literal `[X]` marks the target position, never the note title (the edge already points at the target). Count badge for multiplicity coexists. One edge per ordered pair unchanged ("collapse, don't multiply").
- Edge flyout (src/view/LinkPreviewDrawer.tsx, src/view/LinkPreviewContent.tsx, occurrence seam src/engine/LinkOccurrenceProvider.ts) gains the full breakdown: relation names + qualifiers, context snippets for statement occurrences, and rel-note labels LINKING to their rel note.
- Styling via Obsidian theme CSS variables; CSS over JS.

Tests: jsdom component tests per the *.component.test.tsx pattern + `npm run test:e2e` (view-layer DOM/CSS changes are an e2e-required surface; e2e tests live in the e2e/ submodule — commit there first).

