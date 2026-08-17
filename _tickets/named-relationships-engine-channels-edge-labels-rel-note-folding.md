---
session_ids: [{"a": "claude", "type": "execution", "id": "8a8c49a9-20e8-4a46-8463-cb6882bf9e76"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_ufbtmywzbsyn2gwrx7bi0ww08_e
title: "Named relationships: engine channels, edge labels, rel-note folding"
status: in_progress
deps: [nid_0bhqajvtdq3joblfdzgqogw0x_e]
links: []
created_iso: 2026-08-17T16:44:23Z
status_updated_iso: 2026-08-17T18:12:04Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [named-relationships]
---

Part of the named-relationships set. Read the PLAN first: `_tickets/add-ability-for-named-relationships.md` (closed plan ticket nid_fg66tanwkoyq3cqs1wdxagn21_e) — full syntax spec, signed-off decisions, architecture. Repo conventions: `CLAUDE.md` (layering view→adapters→engine, BDD tests, settings machinery).

Engine-side integration (pure, fixture-tested via Fake* providers):

1. NEW channels `named-outgoing` / `named-incoming` in the `Channel` union (src/engine/types.ts) with their own depth budgets — extend CHANNEL_RELATION, CHANNEL_DISCOVERY_KIND, CHANNEL_DEPTH_FIELD, ChannelDepths/DepthSettings (+ pinned-root variants); every Record<Channel,…> turns the addition into guided compile errors. WHY: system diagrams drawn purely in named links must traverse DEEP (high named depth) without dragging plain links along.
2. EITHER-BUDGET union: a named link is still a link — served to BOTH plain link channels and named channels; a named EMBED is served to embed channel AND named channels. Node reachable under whichever budget reaches it (per-path union). Displayed kind still derives from occurrences at edge assembly (named embed stays `embed`). GUARD: the union is about TRAVERSAL reachability only — one physical occurrence served through two channels is still ONE occurrence at edge assembly (count badge counts it once, its label appears once); never let per-channel streams double-count what is a single statement in the file. Cover with an explicit fixture test.
3. Engine port (new interface, OCP — do not fatten LinkProvider casually; follow the LinkProvider seam pattern in src/engine/LinkProvider.ts) supplying per-file parsed statements from the parser ticket.
4. Label carriage: OutgoingReference/GraphEdge grow relation label data — name PLUS optional qualifier (see plan's bracketed-form spec) — through VicinityTraversal (src/engine/VicinityTraversal.ts) and EdgeAssembly (src/engine/EdgeAssembly.ts). One edge per ordered pair; edge carries ALL its relation labels; count badge data unchanged.
5. REL-NOTE folding (per-occurrence accounting): the rel-note occurrence in `[[he supports]]::[[x]]` is subtracted from the provider-visible link stream — ONE choke point that BOTH traversal discovery and edge assembly consume. Folding at edge assembly alone is WRONG: `VicinityTraversal` discovers neighbors from the same `LinkProvider` streams (`neighborsFor`/`outgoingTargetsOfKind`), so the rel note would still be discovered as a node via the very occurrence being folded, then stranded as an orphan or given a count-0 edge. Never a node/edge of its own; the rel note renders as a normal node only where it has OTHER, non-relationship usages (i.e. the subtraction is per-occurrence, so remaining plain occurrences still discover it and still count).

