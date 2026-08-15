---
session_ids: [{"a": "claude", "type": "execution", "id": "3c279c5f-1da1-4216-a2dc-2db9c2a01f84"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_6ujh4ol7un9etab1vqwfe9nye_e
title: "Self-link records a degenerate source==target edge that nothing filters"
status: in_progress
deps: []
links: []
created_iso: 2026-08-15T00:42:11Z
status_updated_iso: 2026-08-15T02:18:47Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
parent: nid_1gpbw8a2a3p09ny3kjl0u0az5_e
tags: [engine]
---

ROOT CAUSE: src/engine/VicinityTraversal.ts:157 — when a note references itself (Obsidian's resolvedLinks records [[Note#Section]] written inside Note.md as Note→Note; adapters do not filter self, only FrontmatterIdIndex skips self-references), bfs records recordEdge(current, current) BEFORE the visited check, and no downstream stage (EdgeAccumulator, GraphTruncator, EdgeAssembly, view mapping) filters source === target — grep for `source === target` finds no filter. React Flow / edge routing receive a zero-length self-loop on the MAIN node. The native local graph draws no self-loops.

FAILING TEST (committed as it.skip — UNSKIP as acceptance): src/engine/VicinityTraversal.test.ts, "WHEN a note links to itself THEN no self-loop edge reaches the graph".

FIX SHAPE: skip neighbor === current in bfs (cheapest, keeps every downstream stage clean).

