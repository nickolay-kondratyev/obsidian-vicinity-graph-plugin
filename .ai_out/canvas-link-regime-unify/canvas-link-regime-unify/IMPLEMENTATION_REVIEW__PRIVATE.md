# IMPLEMENTATION_REVIEW — PRIVATE rehydration notes

Review pass 1. Verdict APPROVE-WITH-FIXES. Public file:
`.ai_out/canvas-link-regime-unify/canvas-link-regime-unify/IMPLEMENTATION_REVIEW__PUBLIC.md`

## What I actually ran

- `npm test` → exit 0, 1075 passed / 80 files (log `.tmp/test.log`).
- `npm run check` → exit 0 (log `.tmp/check.log`).
- Did NOT run e2e. Decided the reported 5-run gate + 4 probe runs are credible:
  my own code read confirms both regimes now yield `{note1, note3, note2}` for
  the single-canvas dev vault, so 11 is the expected stable number either way.

## Chain of reasoning for the ordering question (the highest-value check)

Asked: does edge/link ORDER feed truncation? Answer: **no**.
- `src/engine/GraphTruncator.ts:32-47` sorts `[...input.nodes.values()]` with
  `NodePriorityChain.compare`.
- `src/engine/NodePriorityChain.ts:34-43` chain ends in
  `lexicographic(a.path, b.path)` → total order → `Array.sort` stability is
  irrelevant → partition is order-independent.
- `NodeSizer.ts:105` uses `.length` (set semantics after dedupe).
- `VicinityTraversal` BFS: node SET and `minDepth` are order-independent for a
  fixed link set.
- `src/view/GraphStructureDiff.ts:63-67` compares Sets → no spurious relayout.
- Residue: elk/d3 receive nodes/edges in traversal order → coordinates differ
  between regimes. Positions are not persisted (V2+ item in the plan doc), so
  cosmetic only. Concluded the implementer's claim is honest.

## The one finding worth defending

**Global vs per-canvas regime detection.** `CanvasCapabilityDetector.detect`
scans for ANY `.canvas` key. If ≥2 canvases and only some are indexed, the whole
provider flips to `core-indexed`, `canvasOutgoingByPath` stays empty, and the
unindexed canvas falls to `Object.keys(resolvedLinks[path] ?? {})` = `[]` →
that canvas loses ALL edges.

Evidence that partial indexing is real, not theoretical: the WHY-NOT block in the
now-deleted `ensureCanvasFixtureIsIndexed()` (see `git show bdf2cdf:e2e/edgeRoutingEval.e2e.ts`)
recorded "indexed in only half of 8 launches, and in the misses it NEVER did,
even 60s past a settled 165-key index". That is per-file flakiness.

Proposed fix I would accept: per-canvas test `resolvedLinks[canvasPath] !== undefined`
(presence, not truthiness — an indexed link-free canvas is `{}`). Either/or per
file ⇒ no double-report; `getIncomingLinks` already dedupes the merge.

Classified SHOULD-FIX not BLOCKING because: pre-existing shape, not introduced by
this diff, and the measured AC passes on the actual fixture. If the implementer
pushes back and defers, insist on a ticket + a plan-doc "known residual" line —
do not let it be absorbed silently into "regime unified".

## Things I checked and deliberately did NOT flag (don't re-raise)

- Self-loop edges from `[[board]]` inside `board.canvas` — `EdgeAccumulator` has
  no self filter, but that is pre-existing for markdown self-links.
- Per-build `vault.getFiles()` scan + per-build resolution cost — pre-existing
  loop shape; added cost is bounded by canvas wikilink count. Acceptable under
  the human's "as long as performance holds".
- `JSON.stringify(references)).not.toContain("example.com")` as an assertion —
  indirect and near-redundant with the `toEqual` above it, but a nitpick.
- The reconciliation describe block covers only the fallback regime — that is
  fine, the AC's both-regimes requirement is met by the paired headline tests,
  and core behaviour is Obsidian's, not fakeable meaningfully.
- `globalPattern()` allocating a RegExp per call — correct and justified.

## Deferral judgement (asked for explicitly)

Markdown-style `[a](b.md)` + `[[link]]` in code spans: deferral is HONEST and
correctly scoped. Documented in `src/shared/Wikilinks.ts:8-11`, the plan doc, and
ticket `nid_ygo7h95ssgmunaqsprc1zlmfh_e` (which has real ACs incl. `%20` decoding
and external-URL rejection). Do not reopen.

## Gaps the implementer did NOT find

Only finding 1. Everything else in their §4 reconciliation table held up under an
adversarial sweep (aliases, subpaths, block refs, embeds, dangling, dupes,
attachments, canvas→canvas, malformed JSON, degenerate node shapes, ReDoS).
