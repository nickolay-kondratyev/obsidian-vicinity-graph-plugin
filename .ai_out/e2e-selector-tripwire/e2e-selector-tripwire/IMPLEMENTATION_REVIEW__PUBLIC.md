# IMPLEMENTATION_REVIEW — PUBLIC

Ticket `nid_c5acy7gm7lj3afz0vtq79k8bx_e`, branch `e2e-selector-tripwire`.
Reviewed as committed (`b9c0d91`, `c17ca2e`, `571c730`). Tree left clean; every
mutation below was reverted (`git status --short` → empty).

## Verdict: **READY**

0 BLOCKING, 2 SHOULD-FIX (both cheap, neither undermines the AC), 1 NICE-TO-HAVE.
The implementation is sound: it does what the ticket asked, it is honest about its
limits, and my independent mutation reproduced the RED with a self-diagnosing message.

## Gate status (as committed, verified by me)

- `npm test` → **exit 0**, `Test Files 75 passed (75) / Tests 1003 passed (1003)`, 1.08s.
- `npm run check` → **exit 0** (`tsc -noEmit` + `check:e2e`).
- No `sanity_check.sh` in this repo.
- Guard cost: `npx vitest run e2e/selectorGuard.test.ts` → 13 tests, **6ms**. Does not
  slow the fast loop.
- `git diff main...HEAD --stat`: purely additive — one new file `e2e/selectorGuard.test.ts`
  plus `.ai_out/` docs. **No test removed, no anchor point touched, no `src/` change.**

## 1. Independent mutation (AC) — reproduced RED

I picked a **different class in a different file** than the implementer's transcript:
`vicinity-graph-group__label` in `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/view/FolderGroupNode.tsx:33`
(renamed `→ vicinity-graph-group__caption`, `.tsx` only, `graph-view.css:350` rule left intact).
Asserted at `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/e2e/vicinityGraph.e2e.ts:87`.

`npx vitest run e2e/selectorGuard.test.ts` → **exit=1**, verbatim:

```
 FAIL  e2e/selectorGuard.test.ts > e2e selector guard > WHEN an e2e source asserts an owned class THEN src/view still renders it
AssertionError: An e2e spec targets a .vicinity-graph-* class that src/view/ no longer renders —
`npm run test:e2e` would go red. Either restore the class in src/view/,
or update the e2e assertion to the class that replaced it.
A CSS rule alone does NOT count: only className/cls in .tsx/.ts renders a class.
If the class is asserted ABSENT on purpose, keep the assertion as a single chained
`expect(<locator>).toHaveCount(0)` on ONE line so this guard can exempt it.: expected [ Array(1) ] to deeply equal []

- []
+ [
+   "e2e/vicinityGraph.e2e.ts:87 asserts .vicinity-graph-group__label, rendered nowhere under src/view/",
+ ]
```

Names the class, the asserting `file:line`, and the remediation. AC met, independently.
Reverted via `git checkout -- src/view/`; re-run green.

## 2. Verdict on the `.css` deviation: **ACCEPT — the deviation is correct, the ticket wording was wrong**

Both halves of the implementer's claim verified empirically by me, not taken on trust.

**(a) A CSS-inclusive scan really would mask the mutation.** On the mutated tree
(`group__label` renamed in `.tsx`, CSS rule intact), a scan over `src/view/**` tokens:

```
MUTATED tree: group__label in render? False
MUTATED tree: group__label in css?    True
=> CSS-inclusive scan would MASK the mutation: True
```

So the ticket's literal wording ("`*.tsx` render code **or** `*.css`") would have produced
a guard that is **green on the ticket's own acceptance-criterion mutation**. Following the
written ticket here would have shipped a placebo.

**(b) No currently-asserted class is CSS-only.** Full scan of all 18 `e2e/*.ts` files vs
`src/view/**`:

```
distinct asserted classes (non-absence): 37
missing from render (.tsx/.ts):          []
CSS-only asserted (in css, not render):  []
asserted but in NEITHER:                 []
```

Zero false positives today. Also verified **no `vicinity-graph-*` producer exists anywhere
outside `src/view/`** (`grep -rl … src | grep -v '^src/view/'` → empty), so the `src/view`
scope adds no false positives either.

The trade-off (a class that only ever exists CSS-side would false-positive) is documented
honestly at `e2e/selectorGuard.test.ts:62-68` and again in the failure message
("A CSS rule alone does NOT count"). Honest, not overclaimed. **Deviation approved.**

## 3. False-negative / false-positive hunt

Tested, with results:

| Scenario | Result | Assessment |
|---|---|---|
| Class asserted via page-object / harness helper only (`obsidianHarness.ts`, `settingsTabPage.ts`) | **Caught** — scope is all `e2e/**/*.ts`, not just `*.e2e.ts` | Deviation from ticket in the safe direction. Good call. |
| Rename where old name is a prefix of new (`vicinity-graph-group` → `…group__wrap`) | **Caught** — comparison is exact `Set.has`, tokens are greedily whole | Sound. |
| Interpolated attribute value (`` `.vicinity-graph-node[data-path="${p}"]` ``) | **Handled** — static class prefix extracted | Sound; unit-tested. |
| Class removed from `.tsx` but still named in a **comment** under `src/view` | **NOT caught** (verified: exit=0) | Real gap → SHOULD-FIX #2. |
| Class present only in a `src/view/*.test.ts` | **NOT caught** by construction (`.ts` glob includes test files); zero occurrences today | Real gap → SHOULD-FIX #2. |
| e2e selector with interpolated class **tail** (`.vicinity-graph-node--${tier}`) | **Spurious RED** — extracts truncated `vicinity-graph-node--` | Real false-positive vector → SHOULD-FIX #1. |
| e2e selector with fully interpolated name (`.vicinity-graph-${kind}`) | Silently skipped (no match) | Acceptable tripwire limit; zero occurrences today. |
| Split (multi-line) absence assertion | Fails LOUD with remediation | Verified — see §4. |

## 4. Absence-exemption honesty — claim VERIFIED

I rewrote `e2e/vicinityGraph.e2e.ts:178` into the split shape
(`const breadcrumbs = page.locator(".vicinity-graph-node__breadcrumb");` then
`await expect(breadcrumbs).toHaveCount(0);`) and ran the guard: **exit=1**, offender
`"e2e/vicinityGraph.e2e.ts:178 asserts .vicinity-graph-node__breadcrumb, rendered nowhere
under src/view/"`, with the remediation block's last two lines telling the reader to
re-chain onto one line. Reverted.

**Pragmatic judgement: acceptable.** The failure is loud, points at the exact line, and
the remedy (re-chain) is a one-line mechanical edit that matches the repo's existing 100%
dominant style. It does not introduce a new marker-comment convention. It is not annoying
enough to motivate disabling the guard. Loud-and-wrong beats silent-and-wrong here.

## 5. Overclaim check — PASS

`e2e/selectorGuard.test.ts:17-24` states the limits the ticket required, in spirit and
almost verbatim: not text/DOM-structure drift (explicitly naming the `solo/` title-prefix
half of `998fdac`), not runtime presence, not attribute/`hasText` targeting, and "it is a
tripwire, **NOT** a substitute for the release gate". No overclaim found.

## 6. CLAUDE.md conformance — PASS

- BDD `WHEN … THEN …` on all 13 tests; one behavior per test.
- Named constants throughout; `OWNED_CLASS_PREFIX` is the single source both regexes derive
  from (no duplicated magic string) — DRY at the knowledge level.
- Small focused functions (`sourceFilesUnder`, `assertedClassesOnLine`,
  `assertedSelectorClassesIn`, `renderedClassesIn`), each with one job (SRP).
- `AssertedSelectorClass` interface instead of a tuple/`Pair` — matches "be classy".
- Matches prior art: `offenders` array + `expect(offenders).toEqual([])`, self-exclusion by
  basename, plain `node:fs` (no glob dep), a matcher `describe` block unit-testing the
  extractor — mirrors both `e2e/vaultTarget.test.ts` and `src/engine/importGuard.test.ts`.
- `import * as fs` convention respected (and `vaultTarget.test.ts`'s guard enforces it —
  it caught the implementer's first draft; they complied rather than weakening the guard,
  which is the right instinct).
- Comments explain WHY (the dot asymmetry trap, why CSS is excluded, why the file
  self-excludes), not WHAT. Strict TS clean.

## 🚨 BLOCKING

None.

## ⚠️ SHOULD-FIX

### S1. Interpolated class *tail* produces a truncated token → spurious RED
`SELECTOR_CLASS_PATTERN` (`e2e/selectorGuard.test.ts:35`) greedily consumes `-`, so a future
selector like `` `.vicinity-graph-node--${tier}` `` yields the token
`vicinity-graph-node--`, which exists nowhere and is reported as a strand. Verified:

```
".vicinity-graph-node--${tier}" => [".vicinity-graph-node--"]
".vicinity-graph-${kind}"       => []
```

Zero occurrences today, but modifier classes DO exist in `src/view`
(`vicinity-graph-node--pinned` appears in the guard's own fixture at line 204), so this is a
plausible next e2e selector shape. A confusing spurious red on an unrelated PR is exactly
what gets a tripwire disabled.

**Fix (≈1 line + 1 matcher test):** in `assertedClassesOnLine`, drop matches whose token
ends in `-` (i.e. an interpolation boundary), and note in the doc block that a class name
built by interpolation is invisible to the scan.

### S2. A class name surviving only in a COMMENT (or in a `src/view/*.test.ts`) counts as "rendered"
Verified false negative: with `group__label` renamed in `FolderGroupNode.tsx`, adding
`// legacy: vicinity-graph-group__label was removed in favor of caption` to
`src/view/NoteNode.tsx` turned the guard **green (exit=0, 13 passed)**.

This is more realistic than it looks: CLAUDE.md actively encourages WHY-NOT comments that
name what was removed — the exact commit shape this guard exists to catch is the one most
likely to leave such a comment behind. Same mechanism applies to `src/view/*.test.ts`
(the `.ts` render glob does not exclude test files; 34 such files exist, none currently
naming an owned class).

**Fix (cheap, two parts):**
1. Exclude `*.test.ts` / `*.test.tsx` from `sourceFilesUnder(VIEW_DIR, …)` — strictly
   stronger, zero cost today.
2. Add one bullet to the "WHAT IT DOES NOT CATCH" block: *a class name surviving only in a
   comment satisfies this scan* (it is a text scan, not a parse). Documenting it is enough;
   parsing is not worth the complexity (80/20).

## 💡 NICE-TO-HAVE

- `e2e/selectorGuard.test.ts:65` says "all 39 e2e-asserted classes appear in render code".
  39 is the count **including** absence-only tokens, one of which
  (`vicinity-graph-node__breadcrumb`) deliberately does NOT appear in render code. The
  non-exempt set is 37, and all 37 do appear. Either say 37 or drop the number (counts rot).

## Documentation Updates Needed

None required. CLAUDE.md's Commands line already covers `e2e/**/*.test.ts` harness guards
and remains accurate; adding a named mention of this guard would fight the "keep CLAUDE.md
succinct" rule. TOP_LEVEL_AGENT still owns the `change_log` entry and closing the ticket.
