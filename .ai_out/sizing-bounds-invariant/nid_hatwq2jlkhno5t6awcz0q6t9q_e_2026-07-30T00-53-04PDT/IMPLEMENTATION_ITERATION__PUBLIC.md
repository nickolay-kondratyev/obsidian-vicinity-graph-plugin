# IMPLEMENTATION_ITERATION — PUBLIC (round 2)

Ticket `nid_hatwq2jlkhno5t6awcz0q6t9q_e`. Delta reviewed: `f6d24f6..HEAD`
(`7192074` fix, `2141741` docs, `b905561` `.ai_out` only). Round 1's
`IMPLEMENTATION_REVIEW__PUBLIC.md` stands as history.

## Summary

All three round-1 SHOULD-FIX items are fixed AT THE ROOT, not papered over. The engine half is
untouched, as asked. One incidental improvement (`SizingRowVerdict` → discriminated union) is a
net win and loses no case.

**Gates I ran myself** (not taken on trust):

- `npm run check` → **exit 0** (`.tmp/rev2-check.log`)
- `npm test` → **95 files / 1271 tests passed**, exit 0 (`.tmp/rev2-test.log`) — was 1265, +6.
- `npm run test:e2e` NOT run (release gate). No e2e spec drives the panel's number rows, and
  `grep -rn "number-row" e2e/` is empty, so nothing in this delta reaches the suite.

## Item-by-item verification

### #1 Dead seeded refusal — FIXED, correctly
`src/view/SettingsRowView.tsx:235` is now `useState<string | undefined>(undefined)` and the
comment states the true reason (`clampSizingSettings` raises an inverted pair at every door,
including a hand-edited `data.json` on load). Dead state and the falsified claim both gone.

### #2 Null commit left the field blank — FIXED, and the rule is behavioral
`src/view/numberRowCommit.ts:73-80`: `reseedsFromStore` is `value === null && refusal === undefined`.
That is a genuine behavioral rule, not an implementation shape — it names exactly the commit for
which no store echo will ever repaint the row AND no message gives the leftover text a meaning.

- **A REFUSED commit deliberately not reseeding is correct**, not stranded stale text: the typed
  number is what the reason is *about*, it is rendered directly beside the `role="alert"` refusal,
  and wiping it would destroy the thing the user has to edit. The staleness that remains (repairing
  the sibling row does not clear this row's message) is now documented at `SettingsRowView.tsx:210-216`
  with the recovery.
- **The two keys do not fight.** `reseeds` is state INSIDE `NumberField`, so an outer `key={shown}`
  remount resets it to 0 while replacing the whole subtree anyway — no double remount. The
  increment happens only in `onBlur`, i.e. after focus has already left, so no focus theft and no
  dropped keystroke; `setRefusal` / `onCommit` / `setReseeds` batch into ONE render.
- The 5 new BDD tests read as behavior ("committed blank THEN the field is reseeded from the
  store"), and the rewritten node-cap test is the honest counterpart of the behavior that changed.

### #3 Snapshot judge — FIXED, at the right seam
`SettingsWritePipeline.storedGlobalView()` → `PluginDataStore.globalView()` → `this.data.globalView`,
and `this.data` is REPLACED by `persist()`. So it is a genuinely fresh read on every call — the same
read the pipeline plans each write from and the same one `VicinityGraphSettingTab.ts:562` uses. No
cached/rendered snapshot one layer down.

The port method is the right seam, not a widening for one caller: `ControlsActionsPort` is the
panel's ONLY door to the pipeline, and `planResetConfirmation` is the existing precedent for "a
decision the user sees, taken against the state the write is taken against". Nothing in `main.ts`
or `VicinityGraphView` needed changing. On the `Fake*` convention: `ControlsActionsPort` has no
fake anywhere in the repo and needs none — nothing in `npm test` renders React. The new test in
`ControlsActions.test.ts` runs the REAL pipeline over a real `PluginDataStore`/`FakePluginDataPort`,
so "a landed write is visible to the next read" is pinned behaviorally.

### Incidental: `SizingRowVerdict` union
`src/view/sizingRowWrite.ts:37-41`. No case lost: `judge()` still returns exactly the two shapes it
did, and both consumers (`VicinityGraphSettingTab.showVerdict` / `:586`, `numberRowCommit.ts:120`)
compile unchanged. It converts "a refusal always says why" from a convention into a compile-time
fact and removes the need for a defensive fallback. Good change.

### CLAUDE.md
The line-44 edit is accurate (both surfaces do judge against a fresh store read; `reseedsFromStore`
is the rule as implemented), stable rather than volatile, and consistent with the file's density.
No further doc updates required.

### Acceptance criteria — all met end-to-end
- Inverted `minPx/maxPx` cannot be stored (raised at the one choke point, three doors) AND is
  visibly rejected in both surfaces with the same copy — now judged against the live store.
- A multi-digit out-of-range value no longer snaps mid-keystroke: the panel field is uncontrolled
  and blur/Enter-committed, the tab is debounced.
- `npm run check` and `npm test` green, verified above.

## 🚨 CRITICAL Issues

None.

## ⚠️ IMPORTANT Issues

None blocking.

## 💡 Suggestions (non-blocking; a follow-up ticket is a fine home)

**The accepted-but-CAPPED commit still has the round-1 #2 shape, in a narrow corner — and the new
doc block now claims it does not.** `src/view/numberRowCommit.ts:41-46` states that the panel's
field "always ends up showing the STORED number — by the store echo after a write, and by
`reseedsFromStore` after a non-write". That is unconditional and false when the clamp lands back ON
the currently stored value: field already at a `NODE_SIZE_PX_BOUNDS` bound (min 1 / max 400), user
types past it → `judge()` returns `rejected: false` with the cap notice, which `NumberRowCommit.writing`
DISCARDS; `PendingEdits.reconciled` matches `settlesAt` immediately so `shown` never moves; no outer
remount, `reseedsFromStore` is false, so the box keeps the unstored number with no message. Narrow
(it needs a bound-sitting field), and I accepted the missing cap notice in round 1 — but the honest
fix is one line, `reseedsFromStore ⇒ this.refusal === undefined` (reseed on ANY non-refused commit;
the outer `key={shown}` already remounts the ordinary accepted case, so this only adds the corner),
plus one BDD test. Otherwise, soften the comment so it does not assert the case it does not cover.
The same over-claim sits in the ticket's iteration-1 note.

**NIT dispositions: reasonable, agreed.** The spinner-arrow and stale-refusal sentences are honest
and belong where they were put. On the CSS rename: **rejecting it is right** (cosmetic churn for no
behavior gain), though the stated reason is not literally accurate — `grep -rn "number-row" e2e/`
returns nothing, the e2e suite goes through aria-labels. The conclusion stands on 80/20 alone.

## Documentation Updates Needed

None beyond the optional comment correction in the Suggestion above.

## Verdict

The three items are genuinely fixed at the root; the reseed rule is behavioral and its
refused-commit exception is the correct one; the fresh-store read is truly fresh and lands on the
seam the repo already uses for this class of read; the union loses nothing. Gates green at 1271
tests. The residual cap-notice corner is narrow, pre-existing, and cheap to fix forward — it should
not hold the branch.

APPROVED
