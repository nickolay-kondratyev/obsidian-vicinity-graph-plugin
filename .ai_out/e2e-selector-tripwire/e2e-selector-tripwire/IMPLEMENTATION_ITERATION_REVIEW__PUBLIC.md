# IMPLEMENTATION_ITERATION_REVIEW — PUBLIC

Scoped confirmation pass over `git diff 571c730..HEAD -- e2e/selectorGuard.test.ts`
(commits `6344134`, `a1fa304`). The base review's verdict on the file as a whole
(READY, `.tsx`-only producer scan endorsed) is settled and NOT re-opened here.

**VERDICT: READY. 0 BLOCKING. Probe 1 found NO false-GREEN hole on any real-world
selector shape** — only a contrived shape that does not exist in the corpus and
that nobody would write here (detailed below, informational only).

---

## 1. S1 — interpolation-boundary skip: correct, and it does not open a hole

The change is `` `\\.vicinity-graph-[\w-]+(\$\{)?` `` plus a filter dropping matches
whose group 1 is defined.

**Shape probe** (`node`, matcher logic reproduced independently):

| Selector shape | extracted | correct? |
|---|---|---|
| `` `.vicinity-graph-node .${x}` `` | `["vicinity-graph-node"]` | ✅ complete class kept |
| `` `.vicinity-graph-node[data-path="${path}"]` `` | `["vicinity-graph-node"]` | ✅ **this is the corpus's actual shape** |
| `` `.vicinity-graph-node--${tier}` `` | `[]` | ✅ truncated prefix skipped (S1 fixed) |
| `` `.vicinity-graph-flow${suffix}` `` | `[]` | ✅ prefix of a runtime-assembled name |
| `` `.vicinity-graph-node${a} .vicinity-graph-edge` `` | `["vicinity-graph-edge"]` | ✅ neighbour still caught |
| `` ".vicinity-graph-node", `.vicinity-graph-x--${k}` `` | `["vicinity-graph-node"]` | ✅ no cross-contamination |

**Differential on the real corpus** — I ran the OLD and NEW patterns over every
`e2e/**/*.ts` line and diffed the token sets. The new pattern drops exactly 4
tokens, all of them `.vicinity-graph-node--` (the truncated prefix), all on the
guard file's own doc/test lines. **Zero legitimate class names are dropped
anywhere in the repository.** Note the guard scans its own file, so without this
fix the doc comment the implementer added would itself have gone RED — the fix is
load-bearing, not cosmetic.

**The one theoretical false-GREEN** (informational, not a finding to fix): a
selector where the interpolation contributes a *non-class* suffix immediately
after a complete class, e.g. `` `.vicinity-graph-node${":nth-child(2)"}` `` or
`` `.vicinity-graph-node${scope}` `` with `scope = " .child"`. There the class is
real and is now skipped. This shape occurs **zero** times in `e2e/`; every real
interpolated selector in the corpus puts the interpolation inside an attribute
predicate (`[data-path="${path}"]`, `[data-folder="${folder}"]`,
`[data-kind="${kind}"]`), which the new pattern handles correctly. The tradeoff is
sound: the eliminated false-RED is a shape that occurs today; the introduced
false-GREEN is a shape that does not, and is unnatural CSS-in-template style.
No action needed.

The reviewer's suggested "drop tokens ending in `-`" would have been strictly
weaker (misses `` `.vicinity-graph-node${suffix}` ``); the implementer's rejection
of the `(?!\$\{)` lookahead on backtracking grounds is correct — the greedy tail
gives back the final `-` and yields a differently-wrong token.

## 2. S2 — comment stripping: predecessor's masking probe now goes RED

Re-ran the predecessor's exact repro on the current tree: mutated
`vicinity-graph-group__label` → `__caption` in `src/view/FolderGroupNode.tsx`, then
prepended `// legacy: vicinity-graph-group__label was replaced by the caption` to
`src/view/NoteNode.tsx`.

```
MASK-PROBE(whole-line comment) exit=1
+   "e2e/vicinityGraph.e2e.ts:87 asserts .vicinity-graph-group__label, rendered nowhere under src/view/",
      Tests  1 failed | 19 passed (20)
```

Predecessor measured **exit=0** for this shape. Gap closed, offender line named.

**The mid-line carve-out is real and honestly documented, not hidden.** I probed
it deliberately — `const x = 1; // legacy: vicinity-graph-group__label …` still
masks (`exit=0`). That is exactly what the file's "WHAT IT DOES NOT CATCH" block
states verbatim (lines 26–29), with the WHY. The stated rationale is factual:
`src/view/testFixtures/graphFixtures.ts:14` really contains
`.replace(/^.*\//, "")`, and that file is a scanned render source (not a
`*.test.ts`), so a naive mid-line strip would truncate live code. Trading a rare
false-GREEN for a recurring false-RED in a tripwire is the right call and it is
argued in the code rather than glossed over.

## 3. `*.test.ts(x)` render-source exclusion: excludes nothing real

34 of 94 `src/view` files are excluded. I scanned every excluded file for
`vicinity-graph-*` tokens: **none contains an owned class**. Measured class sets:

```
raw (all files, no comment strip) = 74 distinct owned classes
final (tests excluded + comments stripped) = 74
lost vs raw: []
```

Zero cost, strictly stronger. `isUnitTestFile` is suffix-based on the full path;
`testFixtures/graphFixtures.ts` correctly stays IN the render set.

## 4. Gates, regression, cost

```
npm test        exit=0   Test Files 75 passed (75)   Tests 1010 passed (1010)   1.12s
npm run check   exit=0
guard alone     exit=0   20 passed, tests 3ms
```

1010 = the prior 1003 + 7 new matcher tests. The delta contains **no removed
`it(`/`describe(`/`expect(`** — verified by grepping deletions in the diff. No
behaviour-capturing test weakened, no anchor point touched. No `src/` change. Guard
cost unchanged at ~3 ms.

## 🚨 CRITICAL Issues
None.

## ⚠️ IMPORTANT Issues
None.

## 💡 Suggestions
None worth the churn. The two documented limits (mid-line `//`, interpolated class
names on either side) are both stated in the file's "WHAT IT DOES NOT CATCH" block,
which is the right place for them.

## Documentation Updates Needed
None. `TOP_LEVEL_AGENT` still owns the `change_log` entry and closing the ticket.

---

Tree left CLEAN (`git status --short` empty). All probes reverted via
`git checkout -- src/view/`.
