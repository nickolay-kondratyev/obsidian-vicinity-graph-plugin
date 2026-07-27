# EXPLORATION_PUBLIC — settings-debounce-validation (index)

Two exploration agents ran. Read the detail docs, not this index, before implementing:

- [`EXPLORATION_PUBLIC__CODE.md`](./EXPLORATION_PUBLIC__CODE.md) — settings-tab fields, write path
  (`applyInteraction`/`applySizing` → `planSettingsWrite` → `PluginDataStore` → `refreshOpenViews` →
  `GraphViewController.handleSettingsChanged` → async `runRebuild`), clamp choke-point, regex compilation,
  overlapping ticket.
- [`EXPLORATION_PUBLIC__TESTS.md`](./EXPLORATION_PUBLIC__TESTS.md) — test surface, fake-timer precedent,
  absence of any settings-tab unit test/Obsidian DOM harness, e2e impact.

## Findings that change the ticket's framing

1. **Upper bounds already exist** in `SETTINGS_SPEC` for `minPx`, `maxPx`, `depthDecayK`. Acceptance
   criterion (c) is largely already satisfied → pin it with a test rather than re-adding bounds.
   `nodeCap` is the only field genuinely lacking a max — **out of scope** (ticket names only sizing px +
   decay-k; adding a cap max changes user-visible behavior) → follow-up ticket.
2. **The real bounds gap** is the missing cross-field check: `clampSizingSettings`
   (`src/engine/constants.ts:157-173`) clamps each field in isolation, so `maxPx < minPx` persists.
3. **No repo-wide debounce utility**; the only precedent is a hand-rolled `window.setTimeout` in
   `GraphViewController`. Fake-timer test template: `GraphViewController.test.ts:789-871`.
4. **No settings-tab unit test or Obsidian DOM fake exists.** Prefer extracting pure, directly-testable
   logic over building a heavy `Setting` mock.
5. **e2e is unaffected** — no spec types into a number/text input today.

## Overlapping ticket
`_tickets/exclusion-settings-debounce-patterns-textarea-surface-invalid-regex-validation.md` covers the
textarea-debounce + invalid-regex subset. Close as superseded once this lands.
