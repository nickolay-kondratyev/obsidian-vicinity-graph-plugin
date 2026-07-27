# IMPLEMENTATION_REVIEW — canvas link regime unify

Ticket `nid_s676x55uojmtcwh9t4l9mc6zl_e`, branch `canvas-link-regime-unify`,
diff `bdf2cdf..HEAD` (621ece9, 42076cb, a46e826).

## Verdict: APPROVE-WITH-FIXES

The chosen approach (option 2 — unify) is implemented correctly and the design is
genuinely good: the `CanvasReference` discriminated union is the right call, the
parse/resolve split is correct and correctly justified, `Wikilinks` is a clean DRY
extraction, and the doc/ticket trail is honest. Gates verified independently:
`npm test` → 1075 passed / 80 files (exit 0); `npm run check` → exit 0.

Two of the three things I was asked to scrutinise hardest come out **clean**:

- **Ordering does NOT feed truncation.** Verified by reading, not by trusting the
  claim. `GraphTruncator.truncate` (`src/engine/GraphTruncator.ts:32-47`) sorts
  candidates with `NodePriorityChain.compare`, whose final tiebreaker is
  `lexicographic(a.path, b.path)` (`src/engine/NodePriorityChain.ts:41`) — a
  **total** order, so the kept/hidden partition is independent of link-list order.
  `NodeSizer` uses `.length` (set-based), BFS reachability and `minDepth` are
  order-independent, and `GraphStructureDiff` compares node/edge **Sets**
  (`src/view/GraphStructureDiff.ts:63-67`). The only residue is elk/d3 input
  ordering → node coordinates, which are not persisted (position persistence is
  explicitly V2+). **The implementer's "order is not contractual" claim holds and
  the race is not user-visible through truncation.**
- **Performance sits inside the cache.** `CanvasParseCache.referencesOf`
  (`src/adapters/CanvasParseCache.ts:23-31`) is mtime-keyed and the wikilink scan
  happens inside `CanvasFallbackParser.parseReferences`, i.e. behind that key.
  Resolution is deliberately outside, with a correct WHY (a rename changes a
  target without touching the canvas mtime). Confirmed by code, and the test at
  `src/adapters/CanvasParseCache.test.ts` ("the scan is part of the CACHED work")
  is a real guard.

The gap below is what stops this from being a plain APPROVE.

---

## 🚨 BLOCKING

None.

## ⚠️ SHOULD-FIX

### 1. The regime switch is still GLOBAL, so a multi-canvas vault keeps the exact bug the ticket is about

`src/adapters/ObsidianLinkProvider.ts:75-90` + `src/adapters/CanvasCapability.ts:20-27`.

`CanvasCapabilityDetector.detect` returns `core-indexed` if **any** key in
`resolvedLinks` ends with `.canvas`. When it does, `canvasOutgoingByPath` is left
empty for **every** canvas, and `outgoingPathsOf` falls through to
`Object.keys(this.metadataCache.resolvedLinks[file.path] ?? {})`
(`ObsidianLinkProvider.ts:240`).

Failure scenario (concrete): vault has `a.canvas` and `b.canvas`. Obsidian's boot
sweep indexes `a.canvas` but not (yet) `b.canvas` — which is not hypothetical: the
now-deleted e2e helper's own WHY-NOT recorded that "measured over 8 launches,
Obsidian's boot sweep indexed this canvas in only half of them, and in the misses
it NEVER did", i.e. canvas indexing is per-file and can stall indefinitely.
Detection then says `core-indexed` for the whole provider, the fallback parser
stays dormant, and `b.canvas` reports **zero** outgoing links — worse than the
one-edge divergence the ticket was filed for, and still session-dependent.

So the AC "the canvas link regime no longer varies between sessions for the same
vault" is met for the single-canvas `.dev-vault` the 5-run gate measures, but not
"benign by construction" as claimed. The 5/5 + 4-probe evidence is credible and I
am not disputing it; it just cannot see this case with one canvas in the fixture.

Concrete fix (small, and it is what "unify" ought to mean): make the decision
**per canvas** rather than per provider — a canvas is core-indexed iff
`resolvedLinks[canvasPath] !== undefined` (note: a genuinely link-free indexed
canvas is present as `{}`, so presence is a sound test), otherwise fallback-parse
that one. It stays either/or per file, so no double-reporting, and
`canvasIncomingByPath` merging in `getIncomingLinks` already dedupes. If the fix
is deferred instead, it needs its own ticket and a line in the plan doc's "known
residual divergence" — it must not be silently absorbed into "regime unified".

## 💡 NICE-TO-HAVE

### 2. Dead null branch
`src/adapters/ObsidianLinkProvider.ts:306` — `if (target !== undefined && target !== null)`.
Both producers are `?.path` on a `VaultFilePort | null`, so `target` is
`string | undefined`; `!== null` is unreachable. Drop it.

### 3. The "resolution is relative to the canvas" claim is untested
`src/adapters/FakeObsidianPorts.ts:83` — the fake `getFirstLinkpathDest` ignores
`sourcePath`. Production passes `canvasPath` correctly
(`ObsidianLinkProvider.ts:305`), and that is the load-bearing part of the design
("resolves exactly like a markdown body link, relative to the canvas"), but no test
can currently go red if someone passes the wrong source path. Teaching the fake to
key on `(linkpath, sourcePath)` would close it.

### 4. A stale docblock claim
`src/adapters/ObsidianLinkProvider.ts:41-42` still says `create` "detects
per-install capabilities **ONCE**". It detects once per **provider**, and a
provider is built per rebuild — that inaccuracy is precisely what the ticket
opened on. Reword now that the surrounding text is being touched anyway.

---

## Adversarial sweep — inputs where the regimes could still differ

Checked beyond the implementer's table; these came out **fine**:

- `[[x#heading]]`, `[[x|alias]]`, `[[x#h|alias]]`, `[[x#^block]]`, `![[x|300]]` —
  `Wikilinks.targetOf` cuts at the first `#` or `|`, which is exactly what
  `getFirstLinkpathDest` accepts. `[[#heading]]` correctly yields nothing.
- Unresolved/dangling — dropped on both paths; correct, `resolvedLinks` only holds
  resolved links.
- Attachments / non-md / canvas→canvas / duplicate targets / same note via file
  node + text node — all covered by real tests and all consistent.
- Malformed canvas JSON, non-array `nodes`, non-object root, `text: 42`,
  `file: 42`, `null` node — all handled without throwing, all tested.
- Regex safety: `!?\[\[([^\]]+)\]\]` has no nested quantifier, so no ReDoS on a
  pathologically large text node.
- Case sensitivity / relative paths — file nodes go through `getFileByPath` on the
  literal path Obsidian itself wrote; text links go through Obsidian's own
  resolver. No new surface.
- Self-link `[[board]]` inside `board.canvas` — emits a self-loop edge, but that
  is pre-existing for markdown self-links (`EdgeAccumulator` has no self filter),
  not introduced here.

**Deferral judgement (markdown-style `[a](b.md)`, `[[link]]` in code spans):**
honest and correctly scoped. Both are stated in `src/shared/Wikilinks.ts:8-11`, in
`docs-internal/plan/high-level-plan.md` (### Canvas support), and in ticket
`nid_ygo7h95ssgmunaqsprc1zlmfh_e`, whose AC names the real hazards (URL-decoding,
external-URL rejection). The reasoning — a half-done markdown-link matcher is
worse than none — is sound and consistent with 80/20. No attempt to hide it.

## Preserved-functionality check

- No behaviour-capturing test deleted. The one intentionally **inverted** test
  ("the two regimes disagree" → "both regimes must agree") is the human-approved
  product decision recorded in the ticket, and the implementer called it out in
  §8 and in the commit message. Correct handling.
- `ensureCanvasFixtureIsIndexed()` removal in `e2e/edgeRoutingEval.e2e.ts` is AC-
  mandated and the eval row is re-baselined; the deleted helper was the suite's
  only vault write, so its removal strictly reduces risk.
- No `ap_XXX_E` anchor touched (grep-verified across the diff).
- Layering intact: `src/shared/Wikilinks.ts` has **zero** imports; `src/adapters`
  and `src/view/outlineEntryLabel.ts` both reach it from `../shared`;
  `ObsidianLinkProvider` imports engine symbols from `../engine`, not deep paths.
  `importGuard.test.ts` passes.

## Standards

DRY, SRP and naming are all in good shape here. `Wikilinks` deduplicates the
pattern without over-sharing (display-stripping stayed local in
`outlineEntryLabel`, correctly justified in a WHY comment). `globalPattern()`
returning a fresh `RegExp` per call, with the `lastIndex` WHY and a test that
would catch a regression, is exactly right. No magic numbers, no hardcoded
secrets, no injection surface, no swallowed exceptions (malformed JSON logs and
degrades, by documented design), no resource leaks, no dead code beyond item 2.

## Documentation Updates Needed

None beyond finding 1's follow-up (plan-doc line or ticket for the per-canvas
partial-index case) and finding 4's docblock correction. `CLAUDE.md` needs no
change.
