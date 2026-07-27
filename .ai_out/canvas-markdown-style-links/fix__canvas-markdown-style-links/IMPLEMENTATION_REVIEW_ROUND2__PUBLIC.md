# Implementation review — ROUND 2 (convergence check) — canvas markdown-style links

Branch `fix/canvas-markdown-style-links` @ `da0d6a6` vs round-1 tip `4af8dfa`.
Scope: verify the two round-1 SHOULD-FIX findings are genuinely resolved and the
iteration introduced no regressions. Not a fresh full review.

## Summary

Iteration diff is small and on-target: 35 lines in `src/shared/MarkdownInlineLinks.ts`,
2 new BDD tests, a new real-Obsidian spec `e2e/canvasMarkdownLinkIndexing.e2e.ts`, and
plan-doc/module-header honesty updates. All four round-1 findings (2 SHOULD-FIX,
2 NICE-TO-HAVE) are incorporated. **No new issues of any severity.**

### Verification (run independently, not taken on trust)
- `npm test` → **exit 0**, 82 files / **1139** tests (`.tmp/r2-test.log`). +2 vs round 1,
  matching the two added matcher tests. No test removed, none weakened.
- `npm run check` → **exit 0** (`.tmp/r2-check.log`), both `src/` and `e2e/` passes.
- Matcher re-probed standalone against 20 adversarial inputs (`.tmp/probe2.mjs`, built
  from the real module via esbuild — not a reimplementation this time).

## Finding 2 (phantom edge) — RESOLVED, and it did not over-correct

`destinationOf` now returns `""` when the whitespace suffix does not open a title
(`TITLE_START = /^\s+["'(]/`). Probed against the compiled module:

| input | result | verdict |
|---|---|---|
| `[a](my note.md)` | `[]` | fixed — no phantom `my` |
| `![alt](my pic.png)` | `[]` | embeds follow the same rule |
| `[a](note.md "Title")` | `["note.md"]` | intact |
| `[a](note.md 'Title')` | `["note.md"]` | intact (new test) |
| `[a](note.md<TAB>"T")`, `[a](note.md   "T")` | `["note.md"]` | intact |
| `[a](<my note.md>)`, `[a](<my note.md> "T")` | `["my note.md"]` | escape hatch intact |
| `[a](  note.md  )` | `["note.md"]` | outer trim happens before the rule — intact |
| `[a](note.md "T") and [b](other note.md) and [c](c.md)` | `["note.md","c.md"]` | one bad link does not poison the scan |

The angle-bracket escape hatch (`[a](<my note.md>)`) has its own pre-existing test at
`src/shared/MarkdownInlineLinks.test.ts:26`, so the new rule cannot silently swallow it
later. `[a](note.md #frag)` → `[]` is correct: a space before `#` is a bare-destination
space, and CommonMark agrees it is not a link.

The rule is the one I proposed, the code comment states WHY in terms of the failure mode
("a wrong edge is worse than a missing one"), and the new test carries that reasoning.

## Finding 1 (unverified premise) — RESOLVED; the spec is a real observation

`e2e/canvasMarkdownLinkIndexing.e2e.ts` is **not** self-fulfilling. The fixtures are
INPUTS (a canvas text node the spec writes); every assertion reads core's own output out
of the live app (`app.metadataCache.resolvedLinks`, `app.metadataCache.getFirstLinkpathDest`).
Nothing in the plugin participates.

Corroborated the claimed run against the artifact left behind (`.tmp/e2e-canvas-md2.txt`):
5 passed against real Obsidian, with the raw observation printed —

```
resolvedLinks[md-links/board.canvas]={"md-links/target.md":4,"md-links/spaced target.md":1}
getFirstLinkpathDest=["md-links/target.md","md-links/target.md","md-links/target.md","md-links/spaced target.md"]
```

Those numbers are internally self-checking, which is what convinces me it is measured
rather than narrated: `4` is exactly plain + `./` + `../` + titled, and `1` is exactly the
`%20` link — i.e. the unencoded-space destination contributed nothing. Premise confirmed;
the change is a fix, not an inversion.

Harness placement is correct: `e2e/playwright.config.ts` has `testDir: "."`,
`testMatch: "**/*.e2e.ts"`, so the spec runs in the `npm run test:e2e` release gate with no
config change. `extraFixtures` is the established per-launch pattern (`edgeRouting`,
`controlsRestart`, `pinnedCentralScenario`), `prepareVaultCopy` mkdirs the `md-links/`
subfolder, and the throwaway-copy guards in `vaultTarget.test.ts` / `vaultCopyReseed.test.ts`
still pass under `npm test` (they scan the harness source, which was not touched). The
`window as unknown as { app: any }` casts match the existing e2e convention.

The bait note `md-links/spaced.md` is a genuinely good touch: a truncating implementation
would betray itself against real core rather than against a fixture.

## 🚨 CRITICAL Issues

None.

## ⚠️ IMPORTANT Issues

None.

## 💡 Suggestions

### 1. NICE-TO-HAVE — pin the observation the plan doc actually leans on

The doc states "an unencoded space … produce[s] nothing". That claim rests on the observed
count `"md-links/spaced target.md": 1`, but no assertion pins the count. The two live tests
cannot distinguish "core skipped the unencoded destination" from "core leniently resolved it
to the same file that `%20` already contributed" — both keys would look identical. If a
future Obsidian became lenient, the spec would stay green while the fallback silently
began UNDER-matching. One line closes it, in
`e2e/canvasMarkdownLinkIndexing.e2e.ts` test 3:

```ts
expect(links[SPACED_TARGET_PATH]).toBe(1); // only the %20 link; the unencoded one is no link
```

Not blocking — the observation itself is sound today, and the failure mode this would guard
is a missing edge, not a wrong one.

## Documentation Updates Needed

None outstanding. Checked line by line:
- Plan doc now separates MEASURED from assumed, records the raw `resolvedLinks` shape, states
  that the unit parity tests hand-seed the `core-indexed` side, and replaces the stale
  "verify in devtools" line with the answer — including the honest scoping "whether an OLDER
  install does is unknown".
- Module header now splits known gaps into OVER-match (code spans, escaped brackets) vs
  UNDER-match (brackets in label, parens in destination) — finding 3 done, and the header is
  now exhaustive rather than only listing under-matches.
- Finding 4 answered by measurement (`./`, `../` accepted verbatim by `getFirstLinkpathDest`),
  recorded in the header with a pointer to the spec that proves it, and no speculative path
  normalisation was added — correct restraint.

## Regression check on the iteration diff

- `src/shared/` purity unchanged; no new imports, `src/engine/importGuard.test.ts` still green.
- No behaviour-capturing test removed or weakened; only additions.
- No anchor point (`ap_XXX_E`) touched.
- Layering untouched — the e2e spec lives in `e2e/`, not in `src/`, and the matcher stays pure.
- DRY/SRP unchanged: the new rule is one named constant plus one branch in the method that
  already owned that decision.

## Verdict

**READY** — both round-1 SHOULD-FIX findings are genuinely resolved (one by a correct,
test-covered code change; one by a real measurement against Obsidian 1.12.7), both
NICE-TO-HAVEs are incorporated, and the iteration introduced no regressions. The single
remaining suggestion is optional.
