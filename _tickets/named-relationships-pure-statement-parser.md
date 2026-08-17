---
id: nid_0bhqajvtdq3joblfdzgqogw0x_e
title: "Named relationships: pure statement parser"
status: open
deps: []
links: []
created_iso: 2026-08-17T16:44:23Z
status_updated_iso: 2026-08-17T16:44:23Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [named-relationships]
---

Part of the named-relationships set. Read the PLAN first: `_tickets/add-ability-for-named-relationships.md` (closed plan ticket nid_fg66tanwkoyq3cqs1wdxagn21_e) — full syntax spec, signed-off decisions, architecture. Repo conventions: `CLAUDE.md` (layering view→adapters→engine, BDD tests, settings machinery).

Build a PURE parser (src/engine/, no obsidian/react imports — guarded by src/engine/importGuard.test.ts) that extracts relationship statements from markdown text.

Forms, decided precedence at each `::` (check left context):
1. ends with `]]` → REL-NOTE form: `[[he supports]]::[[target]]` — the name IS a note link (label = alias else basename).
2. inside `[...]` or `(...)` wrapper → BRACKETED form: `[he supports:: [[x]]]` — name = text between opener and `::` (spaces allowed, trimmed); statement consumes the closing bracket.
3. else → BARE form: name = LONGEST run of `[A-Za-z0-9_-]` immediately before `::` (stops at punctuation: `(he-supports::[[x]])` → `he-supports`). Mid-sentence OK; surrounding prose ignored.

Rules: NO whitespace before `::`; optional whitespace after. Targets = greedy comma-separated RUN of `[[link]]` / `![[embed]]` tokens after `::`, stopping at first non-link/non-comma token (reads Breadcrumbs/ExcaliBrain lists `up:: [[a]], [[b]]`). Embed targets keep an isEmbed flag. Unrecognized text yields NOTHING (links degrade to plain cache edges elsewhere — never guess).

Output per statement: name (text or rel-note link ref), ordered targets, and OFFSETS/positions of the whole statement and of the rel-note occurrence (needed later for flyout snippets and rel-note folding).

BDD fixture tests (WHEN/THEN, one behavior per test) covering every form, precedence collisions, punctuation boundaries, comma-run termination, embeds, and degenerate inputs.

