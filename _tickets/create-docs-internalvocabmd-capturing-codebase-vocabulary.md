---
id: nid_1ht2a3rm0ng8wnlis259u5egg_e
title: "Create docs-internal/vocab.md capturing codebase vocabulary"
status: open
deps: []
links: [nid_e79vxubva52s9gq24idypb77x_e, nid_1av3d7fx1072oyp5lxyhjd451_e]
created_iso: 2026-08-07T02:12:49Z
status_updated_iso: 2026-08-07T02:12:49Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [embed-nesting, docs]
---

Follow-up from embed-nesting decision Q1 (ticket nid_e79vxubva52s9gq24idypb77x_e): tickets and code must share crisp vocabulary.

GOAL: create docs-internal/vocab.md — a concise glossary of the vocabulary USED IN CODE so tickets/design docs use the exact terms.

SEED ENTRIES (already decided):
- MAIN node: the active/focused note; GraphNode.isMain (src/engine/types.ts). Tickets sometimes say "central (focused)" — the crisp term is MAIN.
- Central: GraphNode.isCentral == MAIN node OR any pinned root (traversal roots). NOT the same as MAIN.
- Pinned: isCentral && !isMain; persisted docid-keyed pinned set.
- Nesting vocabulary (embed-nesting feature): Nested node (rendered inside a container), Container (node nesting another), Outermost container (root of a nesting tree). Rendering-specific — same note can have different containers in different graphs.

WORK: sweep the codebase (src/engine, src/view, src/adapters, src/persistence — cheap sub-agent fine) for other load-bearing terms that stand out and deserve a shared definition, e.g.: channel / kind-pure channels, LinkKind vs EdgeKind, reference vs link vs occurrence, folder group, truncation, node cap, override, docid, attachment / node-bearing, depth tags / minDepth, FlowNode/FlowEdge/notePairs, structural diff / relayout vs reuse-layout. Keep each entry to 1-3 lines with the owning file path. SUCCINCT — this is a glossary, not an architecture doc (that is docs-internal/architecture-map.md; link, do not duplicate).

Also: add a one-line pointer to vocab.md from CLAUDE.md "Orient here first" list.

## Acceptance Criteria

docs-internal/vocab.md exists with the seed entries plus code-sweep terms, each 1-3 lines with owning file path; CLAUDE.md points to it.

