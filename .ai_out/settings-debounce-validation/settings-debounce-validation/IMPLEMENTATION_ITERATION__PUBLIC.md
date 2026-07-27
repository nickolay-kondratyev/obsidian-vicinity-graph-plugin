# IMPLEMENTATION_ITERATION — round 1 (settings-debounce-validation)

Branch `settings-debounce-validation`, review round 1 of max 4.
Fix commit: `7207d02` (code + tests + README). Ticket notes/links updated via `ticket`.

**Verification (run here, not taken on trust):**
- `npm test` → **1053 passed / 79 files, exit 0** (`.tmp/test.log`) — was 1038/78; +15 tests, none removed.
- `npm run check` → **clean, src + e2e, exit 0** (`.tmp/check.log`).
- Every fix was sabotage-checked: the new tests were run against a deliberately broken
  implementation and observed to FAIL (details per finding below), so none of them is vacuous.

---

## Disposition table

| # | Finding | Disposition | Where |
|---|---------|-------------|-------|
| SHOULD-FIX 1 | Cross-field check rejects the unrelated "Depth decay k" row | **INCORPORATED** | `src/view/sizingRowWrite.ts` |
| SHOULD-FIX 2 | Debounce TIMER path not actually pinned (AC #1 vacuous) | **INCORPORATED** | `src/view/settingsDebounce.test.ts` |
| SHOULD-FIX 3 | Rejection judged at keystroke time, write re-derived at flush time | **INCORPORATED** (exploitable — confirmed) | `src/view/sizingRowWrite.ts` |
| SHOULD-FIX 4 | Regex-compile knowledge duplicated view ↔ engine | **INCORPORATED** | `src/engine/PathExclusionMatcher.ts` |
| SHOULD-FIX 5 | Out-of-range typed value silently stored as something else | **INCORPORATED** (not deferred to a ticket) | `src/view/sizingRowWrite.ts` |
| CONSIDER 6 | `void flush()` can raise an unhandled rejection | **INCORPORATED** | `VicinityGraphSettingTab.settlePendingWrites` |
| CONSIDER 7 | `display()` / restore-defaults do not settle pending writes | **INCORPORATED** | 3 call sites + `display()` doc |
| CONSIDER 8 | `role="alert"` fires on every keystroke of the pattern warning | **INCORPORATED** | `addFeedbackSlot(row, role)` |
| CONSIDER 9 | One shared settle window across fields | **REJECTED** (no change; already a documented decision) | — |
| NIT 10 | Implementation record over-counts the debounce tests | **INCORPORATED** | `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` |
| NIT 11 | Pre-existing ticket left un-updated | **INCORPORATED** | `nid_hatwq2jlkhno5t6awcz0q6t9q_e` note + link |
| NIT 12 | Stray untracked `_tickets/nodes-in-groups-…md` | **REJECTED** (out of my hands) | — |

---

## Detail

### SHOULD-FIX 1 — INCORPORATED
The reviewer is right, and the consequence was worse than cosmetic: with a stored inverted pair the
decay-k row rejected **every** keystroke, so the field could not be edited at all.

The fix is structural rather than a flag. A new `src/view/sizingRowWrite.ts` (`SizingRowWrite`) owns
one sizing row's whole write policy, and the set of rows the `maxPx >= minPx` rule is *about* lives
there as `CROSS_FIELD_ROWS = {minPx, maxPx}` — `depthDecayK` is judged by nothing. Side effects: the
three `toSizing` lambdas in the tab collapse into `addSizingNumber(section, name, field)`, and the
row's bounds/seed value are derived from the field instead of being passed in.

**Sabotage check**: reverting `CROSS_FIELD_ROWS` to "every row" fails
`WHEN the STORED pair is inverted THEN the depth-decay row still accepts its own value` (+2 more).

### SHOULD-FIX 2 — INCORPORATED
Agreed and it was the most serious item: the tests could not fail. Both `elapse()` tests no longer
call `flush()`; they await a harness promise that only the *write thunk itself* resolves, with a 1 s
per-test timeout so a dead timer fails fast instead of hanging on vitest's 5 s default.

**Sabotage check**: making `restartWindow()` a no-op (i.e. no debounce at all) fails both tests —
verified before applying anything else. Under the old tests it would have stayed green.

### SHOULD-FIX 3 — INCORPORATED, and yes it is exploitable
The pending thunk read the store at flush time and persisted the result unvalidated, so any surface
that lowered `maxPx` between the keystroke and the flush (`src/view/SizingSection.tsx`, a second
view, a section reset) made the tab persist an inverted pair. `SizingRowWrite.persistIfAccepted()`
re-takes the verdict where the write happens and persists nothing when it now fails.

**Sabotage check**: removing the re-check fails
`WHEN the globals turn the pending pair inverted THEN the flushed write persists NOTHING`.

### SHOULD-FIX 4 — INCORPORATED
`new RegExp(pattern)` now appears exactly once, in `PathExclusionMatcher.compilePattern`; both the
matcher's silent-skip path and the new public `PathExclusionMatcher.compileFailure()` go through it,
and `settingsValidation` asks the engine instead of re-implementing the rule. Three engine tests
pin the agreement, including "a pattern reported as failing is one the matcher skips". Layering is
unchanged (view → engine; the engine gained no dependency).

### SHOULD-FIX 5 — INCORPORATED (I chose the fix over the ticket)
The reviewer allowed a ticket. I did the fix instead: with `SizingRowWrite` in place it is ~10 lines
and 3 tests, and "the field shows 500, the store holds 400, nothing says so" is the same dishonesty
the branch exists to remove. The row now shows `Stored as 400 — the allowed range is 40–400.` as a
*warning* (value still written, no `aria-invalid`), computed with the engine's own
`clampSizingSettings` so the message cannot claim a cap the write path does not perform.

Scope note: this covers the settings TAB only. `src/view/SizingSection.tsx` (the in-view mirror)
still clamps silently and still snaps the field mid-keystroke — recorded on
`nid_hatwq2jlkhno5t6awcz0q6t9q_e`, which needs a human UX call for both surfaces.

### CONSIDER 6 + 7 — INCORPORATED together
One method now carries both: `settlePendingWrites()` awaits `flush()` and logs failures instead of
leaking a rejection. It is `await`ed at the top of `applyReset()` and in the two toggle handlers that
call `display()`, and `display()`'s new doc states the requirement, so the previously implicit
"clicking blurs the input first" ordering dependency is now explicit. Swallow-with-a-log inside it is
deliberate and documented: a failed `data.json` write must not abort the reset the user just asked
for, and the rejection has nowhere else to go.

### CONSIDER 8 — INCORPORATED
`addFeedbackSlot(row, role)`: `alert` for the sizing rows (a refusal should interrupt), `status` for
the exclusion-pattern warning (it updates on every character of a half-typed regex).

### CONSIDER 9 — REJECTED (no code change)
This is the design the reviewer describes and accepts; they flagged it only so the trade-off is on
record. It is: one shared "the user stopped typing" window is simpler than per-field timers, cannot
drop an edit (every pending field drains), and is bounded by the blur flush. Continuous typing in
field B holding field A's write open is not a defect — A's value is not lost, only later, and the
user is still typing in the same tab. Already documented in `settingsDebounce.ts`. No change.

### NIT 12 — REJECTED (constraint, not disagreement)
`_tickets/nodes-in-groups-folder-to-be-tighther-together.md` is untracked, unrelated to this branch,
and I was explicitly instructed not to touch it. It remains the only untracked file; everything else
is committed. This is the human's call, not mine.

---

## Tests added (15 new, 0 removed, 0 weakened)

| File | New | What they pin |
|------|-----|---------------|
| `src/view/sizingRowWrite.test.ts` (new) | 12 | Cross-field verdict is min/max-only; the depth-decay row is editable under an inverted stored pair; an accepted write moves only its own field and composes with globals that moved; a pair that turned inverted after the keystroke persists NOTHING; an out-of-range value warns and is still written. |
| `src/engine/PathExclusionMatcher.test.ts` | 3 | `compileFailure` agrees with the matcher's silent-skip contract, carries the engine's own reason, and is silent for a valid pattern. |
| `src/view/settingsDebounce.test.ts` | 0 (2 strengthened) | The two `elapse()` tests now pass ONLY if the settle window actually fires. |

## Readiness

**Ready for re-review / merge from my side.** All three must-fix findings are fixed, each
demonstrated failing before the fix by sabotaging the implementation; both remaining SHOULD-FIXes and
all three CONSIDERs are incorporated. `npm test` 1053/1053 and `npm run check` are green, the working
tree is clean apart from the pre-existing untracked ticket file I was told to leave alone, and no
`change_log` entry was written (TOP_LEVEL_AGENT owns that).

**Open disagreements with the reviewer: none.** CONSIDER 9 is rejected as "no action needed", which
is what the reviewer themselves proposed; NIT 12 is a constraint I was given, not a judgement.

**Still deliberately not done** (unchanged from the implementation record, all ticketed):
engine-level cross-field guard (`nid_9jiira82snkh7bgy8zv060c9r_e`, `[decide]`), `nodeCap` ceiling
(`nid_aau4r0sj8oudhi711qr9j5x1l_e`, `[decide]`), slider debounce, and an e2e spec that types into a
settings input — the tab's obsidian wiring is still glue with no unit harness, which is precisely why
this round moved the decision logic out of it.
