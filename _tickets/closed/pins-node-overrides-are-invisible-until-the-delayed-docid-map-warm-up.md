---
closed_iso: 2026-08-04T01:14:16Z
id: nid_gbyqsuplz8b7pv0u5k34sdz1q_e
title: pins & node overrides are invisible until the delayed docid-map warm-up
status: closed
deps: []
links: [nid_qjsj5mth2phdqctbm0vfx9elw_e, nid_lwionnvohw9k58jw7a2dybht2_e, nid_y081nezeucka9l0x3umebi5zo_e, nid_iqna8b4j5339pjiga7kgwdnh7_e]
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

## Post-close review fixes (2026-08-04)

An adversarial review of commit `59e26b5` found three issues; all fixed in a
follow-up commit (tests first, each proven to fail without the fix):

1. **A read failure during the warm-up killed the graph build.** `getDocId`
   resolves an id by reading file CONTENT (`vault.cachedRead`), and the scan
   spans yields — a file deleted mid-scan rejects. That rejection propagated
   through `warmFor` → `build()` → `void runBuild()` (no catch), so the view
   never published, and since nothing was cached it repeated on EVERY rebuild.
   `DocIdMapWarmer` now treats an unreadable file as "no docid", logs the path
   and walks on; a scan never rejects (documented contract). Because the sweep
   DELETES on the same scan, a pass that could not read every file reports
   `everyFileRead: false` and the sweep then drops NOTHING — a doc that could
   not be read is not evidence that the doc is gone, and this keeps the previous
   (abort-the-sweep) safety while still warming the map.
2. **Two implementations of the same scan.** `OrphanSweeper` had its own
   eligible-file walk with its own batch constant — the same knowledge, and the
   failure policy above would have had to be written twice. `DocIdMapWarmer` is
   now THE scanner (`warmFor` + `warmAll`), the sweeper only judges and drops.
   Bonus: both share one instance, so the sweep and a build never scan
   concurrently. `ChunkedWork.forEachChunked` fell out of use and was removed
   (its yield-count tests moved onto `forEachChunkedUntil`).
3. **The warmer was constructed inside `VicinityGraphBuilder`**, justified by a
   comment asserting "ONE per plugin" — a fact the class cannot enforce and one
   that blocked sharing it with the sweep. It is injected from `main.ts` now.

Remaining, filed as `nid_y081nezeucka9l0x3umebi5zo_e` (not a defect): the first
build after a restart can block on a full-vault content scan on large vaults.

## Second review round (2026-08-04)

One more issue in the same failure policy, fixed here (test first, proven to
fail without the fix):

4. **A MISS was cached off incomplete evidence.** Item 1 above gave the sweep
   the rule "conclude nothing from a walk that did not read every file", but
   `DocIdMapWarmer.scanForMissing` still cached a docid as a per-session miss
   after a walk whose reads had FAILED — so the pin/override carried by the very
   file that could not be read was hidden until restart (only a visit, a write
   intent or the 15s sweep re-warming that path undid it). That is the bug this
   ticket exists to fix, re-entered through a narrow door, and the class doc
   contradicted itself about it ("never gets stuck behind a cached miss" vs.
   "invisible for the session"). A miss is now cached only when the walk read
   every file — ONE rule for both callers. Rescanning converges: a rejected read
   means the file went away between the `getFiles()` snapshot and the read.

Also filed, NOT patched (needs a view-level failure-policy decision):
`nid_iqna8b4j5339pjiga7kgwdnh7_e` — the main doc's own `getDocId` in
`VicinityGraphBuilder.build` is the same rejecting `cachedRead`, and
`GraphViewController.runRebuild` has no catch, so that sibling call still kills
a rebuild silently.

Verified after the fix: `npm test` (1536 pass), `npm run check`,
`npm run test:e2e -- controlsRestart.e2e.ts` (pass).

## Third review round (2026-08-04)

Two issues, both in what the previous round introduced; fixed here (the
behavioural one test-first, proven to fail without the fix):

5. **The miss rule made the read path's rescans UNBOUNDED.** Round 2 refused to
   cache a miss after a walk whose reads failed, justified by "rescanning
   converges: a rejected read means the file went away". That holds for the
   vanishing-file RACE only. A file that stays unreadable — a not-yet-downloaded
   cloud placeholder, a permission error, a locked file — fails the same way
   forever, so with ONE such file plus ONE unresolvable docid (an orphaned
   pin/override, which the sweep also refuses to delete on the same evidence
   rule) EVERY rebuild re-read the whole vault before rendering: permanent, and
   permanent across sessions. `DocIdMapWarmer.recordMiss` now forgives such a
   miss exactly ONCE and lets the next walk decide — the race still converges on
   that retry, the permanent failure costs two full scans per session instead of
   one per rebuild. Nothing is DELETED on this judgment (the sweep keeps its
   stricter rule), so being wrong costs one pin/override unrendered until the
   next session, never lost state.
6. **The warm list re-derived "which maps are docid-keyed" in the build path.**
   `VicinityGraphBuilder` assembled `pins ∪ Object.keys(nodeOverrides)` itself,
   so a third docid-keyed map would be warmed only if whoever added it
   remembered this call — and forgetting it silently re-opens exactly this
   ticket's bug for the new map (no test fails). `PluginDataStore` now answers
   it: `docIdKeyedDocids()`, the READ twin of `forgetDocs`, so both halves of
   that knowledge live in the store.

Also renamed `scanEligibleFiles`'s result to `everyReadSucceeded` — for a walk
that STOPS EARLY (the read path's) "every file read" was never true, and only
`warmAll` (which never stops early) may read it as that.

Verified after the fix: `npm test` (1539 pass), `npm run check`,
`npm run test:e2e -- controlsRestart.e2e.ts` (pass — and confirmed to FAIL when
the pinned-central expectation is flipped, so the assertion is real).
