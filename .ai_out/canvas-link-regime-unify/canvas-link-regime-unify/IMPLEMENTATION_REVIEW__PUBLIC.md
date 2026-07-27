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

---

# ITERATION 1 — convergence check

Diff `f869216..HEAD` (72ba519, bbdebf0, dfc8e3c). Gates re-run by me:
`npm test` → **1082 passed / 80 files**, exit 0. `npm run check` → exit 0.
Did not re-run the 5x e2e gate — no reason to doubt it (see item 4).

## Verdict: APPROVE

All four of my round-0 findings are genuinely fixed, not nodded at. **Converged.**

## 1. Is the per-canvas fix real and complete?

Yes, and the refactor is better than the patch I asked for. The vault-wide concept
is *gone*, not merely bypassed:

- `src/adapters/CanvasCapability.ts:23` — `detect(Iterable<string>)` →
  `detectFor(resolvedLinks, canvasPath)`, an exact key lookup
  (`resolvedLinks[canvasPath] === undefined`). No suffix scan survives anywhere.
- `src/adapters/ObsidianLinkProvider.ts:82-95` — the `if (capability === "fallback-required")`
  wrapper is replaced by a per-file `detectFor(...) === "core-indexed" → continue`.
- `canvasCapability` the **field is deleted**; regime is now *membership in*
  `canvasOutgoingByPath`. `getLinkCount` (`:136-137`) and `outgoingPathsOf`
  (`:242-245`) each **lost** their two-condition guard for a single
  `map.get() !== undefined`. Branches removed, not added — the claim holds.

**Grep sweep for dropped behaviour** (`canvasCapability|CanvasCapabilityDetector|\.detect\(`
across `src/` and `e2e/`): every hit is either the new `detectFor` or prose. The one
real consumer, `src/main.ts:237-243` (a debug-only provenance command), was migrated
to `fallbackServedCanvasPaths` and now *names* the served canvases — a strictly better
diagnostic for exactly this bug. No view or persistence consumer ever read the old
field. Nothing quietly dropped.

**Does the new test fail without the fix?** Yes, provably.
`ObsidianLinkProvider.test.ts` "WHEN a SIBLING canvas is not indexed yet THEN it is
still fallback-parsed (no blank canvas)" uses `resolvedLinks: { "a.canvas": {...} }`
with `b.canvas` absent. Under the old vault-wide `detect`, `a.canvas`'s key forces
`core-indexed`, `canvasOutgoingByPath` stays empty, and `getOutgoingLinks("b.canvas")`
resolves to `Object.keys(resolvedLinks["b.canvas"] ?? {})` = `[]` — against an
asserted `["note-b.md"]`. Deterministic red. Same for
`CanvasCapability.test.ts` "WHEN ANOTHER canvas is indexed but this one is not".

Two bonus correctness points I checked and agree with:
- **Presence, not truthiness.** `{}` (indexed, genuinely link-free) correctly reads as
  `core-indexed`. Testing `Object.keys(...).length` instead would have re-created the
  bug for link-free canvases. Both the unit test and the provider-level test pin it.
- **`my.canvas.md` false positive** genuinely gone — exact lookup, and the old test was
  updated to assert the right thing (`detectFor({"my.canvas.md":{}}, "my.canvas")`)
  rather than deleted.

## 2. No divergence reintroduced

Re-swept my round-0 list against the new dispatch. The regime switch moved from
`(extension === canvas && capability)` to `canvasOutgoingByPath.has(path)`, and that
map is keyed **only** by canvas paths that were fallback-parsed — so a markdown file
can never collide into the canvas branch, and a core-indexed canvas can never be
double-reported (pinned by "WHEN a canvas is core-indexed THEN the fallback does not
ALSO report its links", asserting `getLinkCount === 1`). Aliases, subpaths, embeds,
dangling links, dupes, attachments, canvas→canvas, malformed JSON: all untouched by
this diff and still passing. `resolvedLinks[canvasPath]` cannot hit a prototype key,
since no `Object.prototype` member name ends in `.canvas`.

## 3. My three nice-to-haves — all actually implemented

1. **Dead null branch** — `ObsidianLinkProvider.ts:325` is now `if (target !== undefined)`. Done.
2. **`sourcePath` fidelity** — `FakeObsidianPorts` gained `resolutionsFrom` (source →
   link text → target), consulted *before* the flat map, plus a dedicated test ("resolved
   relative to the CANVAS itself") whose fixture resolves `note-b` **only** from
   `board.canvas`. That test goes red if the wrong source path is ever passed. This is
   the real version of the fix, not a comment.
3. **Stale docblock** — `ObsidianLinkProvider.ts:39-44` now states plainly that a
   provider is built per rebuild and the settling is a fresh read each time. The
   misleading "detects per-install capabilities ONCE" is gone.

## 4. Is the `test2.canvas` e2e guard honest, or a guard that guards nothing?

**Honestly scoped, and it is not vacuous.** Judged on its own merits:

- **Post-fix it is a deterministic guard**: opening `test2.canvas` must show exactly 3
  nodes — itself, `note3.md` (file node) and `note2.md` (text-node wikilink) — on
  *every* run and under *either* regime. That is real end-to-end coverage of the
  settled semantics in a real Obsidian, which no unit test provides.
- **Pre-fix it is probabilistic, and the docblock says so precisely**: it names the one
  combination that turns it red (test.canvas indexed, test2.canvas not) rather than
  claiming general failing-first. Given that a partial index cannot be forced from
  outside Obsidian, that is the honest ceiling, and pairing it with the deterministic
  unit test is the right split.
- **It does not disturb existing baselines**: `test2.canvas` reaches only note2/note3,
  putting it at depth 2 from `note1`, outside the vicinity every other count asserts —
  consistent with the reported unchanged `NOTE1_NODE_COUNT = 11`, sparse eval 11, and
  obstacles 13. The seed uses `write_if_missing`, so it lands in fresh vaults.

That is the opposite of a decorative test. No finding.

## Remaining findings

**None.** No BLOCKING, no SHOULD-FIX, no new NICE-TO-HAVE.

One thing I checked and deliberately am *not* raising as a finding: the canvas loop in
`create()` now runs `vault.getFiles()` unconditionally, where previously a core-indexed
install skipped it entirely. For a fully-indexed vault that is one array walk plus a
hash lookup per canvas — no reads, no parsing — which is noise against the ~30ms layout
pass, and it is the unavoidable cost of asking the question per canvas. The human's
"as long as performance holds" caveat is satisfied.

## Standards (iteration)

The refactor improved SRP and honesty simultaneously: `CanvasCapabilityDetector` now
answers one question about one canvas, the provider's regime state *is* its data
(no parallel flag to drift), and `fallbackServedCanvasPaths` is correctly a list with a
WHY explaining why a single verdict would be a lie. Comments explain WHY and WHY-NOT
throughout, with the measured 4-of-8 evidence cited where the decision rests on it.
