# IMPLEMENTATION_REVIEWER — PRIVATE (rehydration memory)

Ticket `nid_hatwq2jlkhno5t6awcz0q6t9q_e`. READ-ONLY reviews — no code touched, nothing committed.

## Round 1 (diff `344d037..HEAD@f6d24f6`)

- Gates I ran: `npm run check` exit 0; `npm test` 95 files / **1265** tests, exit 0.
- Verified genuine: NodeSizer.test.ts rewrite is a real pin; both tripwire amendments narrow
  (directional `CROSS_FIELD_REPAIRS`, ceiling probe still in-bounds); `key={shown}` safe
  because `PendingEdits.requesting` stores `shown: typedValue`; `numberRowCommit.ts` split is
  real; `NO_CROSS_FIELD_RULE` is an honest null-object.
- Filed 3 SHOULD-FIX: (1) dead seeded refusal + falsified WHY comment, (2) null commit leaves
  the field blank, (3) panel judged cross-field against the RENDERED snapshot.
- Verdict: CHANGES_REQUESTED.

## Round 2 (diff `f6d24f6..HEAD`: 7192074, 2141741, b905561)

- Gates I ran MYSELF: `npm run check` exit 0 (`.tmp/rev2-check.log`); `npm test`
  **95 files / 1271 tests passed**, exit 0 (`.tmp/rev2-test.log`). Matches the implementer.
- **#1 fixed at the root**: `SettingsRowView.tsx:235` is `useState<string | undefined>(undefined)`;
  the comment now states the true reason (`clampSizingSettings` raises at every door).
- **#2 fixed at the root**: `NumberRowCommit` is a class with `writing`/`refusing`/`nothing` and a
  DERIVED `reseedsFromStore = value === null && refusal === undefined`. Behavioral, not
  implementation-shaped: it names the one case where no store echo and no message exist.
  Refused ⇒ no reseed is CORRECT (the typed text is what the reason is about; the reason is
  rendered beside it). Inner `key={reseeds}` vs outer `key={shown}`: no interaction problem —
  `reseeds` resets to 0 on an outer remount (which replaces the whole subtree anyway), the
  increment only happens in the blur handler (focus already gone), and both state updates batch
  into one render, so no double remount and no dropped keystroke.
- **#3 fixed at the root**: `SettingsWritePipeline.storedGlobalView()` → `store.globalView()` →
  `this.data.globalView`, mutated in place by `persist()`. Genuinely fresh per call, same read
  the pipeline plans a write from and the same one the tab uses. Port method is the right seam
  (precedent: `planResetConfirmation`); `ControlsActionsPort` has NO `Fake*` anywhere in the repo
  and needs none — nothing in `npm test` renders React, and `ControlsActions.test.ts` exercises
  the REAL pipeline + real `PluginDataStore` over `FakePluginDataPort`, so the new test is
  behavioral (write lands → next read sees 300).
- `SizingRowVerdict` union: both consumers (`VicinityGraphSettingTab.showVerdict/:586`,
  `numberRowCommit.ts:120`) type-check unchanged; no case lost, `rejected: true ⇒ message: string`
  is now compile-time.
- CLAUDE.md line 44 edit: accurate, stable, in-house style. Fine.
- Acceptance criteria all met (inversion unstorable + visibly rejected; no mid-keystroke snap;
  gates green).

## Residual I found in round 2 (non-blocking, recorded)

`NumberRowCommit` drops `SizingRowWrite`'s non-rejecting CAP notice, and `reseedsFromStore` is
false for an accepted commit. When the clamp lands back ON the currently stored value — field
already at a `NODE_SIZE_PX_BOUNDS` bound (min 1 / max 400), user types past it — `PendingEdits`
releases immediately (`reconciled` matches `settlesAt`), `shown` never moves, no remount, so the
box keeps the unstored typed number with NO message. Narrow, but the new doc block at
`numberRowCommit.ts:41-46` asserts unconditionally that the panel's field "always ends up showing
the STORED number", which is false there. One-line honest fix: `reseedsFromStore` ⇒
`this.refusal === undefined`. Called out as a Suggestion; ticket-able.

Also: the implementer's stated reason for rejecting the CSS-naming NIT ("classes the e2e suite
selects on") is not literally true — `grep -rn "number-row" e2e/` is empty; e2e goes through
aria-labels. The CONCLUSION (cosmetic churn, don't do it) still stands, so I agreed.

Verdict written round 2: APPROVED.
