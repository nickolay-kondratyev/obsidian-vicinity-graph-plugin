# IMPLEMENTATION_ITERATION — review follow-ups (S1, S2)

Ticket `nid_f8csd65emmy6p62ad9x5w1psz_e`. Still **TEST-ONLY** — zero production behavior change.

## Accepted

**S1 — stale pointer comment.** `src/view/GraphStructureDiff.test.ts:47-53`.
The "needs pinning where sizePx is computed instead" future-tense clause now
names the guards that exist: `NodeSizer.test.ts`, `VicinityEngine.test.ts` and
`flowMapping.test.ts`. The test's own WHY (nobody may add a
`nodePreviewPreference` trigger to `decideLayout`) is unchanged, and the test
body/assertion is untouched.

**S2 — the real view-layer gap.** New describe at the end of
`src/view/flowMapping.test.ts`:
`vicinityGraphToFlow node geometry ignores the node preview preference` —
*WHEN only nodePreviewPreference varies THEN every flow node keeps the same width and height.*
Fixture reuses `makeGraph`/`makeNode`/`toFlow` from the suite; the two nodes
differ in `sizePx` and one carries BOTH preview regions (image + outline,
`imagePrecedesOutline: true`) so `data.preview` really does change across the
preferences while geometry must not. Iterates `NODE_PREVIEW_PREFERENCES`, so a
fourth preference is covered for free. Group nodes are included in the compared
set (they are `UNSIZED_GROUP_PX` pre-layout, but a future preference-driven
group box would also be caught).

## Kept declined (unchanged from predecessor)

- No guard in `graphIdentity.test.ts`: `nodeDimensionsPx(node: GraphNode)` takes
  no settings, so such a test is `f(x) === f(x)`. The reviewer agreed; the
  non-tautological place was one level up, and that is what S2 covers.

## REJECTED NITs (with rationale)

- **N1 — baseline entry compares against itself.** Rejected. Deliberate: the
  keyed map is what turns a failure into "which preference broke it". Removing
  the self-comparison saves one map entry and costs the failure message. The new
  flowMapping test uses the SAME idiom as the two engine guards on purpose —
  consistency across the three guards beats a micro-optimization in one.
- **N2 — extract the `Object.fromEntries(NODE_PREVIEW_PREFERENCES.map(...))`
  idiom.** Rejected, and now more firmly than at review time: the idiom appears
  in three files across TWO layers (`src/engine/`, `src/view/`). A shared helper
  would have to live in neither's natural home, would couple engine tests to
  view tests, and would hide four readable lines behind an indirection. Each
  test stays locally readable. (Per the briefing: do not over-DRY three small
  tests into an abstraction that obscures them.)
- **N3** — already "fine" per the reviewer; nothing to do.

## VERIFY (all run, output in `.tmp/`)

| Check | Result |
|---|---|
| `npm test` (`.tmp/it-test.log`) | exit 0 — 76 files / **1014 tests** passed (was 1013; +1 new) |
| `npm run check` (`.tmp/it-check.log`) | exit 0 — strict tsc for `src/` and `e2e/` |
| `npm test` after mutation revert (`.tmp/it-test2.log`) | exit 0 — 1014 passed, `git status` shows only the two intended test files modified |

### Mutation-verify of the NEW flowMapping test (`.tmp/it-mut.log`)

**Perturbation:** in `src/view/flowMapping.ts`, inside the `noteNodes` map, made
the emitted height preference-dependent —
`graph.viewSettings.nodePreviewPreference === "image" ? height + 30 : height`
(the exact "image previews need a taller box" regression the reviewer named).

**Observed:** `npx vitest run src/view/flowMapping.test.ts` → exit 1,
**1 failed | 62 passed**, and the single failure is
`vicinityGraphToFlow node geometry ignores the node preview preference > WHEN only nodePreviewPreference varies THEN every flow node keeps the same width and height`.
No other test in the suite noticed — i.e. this gap was genuinely unpinned before.

**Reverted** with `git checkout -- src/view/flowMapping.ts`; full suite green again.

## Out of scope (owned by TOP_LEVEL_AGENT)

No `change_log` entry, no branch merge, no ticket state change.
