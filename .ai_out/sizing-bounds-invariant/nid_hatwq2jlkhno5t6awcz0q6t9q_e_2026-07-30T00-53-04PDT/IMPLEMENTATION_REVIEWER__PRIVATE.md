# IMPLEMENTATION_REVIEWER — PRIVATE (rehydration memory)

Ticket `nid_hatwq2jlkhno5t6awcz0q6t9q_e`. Diff reviewed: `344d037..HEAD` (f3b008e, 5f20f9f,
8d0bd6c; 963aaa4 is `.ai_out` only). READ-ONLY review — no code touched, nothing committed.

## Verification I actually ran

- `npm run check` → exit 0 (`.tmp/rev-check.log`).
- `npm test` → 95 files / 1265 tests passed, exit 0 (`.tmp/rev-test.log`). Matches the
  implementer's claim.
- e2e NOT run (release gate). Checked by hand for stale assumptions: `nodeOutline.e2e.ts:354`
  sets `maxPx=96` (> default `minPx=40`, so the raise never fires), `settingsResetReview`
  seeds `11/99`, `settingsTypedInput` targets the TAB. No e2e at risk.

## Scrutiny points — conclusions

1. **NodeSizer.test.ts rewrite: GENUINE pin.** New test asserts `everySizePx == minPx` for
   all three files with `minPx=200/maxPx=40`; remove the raise and sizes fall below 200 →
   fails. Deleted image-floor test covered a now-unreachable state; the other image-floor
   tests (~line 365) survive. Owner aligned it in the ticket.
2. **Tripwire amendments: honest.** `CROSS_FIELD_REPAIRS` is DIRECTIONAL (minPx→maxPx only);
   a swap implementation would still fail the reverse direction. The rule is pinned
   independently by 2 new `persistedShapes.test.ts` tests. Ceiling probe still writes a
   distinct in-bounds value → round-trip property intact.
3. **`key={shown}` is safe.** Critical detail: `PendingEdits.requesting` stores
   `shown: typedValue` (not settlesAt), so the post-blur remount reseeds with the TYPED
   value, and the later store echo (settlesAt match, or third-party release) reseeds to the
   real stored number. No keystroke loss (key only moves on a store/optimistic change), no
   focus theft (remount is triggered by the blur that already moved focus). Enter cannot
   double-write: `onKeyDown` only calls `blur()`; `onBlur` is the sole writer.
4. **numberRowCommit.ts split is real** — no React import, component is markup + one call;
   tests build policies from the REAL accessors + `SizingRowWrite`, not fakes.
5. **Missing cap notice: acceptable** for the accepted-but-capped path (optimistic reseed
   states it). The hole is the NULL-commit path — see finding #2 below.
6. **`NO_CROSS_FIELD_RULE` is an honest null-object** — `CROSS_FIELD_ROWS` in
   `sizingRowWrite.ts` is literally `{minPx, maxPx}`; node cap's integer/`MIN_NODE_CAP` rule
   lives in its accessor's `accept` and is pinned.

## Findings I filed (all SHOULD-FIX, none blocking correctness)

1. `SettingsRowView.tsx:223` seeded refusal is DEAD (state is always clamped) and its WHY
   comment claims behaviour this same commit made impossible.
2. `SettingsRowView.tsx:238` + `numberRowCommit.ts` null-commit path: blank/unparsed text
   stands with no reseed and no message → field lies about the stored value.
3. `SettingsRowView.tsx:357` judges cross-field against a RENDERED SNAPSHOT
   (`state.globalView.sizing`); the tab uses a LIVE store read
   (`VicinityGraphSettingTab.ts:562`). Stale by a full rebuild round-trip → false refusals
   quoting a stale number, or a missed refusal silently repaired by the engine.

Verdict written: CHANGES_REQUESTED (all three cheap; engine half is sound and should stand).
