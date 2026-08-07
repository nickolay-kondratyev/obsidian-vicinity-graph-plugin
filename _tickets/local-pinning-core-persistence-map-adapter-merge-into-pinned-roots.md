---
closed_iso: 2026-08-07T20:11:21Z
id: nid_56ggaa2iz70di7xc3h8objt8n_e
title: 'Local pinning core: persistence map + adapter merge into pinned roots'
status: closed
deps: [nid_2zm28ijiqp786yw6grwbvmffv_e]
links: [nid_ndoy0bq50w1p1qzd2i9di2fxo_e, nid_2zm28ijiqp786yw6grwbvmffv_e, nid_6eust4js4l85s163nezeq3v3g_e]
created_iso: '2026-08-07T19:30:35Z'
status_updated_iso: 2026-08-07T20:11:21Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Core (non-UI) half of LOCAL PINNING (planned from nid_ndoy0bq50w1p1qzd2i9di2fxo_e; decisions in nid_2zm28ijiqp786yw6grwbvmffv_e — defaults there are the spec unless overturned).

FEATURE: a local pin marks a target note as pinned ONLY while a specific MAIN (active) note is active. Global pinning is unchanged; a note can hold both pin kinds at once. When the main note is active, its locally pinned notes behave exactly like globally pinned centrals: pinned depth trio, isCentral, cap-exempt, survive restarts.

REQUIREMENTS
1. Persist a docid-keyed map in data.json: localPins keyed by MAIN docid, value = list of PinnedDocEntry-shaped entries ({docid, pinTimestamp}) for the locally pinned targets. Renames stay non-events (both sides are docids). Clean break allowed (plugin unpublished): no migration, but persistedShapes parse must tolerate absence.
2. PluginDataStore (src/persistence/PluginDataStore.ts): addLocalPin(mainDocid, targetDocid, pinTimestamp), removeLocalPins(mainDocid, targetDocids), localPins(mainDocid) read. Re-pin refreshes timestamp (mirror addPin dedupe). docIdKeyedDocids() must include map KEYS and nested target docids; forgetDocs(docids) must drop deleted docs from BOTH positions (as key: whole entry; as target: pruned from every list) — this is the ONE wiring point, so the live vault-delete handler and OrphanSweeper need no changes beyond what forgetDocs gives them (verify with tests).
3. PersistenceServices (src/persistence/PersistenceServices.ts): localPinDoc(mainFile, targetFile) mints/validates docids for BOTH docs via the existing withPersistableIdentity/DocPersistEligibility seam (per decision Q2: minting on MAIN is allowed); refusal reuses the existing not-pinnable outcome naming which doc refused. localUnpinDoc uses read-only getDocId (clearing never mints — same rule as clearNodeOverrideField).
4. Adapter (src/adapters/GraphRequestAssembler.ts): GraphRequestInputs gains the active main docid's local pins; pinnedDescriptors() merges GLOBAL pins + LOCAL pins for the current main, dedupes by docid (keep the most recent pinTimestamp so NodePriorityChain recency stays honest), keeps the existing skip of a pin that IS the main doc. ENGINE IS UNCHANGED: VicinityEngine sees one merged pinned list; local-vs-global is a persistence/view fact, not a traversal fact (decision Q3: same pinned depth trio).
5. Expose to the view mapping the per-node pin facts as TWO flags (isGloballyPinned, isLocallyPinned) wherever isPinned flows today (src/view/flowMapping.ts input side only — actual UI rendering is the dependent UI ticket). Keep isCentral = MAIN or any-pinned.

TESTS (BDD, colocated, Fake* providers; start failing-first): persistedShapes parse/round-trip incl. version field; PluginDataStore add/remove/forget both-positions; PersistenceServices eligibility both-docs incl. refusal reasons; GraphRequestAssembler merge/dedupe/most-recent-timestamp; flowMapping flag split. npm test + npm run check must pass. Pure engine/persistence scope: no e2e required here.

CONVENTIONS: see CLAUDE.md Persistence section (write intents name ONE field; never compose from rendered graph; every persisted shape carries version). Update docs-internal/plan/high-level-plan.md "Pinning and settings" + "Persistence" sections: local pins are the first sanctioned per-main-doc layer, superseding part of the 2026-07-29 global-only decision for PINS ONLY (owner-directed via ticket nid_ndoy0bq50w1p1qzd2i9di2fxo_e).

## Acceptance Criteria

localPins map persists and reloads; locally pinned targets of the active main traverse as pinned centrals (merged before engine); forgetDocs prunes both key and target positions; all new logic unit-tested; npm run check and npm test green; high-level-plan.md updated.


## Notes

**2026-08-07T19:47:45Z**

REQUIREMENT ADDED (owner decision 6, nid_2zm28ijiqp786yw6grwbvmffv_e): a locally pinned note appears even with NO link from the main note — it is a pinned ROOT with its own vicinity, exactly like a global pin. This should fall out of merging local pins into the pinned-root list, but MUST be pinned by an explicit BDD test, e.g. in src/adapters/ (assembler/builder level): GIVEN doc B locally pinned under main A and NOT linked from A, WHEN the graph builds for A, THEN B is present as a pinned central (and its own vicinity traverses with the pinned trio). Also cover the converse: with a different main active, B does not appear (absent other reachability).

**2026-08-07T20:11:21Z**

RESOLVED 2026-08-07. Core (non-UI) local-pinning implemented; `npm run check` + `npm test` green (1768 tests, +38 new). No e2e (pure engine/persistence scope, per ticket).

WHAT SHIPPED (by requirement):
1. persistedShapes.ts — new `localPins` map (`LocalPinsByMainDocid` = MAIN docid → PinnedDocEntry[]) on `PluginData`, default `{}`. `parseLocalPins` tolerates absence (additive, no version bump), reuses `parsePins` per target, and drops any main whose target list survives empty (no orphan-main shape). Round-trip incl. version covered.
2. PluginDataStore.ts — `localPins(mainDocid)` read; `addLocalPin` (re-pin refreshes timestamp, mirrors addPin dedupe); `removeLocalPins` (drops a main's key when its last target goes). `docIdKeyedDocids()` now unions local-pin KEYS + nested TARGET docids (extracted `localPinDocids()` helper, DRY). `forgetDocs()` prunes BOTH positions (key → whole entry; target → pruned from every list, empty main dropped) via `forgetFromLocalPins`, returning same-ref on no-op so the write is still skipped when nothing changed.
3. PersistenceServices.ts — `localPinDoc(mainFile, targetFile)` mints/validates BOTH docids via the existing withPersistableIdentity/DocPersistEligibility seam (Q2: minting on MAIN sanctioned). Classifies the CLICKED target FIRST so a doomed pin never writes frontmatter into the un-clicked main; returns new `LocalPinPersistOutcome` naming which doc refused (`refusedDoc: "main"|"target"` + existing NotPersistableReason). `localUnpinDoc(mainFile, targetDocid)` uses read-only getDocId (never mints), mirroring clearNodeOverrideField.
4. GraphRequestAssembler.ts — `GraphRequestInputs.localPins` (active main's list, selected by the builder). `pinnedDescriptors()` merges GLOBAL ∪ LOCAL, dedupes by docid keeping the most-recent pinTimestamp (NodePriorityChain recency stays honest), keeps the existing skip of the main-doc pin and unresolved docids. ENGINE UNCHANGED — one merged pinned list.
5. flowMapping.ts — `isPinned` split into `isGloballyPinned` / `isLocallyPinned`, derived from a new `FlowPinFacts` (global/local docid sets) supplied by the caller. `vicinityGraphToFlow(graph, pinFacts)`; the sets are built in VicinityGraphBuilder from the SAME inputs and carried on `GraphBuildResult.pinFacts`. isCentral (engine: MAIN or any-pinned) unchanged. NoteNode's existing GLOBAL pin toggle now reads `isGloballyPinned` (the local-pin control is the dependent UI ticket).

REQUIREMENT 6 (unlinked visibility) — proven by src/adapters/localPinVisibility.integration.test.ts (assembler→real VicinityEngine, FakeLinkProvider): B locally pinned under main A and NOT linked from A is present as a pinned central and its own vicinity (its neighbor C) traverses; converse — with a different main active, B is absent.

BEYOND THE TICKET (called out for transparency): the ticket assumed OrphanSweeper needs no changes "beyond what forgetDocs gives", but the sweep enumerates its own candidate list (pins + overrides) via SweepPlanner rather than through docIdKeyedDocids, so local-pin orphans the live delete handler missed would have leaked as dead storage. Closed the gap: SweepInputs/SweepPlan gained localPinDocids/localPinsToRemove, OrphanSweeper forgets them and reports `localPinsRemoved` in SweepSummary. Live `vault.on('delete')` handler needed no change (it already passes the docid to forgetDocs).

LEFT IN PLACE (judgment call): `ControlsModel.mainPinned` is now written but no longer read in production (its sole reader, GraphViewController, moved to pinFacts). Kept because it is a coherent, tested field of the controls read-model and the tightly-coupled UI follow-up ticket (second pin control) will consume panel-side pin state; removing then re-adding across the ticket boundary is needless thrash. The equivalent fact now also flows to the MAIN node via pinFacts → FlowNodeData.isGloballyPinned.

DOCS: docs-internal/plan/high-level-plan.md "Pinning and settings" + "Persistence" sections updated — local pins recorded as the first sanctioned per-main-doc layer (PINS ONLY), superseding part of the 2026-07-29 global-only decision.

TESTS ADDED: persistedShapes local-pins parse/round-trip/absence/malformed/empty-drop; PluginDataStore add/remove/re-pin/two-mains/last-target-drop/forget-both-positions/dual-map/docIdKeyedDocids; PersistenceServices localPinDoc both-docs + refusal naming + no-frontmatter-on-doomed-pin + localUnpinDoc no-mint; GraphRequestAssembler merge/dedupe/most-recent-timestamp; flowMapping global/local flag split; SweepPlanner + OrphanSweeper local-pin orphan coverage.
