---
closed_iso: 2026-08-04T01:14:16Z
id: nid_gbyqsuplz8b7pv0u5k34sdz1q_e
title: pins & node overrides are invisible until the delayed docid-map warm-up
status: closed
deps: []
links: [nid_qjsj5mth2phdqctbm0vfx9elw_e, nid_lwionnvohw9k58jw7a2dybht2_e]
created_iso: '2026-08-04T00:32:28Z'
status_updated_iso: 2026-08-04T01:14:16Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [persistence, sizing]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
**This ticket OWNS the cold-map problem.** Its root cause and the option list
were already written up for the pin side in
`docs-internal/tickets/ticket-pinned-central-status-lags-after-restart.md`
(options A/B/C) — read that file, it is not repeated here. This ticket exists
because per-node overrides land on the SAME seam and raise the severity; that
file now points here.

What is new with `nodeOverrides`: both docid-keyed maps are translated to paths
through `PathDocIdMap` in `src/adapters/GraphRequestAssembler.ts`
(`resolveDocPath`), so an override does not resolve either during the cold
window. Once the consuming tickets APPLY pixels, the node first renders at its
computed size and then JUMPS when a later rebuild picks the override up — a
visible layout jolt, where the pin side only lost accent styling (or, for a
disconnected pinned island, the node itself).

Per-node size overrides make it visible as a layout jump, so it should be
settled before/with `nid_qjsj5mth2phdqctbm0vfx9elw_e` (drag-to-resize).

One option is worth adding to that file's A/B/C: resolve a MISSING docid on
demand in the read path (`VicinityGraphBuilder` has `DocIdPort.getDocId` —
READ-ONLY, id-lib-legal) for just the docids present in the two maps, instead of
waiting for the bulk warm-up. Pick ONE direction, do not stack.

## Acceptance Criteria

Opening a vault with a pinned doc and a per-node override renders both correctly on the FIRST graph build, without waiting for the delayed sweep.

## Resolution (2026-08-04, commit 59e26b5)

Implemented the on-demand read-path option (the "D" this ticket added to the
A/B/C list) — ONE direction, nothing stacked:

- **`src/persistence/DocIdMapWarmer.ts`** (new): given the docids a build
  needs, it resolves the ones missing from the cold `PathDocIdMap` by scanning
  eligible files with `DocIdPort.getDocId` (READ-ONLY — id-lib-legal; the
  `ensureCalls === 0` test guards it). The scan is chunked (batch 20, same
  politeness budget as the sweep), EARLY-EXITS once every wanted docid is
  found, learns every docid it passes (free warm-up), serialises concurrent
  scans on `SerialPromiseChain`, and caches per-session MISSES so an orphaned
  pin/override never forces a full rescan on every rebuild (the delayed sweep
  still deletes orphans — it stays the backstop).
- **`VicinityGraphBuilder.build`** awaits `warmFor(pins ∪ nodeOverride docids)`
  before assembling the request, so the FIRST build after a restart already
  resolves both maps. Warm map ⇒ `warmFor` is a no-op (no scan starts).
- **`ChunkedWork.forEachChunkedUntil`** added (stop-early variant);
  `forEachChunked` now delegates to it.

Acceptance criterion covered by BDD tests: a cold-map fixture in
`src/adapters/VicinityGraphBuilder.test.ts` asserts a persisted pin is a
central AND a persisted `sizePx` override reaches its node on the FIRST build;
`src/persistence/DocIdMapWarmer.test.ts` covers no-scan-when-warm, early exit,
miss caching and read-only identity. Verified: `npm test` (1524 pass),
`npm run check`, and `npm run test:e2e -- controlsRestart.e2e.ts` (pass).

The root-cause write-up
`docs-internal/tickets/ticket-pinned-central-status-lags-after-restart.md` is
marked RESOLVED and points back here.

Known limit (accepted, pre-existing): a doc that appears AFTER the one full
scan recorded its docid as a miss (e.g. arrives via sync) stays unresolved
until restart — write intents map their own docid, so normal pin/override
flows are unaffected.
