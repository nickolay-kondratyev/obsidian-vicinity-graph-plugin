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
falsify it. Only devtools/e2e can.
