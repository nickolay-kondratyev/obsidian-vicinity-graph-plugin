# IMPLEMENTATION_REVIEW — PUBLIC

Ticket `nid_hatwq2jlkhno5t6awcz0q6t9q_e`. Diff reviewed: `344d037..HEAD`
(`f3b008e`, `5f20f9f`, `8d0bd6c`; `963aaa4` is `.ai_out` only).

## Summary

Two halves, both landed. **Engine**: `clampSizingSettings` (`src/engine/constants.ts:234-244`)
now raises `maxPx` to the CLAMPED `minPx` — one line at the single choke point shared by
`NodeSizer.compute`, `parseSizing` and `planSettingsWrite`, exactly as the owner's
2026-07-29 decision specifies. **Panel**: `NumberRow` in `src/view/SettingsRowView.tsx` is
split into `NumberRow` (owns the optimistic stored value) + `NumberField` (owns the text and
the refusal), uncontrolled and blur-committed, with the blur decision extracted into the pure
`src/view/numberRowCommit.ts`. Sizing rows are judged by the tab's own `SizingRowWrite`, so
the refusal copy exists once; `NodeCapRow` gets the same fix via `NO_CROSS_FIELD_RULE`.

Acceptance criteria: (a) met, (b) met in the steady state — see SHOULD-FIX #3 for the stale
window, (c) met for every `NumberRow`-based row including `NodeCapRow`, (d) verified below.

**Tests I ran myself**: `npm run check` exit 0; `npm test` **95 files / 1265 tests passed**,
exit 0. Matches the implementer's report. `npm run test:e2e` not run (release gate) — I
checked the specs by hand instead: `e2e/nodeOutline.e2e.ts:354` sets `maxPx=96` (above the
default `minPx=40`, so the new raise never fires), `settingsResetReview` seeds `11/99`,
`settingsTypedInput` drives the TAB. No e2e assumption is invalidated by the raise rule.

## What I verified, rather than took on trust

- **`NodeSizer.test.ts` rewrite is a genuine behaviour pin, not aligned-to-implementation.**
  The new test (`src/engine/NodeSizer.test.ts:220`) asserts `everySizePx == INVERTED_MIN_PX`
  for the whole vicinity with `minPx=200 / maxPx=40`; delete the raise and the top scorers
  land below 200, so it fails. The deleted test
  (`NodeSizer.test.ts` image-floor block, "the floor never shrinks an image node") covered a
  state this change makes unreachable, and the remaining image-floor tests still pin the
  floor itself. Rewrite + relocation are exactly what the ticket's 2026-07-29 note authorised.
- **Both tripwire amendments are narrow, not weakened.** `CROSS_FIELD_REPAIRS`
  (`src/persistence/settingsSpecPersistence.test.ts:64`) is DIRECTIONAL — `minPx` may move
  `maxPx`, and nothing else; a swap implementation would still fail on the reverse pair, and
  an unwired field still fails the walk. The rule it exempts is pinned independently at that
  same door by the two new `persistedShapes.test.ts:164,172` tests. The ceiling probe
  (`src/view/settingsRowAccessors.test.ts:135`) still writes a distinct in-bounds value, so
  the round-trip property is unchanged.
- **`key={shown}` cannot drop a keystroke, steal focus, or fight the optimistic value.** The
  load-bearing detail is in `PendingEdits.requesting`, which records
  `{ shown: typedValue, settlesAt }` — so the remount right after blur reseeds with the TYPED
  value, and the later store echo reseeds to the number actually stored (whether via the
  settlesAt match or the third-party release). `shown` only moves on a store/optimistic
  change, never mid-typing, and the remount is triggered by the blur that already moved focus.
- **Enter cannot double-write.** `onKeyDown` (`SettingsRowView.tsx:248`) only calls
  `blur()`; `onBlur` is the single writer.
- **The pure/impure split is real.** `numberRowCommit.ts` imports no React; the component is
  markup plus one `policy.commit()` call. Its tests build policies from the REAL accessors and
  a real `SizingRowWrite`, so a change to what a row accepts reaches the suite by itself —
  behaviour, not implementation.
- **`NO_CROSS_FIELD_RULE` is an honest null-object, not a stub.** `CROSS_FIELD_ROWS` in
  `src/view/sizingRowWrite.ts:27` is literally `{minPx, maxPx}`; the node cap has no sibling
  constraint, and its integer/`MIN_NODE_CAP` rule lives in the accessor's `accept` and is
  pinned (`numberRowCommit.test.ts`, "below its declared minimum THEN nothing is written").
- **The omitted "Stored as N …" notice is acceptable** for the accepted-but-capped path: the
  optimistic machinery reseeds the field to the stored number once the write settles, so the
  field states the fact. It is NOT acceptable on the null-commit path — SHOULD-FIX #2.

## 🚨 CRITICAL Issues

None. No security surface, no data loss, no swallowed exception, no layering violation
(`numberRowCommit.ts` is a view module; the engine stays pure).

## ⚠️ SHOULD-FIX Issues

### 1. Dead seeded refusal, with a WHY comment this same commit falsified
`src/view/SettingsRowView.tsx:221-223`

```ts
// Seeded from the STORED value: a hand-edited data.json can hold a refused pair, and
// the row should say so on open rather than only once the user types.
const [refusal, setRefusal] = useState(() => policy.commit(String(stored)).refusal);
```

After `f3b008e` a hand-edited inverted pair can no longer reach `state.globalView.sizing`:
`parseSizing` raises it on load (pinned by the two new `persistedShapes` tests) and
`planSettingsWrite` raises it on every write. So this seed is unreachable dead state and the
comment asserts behaviour that is now impossible — precisely the kind of comment the repo
treats as a lie. **Fix**: `useState<string | undefined>(undefined)` and delete the claim (or
keep the call and say plainly that it is belt-and-braces with no reachable path today).

### 2. A commit that writes nothing leaves the field lying about the stored value
`src/view/SettingsRowView.tsx:238-246`, `src/view/numberRowCommit.ts:70-78`

`commit("")` returns `{ value: null, refusal: undefined }`, so the blur writes nothing, says
nothing, and — because `shown` did not move — does not remount. The field is left BLANK while
the setting still holds, say, `160`, and stays that way until something else changes the value.
That directly undercuts the stated rationale for dropping the tab's cap notice ("the panel
reseeds its field FROM THE STORE on an accepted commit"): the reseed is exactly what does not
happen here. **Fix**: reseed on the no-write-nothing-to-say path only — e.g. a commit counter
folded into the key (``key={`${shown}#${commits}`}``), or set the input back to `stored` in the
blur handler when `committed.value === null && committed.refusal === undefined`. A REFUSED
commit must still keep the typed text. (The settings tab behaves the same way today, so this is
consistent rather than a regression — but the panel field is 4.5em wide and the mismatch reads
as "my setting got cleared".)

### 3. The panel's cross-field judge reads a rendered snapshot; the tab reads the live store
`src/view/SettingsRowView.tsx:357` — `new SizingRowWrite(field, () => state.globalView.sizing)`
vs. `src/view/VicinityGraphSettingTab.ts:562` — `new SizingRowWrite(field, () => this.store.globalView().sizing)`

`state` is the graph snapshot (`GraphToolbar.tsx:35`), which only refreshes after persist +
traversal + elk layout — the very latency `useOptimisticValue` exists to paper over. Inside
that window:

- widening the range legitimately (raise **Max**, then **Min**) can be REFUSED, with a message
  quoting the stale old maximum; and
- an inverted pair can be ACCEPTED and then silently raised by the engine, with no message and
  the field snapping to a number the user did not type.

Neither corrupts data (the engine backstop is exactly the safety net here), and the call-site
comment does disclose that it reads "the globals this render drew from" — but it does not state
the consequence, and `GraphToolbar`'s own doc block warns against exactly this class of
snapshot read. **Fix**: expose a fresh globals read on `ControlsActionsPort` mirroring the tab's
`store.globalView()`, or — if that is out of scope for this ticket — state the consequence at
the call site and file a follow-up ticket.

## 💡 Suggestions (NIT)

- The native number-input **spinner arrows** now only apply on blur/Enter. That contradicts the
  class doc added at `SettingsRowView.tsx:42-45` ("a control the user AIMS … commits
  immediately") on a live-preview surface. Worth one honest sentence there; no code change
  needed.
- A refusal can go **stale**: fixing `minPx` in the other row does not clear the `maxPx` row's
  message, because `shown` for that row did not move. Recovery is a re-commit of that field.
  Acceptable, but currently undocumented.
- CSS naming crosses conventions: `.vicinity-graph-number-row-block` (block) hosting
  `.vicinity-graph-number-row__refusal` (element of a *different* block). Cosmetic.

## Documentation Updates Needed

The `CLAUDE.md` line added at line 44 is accurate and well-scoped, and
`docs-internal/notes/settings.md` records the delivery honestly. Beyond the comment fixes in
#1/#3 above, nothing further is required. The `NodeSizer.test.ts` rewrite must appear in the
PR/release note as the implementer flagged — it is a deliberate change to a behaviour-capturing
test, authorised in the ticket.

## Verdict

Engine half is correct, minimal and well-pinned — including the subtle "raise to the CLAMPED
minPx" case, which has its own test. Panel half does what the ticket asked and the remount
mechanics hold up. The three SHOULD-FIX items are all cheap and all in
`SettingsRowView.tsx`/`numberRowCommit.ts`; none of them touches the engine rule, which should
stand as written.

CHANGES_REQUESTED
