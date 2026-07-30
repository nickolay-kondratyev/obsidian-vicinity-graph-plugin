# PRIVATE memory — nid_9uzrvqv0k5qgckgdaqtgr41ky_e (panel weight → uncontrolled)

STATUS: **DONE**. `npm run check` exit 0, `npm test` exit 0 (96 files / 1280 tests).
Tree left dirty on purpose (TOP_LEVEL_AGENT commits). Ticket NOT closed, no change_log.

## Plan (executed)

1. Read ticket + `src/view/SettingsRowView.tsx` + `numberRowCommit.ts` + accessors + parity scan. ✔
2. Write FAILING tripwire `src/view/panelTypedNumberFields.test.ts` (source scan). ✔ (failed, then passed)
3. Add metric-weight suite to `numberRowCommit.test.ts` (passed already — policy is generic). ✔
4. Extract `useNumberFieldCommit` hook; collapse `NumberField` into `NumberRow`; rewire weight. ✔
5. Fix `e2e/controlsRestart.e2e.ts` `setNumberInput` (blur now required to commit). ✔
6. Update `CLAUDE.md` bullet that named `NumberField`. ✔

## Decision

Hook (`useNumberFieldCommit`) over "one component with two layouts" and over "reuse only
`NumberRowCommitPolicy`". Protocol shared 100%, layout shared 0%. Returns
`{ key, inputProps, refusal }`:
- `key` = `` `${stored}:${reseeds}` `` — a remount reseeds an uncontrolled input; a REFUSED
  commit moves neither part, so a refusal is never remounted away.
- `inputProps` includes min/max/step (from `accessor.bounds`), `defaultValue`,
  `aria-invalid`, `aria-describedby`, `onBlur`, `onKeyDown` (Enter → blur).
- `refusal` is a rendered `<div class="vicinity-graph-number-row__refusal">` or `null`.

Behavior delta worth knowing: previously `NumberField` remounted on store echo
(`key={shown}` at the `NumberRow` level), which incidentally cleared a stale refusal.
Refusal state now lives in the row component and survives a store echo. Practically
identical — a refused commit writes nothing, so this row's stored value does not move, and
the documented rule ("a refusal clears by committing again") is now uniformly true.

## Gotchas

- `npm test` renders NO React (see `settingsRowParity.test.ts` doc). Never add a render
  harness; test the policy seam + source scans. Component-test harness is a separate
  ticket: `nid_7qot0m6nuxxmd5z0yb9jylsd6_e`.
- Scan implementation detail: split source on `<input`, take up to the first `/>`, keep
  segments containing `type="number"`. Regexes: `/\{\.\.\.\w+\.inputProps\}/` (wired) and
  `/(^|[^A-Za-z])value=\{/` (controlled — deliberately does not match `defaultValue`).
  Comments are stripped first (same technique as the parity scan).
- Parity scan bans naming a row LABEL or an `ACCESSOR_OWNED_SYMBOLS` entry in any
  row-rendering module. The hook only touches `accessor.bounds`, so it is clean.
  `title="Weight"` in the metric row is pre-existing and is NOT a row label — left alone.
- e2e: `setNumberInput` in `e2e/controlsRestart.e2e.ts` MUST blur; uncontrolled fields
  ignore a bare `input` event. `npm run test:e2e` needs a real Obsidian — not run here.
- `.vicinity-graph-sizing__metric` is a flex LINE inside `.vicinity-graph-sizing__metrics`
  (flex column, gap), so wrapping it in `.vicinity-graph-number-row-block` (flex column) is
  layout-neutral.

## Commands

```bash
mkdir -p .tmp
npm run check > .tmp/check.txt 2>&1        # tsc src/ + e2e/
npm test     > .tmp/test.txt  2>&1
npx vitest run src/view/panelTypedNumberFields.test.ts src/view/numberRowCommit.test.ts
```

## Files touched

- `src/view/SettingsRowView.tsx`
- `src/view/panelTypedNumberFields.test.ts` (new)
- `src/view/numberRowCommit.test.ts`
- `e2e/controlsRestart.e2e.ts`
- `CLAUDE.md`

---

# ROUND 2 (iteration 1 — responding to IMPLEMENTATION_REVIEW of 1875811)

STATUS: **DONE**. `npm run check` exit 0, `npm test` exit 0 (96 files / **1283** tests).
Tree dirty on purpose. Ticket not closed, no change_log. Public artifact:
`IMPLEMENTATION_ITERATION__PUBLIC.md`.

## What the reviewer caught that I got WRONG

My round-1 PRIVATE said the refusal-lives-in-the-row change was "practically identical".
It was NOT: a refusal + `aria-invalid` survived a STORE move (Restore defaults), leaving a
valid stored number presented as invalid. Lesson: when a refactor moves STATE up past a
remount boundary, enumerate everything the old remount was incidentally clearing.

## Round-2 changes

1. `NumberFieldRefusal` (new, `numberRowCommit.ts`): `fromCommit(commit, storedWhenJudged)`
   + `messageWhileStoredIs(stored)`. Hook stores it, derives `shownRefusal`, which drives
   the element AND `aria-invalid`/`aria-describedby` together. Red-first: 3 new cases in
   `numberRowCommit.test.ts` failed with `Cannot read properties of undefined
   (reading 'fromCommit')`, then green.
   - Deliberate residual: value-binding, so a store bounce 100→160→100 re-shows it.
     Documented on the class. The robust alternative (render-time state adjustment against
     the previous render's `stored`) was rejected: unreachable by `npm test`.
2. `src/view/rowRenderingSource.ts` (new, TEST-SUPPORT only — nothing in the bundle imports
   it): module tables + `readRowSourceWithoutComments`. `settingsRowParity.test.ts` now
   imports it (`ROW_PRESENTERS as PRESENTERS` etc. to keep its assertions untouched).
3. `panelTypedNumberFields.test.ts` → **`typedNumberFields.test.ts`**, scans
   `EVERY_ROW_RENDERING_MODULE`, failures name the module. CLAUDE.md bullet updated.
4. Spread now BEFORE `disabled={!enabled}` on the weight input; stale `key={shown}` doc in
   `numberRowCommit.ts` fixed.
5. REJECTED one nice-to-have (scan-assert the weight's `disabled`): a scan cannot tell
   `disabled={!enabled}` from `disabled={enabled}`. Recorded on `nid_7qot0m6nuxxmd5z0yb9jylsd6_e`.
6. New ticket `nid_bbe962ojwwkhzn3uq27zw5w6l_e` — focus-out commits an unchanged value.

## Gotchas learned this round

- Tickets live in `_tickets/` (the `ticket` CLI store), NOT `docs-internal/tickets/`
  (that is the older `ticket-*.md` set). `ticket add-note <id>` accepts a heredoc.
- To prove a source scan is not vacuous: temporarily inject the offending markup into a
  REAL module (scans read by filename from `VIEW_DIR`, so copies do not work), run the one
  suite, then `git checkout` the file. Verified on `DepthStepper.tsx`.
- Repo has NO prettier/biome — match style by hand (tabs, ~120 cols).

---

# ROUND 3 (cleanup — the two NON-BLOCKING suggestions on APPROVED commit 7da47d3)

STATUS: **DONE**. `npm run check` exit 0, `npm test` exit 0 (96 files / 1283 tests — baseline
held exactly). Tree dirty on purpose. Not committed, no change_log, ticket not closed.

## Changes

1. Stale `panelTypedNumberFields.test.ts` → `typedNumberFields.test.ts` in the two LIVE
   references: `src/view/rowRenderingSource.ts:10`, `src/view/numberRowCommit.test.ts` (the
   weight suite's comment). Repo-wide grep found no others — remaining hits are `.ai_out/`
   round-1/2 records (historical, deliberately left) and `.tmp/` scratch. CLAUDE.md was
   already correct.
2. Refusal-sentence duplication: ACCEPTED the suggestion, done by SOURCING from the owner.
   New file-level helper `refusedMaxPxCommit()` (the one refused commit: `maxPx`=40 against
   stored `minPx`=200) used by 3 call sites. The "the row says why" test still spells the
   sentence out — that test's SUBJECT is the wording — and the `NumberFieldRefusal` test at
   ex-line 185, whose subject is presence-vs-absence, now asserts
   `toBe(refusedMaxPxCommit().refusal)`. Net: one copy of the sentence in this file, down
   from two, and the two tests are provably about the SAME commit.

## Vacuity check (the thing that could have made this a weakening)

`toBe(<something possibly undefined>)` passes trivially if both sides go `undefined`.
Verified by tampering: `messageWhileStoredIs` → `return undefined` ⇒ the reworked test FAILS
(exit 1, 1 failed / 27 passed), then `git checkout`. The other direction (the rule stops
refusing at all) is caught by the wording test, which is against the same helper. Comment in
the test says both.

## Gotcha

`NumberRowCommit` is imported `import type` on its own line — the value import beside it is
the class-free set; a plain value import of a type-only use trips the repo's TS config style.
