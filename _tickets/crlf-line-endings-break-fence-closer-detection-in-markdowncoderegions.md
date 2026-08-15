---
session_ids: [{"a": "claude", "type": "execution", "id": "684cd48a-a1c1-433f-b3bd-8ec9b75688c1"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_b7k6gymkwum7pozwnf28vgecb_e
title: "CRLF line endings break fence-closer detection in MarkdownCodeRegions"
status: in_progress
deps: []
links: []
created_iso: 2026-08-15T00:42:11Z
status_updated_iso: 2026-08-15T02:23:52Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
parent: nid_1gpbw8a2a3p09ny3kjl0u0az5_e
tags: [shared, canvas]
---

ROOT CAUSE: src/shared/MarkdownCodeRegions.ts:35 — with \r\n line endings, split("\n") leaves a trailing \r on every line. FENCE_OPENER still matches ("```\r" reads the \r as an info string) but FENCE_CLOSER's `[ \t]*$` rejects "```\r", so the fence never closes and EVERY remaining line of the text is blanked — all wikilinks/inline links after the first code block are silently dropped from canvas fallback harvesting (missing edges where core would index them). The sibling matchers (PARAGRAPH_BREAK, DESTINATION_TERMINATOR) already handle \r; this module is the odd one out. REACHABILITY: low — only call site is src/adapters/CanvasFallbackParser.ts (canvas text nodes); Obsidian-authored canvas JSON uses \n, so CRLF needs externally edited/synced canvas files.

FAILING TEST (committed as it.skip — UNSKIP as acceptance): src/shared/MarkdownCodeRegions.test.ts, "WHEN the text uses CRLF line endings THEN a closing fence still closes the block".

FIX SHAPE: allow \r in FENCE_CLOSER's trailing-whitespace class (e.g. `[ \t\r]*$`), or strip a single trailing \r per line before matching (offsets must stay preserved — masking is same-length).

