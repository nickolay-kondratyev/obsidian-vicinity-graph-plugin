# IMPLEMENTATION_REVIEW — settings-debounce-validation

Reviewed: `git diff main...HEAD` (3 code/doc commits), branch `settings-debounce-validation`.
Ticket `nid_x6l6x07rd1d1h4cefqmnyrbec_e`.

**Verification run by the reviewer (not taken on trust):**
- `npm test` → **1038 passed / 78 files, exit 0** (`.tmp/review-test.log`)
- `npm run check` → **clean, src + e2e, exit 0** (`.tmp/review-check.log`)
- No test file deleted or weakened on this branch; the only removals in `src/` are the code
  moved out of `VicinityGraphSettingTab.ts` into `settingsValidation.ts`. No anchor points touched.
- No `sanity_check.sh` in this repo.

Overall: the shape is right — two pure, testable view modules plus thin obsidian glue, layering
respected (nothing new under `engine/`/`shared/`, no `obsidian`/`react` leakage), good WHY comments,
honest deferral tickets. Nothing here is a security issue and nothing is a silent behavior removal.
The findings below are correctness/test-strength issues, not style.

---

## Findings

### SHOULD-FIX 1 — The "Depth decay k" row is rejected by an unrelated min/max inversion
`src/view/VicinityGraphSettingTab.ts:600-635` (`addSizingNumber`), used at `:418` for `Depth decay k`.

`addSizingNumber` runs `describeSizingRejection(toSizing(parsed))` for **every** sizing number row,
and `describeSizingRejection` only ever inspects `minPx`/`maxPx`. For the decay-k row `toSizing`
carries `minPx`/`maxPx` straight from the store, so if the stored pair is inverted (which the
implementer's own deferred ticket `nid_9jiira82snkh7bgy8zv060c9r_e` says is still reachable via a
hand-edited `data.json` or `SizingSection.tsx`):

- on open, the decay-k row shows `Not applied: maximum node size (50px) must be at least the
  minimum (300px).` and gets `aria-invalid` — a message about a field that is not this field;
- every keystroke in decay-k hits `this.debounced.drop(name); return;` at `:628-631`, so **decay-k
  cannot be edited at all** until the user works out that a different row is the culprit.

Why it matters: a validation rule that refuses input for a reason unrelated to the input is exactly
the POLS violation the ticket set out to remove.
Direction: only run the cross-field check on the two rows that participate in it — e.g. pass an
optional `validate?: (sizing) => string | undefined` per row (identity/`undefined` for decay-k), or
give `addSizingNumber` a `crossField: boolean`. Cheapest honest fix: hoist the check into the
min/max call sites.

### SHOULD-FIX 2 — The debounce **timer** path is not actually pinned by any test
`src/view/settingsDebounce.test.ts:64-81, 92-98`.

Both tests that call `h.scheduler.elapse()` immediately `await h.debounced.flush()` afterwards. If
`elapse()` fired nothing at all (or if `restartWindow()` never scheduled anything), `flush()` would
drain the same pending map and both tests would still pass. The only elapse-sensitive test
(`"the flushed write is NOT repeated"`) proves elapse does *not* write — never that it *does*.

Net: the suite pins the coalescing map and `flush`/`drop`, but **not** the debounce itself, which is
acceptance criterion #1. That is a vacuity risk in exactly the behavior the ticket exists for.
Direction: one test — `schedule(...)`, `scheduler.elapse()`, `await Promise.resolve()` (or await a
promise captured from the thunk), assert the write landed **without** any `flush()` call.

### SHOULD-FIX 3 — Rejection is decided at keystroke time but the write is re-derived at flush time
`src/view/VicinityGraphSettingTab.ts:626-632`.

`describeSizingRejection` runs against the store snapshot at keystroke time; the scheduled thunk
`() => this.applySizing(toSizing(parsed))` re-reads the store **at flush time** and persists whatever
pair results, unvalidated. So a pending max/min write can persist an inverted pair if the store moved
between the keystroke and the flush (in-view `SizingSection.tsx` writing the same globals, a section
reset, a second view). In practice the blur-flush makes the tab-only path narrow, but the guard is
one line and the invariant is currently claimed, not enforced.
Direction: re-validate inside the thunk and skip (or drop) if the freshly-derived pair is rejected —
the same `describeSizingRejection(toSizing(parsed))` call, evaluated where the write happens.

### SHOULD-FIX 4 — Regex-compile knowledge is duplicated between view and engine
`src/view/settingsValidation.ts:89-96` (`compileFailure`) vs `src/engine/PathExclusionMatcher.ts:37-44`
(`compile`).

Both encode "an exclusion pattern is `new RegExp(pattern)`, no flags". The whole value of AC #4 is
that the tab's verdict matches what the engine will actually do; the moment the engine adds a flag or
a pre-check, the tab starts reporting false positives/negatives with no test to catch the drift.
Direction: expose the predicate from the engine (e.g. `PathExclusionMatcher.compileFailure(pattern)`
returning `string | undefined`) and have `settingsValidation` call it. Stays pure, keeps layering.

### SHOULD-FIX 5 — Out-of-range typed values still persist silently different from what the field shows
`src/view/VicinityGraphSettingTab.ts:618-632`, with clamping in `planSettingsWrite`.

Typing `500` into *Maximum node size* is accepted, scheduled and clamped to `400` by the planner. The
field keeps showing `500`, no feedback appears, and the stored value is something the user never
typed. This branch's stated thesis is "never silently persisted, never silently reverted"
(`addSizingNumber` doc comment) — that holds for the inverted pair and not for the bounds, which is
the same class of dishonesty and the same feedback slot away from being fixed. Note it is
*pre-existing* behavior (and is item 2 of `nid_hatwq2jlkhno5t6awcz0q6t9q_e`), so a ticket is an
acceptable resolution — but shipping AC #3 as "the bounds bite" while the UI hides that they bit is
worth calling out.
Direction: when `planSettingsWrite`'s result differs from the typed value, show
`Capped at 400px.` in the existing slot (warning, not rejection).

### CONSIDER 6 — `void this.debounced.flush()` can raise an unhandled rejection
`src/view/VicinityGraphSettingTab.ts:143, 152-154`.

`DebouncedSettingsWrites.flush()` deliberately returns a promise that rejects when a write fails
(`settingsDebounce.ts:103-105`, and the test at `settingsDebounce.test.ts:106-113` pins it). Both
production callers `void` it, so a failed `data.json` write on blur/hide becomes an unhandled
rejection and the user is told nothing. Direction: `.catch(...)` with a structured console log
(repo convention: no values interpolated into the message), or a `Notice`.

### CONSIDER 7 — `display()` / restore-defaults do not flush or cancel pending writes
`src/view/VicinityGraphSettingTab.ts:122-136, 690-697`, and the `this.display()` calls at `:298`, `:380`.

The debouncer outlives a re-render (it is an instance field), so a pending write survives `display()`
and lands afterwards against freshly-read globals — the tab then shows a value the store no longer
has, and a pending write can land *after* a section reset and quietly undo part of it. Today this is
saved only by the fact that clicking a toggle/reset blurs the focused input first, which is an
implicit ordering dependency nothing states or tests. Direction: `await this.debounced.flush()` at
the top of `applyReset` / before re-rendering, and say so in the `display()` doc.

### CONSIDER 8 — `role="alert"` on the exclusion warning fires on every keystroke
`src/view/VicinityGraphSettingTab.ts:163-165, 328`.

The same slot is used for a hard rejection (assertive is right) and for the per-keystroke pattern
warning (assertive interrupts a screen-reader user on every character). Direction: `role="status"` /
`aria-live="polite"` for the warning slot; keep `alert` for rejections.

### CONSIDER 9 — One shared settle window across fields
`settingsDebounce.ts:56-59, 76-82`. Any field's keystroke restarts the *shared* window, so continuous
typing in field B holds field A's pending write open indefinitely. Documented as intentional and
bounded by the blur flush; flagged only so the trade-off is a decision, not an accident.

### NIT 10 — Implementation record over-counts the debounce tests
`IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` says `settingsDebounce.test.ts (12)`; the file has 9.
Records that are checked get trusted; keep the count honest.

### NIT 11 — Pre-existing ticket left un-updated
`_tickets/decide-node-sizing-minpx-maxpx-inverts-the-size-ramp-and-per-keystroke-clamping-snaps-the-field.md`
(`nid_hatwq2jlkhno5t6awcz0q6t9q_e`) item 1 is now half-answered by this branch (the settings tab does
visibly reject), but the ticket has no note and no link to the new
`nid_9jiira82snkh7bgy8zv060c9r_e`. Add a note so a future reader does not re-derive the same analysis.

### NIT 12 — Stray untracked file in the working tree
`_tickets/nodes-in-groups-folder-to-be-tighther-together.md` is untracked and unrelated to this
branch (pre-existing, not created by this review). Commit it or remove it before merging.

---

## Things I checked and found genuinely fine

- **Latest-wins / per-field independence / drain order**: `Map` insertion order gives edit-ordered
  drain; `await` between writes means the "successive edits compose" invariant survives, and the
  thunk-not-command decision (`settingsDebounce.ts:13-16`) is the right call and is documented.
- **No double-persist**: `flush()` cancels the window before draining, and `drain()` clears `pending`
  before running — a window firing after a flush writes nothing. Pinned by test.
- **No leaked timers on close**: `hide()` → `flush()` → `cancelWindow()`.
- **Rejected input is genuinely not persisted** (`drop` before `schedule`), the typed text stays in
  the field, `aria-invalid` is set, and the message is real DOM text, not a console log.
- **Regex line numbers** count blank lines (`numberedPatternLines` numbers before filtering) — correct
  and pinned; `\r\n` survives via `trim()`; invalid lines are surfaced but still persisted, with the
  WHY stated (refusing would discard the valid lines typed in the same edit). Honest.
- **Layering**: both new modules live in `src/view/`, import only `../engine` types; `importGuard`
  still green.
- **Deferrals** (engine-level cross-field guard, `nodeCap` ceiling, slider debounce, e2e typing) are
  real tickets with rationale, not quietly-broken behavior. Slider debounce being out of scope is
  correct — routing a drag through 400 ms is an unrequested feel change.

## Acceptance criteria

| # | Criterion | Verdict | Note |
|---|-----------|---------|------|
| 1 | Numeric/text settings debounce before persisting + rebuilding | **PARTIAL** | Implementation is correct; the *timer* behavior is not pinned by a test (SHOULD-FIX 2), and the tab wiring is untested glue (acknowledged, ticketed as e2e follow-up). |
| 2 | `maxPx < minPx` rejected with visible feedback | **PARTIAL** | Rejection + inline message + `aria-invalid` are real and tested. Bleeds onto the decay-k row (SHOULD-FIX 1); not re-validated at flush time (SHOULD-FIX 3). |
| 3 | Upper bounds in SETTINGS_SPEC for sizing px and decay-k | **MET** | Already present; three write-path tests pin that they bite. Per TOP_LEVEL scope call, correct response. (See SHOULD-FIX 5 for the UX side.) |
| 4 | Invalid regex lines surfaced | **MET** | Per line, 1-based, engine reason on hover, shown on open too. Duplicate compile rule is the maintainability risk (SHOULD-FIX 4). |
| 5 | BDD tests cover each | **PARTIAL** | Style and granularity are good; AC #1's core is under-pinned (SHOULD-FIX 2). |

## Readiness

**Not blocking, but not done.** Nothing here is a security issue, a data-loss path, or a removal of
prior behavior, and the suite is green — I would not hold the branch for the CONSIDERs. I would
resolve **SHOULD-FIX 1, 2 and 3** before merge: 1 is a user-visible wrong-field rejection, 2 means the
headline acceptance criterion is not actually pinned, and 3 is a one-line enforcement of an invariant
the code already claims. SHOULD-FIX 4 and 5 are legitimate ticket material if the human prefers.

## Documentation updates needed

- None for `CLAUDE.md` — no new stable convention was introduced that is not already local to the
  modules (the debounce seam is documented in place).
- `README.md` changes are accurate as written.
- Add the note/cross-link to `nid_hatwq2jlkhno5t6awcz0q6t9q_e` (NIT 11).
