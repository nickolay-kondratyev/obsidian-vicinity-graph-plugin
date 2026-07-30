# DOC_FIXER — PUBLIC

Closes the round-2 review's single open item (no map entry for `e2e/settingsWriteWindow.ts`).

## Changed

- **`docs-internal/architecture-map.md`** — appended to the `view/settingsWritePipeline.ts`
  seam bullet (same bullet, same altitude as its neighbours; no new section): typed tab rows
  reach the pipeline through `DebouncedSettingsWrites` / `SETTINGS_WRITE_DEBOUNCE_MS` (ONE
  shared settle window), and `e2e/settingsWriteWindow.ts` (`SettingsWriteWindow`) is THE
  pattern for settling it — poll for a write that should land, sentinel-edit ordering barrier
  for one that should not, `expectFlushedAheadOfWindow` for the leave-the-field flushes.
  Placed there rather than in a new e2e section because the window is a property of the write
  path, and the map has no e2e section to extend.
- **`CLAUDE.md`** — one clause in the settings-tests convention pointing at the helper
  ("never a sleep; copy that pattern"). CLAUDE.md is auto-loaded, so it is the index; the WHY
  stays in the map and the mechanism stays in the file's own doc comment.

## Deliberately left alone

- **`README.md`** — its e2e section is about RUNNING the suite (binary provisioning, headless
  flags, external-vault safety), not authoring specs. A pattern line there would be a third
  copy of the same fact for no reader it does not already have.
- **`docs-internal/notes/settings.md`** — ticket-context note for the `settings-cleanup` chain;
  the e2e ticket is already listed there as a satellite, and the note tracks structural holes
  in the settings family, not test helpers.

## Verification

| Gate | Result |
|---|---|
| `npm run check` | exit 0 (`.tmp/doc-check.log`) |
| `npm test` | exit 0 — 94 files, 1245 tests (`.tmp/doc-test.log`) |

No code or tests touched. No change_log entry, no ticket edits (TOP_LEVEL_AGENT owns both).
