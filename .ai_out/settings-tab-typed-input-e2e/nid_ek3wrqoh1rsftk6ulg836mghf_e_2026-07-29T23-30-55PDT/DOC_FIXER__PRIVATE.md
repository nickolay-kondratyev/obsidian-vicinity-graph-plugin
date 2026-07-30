# DOC_FIXER — PRIVATE

## Reasoning trail

1. Read `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` (both rounds are in that one file) — the
   implementer itself flagged the map one-liner as the only doc debt.
2. Read `docs-internal/architecture-map.md` end to end before editing. It has NO e2e section:
   `e2e/` appears twice, both times as a REASON a src module has a constraint (e.g.
   `settingsRows.ts` is pure "because `e2e/settingsBaseline.ts` reads it too"). So inventing
   an "## E2E helpers" section would have been a new shape, which the brief forbade. The
   existing convention is: an e2e file is named inside the src seam it constrains. The debounce
   window belongs to the settings write path ⇒ the `settingsWritePipeline.ts` bullet.
3. Named `DebouncedSettingsWrites` / `SETTINGS_WRITE_DEBOUNCE_MS` in the same sentence because
   the map did not previously say anywhere that the TAB debounces typed rows — without that,
   "settle the window" has no referent. That is stable knowledge, not volatile detail.
4. Kept the three method names (poll / ordering barrier / `expectFlushedAheadOfWindow`) but no
   mechanism: the sentinel row, the 0.75× margin, the setTimeout-never-fires-early argument all
   live in the file's doc comment, which is where implementation-shaped WHY belongs.

## Files considered and rejected

- `README.md` §"e2e suite" — reader there is running the gate, not writing a spec. Rejected as
  duplication (DRY) rather than as unimportant.
- `docs-internal/notes/settings.md` — a `settings-cleanup` context note about SILENT HOLES in
  the settings family and the ticket chain order. `nid_ek3wrqoh1rsftk6ulg836mghf_e` is already
  named in its satellite list. A test-helper pointer is off-topic for it.
- `docs-internal/plan/high-level-plan.md` — design source of truth for product behavior; a test
  helper is not product behavior.
- `docs-internal/RELEASE_CHECKLIST.md` — nothing about the release gate changed.

## Thorg phase

No `thorg://notes/` references exist anywhere in this repo (checked the changed e2e files and
the two docs). No anchor points added: the anchor-point mechanism is for code that documentation
references from a distance; here the map cites a stable FILE PATH + CLASS NAME, which is
already a durable handle, and `SettingsWriteWindow` is public API of the e2e helper. Adding an
`ap_XXX_E` would be ceremony over a path that renames as easily as the anchor would.

## Verification (real, observed)

- `npm run check` → exit 0, `.tmp/doc-check.log`.
- `npm test` → exit 0, 94 files / 1245 tests, `.tmp/doc-test.log`. Counts match the
  implementer's, i.e. no source-scan test (`settingsRowParity`, `selectorGuard`,
  `settingsRowSpecCoverage`) reacted to the doc edits — expected, none of them scan `.md`.
- Tree left clean; commit includes the two `.ai_out/` review files modified by the previous
  agent, as the brief allowed.
