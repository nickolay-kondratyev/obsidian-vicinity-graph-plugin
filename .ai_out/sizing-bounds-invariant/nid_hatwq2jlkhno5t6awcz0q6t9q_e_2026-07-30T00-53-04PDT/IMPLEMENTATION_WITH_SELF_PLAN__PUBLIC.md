# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC

## Iteration 3 (round-2 APPROVED; this is the single non-blocking suggestion)

**Disposition: FIXED the behaviour, not the prose.** The reviewer's option A taken.

`src/view/numberRowCommit.ts` — `reseedsFromStore` is now `this.refusal === undefined`
(was `value === null && refusal === undefined`). The comment that claimed the field
"always ends up showing the STORED number" is now TRUE by construction rather than by
assertion.

**Why fixing beat softening.** The claim was false because a WRITE is no guarantee that the
row moves. Two ways that happens, both leaving the box holding a number the plugin never
stored, with no message beside it:
1. the reviewer's corner — a field sitting at a `NODE_SIZE_PX_BOUNDS` bound (1/400), typed
   past it: `judge()` accepts, `settlesAt` caps back onto the stored value, `PendingEdits`
   settles instantly, `shown` never moves, no outer `key={shown}` remount;
2. a respelling — `007` over a stored `7`.
Softening the prose would have documented both as intended. They are not.

**Regression check (the prompt asked for one) — none.** On an ordinary accepted write the
store echo remounts the whole field via `NumberRow`'s `key={shown}`, so the extra
`setReseeds` request lands on an already-replaced component; `setRefusal`/`onCommit`/
`setReseeds` batch into one render either way. The reseed only ever fires on BLUR, i.e.
after the user has finished with the field, so it cannot clobber a number being typed. A
REFUSED commit still keeps its text — that is what the reason is about — and that exception
is exactly what the new one-line rule expresses.

**Started RED**: 2 tests in `src/view/numberRowCommit.test.ts` failed against the old rule.

**Behaviour-capturing test rewritten (called out):** "WHEN a value is written THEN the field
is NOT reseeded" asserted the old rule and is now its opposite — that IS the behaviour this
iteration changes, and the new test says why the redundant reseed is free.

| File | What |
|---|---|
| `src/view/numberRowCommit.ts` | `reseedsFromStore` rule + 3 corrected doc blocks |
| `src/view/numberRowCommit.test.ts` | +1 BDD test (capped-onto-stored), 1 rewritten |
| `src/view/SettingsRowView.tsx` | the `reseeds`-key comment now states the true reason |
| `CLAUDE.md` | line 44 restates the reseed rule |

Ticket `nid_hatwq2jlkhno5t6awcz0q6t9q_e`: correcting `add-note` appended (the iteration-1
note over-claimed the same way). Ticket left OPEN, no change_log entry.

Gates: `npm run check` **exit 0**; `npm test` **95 files / 1272 tests passed**, exit 0
(was 1271). `npm run test:e2e` not run (release gate; `grep -rn "number-row" e2e/` empty).

---

## Iteration 2 record (review response)

Ticket `nid_hatwq2jlkhno5t6awcz0q6t9q_e`. Iteration 1 delivered the engine + panel halves
(see the git history and the sections at the bottom of this file). Iteration 2 answers the
reviewer's three SHOULD-FIX items. **All three FIXED — none rejected.** The engine half is
untouched, as the review asked.

Branch `nid_hatwq2jlkhno5t6awcz0q6t9q_e_2026-07-30T00-53-04PDT`, 2 new commits
(`7192074` fix, `2141741` docs), clean tree. Ticket NOT closed, NO change_log entry (both
belong to TOP_LEVEL_AGENT).

## Per-item disposition

### #1 Dead seeded refusal + a comment this commit falsified — **FIXED**
`SettingsRowView.tsx`. The reviewer is right on the facts: after the load-path raise,
`parseSizing` and `planSettingsWrite` both raise an inverted pair, so `stored` can no
longer BE a refused value and the mount-time `policy.commit(String(stored))` was
unreachable. Now `useState<string | undefined>(undefined)`, and the comment states the
reason (`clampSizingSettings` raises at every door) instead of the impossible case.
No test to pin — the removal is the removal of dead state.

### #2 A commit that writes nothing leaves the field blank — **FIXED (started RED)**
The rule lives in the pure seam, as instructed. `NumberRowCommit` is now a small class
with named factories (`writing` / `refusing` / `nothing`) and one derived member:

- `reseedsFromStore` ⇒ the commit wrote nothing AND said nothing, so no store echo will
  ever repaint the row and no message gives the leftover text a meaning. The field must
  be reseeded. A REFUSED commit is deliberately `false`: the typed text is what the
  reason is about.

A class rather than three object literals so the derivation happens in ONE place and
cannot drift from the case that produced it.

`NumberField` keeps a `reseeds` counter and puts it on the `<input>`'s `key` — reseeding
an uncontrolled input IS a remount, and `stored` did not move on such a commit, so the
key needed something that did. (Same idiom as the existing `key={shown}` one level up.)

5 new BDD tests in `numberRowCommit.test.ts`; the node-cap blank test that asserted "the
text stands" was rewritten, because that is precisely the behaviour this item changes.
**Verified genuinely RED**: with `reseedsFromStore` stubbed to `false`, 3 of them fail.

### #3 Cross-field judge read the rendered snapshot — **FIXED**
Weighed exactly as the prompt asked, and the CLAUDE.md rule decides it: a decision the
user sees must be taken against the state the write is taken against. The window is real
— raise **Max**, then **Min**, inside one rebuild and the panel refuses a legitimate
widening while quoting a maximum the user has already replaced.

New read on the panel's own seam, mirroring the settings tab's `store.globalView()`:

- `ControlsActionsPort.storedGlobalView(): ViewSettings` (documented with the WHY-NOT for
  the snapshot),
- `ControlsActions.storedGlobalView()` delegating to
- `SettingsWritePipeline.storedGlobalView()` — the pipeline already owns the store and
  already reads it fresh per write, so the value a control is JUDGED against and the value
  it is MERGED over now come from one place. Precedent for a read on the write pipeline:
  `planResetConfirmation`, which exists for the same reason.
- `SizingNumberRow` now builds `new SizingRowWrite(field, () => actions.storedGlobalView().sizing)`.

1 new BDD test in `ControlsActions.test.ts` (a landed write is visible to the next read).
No new class needed store injection; nothing in `main.ts` / `VicinityGraphView` changed.

### NITs
- **Spinner arrows** (accepted): one honest sentence added to the `SettingsRowView` class
  doc — the arrows are aimed yet move text, so they too apply on blur; the step is 1px on
  fields whose useful moves are tens of pixels.
- **Stale refusal** (accepted): documented on `NumberField` — a refusal belongs to a
  COMMIT, the alternative is a row subscribing to its sibling's keystrokes, and the
  recovery is committing the field again.
- **CSS naming** (`.vicinity-graph-number-row-block` hosting `…number-row__refusal`) —
  **NOT changed**. Cosmetic by the reviewer's own label; renaming touches CSS the e2e
  suite selects through for no behaviour gain. Recorded here rather than silently dropped.

## Incidental improvement (call out in review)
`SizingRowVerdict` became a UNION (`rejected: true` carries a `string` message;
`rejected: false` carries `string | undefined`). Turning a rejection into a message would
otherwise have needed a runtime fallback for a reasonless refusal — a compile-time fact is
better than a defensive branch, and both existing consumers type-check unchanged.

## Files touched (iteration 2)

| File | What |
|---|---|
| `src/view/numberRowCommit.ts` | `NumberRowCommit` → class + `reseedsFromStore` |
| `src/view/numberRowCommit.test.ts` | +5 BDD tests; node-cap blank test rewritten |
| `src/view/SettingsRowView.tsx` | no seeded refusal; reseed key; fresh-read judge; 2 doc limits |
| `src/view/sizingRowWrite.ts` | `SizingRowVerdict` is a union |
| `src/view/viewPorts.ts` | `ControlsActionsPort.storedGlobalView()` |
| `src/view/ControlsActions.ts` | implements it via the pipeline |
| `src/view/settingsWritePipeline.ts` | `storedGlobalView()` read |
| `src/view/ControlsActions.test.ts` | +1 BDD test |
| `CLAUDE.md` | fresh-read judging + the reseed rule |

## Gates (real numbers)

- `npm run check` → **exit 0**
- `npm test` → **95 files / 1271 tests passed**, exit 0 (was 1265; +6 net)
- `npm run test:e2e` NOT run (release gate). No e2e spec drives the panel's number rows.

## For the release / PR note

1. `src/engine/NodeSizer.test.ts`'s inverted-ramp test was rewritten and relocated — a
   deliberate change to a behaviour-capturing test, authorised in the ticket (carried over
   from iteration 1).
2. Behaviour change users will notice: an inverted `minPx > maxPx` pair is now RAISED
   (never swapped, never reset) at load and at every write, and the panel's typed number
   rows commit on blur/Enter rather than per keystroke.
3. Follow-up ticket `nid_9uzrvqv0k5qgckgdaqtgr41ky_e` (per-metric WEIGHT input still
   controlled/per-keystroke) remains open and linked.

---

## Iteration 1 record (unchanged, for context)

Engine: `clampSizingSettings` raises `maxPx` to the CLAMPED `minPx` — one line at the one
choke point shared by `NodeSizer.compute`, `parseSizing` and `planSettingsWrite`. Panel:
`NumberRow` split into `NumberRow` (optimistic stored value, `key={shown}`) + `NumberField`
(text + refusal), uncontrolled and blur-committed, deciding through the pure
`numberRowCommit.ts`. Two spec-walking tripwires were amended in the open
(`CROSS_FIELD_REPAIRS` in `settingsSpecPersistence.test.ts`, a ceiling probe in
`settingsRowAccessors.test.ts`), neither weakened; the exempted rule is pinned
independently by two new `persistedShapes.test.ts` tests.

Process note carried forward: `npx prettier --write` was run mid-iteration-1 on four files;
the repo has no prettier config or dependency and uses tabs. Everything was reverted and
re-applied by hand, nothing was committed reformatted. **Do not run prettier in this repo.**
