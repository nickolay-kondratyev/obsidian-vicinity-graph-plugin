# DOC_FIXER (PUBLIC)

Docs-only pass for step 5 of the settings-cleanup chain (commits `3468387` + `9dee711`).
`npm run check` re-run after the edits: exit 0 (`.tmp/doc-check.log`).

## Files touched

| File | WHY |
|---|---|
| `CLAUDE.md` | New "Settings tests" bullet in *Conventions*, in the same voice as the ONE-pipeline / ONE-row-model rules: suites walk `SETTINGS_SPEC` and assert structure; literals live only in `src/engine/settingsProductDefaults.test.ts`; editing it is the conscious act of changing shipped behavior; never mirror a default; parity is a source scan and nothing in `npm test` renders React. |
| `docs-internal/notes/settings.md` | Added "What ticket 5 added to the family — LANDED 2026-07-29" (the one-tripwire test contract, in the file's existing per-ticket section style) plus the ONE open owner decision: SMALL was asked for, all 21 leaves shipped, ratification pending via `nid_5rdya0nr660n9sru1zhfs51ic_e`. Also flagged the now-superseded "Tests" standing-decision bullet so it cannot read as current. Chain table, mermaid graph and ordering rationale untouched. |
| `docs-internal/architecture-map.md` | Added ONE `engine/SettingsSpec.ts` seam bullet naming `settingsProductDefaults.test.ts` as the single literal tripwire. Justified: the map already tracks guard tests at that granularity (`importGuard.test.ts`, `settingsRowParity.test.ts`, `engineDefaultsSingleSource.test.ts` are all named against the thing they guard). No new section. |

## Deliberately left alone

- **`README.md`** — grepped for settings/testing claims; it documents scripts and the
  e2e gate only and says nothing about settings-test construction. Nothing false, so
  nothing changed.
- **`src/**`, `e2e/**`** — out of scope for this role. The reviewer's two NITs (the
  thrice-repeated "4 of 7 geometry-observable" prose, the one `it` covering 21
  behaviors) live in code comments and are the implementer's/owner's call, not a doc fix.
- **`_tickets/`** and the `change_log`** — TOP_LEVEL_AGENT owns both; it was editing
  `_tickets/` concurrently with this pass (the `decide` ticket appeared mid-run and is
  now referenced by id). My commit contains only the three doc files.
- **Mutation-experiment details** (which files must be edited per mutated default) —
  stays in `.ai_out/`; volatile measurement, not stable knowledge.
- No anchor points were added: the new docs describe a repo-wide RULE about a whole
  file, not a line-level code site, and `src/` is off-limits this pass.
