---
closed_iso: 2026-08-17T18:45:37Z
session_ids: [{"a": "claude", "type": "execution", "id": "8a8c49a9-20e8-4a46-8463-cb6882bf9e76"}, {"a": "claude", "type": "review", "id": "2ca0eb14-e453-4c96-9cc6-9fafe5dbd95a"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_ufbtmywzbsyn2gwrx7bi0ww08_e
title: "Named relationships: engine channels, edge labels, rel-note folding"
status: closed
deps: [nid_0bhqajvtdq3joblfdzgqogw0x_e]
links: []
created_iso: 2026-08-17T16:44:23Z
status_updated_iso: 2026-08-17T18:45:37Z
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


## Notes

**2026-08-17T18:45:37Z**

DONE (engine-side integration). All 5 parts landed; `npm run check` green, `npx vitest run` 2266 passed / 1 skipped. Pure-engine change — no e2e (per CLAUDE.md, engine/persistence stays on `npm test`).

WHAT WAS BUILT / WHERE
1. Channels — src/engine/types.ts: Channel union + CHANNELS gained `named-outgoing`/`named-incoming`; CHANNEL_RELATION→"link", CHANNEL_DISCOVERY_KIND→"link", CHANNEL_DEPTH_FIELD→namedDepthOut/namedDepthIn. ChannelDepths gained namedDepthOut/namedDepthIn; DepthSettings gained those + pinnedNamedDepthOut/pinnedNamedDepthIn; DepthSettingsFacts active/pinned maps updated. Every Record<Channel,…> steered the additions.
2. Either-budget union — a named link IS a link/embed (rides the SAME OutgoingReference by carrying `relations`), so it is served to plain link/embed channels AND the named channels. VicinityTraversal.ts: CHANNEL_LINKER + neighborsOf gained named-outgoing (OutgoingReferences.namedTargetsOf) and named-incoming (private namedIncomingOf = incoming linkers whose refs to the node carry relations). Single-occurrence guard: traversal dedups to one pair; EdgeAssembly counts occurrences via getLinkCount (kind-blind), so one physical statement served through two channels = ONE edge, count once, label once.
3. Port (OCP) — src/engine/RelationProvider.ts (new): `relNoteFolds(source): readonly VaultPath[]`, one entry per statement occurrence. Fake: src/engine/FakeRelationProvider.ts. Did NOT fatten LinkProvider; the LABEL half rides LinkProvider (OutgoingReference.relations), only the fold half needs the new port.
4. Label carriage — RelationLabel {name, qualifier?, relNoteTarget?} in types.ts; OutgoingReference.relations (LinkProvider.ts) + GraphEdge.relations (types.ts). OutgoingReferences.deduped MERGES relations across collapsed dups; EdgeAssembly.relationsOf aggregates distinct labels (NUL-joined identity) → one edge carries ALL its names; count badge unchanged.
5. Rel-note folding — src/engine/RelationFoldingLinkProvider.ts (new), THE one choke point: a LinkProvider decorator wrapping base; getLinkCount = max(0, base − folded), getOutgoingReferences/getIncomingLinks drop fully-folded pairs. Both traversal discovery AND edge assembly consume it (VicinityEngine wraps base when a RelationProvider is passed). Correct because a rel-note NAME occurrence IS a physical link occurrence (base >= folds); base===folds ⇒ fully folded (no node/edge), base>folds ⇒ still a node, remaining plain occurrences counted. Per-occurrence.

Wiring: VicinityEngine(provider, relationProvider?) wraps in RelationFoldingLinkProvider when the port is supplied. Exports in src/engine/index.ts.

TESTS: src/engine/namedRelationships.test.ts (13 BDD, Fake* fixtures) — named-depth budgets incl. independence + named-incoming; either-budget union single-occurrence guard; named-embed kind stays embed; label carriage (multi-name, qualifier, relNoteTarget); rel-note folding incl. per-occurrence multiplicity. Existing fixtures updated for the new DepthSettings/ChannelDepths keys.

ENGINEERING CALLS (non-interactive; no product decision needed)
- Pinned named-depth defaults follow the LINK convention (pinnedNamedDepthOut=namedDepthOut=2, pinnedNamedDepthIn=namedDepthIn=1). SETTINGS_SPEC bounds = DEPTH_STEPPER_BOUNDS (0..5 step 1), same as other depths.
- SETTINGS_SPEC/persistence/section-fields updated (compile-guarded cascade is unavoidable when DepthSettings grows). No UI ROWS added — deferred to the rows ticket, exactly the Hierarchy 1→3 precedent.

FOLLOW-UP FOR THE ROWS TICKET (nid_fqdc55oifopcxxs4eb0w8q876_e): it MUST remove the 4 REACHABLE_LATER allowlist entries in src/view/settingsRowSpecCoverage.test.ts (namedDepthOut/namedDepthIn/pinnedNamedDepthOut/pinnedNamedDepthIn) when it wires the actual settings rows.

STILL OPEN UPSTREAM: the real adapter that implements RelationProvider + merges labels onto OutgoingReference (nid_wldz7yfjecf9fuwtlezlbde9s_e) — until then the engine is fully functional but fed only by Fake* in tests.
