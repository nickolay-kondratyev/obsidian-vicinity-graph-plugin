# IMPLEMENTATION_ITERATION — PUBLIC

Ticket `nid_c5acy7gm7lj3afz0vtq79k8bx_e`, branch `e2e-selector-tripwire`.
Responding to `IMPLEMENTATION_REVIEW__PUBLIC.md` (verdict READY, 0 BLOCKING,
2 SHOULD-FIX, 1 NICE-TO-HAVE). One commit: `6344134`. Only file changed:
`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/e2e/selectorGuard.test.ts`.
No `src/` change, no test weakened or removed, tree clean.

## Disposition

### S1 — interpolated class tail → spurious RED: **INCORPORATED**

`SELECTOR_CLASS_PATTERN` now ends with an optional capture of the interpolation
opener — `` `\\.vicinity-graph-[\w-]+(\$\{)?` `` — and `assertedClassesOnLine`
drops any match whose `INTERPOLATION_BOUNDARY_GROUP` is defined. A token that ends
*at* an interpolation boundary is a truncated PREFIX of a runtime-assembled name,
not a class anyone renders, so it is skipped.

**Why the boundary capture and not the reviewer's suggested "token ends in `-`":**
the capture is strictly more precise. It also catches `` `.vicinity-graph-node${suffix}` ``
(no trailing `-`), which the ends-in-`-` rule would still mis-report. I rejected
the obvious regex-lookahead spelling (`(?!\$\{)`) because backtracking defeats it:
the greedy tail simply gives back the final `-` and matches
`vicinity-graph-node-` — a *differently* wrong token. Verified before choosing.

Documented as an explicit limit in the file's "WHAT IT DOES NOT CATCH" block:
class names assembled by interpolation, on **either** side, are NOT checked.

Tests added (2): a pure interpolated-tail line extracts `[]`; an interpolated
class sharing a line with a complete one yields only the complete one.

### S2 — comment / unit-test masking: **INCORPORATED, with one deliberate sub-part narrowed**

**(a) Unit-test files — fully incorporated.** `UNIT_TEST_FILE_SUFFIXES`
(`.test.ts`, `.test.tsx`) + `isUnitTestFile`; render sources are filtered by it.
A `src/view` unit test *asserts* a class, it does not *render* one.

**(b) Comments — incorporated as the cheap correct subset, not a parser.**
`renderedClassesIn` strips block comments (`/\*[\s\S]*?\*/`) and **whole-line**
`//` comments (`/^[ \t]*\/\/.*$/gm`) before scanning. Mid-line trailing `//` is
deliberately NOT stripped, and this is argued rather than overlooked:

> `//` occurs in real non-comment code under `src/view`. Concretely,
> `src/view/testFixtures/graphFixtures.ts:14` contains `.replace(/^.*\//, "")` —
> a regex literal whose `\//` a naive mid-line strip would treat as a comment
> start, truncating the rest of the line. Truncating real code on the *render*
> side removes classes from the rendered set, i.e. produces exactly the spurious
> RED that S1 exists to eliminate. Trading a rare false-GREEN for a recurring
> false-RED is a bad trade for a tripwire.

Whole-line and block forms cover the realistic masking shape (the reviewer's own
repro was a whole-line `//`, and CLAUDE.md-encouraged WHY-NOT prose is usually a
JSDoc block or its own line). The residual gap is stated in "WHAT IT DOES NOT
CATCH". This is a text scan, and it now says so precisely.

**Measured cost of both parts: zero.** Distinct owned classes under `src/view`:
74 raw, 74 after excluding test files, 74 after comment stripping. Strictly
stronger, no false positives introduced.

Tests added (5): class only in a whole-line comment → not rendered; class only in
a block comment → not rendered; trailing comment after real code → the rendered
class still counts (pins the documented limit); `isUnitTestFile` true for
`NoteNode.test.tsx`, false for `NoteNode.tsx`.

### NICE-TO-HAVE — stale count "39": **INCORPORATED**
Replaced with "every non-exempt e2e-asserted class"; counts rot. Also declined to
put a file count in the new `UNIT_TEST_FILE_SUFFIXES` doc for the same reason.

## VERIFICATION — actually re-run, verbatim

Guard alone: **20 tests, 3 ms** (was 13 tests / 6 ms). Still milliseconds.

### MUTATION-A — the ticket's AC. `vicinity-graph-node__title` → `__heading` in `src/view/NoteNode.tsx` only; `graph-view.css` keeps 2 matching rules.

`npm test` → **exit=1**

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  e2e/selectorGuard.test.ts > e2e selector guard > WHEN an e2e source asserts an owned class THEN src/view still renders it
AssertionError: An e2e spec targets a .vicinity-graph-* class that src/view/ no longer renders —
`npm run test:e2e` would go red. Either restore the class in src/view/,
or update the e2e assertion to the class that replaced it.
A CSS rule alone does NOT count: only className/cls in .tsx/.ts renders a class.
If the class is asserted ABSENT on purpose, keep the assertion as a single chained
`expect(<locator>).toHaveCount(0)` on ONE line so this guard can exempt it.: expected [ …(3) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "e2e/vicinityGraph.e2e.ts:82 asserts .vicinity-graph-node__title, rendered nowhere under src/view/",
+   "e2e/vicinityGraph.e2e.ts:106 asserts .vicinity-graph-node__title, rendered nowhere under src/view/",
+   "e2e/vicinityGraph.e2e.ts:189 asserts .vicinity-graph-node__title, rendered nowhere under src/view/",
+ ]

 ❯ e2e/selectorGuard.test.ts:185:43
```

Class named, asserting `file:line` named, remediation given. AC re-verified.

### MUTATION-B — S2 regression: MUTATION-A **plus** the reviewer's masking comment prepended to `NoteNode.tsx`

`// legacy: vicinity-graph-node__title was removed in favor of heading`

```
MUTATION-B (comment masking) exit=1
+   "e2e/vicinityGraph.e2e.ts:82 asserts .vicinity-graph-node__title, rendered nowhere under src/view/",
+   "e2e/vicinityGraph.e2e.ts:106 asserts .vicinity-graph-node__title, rendered nowhere under src/view/",
+   "e2e/vicinityGraph.e2e.ts:189 asserts .vicinity-graph-node__title, rendered nowhere under src/view/",
      Tests  1 failed | 19 passed (20)
```

The reviewer measured **exit=0 / 13 passed** for this exact shape. Gap closed.

### MUTATION-C — S2 regression: B **plus** `const stale = "vicinity-graph-node__title";` in `src/view/GraphViewController.test.ts`

```
MUTATION-C (test-file masking) exit=1
3          # offender lines still reported
```

Reverted: `git checkout -- src/view/` → `git status --short src/view/` empty.

### MUTATION-D — S1 false-positive, on the real corpus. Interpolated-tail selector appended to `e2e/vicinityGraph.e2e.ts`

`` const probe = (tier: string) => `.vicinity-graph-node--${tier}`; ``

```
MUTATION-D (interpolated tail, expect GREEN) exit=0
      Tests  20 passed (20)
```

And the same probe against the **pre-fix** guard (restored from git), proving the
fix is load-bearing rather than decorative:

```
PRE-FIX guard + interpolated tail exit=1
+   "e2e/vicinityGraph.e2e.ts:276 asserts .vicinity-graph-node--, rendered nowhere under src/view/",
```

### Reverted tree — both gates GREEN

```
REVERTED npm test exit=0
 Test Files  75 passed (75)
      Tests  1010 passed (1010)
   Duration  1.08s (transform 9.14s, setup 0ms, import 14.36s, tests 1.52s, environment 5ms)
REVERTED npm check exit=0
```

1010 = the previous 1003 + 7 new matcher tests. No prior test lost.
`npm run check` output:

```
> vicinity-graph@0.1.1 check
> tsc -noEmit && npm run check:e2e

> vicinity-graph@0.1.1 check:e2e
> tsc -noEmit -p e2e/tsconfig.json
```

`git status --short` → only the `.ai_out/` review docs (untracked, not mine).
No residual mutation under `src/` or `e2e/`.

## Constraints honoured

- No existing test weakened or deleted — including the guard's own cases and
  `e2e/vaultTarget.test.ts`'s destructive-call guard (the `import * as fs` form
  is untouched; that guard passes in every run above).
- No `npm run test:e2e`. No `change_log` entry. No ticket created or closed.
- No `src/` change; every mutation reverted.

## Readiness

**READY.** Both SHOULD-FIX findings addressed, S2(b) narrowed with a stated
technical rationale rather than silently. Acceptance criteria re-verified by
mutation on the current tree, both gates green, guard cost unchanged at ~3 ms.
Nothing outstanding from my side; TOP_LEVEL_AGENT still owns the `change_log`
entry and closing the ticket.
