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
