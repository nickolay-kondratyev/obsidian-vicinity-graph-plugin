# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC

Ticket `nid_c5acy7gm7lj3afz0vtq79k8bx_e`. **DONE.** Acceptance criteria verified by
actually running the mutation (verbatim output below).

## Deliverable

**`e2e/selectorGuard.test.ts`** (new, 190 lines) — the only production file touched.
Runs inside `npm test` via the existing `e2e/**/*.test.ts` vitest include; typechecked
by the existing `e2e/tsconfig.json` `./**/*.ts` include. **No config edits were needed.**

13 tests, ~6ms. Two `describe` blocks, mirroring `src/engine/importGuard.test.ts`:
the guard itself (2 vacuity tests + the scan) and a matcher block unit-testing every
selector shape EXPLORATION inventoried (plain literal, interpolated attribute value,
compound owned+foreign, multi-owned chain, tag-qualified, absence, non-zero count).

## Design decisions

### Scope: all `e2e/**/*.ts`, not just `*.e2e.ts`
Followed the TOP_LEVEL_AGENT direction. `obsidianHarness.ts:280` and
`settingsTabPage.ts:38,57,62,67` hold live selector literals; scanning only `*.e2e.ts`
would mean **centralizing a selector into a page object silently disables the guard for
it**. Today every helper-held class is redundantly present in some `*.e2e.ts`, so this
costs nothing now and closes a latent hole. Self-excluded by filename
(`SELF_FILE_NAME`) — the matcher fixtures name classes on purpose, exactly as
`vaultTarget.test.ts` excludes itself.

### The dot asymmetry
Two distinct regexes, both derived from one `OWNED_CLASS_PREFIX` constant (no duplicated
magic string). e2e side **requires** the leading `.` (the dot is what makes a string a
selector rather than prose) then strips it; src side matches **dotless** (`className=`,
Obsidian `{ cls: … }`). Comparison is on bare names. Getting this backwards yields three
spurious "missing" classes — the trap is called out in a comment on the constant.

### CSS is deliberately NOT a producer — a correction I made mid-task
My first cut accepted a `.css` rule as proof the class exists (that is what the ticket's
wording suggests: "`*.tsx` render code **or** `*.css`"). **Mutation testing proved that
wording is wrong**: renaming `vicinity-graph-node__title` in `NoteNode.tsx` while
`graph-view.css` kept its rule left `npm test` **GREEN** — the guard failed the ticket's
own acceptance criterion ("rename one class in `src/view/*.tsx` and observe the
failure"). A stylesheet rule renders nothing.

Producers are now `.tsx`/`.ts` only. **Verified this costs zero false positives**: of the
39 distinct classes the e2e suite asserts, every one appears in render code; not a single
one is CSS-only. Strictly stronger, no downside. Commit `c17ca2e` records the reasoning.

### Absence exemption: line-scoped `toHaveCount(0)`, zero new convention
EXPLORATION verified every `toHaveCount(0)` in the repo is a single chained
`expect(page.locator(SELECTOR)).toHaveCount(0)` on one line, so no cross-statement
analysis is needed and **no marker-comment convention was introduced**. Honest limits,
stated in the file's own doc block:

- **A split absence assertion** (locator in a variable, asserted on a later line) is NOT
  exempted → the scan fails **LOUD**, naming the file:line, and `OFFENDER_REMEDIATION`
  explicitly tells the reader to re-chain it onto one line. It never mis-handles this
  *silently*, which was the reviewer's actual concern.
- **A presence-asserted class sharing a line with an absence assertion** is exempted too.
  Narrow, and it only ever UNDER-reports (never a false red).

This is a line-level text check, not a half-parser.

### Failure message
`expect(offenders, OFFENDER_REMEDIATION).toEqual([])`. Each offender is a sentence
carrying the asserting **file:line** and the **class**; the vitest message argument
carries the remediation (restore in src/view, or update the e2e spec, plus the CSS and
absence-assertion caveats). See verbatim output below — it is self-diagnosing.

## Stated known limits (in the test file's own docs, per the ticket)

Catches "the e2e asserts a **selector** src no longer produces". Does NOT catch:
text/DOM-structure drift (`toHaveText("solo/Gamma")` — the other half of the same
`998fdac` failure); whether the class reaches the DOM at runtime (dead render code
satisfies it); attribute selectors and `hasText` filters. It is a tripwire, **not** a
substitute for `npm run test:e2e`.

## VERIFICATION — actually run, verbatim

### Mutation (the ticket's AC): rename `vicinity-graph-node__title` → `__heading` in `src/view/NoteNode.tsx` ONLY

`npm test` → **exit=1**

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  e2e/selectorGuard.test.ts > e2e selector guard > WHEN an e2e source asserts an owned class THEN src/view still renders it
AssertionError: An e2e spec targets a .vicinity-graph-* class that src/view/ no longer produces —
`npm run test:e2e` would go red. Either restore the class in src/view/,
or update the e2e assertion to the class that replaced it.
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

 ❯ e2e/selectorGuard.test.ts:144:43
```

(The `no longer produces` wording in that capture was changed to `no longer renders` and
a CSS caveat line added in the same commit, immediately after this run. The behavior
shown is otherwise final.)

### Earlier mutation proving the CSS decision
Same `.tsx` rename with `graph-view.css` left intact, while `.css` was still a producer:
`MUTATION-B vitest exit=0`, `Test Files 1 passed (1) / Tests 13 passed (13)` — i.e.
**green, guard blind**. This is what drove commit `c17ca2e`.

### Reverted (`git checkout -- src/view/`) — GREEN

```
src/view mutation reverted:
 M e2e/selectorGuard.test.ts
npm test exit=0
 Test Files  75 passed (75)
      Tests  1003 passed (1003)
   Duration  1.16s (transform 9.58s, setup 0ms, import 14.76s, tests 1.48s, environment 5ms)
npm check exit=0
> vicinity-graph@0.1.1 check
> tsc -noEmit && npm run check:e2e
> vicinity-graph@0.1.1 check:e2e
> tsc -noEmit -p e2e/tsconfig.json
```

`git status --short` shows **no residual mutation** under `src/`.

## Notable incident: an existing guard caught me

My first draft used `import { readdirSync, readFileSync } from "node:fs"`. That turned
`e2e/vaultTarget.test.ts`'s guard RED — it requires the `import * as fs` namespace form
so its destructive-call scan can key off the `fs.` prefix. I complied rather than
weakening the guard. Worth noting as evidence the existing harness guards work, and that
**any new `e2e/*.ts` file must use `import * as fs`**.

## Files touched

- `e2e/selectorGuard.test.ts` — **new**, the entire deliverable.
- Commits on `e2e-selector-tripwire`: `b9c0d91` (guard), `c17ca2e` (CSS correction).

## Deliberately NOT done

- **No change_log entry** (TOP_LEVEL_AGENT owns the single entry). No tickets created/closed.
- **No CLAUDE.md / README edit.** CLAUDE.md's Commands section already reads
  `npm test # vitest (src/**/*.test.{ts,tsx} + e2e/**/*.test.ts harness guards)` — still
  accurate, and CLAUDE.md must stay succinct. Flagging for TOP_LEVEL_AGENT in case a
  reviewer wants it named explicitly.
- **No `npm run test:e2e`** (needs real Obsidian, out of scope, explicitly excluded).
- **No edits to existing e2e specs or `src/view/`.** Both mutations were temporary and
  are fully reverted.
- **No stranded selector found** beyond the already-known, already-intentional
  `.vicinity-graph-node__breadcrumb` absence guard at `e2e/vicinityGraph.e2e.ts:178`,
  which the exemption correctly passes. Nothing to STOP-and-report.
- **Did not demonstrate the helper-file scope biting.** Every helper-held class is
  currently duplicated in some `*.e2e.ts`, so no mutation can isolate that path today.
  The wider scope is future-proofing, asserted by construction, not by a live mutation.
