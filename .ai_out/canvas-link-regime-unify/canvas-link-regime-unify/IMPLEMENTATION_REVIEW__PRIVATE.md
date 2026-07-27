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

---

# ITERATION 1 — PRIVATE notes

Verdict **APPROVE**. Converged with the implementer. Diff `f869216..HEAD`
(72ba519 fix, bbdebf0 e2e guard, dfc8e3c notes).

## Gates I ran myself this round
- `npm test` → exit 0, **1082 passed / 80 files** (log `.tmp/test2.log`). Matches
  their report exactly (+7 over round 0's 1075).
- `npm run check` → exit 0 (log `.tmp/check2.log`).
- Did NOT re-run e2e. Reasoning: the per-canvas logic is deterministic in unit
  tests; the e2e numbers they report (11 five times, obstacles 13, 21 specs) are
  consistent with `test2.canvas` sitting at depth 2 from note1.

## How I convinced myself the fix is real (not just renamed)

Decisive evidence, in order:
1. `CanvasCapability.ts` no longer contains `CANVAS_KEY_SUFFIX` or any iteration —
   `detectFor` is a one-line exact key lookup. The vault-wide concept is deleted,
   not wrapped.
2. `canvasCapability` field removed from the constructor. Grep
   `canvasCapability|CanvasCapabilityDetector|\.detect\(` over `src/` + `e2e/`
   returns only `detectFor` call sites and prose. Only external consumer was
   `main.ts:237` (debug provenance command) → migrated to
   `fallbackServedCanvasPaths`. No view/persistence consumer existed.
3. Both `getLinkCount` and `outgoingPathsOf` went from a 2-condition guard to a
   single `map.get() !== undefined`. Regime state IS the data now — no parallel
   flag that can drift. This is genuinely better than the fix I proposed.

**Failing-first proof (reasoned, not run):** the sibling test uses
`resolvedLinks: {"a.canvas": {...}}` with `b.canvas` absent. Old vault-wide
`detect` ⇒ `core-indexed` ⇒ empty `canvasOutgoingByPath` ⇒
`getOutgoingLinks("b.canvas")` = `Object.keys(resolvedLinks["b.canvas"] ?? {})`
= `[]` vs asserted `["note-b.md"]`. Unambiguous red. I did not mutate src (read-only
role) but the code path admits no other outcome.

## Subtleties I checked this round

- **Presence vs truthiness**: `resolvedLinks[path] === undefined`, so `{}` reads as
  core-indexed. Had they used `Object.keys(...).length` the bug would return for
  link-free indexed canvases. Both a unit test and a provider test pin it. Good.
- **Prototype-key hazard** on `resolvedLinks[canvasPath]`: no `Object.prototype`
  member name ends in `.canvas`, so no false `core-indexed`. Safe.
- **Map-key collision**: `canvasOutgoingByPath` only ever holds fallback-parsed
  canvas paths, so a markdown file cannot fall into the canvas branch now that the
  extension check is gone from the query methods. Verified by construction in `create()`.
- **Nice-to-have #3 is the real thing**: `resolutionsFrom` is consulted BEFORE the
  flat `resolutions` map, and the new test supplies ONLY `{"board.canvas": {...}}`,
  so a wrong source path ⇒ null ⇒ empty result ⇒ red. Not a cosmetic fix.

## e2e guard judgement (item 4) — reasoning, in case it is challenged

Not vacuous. Post-fix it is deterministic (3 nodes, every run, either regime) and
covers the settled semantics end-to-end in real Obsidian — file node + text-node
wikilink both owed. Pre-fix it is probabilistic and the docblock names the exact
combination that reddens it rather than overclaiming. Partial indexing cannot be
forced externally, so that is the honest ceiling; the deterministic guard is the
unit test, which exists. Baselines undisturbed because test2.canvas is depth 2 from
note1 (reaches note2/note3 only), consistent with NOTE1_NODE_COUNT still 11.

## Deliberately NOT raised (do not let a later round manufacture it)

`create()` now calls `vault.getFiles()` unconditionally, where a core-indexed
install previously skipped it. Cost: one array walk + a hash lookup per canvas, no
reads/parses, vs ~30ms layout. That is the irreducible price of asking per canvas.
Mentioned as informational in PUBLIC, explicitly not a finding.

Also still standing from round 0 and correctly left alone: markdown-style
`[a](b.md)` + code-span links deferred to `nid_ygo7h95ssgmunaqsprc1zlmfh_e`;
edge ORDER non-contractual (does not feed truncation — `NodePriorityChain` ends in
a total lexicographic path order).

## State

No open findings. If a round 2 is requested, there is nothing outstanding from me —
say so plainly rather than opening new ground.
