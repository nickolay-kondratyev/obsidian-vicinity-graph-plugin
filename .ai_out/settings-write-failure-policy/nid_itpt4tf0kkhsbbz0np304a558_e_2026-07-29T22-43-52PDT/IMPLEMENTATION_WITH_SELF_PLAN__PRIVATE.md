# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE memory

Ticket: `nid_itpt4tf0kkhsbbz0np304a558_e` — "Settings writes: user-visible failure policy for void-ed write promises".
Branch: `nid_itpt4tf0kkhsbbz0np304a558_e_2026-07-29T22-43-52PDT`. **Status: COMPLETE, not committed, ticket not closed** (top-level agent commits / closes / writes the change_log).

## Plan (as executed)

1. Recon: pipeline, debounce, tab, ControlsActions, `ViewsRefreshPort` + `FakeViewsRefresh` (shape to copy), `settingsRows.ts` (labels), `settingsResetPlan.ts` (scope labels), `SerialPromiseChain`, `PluginDataStore`.
2. New pure copy module `src/view/settingsWriteFailureNotice.ts` (interaction/scope → notice text, label READ from the declared row model).
3. New port `UserNoticePort` in `src/view/viewPorts.ts` + `src/view/FakeUserNotices.ts`.
4. Failing tests first (verified they fail — see evidence), then the pipeline catch.
5. Wire real `Notice` in `src/main.ts`; update the 2 test construction sites.
6. Docs: `CLAUDE.md` settings-writes bullet + `docs-internal/architecture-map.md`. Two follow-up tickets filed.

## Design decisions (the WHY, for a reviewer or a future me)

- **Catch at the innermost write, never re-throw.** `SettingsWritePipeline.write()` is the single body every settings write (apply / restoreDefaults / debounced thunk via `SettingsWriter.apply`) flows through, so one `try` there is the whole policy. Re-throwing was rejected: every call site `void`s the promise (unhandled rejection), and `DebouncedSettingsWrites.drain()` awaits its thunks in a loop — a throw would strand the rest of the settle window (the user's LAST keystroke). Documented as rule 5 in the class doc, including the consequence: a resolved write promise now means "attempted and reported", not "stored".
- **Fan-out still runs on failure** (outside the `try`). Views must repaint from what IS stored; that is also what releases an optimistic control's override. One fan-out per write either way, so no test on fan-out counts changed.
- **`failureNotice` is a parameter of `write()`**, computed eagerly by the two callers, because only the caller knows WHAT was being written (one interaction's row vs. one reset scope). Cheap (a Map lookup + a concat); no thunk indirection.
- **Subject naming reads the DECLARED label**, per ticket constraint: `EVERY_SETTINGS_ROW` keyed by a control-identity string (`controlKey`, exhaustive `switch` closed by `unhandledRowControl`, so a new field-bearing kind cannot silently key on its bare kind and inherit the first row's copy). Interaction → `SettingsRowControl` is a second switch on purpose so the key FORMAT is spelled once (no drift between the two sides). Reset subject = `SETTINGS_RESET_SCOPES[scope].label`.
- Fallback when no row declares a control: `control.kind`. Not a throw — this runs inside a failure handler. `settingsRowSpecCoverage.test.ts` keeps every shipped setting declared.
- Copy: `Vicinity graph couldn't save “<subject>”. See the developer console for details.` Deliberately does NOT claim "nothing was stored" — a multi-command reset can partially land, and `PluginDataStore` moves in-memory state regardless (see ticket `nid_biwdtykvazsk3ejcqqli8o9j7_e`). Console keeps the real cause (`console.error` with the error).
- Layering: `settingsWriteFailureNotice.ts` is pure (no `obsidian`, no `react`); only `main.ts` touches `Notice`. Port shape mirrors `ViewsRefreshPort` exactly, fake mirrors `FakeViewsRefresh` (accumulating list so a DOUBLE notice is visible).
- Not in `EVERY_ROW_RENDERING_MODULE`, so `settingsRowParity.test.ts`'s `ACCESSOR_OWNED_SYMBOLS` scan does not apply to the new module (it names no range/clamp anyway).

## Files touched

New: `src/view/settingsWriteFailureNotice.ts`, `src/view/settingsWriteFailureNotice.test.ts`, `src/view/FakeUserNotices.ts`.
Modified: `src/view/settingsWritePipeline.ts` (rule 5 doc, 3rd ctor param `notices: UserNoticePort`, `write(failureNotice, commands)` + catch), `src/view/viewPorts.ts` (`UserNoticePort`), `src/main.ts` (`Notice` import, `notices` port field, ctor arg), `src/view/settingsWritePipeline.test.ts` (helper + 6 new tests + `RejectingPluginDataPort`), `src/view/ControlsActions.test.ts` (ctor arg), `CLAUDE.md`, `docs-internal/architecture-map.md`.
Tickets filed (linked to this one): `nid_biwdtykvazsk3ejcqqli8o9j7_e` (in-memory state keeps a rejected value — `decide`), `nid_t25rc8sd9nmlbmrn69k4zsaes_e` (ControlsActions' pin Notice should use the port).

## Test evidence (actual, verified)

- Failing-first check: with the `catch` body replaced by a no-op `finally`, `npx vitest run src/view/settingsWritePipeline.test.ts` → **6 failed | 13 passed** (exactly the 6 new tests). File restored from `.tmp/pipeline.bak` afterwards; log `.tmp/test_nofix.log`.
- `npm test` → **94 files, 1241 tests, all passed** (`.tmp/test_final.log`).
- `npm run check` → **exit 0** (tsc strict + e2e tsconfig) (`.tmp/check_final.log`).
- `npm run test:e2e` NOT run (needs a real Obsidian; release gate).

## Open questions / not done

- No e2e coverage of the notice (would need a way to make `saveData` reject inside real Obsidian). Judged not worth it — the seam is unit-covered.
- `ControlsActions` still constructs `Notice` directly (ticket filed rather than expanding this change into `VicinityGraphView` wiring).
- Whether the in-memory value should roll back on a rejected persist is an owner decision (ticket filed, `decide`).
