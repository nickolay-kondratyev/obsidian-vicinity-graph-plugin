# Implementation review — e2e-pinned-centrals-dry (`64c5d98`)

Ticket: `nid_iwd08rsdnsbdziltw1odisuoc_e`. Reviewer read-only; no code modified.

## Scope reviewed

The single HEAD commit. Code diff is 4 lines across two files (plus two `.ai_out/` docs):
`e2e/controlsRestart.e2e.ts` and `e2e/pinnedCentralScenario.e2e.ts` each gain
`import { PINNED_CENTRALS_SUMMARY } from "./settingsBaseline";` and swap
`hasText: "Pinned centrals"` → `hasText: PINNED_CENTRALS_SUMMARY` inside their
module-level `pinnedDisclosure()` helper.

## Acceptance criteria — independently verified

| Criterion | Result |
|---|---|
| No hard-coded `"Pinned centrals"` literal outside `e2e/settingsBaseline.ts` | **PASS** — I ran `grep -rn '"Pinned centrals"' e2e/ src/`: exactly one hit, `e2e/settingsBaseline.ts:137`. A looser phrase grep (unquoted) surfaces only doc comments (`settingsBaseline.ts:113,130`, `settingsUxVisual.e2e.ts:96`), a CSS comment (`src/view/graph-view.css:496`), and the production template literal `src/view/GraphToolbar.tsx:47` — none of which are test-side literals. |
| `npm run check` green | **PASS** — I ran it. Exit 0 (`tsc -noEmit` for `src/`, then `e2e/tsconfig.json`). |
| `npm test` green | **PASS** — I ran it. Exit 0, 75 files / 1010 tests passed. |
| `npm run test:e2e -- controlsRestart pinnedCentralScenario` green | **NOT RE-RUN BY ME.** I judged a real-Obsidian relaunch (~25s + Electron download risk) low value for a 4-line pure-string substitution whose value is provably byte-identical to the literal it replaces. The implementer reports exit 0 / 3 passed (23.3s) with verbatim output; I did not verify that claim. |

## BLOCKING

None.

## SHOULD-FIX

**1. Doc drift on `PINNED_CENTRALS_SUMMARY`'s contract comment**
(`e2e/settingsBaseline.ts:130-132`)

> "…without its `(n)` suffix — that is a live count, so **callers wrap this in a regex that spells the count out** rather than matching a bare prefix."

Before this change that sentence was true of every importing caller (only
`settingsUxVisual.e2e.ts:102`, which wraps it as `` new RegExp(`^${PINNED_CENTRALS_SUMMARY} \\(\\d+\\)$`) ``).
After this change 2 of 3 callers use it as a **bare substring** `hasText`. The comment now
over-claims and, read literally, tells a future maintainer their new bare-substring use is
wrong. The substring use is itself fine here (`pinnedDisclosure()` is a *navigation* locator
in a fixture that pins exactly one central, not an exhaustiveness assertion — the
"Pinned centrals defaults" false-match hazard the comment warns about only bites the
`hasNotText` exhaustiveness filter). So the fix is the comment, not the code: reword to say
the `(n)` suffix is stripped because it is a live count, and that *exhaustiveness* filters
must therefore spell the count out in a regex, while locators may match the prefix.

One-line doc edit; not worth a re-run of anything.

## NIT

**2. `pinnedDisclosure()` is itself duplicated verbatim between the two specs.** Pre-existing,
correctly identified by the implementer as out of ticket scope, and consolidating a 4-line
helper for two callers into a shared page object is negative ROI today. Agreed — leave it.
No ticket needed.

## Key judgment call: NOT folding `src/view/GraphToolbar.tsx:47` — **the implementer is right**

Assessed explicitly, as asked. The reasoning is correct *and* it is the reasoning this repo's
e2e baseline already documents for itself. `e2e/settingsBaseline.test.ts:4-18` states the rule
in so many words: values **derived** from `src/` (the reset labels, read out of
`settingsResetPlan`) need a literal second opinion or "rename a label and every spec would
happily follow it"; **hand-written** literals in the baseline are deliberately *not* pinned by
a mirror literal ("a literal here asserting a literal one file over has no independent
authority") — "their real pin is the DOM". `PINNED_CENTRALS_SUMMARY` is a hand-written literal,
and its authority comes from `settingsUxVisual.e2e.ts` asserting it against a real Obsidian.

Importing `GraphToolbar`'s string into the e2e side would move it from the hand-written
category into the derived category **without** adding the compensating literal pin, i.e. it
would strictly weaken the suite: an accidental copy change to the toolbar summary would then
pass e2e silently. Not folding is the correct call, consistent with the module's stated design.
(Layering is not the objection — `e2e/settingsBaseline.ts:1` already imports from `src/view/`,
and `settingsResetPlan` is pure with no `obsidian`/`react` deps, so the new transitive import
these two specs pick up is precedented and safe.)

## Correctness / readability regression check

None found.

- Value identity: the old literal and `PINNED_CENTRALS_SUMMARY` are both exactly
  `"Pinned centrals"` — byte-identical, no trailing space, no `(n)`.
- Assertion semantics unchanged: `hasText` with a **string** argument is substring +
  case-insensitive + whitespace-normalized in Playwright, both before and after. The
  substitution cannot change match behavior; only a string→RegExp change could, and none
  was made.
- Readability: the named const at the call site reads at least as well as the literal, and
  the import points a maintainer at the doc comment explaining the `(n)` suffix.
- No behavior-capturing test, anchor point (`ap_XXX_E`), or use case was removed or weakened.

## Documentation updates needed

Only SHOULD-FIX #1 (the `settingsBaseline.ts:130-132` comment). No `CLAUDE.md` or thorg-note
change warranted — this is a chore within an already-documented pattern.

## Verdict

**READY TO MERGE.** Acceptance criteria met and independently re-verified (except the e2e
run, which I chose not to repeat — stated above). SHOULD-FIX #1 is a one-line comment
correction that can land in this commit or as a trivial follow-up; it does not gate merge.
