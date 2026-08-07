---
id: nid_56ggaa2iz70di7xc3h8objt8n_e
title: "Local pinning core: persistence map + adapter merge into pinned roots"
status: open
deps: [nid_2zm28ijiqp786yw6grwbvmffv_e]
links: [nid_ndoy0bq50w1p1qzd2i9di2fxo_e, nid_2zm28ijiqp786yw6grwbvmffv_e, nid_6eust4js4l85s163nezeq3v3g_e]
created_iso: 2026-08-07T19:30:35Z
status_updated_iso: 2026-08-07T19:30:35Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: []
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

