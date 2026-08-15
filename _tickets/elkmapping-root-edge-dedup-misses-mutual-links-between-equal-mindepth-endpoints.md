---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_4i09w45k625h4ltdscishx6x3_e
title: "elkMapping root-edge dedup misses mutual links between equal-minDepth endpoints"
status: in_progress
deps: []
links: []
created_iso: 2026-08-15T00:42:38Z
status_updated_iso: 2026-08-15T02:12:45Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
parent: nid_1gpbw8a2a3p09ny3kjl0u0az5_e
tags: [view, layout]
---

ROOT CAUSE: src/view/elkMapping.ts:121-128 — root edges are documented as "deduped by projected pair", but the centre-outward flip uses STRICT less-than on minDepth (`outward = minDepth(target) < minDepth(source)`); a TIE keeps each edge's own order, so mutual links A→B and B→A between equal-depth nodes produce ids "A->B" AND "B->A" — two root edges for one unordered pair. Downstream refineForceRootLayout builds two RectLinks, inflating both endpoints' degree and applying two spring impulses (modest deterministic layout bias; mutual links between same-depth neighbors are common).

FAILING TEST (committed as it.skip — UNSKIP as acceptance): src/view/elkMapping.test.ts, "WHEN two equal-depth nodes link BOTH ways THEN the root keeps ONE edge for the pair".

FIX SHAPE: on tie, order the pair canonically (e.g. lexicographic by id) before minting the dedup key.

