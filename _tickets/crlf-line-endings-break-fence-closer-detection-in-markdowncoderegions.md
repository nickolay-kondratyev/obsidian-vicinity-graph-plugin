---
closed_iso: 2026-08-15T02:25:09Z
session_ids: [{"a": "claude", "type": "execution", "id": "684cd48a-a1c1-433f-b3bd-8ec9b75688c1"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_b7k6gymkwum7pozwnf28vgecb_e
title: "CRLF line endings break fence-closer detection in MarkdownCodeRegions"
status: closed
deps: []
links: []
created_iso: 2026-08-15T00:42:11Z
status_updated_iso: 2026-08-15T02:25:09Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
parent: nid_1gpbw8a2a3p09ny3kjl0u0az5_e
tags: [shared, canvas]
---

ROOT CAUSE: src/shared/MarkdownCodeRegions.ts:35 — with \r\n line endings, split("\n") leaves a trailing \r on every line. FENCE_OPENER still matches ("```\r" reads the \r as an info string) but FENCE_CLOSER's `[ \t]*$` rejects "```\r", so the fence never closes and EVERY remaining line of the text is blanked — all wikilinks/inline links after the first code block are silently dropped from canvas fallback harvesting (missing edges where core would index them). The sibling matchers (PARAGRAPH_BREAK, DESTINATION_TERMINATOR) already handle \r; this module is the odd one out. REACHABILITY: low — only call site is src/adapters/CanvasFallbackParser.ts (canvas text nodes); Obsidian-authored canvas JSON uses \n, so CRLF needs externally edited/synced canvas files.

FAILING TEST (committed as it.skip — UNSKIP as acceptance): src/shared/MarkdownCodeRegions.test.ts, "WHEN the text uses CRLF line endings THEN a closing fence still closes the block".

FIX SHAPE: allow \r in FENCE_CLOSER's trailing-whitespace class (e.g. `[ \t\r]*$`), or strip a single trailing \r per line before matching (offsets must stay preserved — masking is same-length).

RESOLUTION (2026-08-15): Fixed by allowing one optional trailing `\r` in FENCE_CLOSER — `/^ {0,3}(`{3,}|~{3,})[ \t]*\r?$/` in src/shared/MarkdownCodeRegions.ts — matching how the sibling matchers tolerate CRLF. Chose `\r?$` over `[ \t\r]*$` for precision (only the CRLF residue position accepts it). No offset concerns: matching only, masking still same-length. FENCE_OPENER needed no change (a `\r` info string already opens fine, and a backtick-run followed by `\r` contains no backtick so the info-string rule is unaffected). The committed failing test in src/shared/MarkdownCodeRegions.test.ts was unskipped and passes; full `npm run check` + `npm test` green (2110 passed). Pure shared/ change — no e2e needed.

