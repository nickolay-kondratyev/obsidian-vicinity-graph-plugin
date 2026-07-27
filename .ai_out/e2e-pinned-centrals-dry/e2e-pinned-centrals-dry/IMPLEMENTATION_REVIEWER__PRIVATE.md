# PRIVATE reviewer memory — e2e-pinned-centrals-dry

Status: **REVIEW COMPLETE**. Verdict READY-TO-MERGE with one non-blocking SHOULD-FIX.
Public output: `IMPLEMENTATION_REVIEW__PUBLIC.md` in this dir.

## What I actually ran (be truthful if asked again)

- `git show HEAD` — full diff read. 4 code lines, 2 files, + 2 `.ai_out/` docs.
- `grep -rn '"Pinned centrals"' e2e/ src/` → 1 hit (`e2e/settingsBaseline.ts:137`). Acceptance met.
- `grep -rn 'Pinned centrals' e2e/ src/` (unquoted) → only comments + `GraphToolbar.tsx:47` + CSS comment.
- `npm run check` → exit 0. Log `.tmp/rev-check.txt`.
- `npm test` → exit 0, 75 files / 1010 tests. Log `.tmp/rev-test.txt`.
- **DID NOT** run `npm run test:e2e`. Deliberate, and said so in the public review.
  Rationale: substitution is provably value-identical; real-Obsidian relaunch is ~25s + flake surface.
- Read: `e2e/settingsBaseline.ts` 110-137, `e2e/settingsBaseline.test.ts` 1-30,
  `e2e/settingsUxVisual.e2e.ts` 90-110, `src/view/GraphToolbar.tsx` 40-55,
  `src/view/settingsResetPlan.ts` imports.

## Findings

- BLOCKING: none.
- SHOULD-FIX (doc only): `e2e/settingsBaseline.ts:130-132` says "callers wrap this in a regex
  that spells the count out" — no longer true for 2 of 3 callers after this change. Reword to
  distinguish exhaustiveness filters (must regex, per the "Pinned centrals defaults" hazard)
  from navigation locators (prefix substring is fine).
- NIT: `pinnedDisclosure()` duplicated verbatim across the two specs. Pre-existing, negative-ROI
  to fold for 2 callers. No ticket filed — deliberately.

## Judgment call verdict (the one the parent asked about)

Implementer's refusal to fold `GraphToolbar.tsx:47` into the e2e const is **CORRECT**, and not
just defensible — it is the rule `e2e/settingsBaseline.test.ts:4-18` already writes down:
derived-from-`src` values need a literal second opinion; hand-written baseline literals are
pinned BY THE DOM (`settingsUxVisual.e2e.ts`) and importing them from `src` would delete that pin.
Layering was NOT an objection: `settingsBaseline.ts:1` already imports `src/view/settingsResetPlan`,
which is pure (imports only `../engine`, `nodePreviewPreferenceMeta`, a type). So the new
transitive dep the two specs pick up is precedented and side-effect-free.

## Semantics check (done, no regression)

Playwright `hasText: <string>` = substring, case-insensitive, whitespace-normalized — same before
and after. Const value is exactly `"Pinned centrals"`, no suffix/whitespace difference. Only a
string→RegExp swap could have changed matching; none happened.

## Environment note

Every Bash call emits ~25 lines of profile noise. Redirect real output to `.tmp/` and read back.
