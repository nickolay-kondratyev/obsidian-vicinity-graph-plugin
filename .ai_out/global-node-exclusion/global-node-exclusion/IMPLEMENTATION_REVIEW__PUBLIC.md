# IMPLEMENTATION_REVIEW__PUBLIC — Global Node Exclusion

Reviewer: IMPLEMENTATION_REVIEWER (read-only). Branch `global-node-exclusion`, commit `e473230`.
Acceptance criteria = `CLARIFICATION__PUBLIC.md`.

## Verdict: APPROVE-WITH-NITS

The feature is correct, spec-conformant, cleanly layered, and genuinely well-tested. No
BLOCKING issues. The nits below are within-spec edges and a downstream doc gap, none of
which should hold the merge.

## Gates observed (ran myself, not trusted from the PUBLIC file)
- `npm test` → **56 files, 713 tests passed**, exit 0.
- `npm run check` (tsc strict) → exit 0, no errors.
- `importGuard.test.ts` recursively scans `src/engine` + `src/shared`; the new
  `PathExclusionMatcher.ts` imports only `./types`, so purity is auto-covered and green.

## CLARIFICATION requirement checklist
1. Global enable + global pattern list, mirrors `edgeRouting` precedent — **MET**
   (`PluginData.nodeExclusion`, no per-doc override; pill + settings-tab both write the one
   `global-node-exclusion` interaction).
2. Roots exempt (central + pinned, even when matching) — **MET**. `rootPaths` set computed once
   in `VicinityTraversal.traverse` and consulted at the neighbor gate
   (`VicinityTraversal.ts:113`); proven by the root and pinned-root-as-neighbor tests
   (`VicinityTraversal.test.ts:283`, `:292`).
3. Case-sensitive `new RegExp(pattern)`, no implicit flags — **MET** (`PathExclusionMatcher.ts:39`;
   test `:33`).
4. Unanchored `regex.test` against full vault-relative path incl. extension; `^rel/` anchors —
   **MET** (`PathExclusionMatcher.ts:32`; tests `:9-43`).
5. Invalid regex silently skipped, never breaks the graph — **MET** (`compile` try/catch
   `:37-43`; tests `:51-59`).
6. Disabled/empty ⇒ no-op — **MET**. Enable gate lives in `VicinityEngine.exclusionMatcher`
   (`VicinityEngine.ts:108`); empty ⇒ no-op matcher (test `PathExclusionMatcher.test.ts:61`,
   engine `VicinityEngine.test.ts:65`).
7. Excluded iff ANY pattern matches — **MET** (`.some(...)` `:33`; test `:45`).
8. Applied at BFS neighbor discovery, before `isNodeBearing` (never enqueued/expanded/metadata-
   fetched) — **MET**. Check precedes the `isNodeBearing` read (`VicinityTraversal.ts:109-119`);
   perf win proven by `outgoingQueryCount(...) === 0` (`VicinityTraversal.test.ts:253`). NOT applied
   post-traversal.
9. Nodes reachable only through an excluded node are not discovered (documented) — **MET**
   (test `:248`).
10. `excludedNodeCount` = distinct vault paths rejected; no double-counting across roots/directions
    — **MET**. Deduped via a `Set` in `TraversalCollector.excluded` (`:189`); distinct-across-roots
    test `:273`.
11. Count surfaced next to pill only when enabled AND > 0 — **MET** (`NodeExclusionSection.tsx:25`).
12. `PluginData.nodeExclusion` parses defensively, sensible defaults, v1 additive, round-trip —
    **MET**. `parseNodeExclusion` (`persistedShapes.ts:192`) degrades non-object / non-boolean
    `enabled` / non-array `patterns` to fallback and drops non-string entries; default
    `{ enabled:false, patterns:[] }` from `EngineDefaults`; `PERSISTED_SHAPE_VERSION` stays 1;
    round-trip + degrade tests present.
13. Reaches engine as top-level `GraphBuildRequest.nodeExclusion` via `GraphRequestAssembler` (NOT
    inside `ViewSettings`) — **MET** (`VicinityEngine.ts:43`, `GraphRequestAssembler.ts:65`).
14. Matcher pure, OCP via new seam — **MET**. New pure class + new interaction/command variants;
    no existing seam edited destructively.
15. Regex compiled once per build, not per candidate — **MET**. `exclusionMatcher(request)` builds
    the matcher once per `build()` and hands it to the traversal ctor; `excludes` only runs
    `.test`, never `new RegExp`.

## Findings

### BLOCKING
None.

### SHOULD-FIX
- **User-facing docs not updated.** `README.md` (documents the user-facing settings model /
  toolbar) and `docs-internal/CHANGELOG.md` have no mention of node exclusion; no
  `docs-internal/tickets/` entry either. Per `CLAUDE.md` guardrails these should track the new
  surface. This may be owned by a downstream doc stage (THORG_DOC_NOTE_UPDATER) — if so, ensure it
  covers: the two settings-tab controls, the toolbar pill + count, and the regex-lite
  (case-sensitive, unanchored, full-path-incl-extension) semantics. Not code-blocking.

### NITS
- **Count can include an excluded *attachment* neighbor** (implementer's own callout, accurate).
  Because exclusion is evaluated *before* `isNodeBearing` (correct — that is the perf win), an
  excluded path that is actually a non-node-bearing attachment appearing in the link list still
  increments `excludedNodeCount`. This is a genuine tension: you cannot both skip the metadata read
  AND know node-bearingness. It is *within spec* — CLARIFICATION defines the count as "distinct
  vault paths rejected by exclusion", which is exactly what is counted — and in practice attachments
  surface via `FileMetadata.attachments`, not as neighbors, so the graph result is unaffected (only a
  possible count contribution). Acceptable; worth one sentence in user docs if the count is described
  as "notes excluded". No change required.
- **Settings-tab patterns textarea persists + rebuilds on every keystroke**
  (`VicinityGraphSettingTab.ts:95`). A mid-typing partial/invalid regex is safely skipped, and this
  matches the existing node-cap / sizing-weight `onChange` precedent, so it introduces no new
  pattern — but each keystroke triggers a `saveData` + `refreshOpenViews` rebuild. Consider a small
  debounce if this ever proves janky on large vaults. Consistent-with-codebase, so not flagged
  higher.

## Assessment of implementer callouts
- *Attachment-neighbor counting*: acknowledged and accurate — see NIT above. Acceptable per the
  literal requirement.
- *"Reachable only through an excluded node not discovered"*: explicitly sanctioned by CLARIFICATION
  line 15. Not a bug; covered by test.
- *No per-doc override / no settings-tab regex validation UI*: both explicitly out of scope this
  iteration per CLARIFICATION #4.

## Test integrity (LIE scan)
No faked or weakened tests found. Exclusion tests genuinely exercise behavior (absence from graph,
`outgoingQueryCount === 0`, no edge recorded, distinct-count, root/pinned-root exemption, disabled
no-op, defensive-parse degrade, end-to-end-over-fakes with count on both graph and controls). The
only deletion in any test file is a benign helper-return widening (`return { builder, docIdPort,
pathDocIdMap, pluginDataStore }` in `VicinityGraphBuilder.test.ts`) to expose the store for the new
end-to-end test. No behavior-capturing test removed; no `ap_XXX_E` anchor touched.

## Notes
- Layering respected: engine/shared stay obsidian/react-free; the `enabled` gate sits in the engine
  facade so `PathExclusionMatcher` stays pure regex-lite; adapters remain thin pass-through.
- Types are descriptive (`NodeExclusionSettings`, no Pair/Triple), branded `VaultPath` used at the
  matcher boundary, named constants (`EXCLUSION_TEXTAREA_ROWS`), whole-object write mirrors the
  sizing/layout precedent (DRY).
