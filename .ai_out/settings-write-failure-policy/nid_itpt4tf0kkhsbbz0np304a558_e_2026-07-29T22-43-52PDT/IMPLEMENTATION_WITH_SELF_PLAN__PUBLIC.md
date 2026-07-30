# Settings writes: ONE user-visible failure policy

Ticket `nid_itpt4tf0kkhsbbz0np304a558_e`. Not committed (top-level commits); ticket left open.

## What was built

A failed settings persist is now reported to the user **once**, naming the setting, from **one place** — `SettingsWritePipeline.write()`, the single body every settings write already flowed through (`apply`, `restoreDefaults`, and the debounced thunks' `SettingsWriter.apply`). No `try/catch` was added at any call site; the `void`-ed promises in `settingsDebounce.ts`, `VicinityGraphSettingTab.ts` and `ControlsActions.ts` are unchanged and now safe.

- **Notice surface behind a port**: `UserNoticePort { show(message) }` in `src/view/viewPorts.ts` (same shape as `ViewsRefreshPort`), implemented in `src/main.ts` over Obsidian's `Notice`, faked by `src/view/FakeUserNotices.ts`. Nothing outside `main.ts` gained an `obsidian` import; the pipeline and the copy module stay unit-testable with no obsidian runtime.
- **Copy** lives in the new pure `src/view/settingsWriteFailureNotice.ts`: `Vicinity graph couldn't save “<subject>”. See the developer console for details.` The subject is the **declared** label — the failed row's `label` from `settingsRows.ts` (reachable without breaking layering: that module is pure view data), or `SETTINGS_RESET_SCOPES[scope].label` for a restore-defaults. Nothing is hand-typed. `console.error` keeps the underlying error.

## Decisions a reviewer should weigh

1. **A failed write is caught and NOT re-thrown**, so `apply()` / `restoreDefaults()` now always resolve. Reasons: every call site `void`s the promise (a re-throw is an unhandled rejection), and `DebouncedSettingsWrites.drain()` awaits its thunks in a loop — a throw would abandon the rest of the settle window, silently dropping the user's last keystroke. Consequence stated in the class doc, in `CLAUDE.md` and in the architecture map: **a resolved write promise means "attempted and reported", not "stored"**.
2. **The refresh fan-out runs even when the write failed** (it sits outside the `try`). Views must repaint from what IS stored; this is also what lets an optimistic control release its override. Still exactly one fan-out per write, so no existing fan-out assertion changed.
3. **`write()` takes the notice text as a parameter**, computed by its two callers, because only they know what was being written (one interaction's row vs. one whole reset scope). A partially-landed multi-command reset therefore still produces exactly ONE notice.
4. **Copy deliberately does not claim "nothing was saved"** — a multi-command reset can partly land, and `PluginDataStore` moves in-memory state before the disk write. Overclaiming would be a lie; the console is pointed at instead of guessing a cause.
5. `SettingsWritePipeline`'s constructor gained a required third argument (`UserNoticePort`) — required, not defaulted, so a new construction site cannot silently lose the policy. Updated: `src/main.ts`, `settingsWritePipeline.test.ts`, `ControlsActions.test.ts`.

## Files changed (repo-relative)

New
- `src/view/settingsWriteFailureNotice.ts` — notice copy + subject naming (pure).
- `src/view/settingsWriteFailureNotice.test.ts` — 5 tests.
- `src/view/FakeUserNotices.ts` — accumulating fake (a double notice is visible).

Modified
- `src/view/settingsWritePipeline.ts` — rule 5 in the class doc; `notices` ctor param; `write(failureNotice, commands)` with the single `try/catch`.
- `src/view/viewPorts.ts` — `UserNoticePort`.
- `src/main.ts` — `notices: UserNoticePort` over `new Notice(...)`, passed to the pipeline.
- `src/view/settingsWritePipeline.test.ts` — 6 new tests + a rejecting `PluginDataPort`.
- `src/view/ControlsActions.test.ts` — construction site.
- `CLAUDE.md`, `docs-internal/architecture-map.md` — the policy documented where the write-pipeline convention already is.

## Test evidence

- **Failing first, verified**: with the `catch` body neutralised, `npx vitest run src/view/settingsWritePipeline.test.ts` → **6 failed | 13 passed** — exactly the 6 new tests (told exactly once / once per reset scope / does not reject its caller / a write queued behind it is still attempted / the next field in a debounce window is still written / views refreshed anyway). File restored.
- `npm test` → **94 files, 1241 tests, all passed**.
- `npm run check` → **exit 0** (strict tsc for `src/` and `e2e/`).
- `npm run test:e2e` not run (real-Obsidian release gate).

## Out of scope / follow-ups filed (both linked to this ticket)

- `nid_biwdtykvazsk3ejcqqli8o9j7_e` (`decide`) — `PluginDataStore` moves in-memory state BEFORE the disk write, so after a rejected persist the session keeps using the value the notice says was not saved. Needs an owner call: soften the copy, or roll the in-memory value back.
- `nid_t25rc8sd9nmlbmrn69k4zsaes_e` — `ControlsActions` still constructs `Notice` directly for its pin-refusal message (and its test therefore mocks `obsidian`). Behaviour-neutral migration to the new port, kept out of this change to stay focused.
- No e2e test of the notice: making `saveData` reject inside real Obsidian has no clean seam, and the pipeline seam is unit-covered.
