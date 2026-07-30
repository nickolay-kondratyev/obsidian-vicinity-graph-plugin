# ControlsActions: pin Notice routed through UserNoticePort — DONE

Behavior-neutral. `main.ts` is now the only file in the plugin that constructs `Notice`.

## What changed

- `src/view/ControlsActions.ts` — no longer imports `obsidian`; takes a `UserNoticePort` as its
  last constructor parameter and reports a refused pin through it. Class doc no longer claims
  the file may import `obsidian`.
- `src/view/VicinityGraphView.tsx` — takes a `UserNoticePort` and hands it to `ControlsActions`,
  threaded exactly like the existing `ViewsRefreshPort` / `SettingsWritePipeline` parameters.
- `src/main.ts` — passes its existing `notices` field into `new VicinityGraphView(...)`; that
  field's doc now covers both users (failed settings write, refused pin).
- `src/view/ControlsActions.test.ts` — `vi.mock("obsidian", …)` removed; the suite builds ONE
  `FakeUserNotices` shared by the pipeline and the executor (as production does) and asserts the
  refusal copy, plus a negative case that a landed pin says nothing.

## Decisions

- The refusal message stays a private constant in `ControlsActions.ts`, NOT moved next to
  `settingsWriteFailureNotice.ts`. That module's job is deriving copy from the declared settings
  row/reset model; a pin refusal names no row and has one call site, so relocating it would add
  indirection without removing any duplicated knowledge.
- No new source-scan test enforcing "only main.ts constructs Notice" — outside ticket scope.

## Verification

- `npm test` — 1245 tests / 94 files pass (`.tmp/test.log`).
- `npm run check` — clean, incl. `check:e2e` (`.tmp/check.log`).

## Open items

- Not committed (per instruction). Ticket `_tickets/controlsactions-route-its-pin-notice-through-usernoticeport.md`
  left `status: open` for the committing agent to close.
