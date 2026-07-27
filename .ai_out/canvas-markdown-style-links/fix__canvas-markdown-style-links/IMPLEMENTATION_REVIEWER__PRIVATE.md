# Reviewer rehydration memory — canvas markdown-style links

Branch `fix/canvas-markdown-style-links` (commit `977d029`), reviewed vs `main`.

## What I actually did
- Read `EXPLORATION_PUBLIC.md`, `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md`, both tickets
  (`nid_ygo7h95ssgmunaqsprc1zlmfh_e`, new `nid_869bt9d9rlrbr8of1403dnmf3_e`), full
  `git diff main...HEAD` (477 lines, saved `.tmp/rev-diff.txt`).
- Ran `npm test` → 82 files / 1137 tests pass, exit 0 (`.tmp/rev-test.log`).
- Ran `npm run check` → exit 0 (`.tmp/rev-check.log`).
- Reimplemented the matcher standalone in `.tmp/probe.mjs` and probed ~35 adversarial
  inputs (wikilink adjacency, escaped brackets, parens in destination, unencoded space,
  angle wrapping, schemes, `//`, `%2F`, `%3A`, `%23`, code span, relative/absolute paths).

## Probe conclusions (verified, not assumed)
- No phantom match on `[[a]](x)`, `![[pic.png]]`, `[a] (b.md)`, `- [ ] task (x)`, `[a][ref]`,
  `[a](note (1).md)` (parens in destination just do not match — no partial garbage).
- Order of operations in code IS as documented: unwrap `<>`/drop title → external verdict →
  `#`/`?` strip → `decodeURIComponent` (try/catch) → trim. `%3A`/`%23` tests are honest.
- Two genuine over/under-matches found: unencoded space `[a](my note.md)` → `"my"` (phantom
  risk), escaped `\[x\](y.md)` → `y.md`. Leading `/` and `./ ../` destinations pass through
  verbatim into `getFirstLinkpathDest`.

## Verdict issued
READY, with 2 SHOULD-FIX (unverified core-indexing premise; whitespace-truncation phantom)
and 2 NICE-TO-HAVE. No BLOCKING. No behavior-capturing test removed (only one test NAME
corrected in `CanvasFallbackParser.test.ts`); `src/shared/` purity still guarded by
`src/engine/importGuard.test.ts` (it guards `src/shared` too).

## If asked to re-review
The load-bearing open question is the premise: does real Obsidian core actually index
`[label](note.md)` inside a canvas TEXT node, and under the decoded resolved path? The
core-indexed side of the parity test is hand-seeded `resolvedLinks`, so no unit test can
falsify it. Only devtools/e2e can. — **ANSWERED in round 2: YES.**

---

# Round 2 (convergence check) — `da0d6a6` vs `4af8dfa`

## What I did
- Ran `npm test` → 82 files / **1139** tests, exit 0 (`.tmp/r2-test.log`); `npm run check`
  → exit 0 (`.tmp/r2-check.log`). +2 tests vs round 1 = exactly the two added.
- Compiled the REAL `MarkdownInlineLinks.ts` with esbuild and probed 20 inputs
  (`.tmp/probe2.mjs`) — not a reimplementation this time.
- Read `e2e/canvasMarkdownLinkIndexing.e2e.ts`, `e2e/playwright.config.ts`,
  `prepareVaultCopy` in `e2e/obsidianHarness.ts`; corroborated the claimed e2e run against
  the leftover artifact `.tmp/e2e-canvas-md2.txt` (5 passed, raw observation printed).
- Did NOT run `npm run test:e2e` (real Obsidian, slow) — no reason to doubt.

## Conclusions
- Finding 2 fixed and does NOT over-correct: titles (both quote styles), `<…>`-wrapped
  destinations with spaces, embeds, multi-link lines all intact; angle-hatch has its own
  test at `MarkdownInlineLinks.test.ts:26`, so the new rule cannot silently swallow it.
- Finding 1 genuinely measured. Spec is not self-fulfilling: fixtures are inputs, assertions
  read core's own output. Observed counts are self-checking (`target.md`:4 = plain+`./`+`../`+
  titled; `spaced target.md`:1 = only the `%20` one), which is what proves the unencoded-space
  destination contributed nothing. Spec runs in the release gate (`testMatch **/*.e2e.ts`),
  uses the established `extraFixtures` pattern, harness guards untouched.
- Findings 3 & 4 incorporated (header now exhaustive OVER/UNDER-match; relative paths
  measured, no normalisation added — correct restraint).
- No regressions: no test removed/weakened, `src/shared/` purity intact, no anchor touched.

## Verdict issued
**READY.** One optional suggestion only: e2e test 3 asserts only that the bait key is absent;
the plan doc's "unencoded space produces nothing" leans on the observed count, so
`expect(links[SPACED_TARGET_PATH]).toBe(1)` would pin it against a future lenient core.
Failure mode it guards is a MISSING edge, not a wrong one — hence non-blocking.
