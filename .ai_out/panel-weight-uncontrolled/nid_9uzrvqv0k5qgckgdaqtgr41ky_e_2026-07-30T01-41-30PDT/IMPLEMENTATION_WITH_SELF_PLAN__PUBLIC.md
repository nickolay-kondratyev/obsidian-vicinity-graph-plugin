# Ticket nid_9uzrvqv0k5qgckgdaqtgr41ky_e — panel size-metric WEIGHT input is now uncontrolled

## What changed

The per-metric **Weight** input in the in-graph controls panel (`SizingMetricRow`) was the
last typed panel field still CONTROLLED and writing per keystroke, so `clampSizingNumber`
snapped it mid-word (its range is 0..100 — typing `150` snapped after the third key). It
now commits **on blur/Enter** through exactly the same protocol every other typed panel
field uses.

## The design decision (the one the ticket left open)

The ticket offered two options: grow the shared `NumberField` component with a `disabled`
prop and a second layout, or let the metric row keep its markup and reuse only
`NumberRowCommitPolicy`.

**Chosen: neither literally — the commit PROTOCOL was extracted into a hook,
`useNumberFieldCommit`, and both fields keep their own markup.**

Rationale:
- Option "one component, two layouts" puts a presentation branch inside a component whose
  only real job is the commit protocol. The two fields differ in wrapper, class, title,
  accessible-name role and disabled-ness — that is five props of pure layout, i.e. a
  layout switch smuggled into a behavior component.
- Option "reuse only `NumberRowCommitPolicy`" duplicates real knowledge: the uncontrolled
  `defaultValue`, the remount/reseed key protocol (`NumberRowCommit.reseedsFromStore`),
  Enter-blurs-to-commit, and the `aria-invalid` / `aria-describedby` refusal wiring — ~15
  lines of non-obvious rules, written twice.
- The hook shares 100% of the protocol (including `min`/`max`/`step`, which now also come
  from the accessor in one place) and 0% of the layout. `NumberRow` shrank to one
  component instead of two; the metric row gained three lines.

`NumberField` was therefore folded away: `NumberRow` is now a single component that calls
the hook. `SizingMetricRow` calls the same hook with `NO_CROSS_FIELD_RULE` (a weight is
judged entirely by its accessor) and spreads the returned props onto its existing input,
keeping `disabled={!enabled}`.

One markup change: the metric row is now wrapped in the shared
`.vicinity-graph-number-row-block` so a refusal (should the weight ever earn one) sits
UNDER the flex line rather than competing with the field for it — the same shape
`NumberRow` uses.

Acceptance criteria: all met. The commit decision still comes from
`NumberRowCommitPolicy`; the value half still from `SettingsRowAccessors.metricWeight`;
`disabled={!enabled}` is untouched.

## Tests (failing first, per repo convention)

- **New** `src/view/panelTypedNumberFields.test.ts` — a SOURCE SCAN (nothing under
  `npm test` renders React): every `<input type="number">` in `SettingsRowView.tsx` takes
  the shared blur-commit props and carries no controlled `value={…}`. Both assertions
  FAILED before the change (the failure printed the offending weight markup) and pass now.
  This is the tripwire that stops the next typed field being added the old way.
- **Extended** `src/view/numberRowCommit.test.ts` — a `NumberRowCommitPolicy` built from
  `SettingsRowAccessors.metricWeight(...)` + `NO_CROSS_FIELD_RULE`: in-range writes,
  above-range still writes (the write path caps, nothing is refused), blank writes nothing
  and reseeds. These passed on the old code too — the policy was always generic; they pin
  the behaviour the new wiring buys.

## e2e — REVIEWER MUST KNOW

`e2e/controlsRestart.e2e.ts` §11 sets the PANEL weight via `setNumberInput`, which set
`.value` and dispatched `input` only. Against an uncontrolled blur-committed field that
stores **nothing**, so that spec would have hung on its poll. `setNumberInput` now does
`focus()` → set value → `input` event → `blur()` (React maps `focusout` to `onBlur`).

`npm run test:e2e` needs a real Obsidian and was **NOT run here** (release gate). The
change type-checks (`npm run check:e2e` is part of `npm run check`), but the e2e run is
unverified by me — worth running before release.

## Files touched (repo-relative)

- `src/view/SettingsRowView.tsx` — `NumberField` → `useNumberFieldCommit` hook
  (`CommittedNumberField` / `CommittedNumberFieldProps`); `NumberRow` collapsed into one
  component; `SizingMetricRow`'s weight input now uncontrolled + blur-committed.
- `src/view/panelTypedNumberFields.test.ts` — NEW source-scan tripwire.
- `src/view/numberRowCommit.test.ts` — metric-weight policy suite.
- `e2e/controlsRestart.e2e.ts` — `setNumberInput` now commits by blurring.
- `CLAUDE.md` — the typed-fields bullet named `NumberField`; it now names the hook and the
  new scan.

## Verification (verbatim status)

- `npm run check` → exit 0 (`tsc -noEmit` for `src/`, then `e2e/`).
- `npm test` → exit 0, **96 test files, 1280 tests passed**.
- Not run: `npm run test:e2e` (needs a real Obsidian), `npm run build`.

Not committed, no change_log entry, ticket left open — as instructed.
