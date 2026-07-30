# Review — ticket `nid_zwhec6kznw0utd9sz0n5g60ex_e` (commit `ec70c00`)

## VERDICT: CONVERGED

No CRITICAL and no IMPORTANT issues. One optional suggestion, recorded below and explicitly NOT
required for this ticket.

## What I verified

| Check | Result |
|---|---|
| `npm run check` (`tsc -noEmit` src + `check:e2e`) | exit 0 |
| `npm test` (vitest) | exit 0 — 94 files, 1245 tests passed |
| `./sanity_check.sh` | not present in this repo |
| Diff scope | `e2e/settingsDependentRows.e2e.ts` only (-8/+1) plus the maker's `.ai_out/` notes |

## 1. CORRECTNESS — the deleted guard was genuinely unreachable ✅

`src/view/sizingMetrics.ts:20-26` declares `SIZING_METRICS` with `as const satisfies readonly
SizingMetricLabel[]` over five literal entries. `as const` produces a **const tuple**, and
`noUncheckedIndexedAccess` does not add `| undefined` to an **in-range literal index of a tuple** —
only to array/record index signatures. So `SIZING_METRICS[0]` is `{ id: "own-file-size"; label:
"Own file size" }`, never `undefined`. The deleted `if (… === undefined) throw` could not fire, and
the deleted sentence taught the opposite of the truth. Correct call by the maker.

Nothing relied on the guard's narrowing: `METRIC_UNDER_TEST` is a module-local const with three
dereference sites (lines 191, 257, 261) and no exports. `check:e2e` passing after removal is the
falsifiable proof — had `[0]` really been optional, all three `.id`/`.label` accesses would now
error.

Bonus, worth stating: removal is a strict **improvement** in failure mode. If `SIZING_METRICS` were
ever emptied, `SIZING_METRICS[0]` on an empty tuple is a **compile error** ("Tuple type '[]' of
length '0' has no element at index '0'"), which is strictly earlier and louder than the runtime
throw that was there. The safety the comment claimed is still enforced, just by the type system.

## 2. TRUTHFULNESS of remaining comments ✅

**The second deletion was right.** The arrow-const comment (~old line 194) read: *"a hoisted
declaration is callable before the throw above, so TS would not see `METRIC_UNDER_TEST` as
narrowed."* It justified itself **entirely** by the throw the same commit deleted, and it pointed
at a "throw above" that no longer exists. Leaving it would have re-created the exact defect the
ticket exists to remove. Deleting it — rather than the alternative of reverting to a `function`
declaration — was the minimal honest fix and kept the diff comment-only.

I re-read every other comment in the file with the throw removed. **None became false.** Checked
specifically:
- The surviving `METRIC_UNDER_TEST` doc (lines 45-49) — the retained sentence ("read from the
  shared table rather than re-typed, so a renamed metric fails HERE instead of drifting") is still
  accurate and no longer makes any claim about optionality.
- File header (8-32), `SCROLL_OFFSET_PX` (52-58), `IDENTITY_PROBE` (61-68), the locator-provenance
  note (85-87), `expectExclusionPersisted` (172-180), and the three in-test notes (202, 205-208,
  230-231, 252-253, 264-265, 273-275) — all independent of the removed throw and of tuple
  optionality.

## 3. SCOPE ✅

Zero production-code churn. `src/view/sizingMetrics.ts` read only, not modified. No e2e baselines,
no screenshots, no settings-spec or row-model files touched. No anchor points (`ap_XXX_E`) and no
behavior-capturing tests removed — the three tests in the spec are all intact, the change removes
only a comment and a never-taken branch.

## 4. REPO STANDARDS ✅

Consistent with CLAUDE.md: comments explain WHY, and a WHY that is false is worse than none;
compile-time checks preferred over runtime guards; no `@Deprecated`-style hedging, clean break.
The maker was honest that `npm run test:e2e` was NOT run (release gate, needs a real Obsidian
binary) and did not imply a green e2e run — correct per EARN_TRUST. Given the change is a comment
deletion plus an unreachable branch, and `check:e2e` type-checks the spec, I agree the e2e gate is
not required for this commit.

## 💡 Suggestion (optional, NOT required — do not do it under this ticket)

1. **[Low] Sibling-helper form is now inconsistent without an explanation.**
   `expectExclusionPersisted` (line 181) is an `async function` declaration while its sibling
   `expectMetricEnabledPersisted` (line 189) is an arrow const. Before this commit the asymmetry
   had a written reason; now it has none. It is harmless and invisible at runtime, but a future
   reader may wonder. Converting the arrow to `async function` would restore symmetry — that is
   real churn on a "nothing else" ticket, so it belongs in a separate tidy-up if anyone thinks it
   is worth the diff. I lean toward: leave it.

## Maker observations I checked

The maker flagged two unrelated items in `src/view/sizingMetrics.ts` (an exported
`_assertEverySizingMetricListed` compile-time const, and an unverified claim in its doc comment
about a unit test). Both are correctly OUT of scope here and were correctly not patched. Neither
blocks this commit; file a ticket only if someone touches that file.

## Documentation Updates Needed

None. This is stable-knowledge-free cleanup; nothing in `CLAUDE.md`, `docs-internal/`, or the
architecture map describes the deleted lines.
