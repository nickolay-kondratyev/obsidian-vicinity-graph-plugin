# IMPLEMENTATION_REVIEW — PUBLIC

Ticket `nid_ek3wrqoh1rsftk6ulg836mghf_e` — "e2e: no spec types into a settings-tab text/number input".
Reviewed commits `7170c24` (code) and `b8d9d39` (notes) on branch
`nid_ek3wrqoh1rsftk6ulg836mghf_e_2026-07-29T23-30-55PDT`.

## Verdict: APPROVED_WITH_MINOR

One MAJOR finding, and it is an **honesty/claim** fix rather than a test-machinery fix: the
`hide()`-flush wiring — one of the three things the ticket names as unverified — is still
unverified, while the commit message and the spec's file header say it is covered. Everything else
is small. The core of the work is good: the assertions are real (I traced each one for vacuity), the
ordering barrier is genuinely sound, no guard was weakened, and nothing leaked out of scope.

## Findings

### 1. [MAJOR] The `hide()`-flush test cannot fail if `hide()` stops flushing

`e2e/settingsTypedInput.e2e.ts:285-305` types a VALID `200`, closes the settings window, then polls
until the store holds `200`. But `VicinityGraphSettingTab.hide()` does **not** cancel the debounce
timer — it only calls `settlePendingWrites()` and then `super.hide()`. `DebouncedSettingsWrites`
lives on the tab instance, which Obsidian keeps alive across open/close, and its `window.setTimeout`
keeps running. So if the `void this.settlePendingWrites()` line in `hide()` were deleted tomorrow,
the pending write would simply land 400 ms later and this test would still go green.

The test's own NAME ("THEN the edit is not lost") is honest, and the WHY-NOT comment at :291-299
and decision #3 in `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` disclose the weaker claim. The problem
is the surrounding copy that does NOT:

- commit message `7170c24`: "the typed-input WIRING (debounce settle, **flush on leaving**, …) had
  zero real-Obsidian coverage" — implying it now has some. It does not.
- `e2e/settingsTypedInput.e2e.ts:16-17`: "the debounce settle, **the flush on leaving**, and the
  inline feedback".
- `flushOnBlur` (the OTHER half of the ticket's "flush on blur/`hide()`") is not exercised at all —
  no test blurs a field.

Why it matters: per CLAUDE.md, behaviour must match naming, and "making tests look like they cover
something they do not" is the exact failure mode the repo's identity section forbids. A future
maintainer reading the commit will believe `hide()`-flush is gated when it is not.

Suggested fix, in preference order:
1. **Cheapest and sufficient**: reword the file header and record the residual gap on the ticket /
   `docs-internal/notes/settings.md` — "flush-on-blur and flush-on-`hide()` remain unproven in
   e2e; only `settingsDebounce.test.ts` gates `flush()` itself".
2. **Optional, and I think defensible**: make it sensitive with a bounded-latency assertion. The
   implementer's own measurement is ~37 ms for this test against a 400 ms window — a >10x margin,
   so asserting "persisted within 250 ms of `close()`" is not the coin-flip race the WHY-NOT comment
   fears. Same trick would gate `flushOnBlur` (`input.blur()`, then bounded poll). If the team still
   prefers not to put a wall clock in a release gate, do (1) and say so.

### 2. [MINOR] `expectPersisted` says `data.json`, but reads the in-memory store

`e2e/settingsWriteWindow.ts:40-45` — "has actually reached `data.json` — the only honest evidence
that a typed edit was STORED" (and the same claim at `settingsTypedInput.e2e.ts:214`). But
`ObsidianHarness.readGlobals()` (`e2e/obsidianHarness.ts:353`) calls `store.globalView()` /
`store.nodeExclusion()` — the plugin's **in-memory** accessors. A write that updated memory and then
failed to persist would satisfy every assertion in this spec.

Fix: reword to "the plugin's settings store" (accurate, still much stronger than the DOM), and/or
have exactly ONE test in the file go the whole way — `await harness.reloadPlugin()` then read — so
the file-level round trip is gated once. The harness already has `reloadPlugin()` for precisely this.

### 3. [MINOR] `drain()`'s preconditions and side effects are not documented

`e2e/settingsWriteWindow.ts:67-75` is the pattern other specs are told to copy, so its contract
should be complete. Three unstated requirements a copier will trip over:

- it requires the settings **tab open** with the `Depth decay k` row rendered and enabled — call it
  after the tab is closed and it hangs for the full 15 s `expect` timeout with a confusing message;
- it only bars the **tab's** `DebouncedSettingsWrites` instance. An edit made in the in-graph
  controls panel is not covered by this barrier;
- it **mutates a real setting** (`sizing.depthDecayK` flips between `0` and `0.5`). Benign here
  because no test reads it, but a copier asserting on `depthDecayK` will be confused.

Fix: three lines in the doc comment.

### 4. [MINOR] Cross-test bleed: a pending debounced write can drain into the next test's GIVEN

Tests at `settingsTypedInput.e2e.ts:179` (and :165) leave a scheduled `maxPx=200` write behind. The
next test's `givenSizingPairSeeded()` (:103-110) seeds `maxPx=160` through the store, and the stale
400 ms drain can land AFTER that seed, silently making the "stored" baseline `200`.

Today this is harmless by luck — the only test that asserts the seeded maximum survived (:208) is
preceded by two tests whose typed value is REJECTED and therefore `drop()`ped, so no write is
pending. It is one reordering or one inserted test away from a real, intermittent failure, and the
symptom would look like the product bug the suite exists to catch.

Fix: make the barrier part of the GIVEN — `await writeWindow.drain()` at the top of
`givenSizingPairSeeded()` (after `settingsTab.open()`), or an `afterEach` that drains. Cheap, and it
turns "no pending write leaked" from an assumption into a fact.

### 5. [NIT] Test 9 asserts `white-space` on the wrong row for the reason it gives

`settingsTypedInput.e2e.ts:267-274` motivates `pre-line` with "a multi-line message (several bad
exclusion lines)" but probes the **sizing** row's slot, whose message is always one line. Same CSS
class, so the assertion is equivalent — but assert it on the exclusion slot (which is the one that
actually goes multi-line) or reword the comment.

### 6. [NIT] The `role="alert"` vs `role="status"` split is never asserted

`addFeedbackSlot` deliberately gives the sizing slot `role="alert"` (interrupts on a refusal) and
the exclusion slot `role="status"` (advisory, must not interrupt). That is a real accessibility
decision with no coverage anywhere, and this spec already holds both locators — two
`toHaveAttribute` lines would gate it.

## What I checked and found NOT to be a problem

- **The ordering barrier is sound**, not a race dressed up. I verified it against
  `src/view/settingsDebounce.ts`: `pending` is an insertion-ordered `Map`, `schedule()` restarts ONE
  shared window, and `drain()` snapshots all thunks and runs them **in edit order inside a single
  `writes.runSerialised` slot, each awaited before the next**. The edit under test is filled before
  the sentinel, so it is earlier in that Map; the sentinel becoming observable therefore implies any
  write for the edit under test already completed. The doubling as a positive control is real too:
  if `fill()` stopped driving the handler, `drain()` fails loud rather than making the caller's
  absence claim vacuous.
- **No sleeps, no retry-until-pass, no hidden waits.** `grep` confirms zero `waitForTimeout` /
  `sleep` in both new files. Every wait is `expect.poll` or a web-first assertion.
- **The sentinel values cannot hang the poll.** `SENTINEL_VALUES` is `{min, min+step}` from the
  row's own accessor bounds (`depthDecayK`: `min 0, max 10, step 0.5`), and
  `clampSizingNumber` → `clampIntoRange` only clamps to `[min,max]` — no step snapping, no rounding
  for sizing numbers (rounding is the DEPTH accessor's, not this one). So `0.5` is stored verbatim
  and the poll's expected value is reachable. `nextSentinelValue()` correctly guarantees the sentinel
  always CHANGES the stored number.
- **No assertion is vacuously true.** I traced each: the two persistence claims move the value away
  from the seeded baseline; both feedback assertions are `toHaveText` against a message COMPUTED by
  the product's own `describeSizingRejection` / `describeInvalidExclusionPatterns`; the colour test
  guards itself against an unresolved `var()` by first proving `--text-error` differs from the
  inherited root colour (so deleting the CSS rule reddens it — the slot would inherit
  `--text-muted` from `.setting-item-description`); the `display:none` probe would throw, not pass,
  if the slot were missing.
- **"Under the row" is genuinely part of the assertion.** `SettingsTabPage.feedbackUnder()` scopes
  through `.setting-item` → `.setting-item-description`, so a slot rendered anywhere else fails.
- **No guard weakened, nothing deleted.** `git show 7170c24 --stat -- '*test*'` is EMPTY — no
  `*.test.ts` was touched, no allowlist entry added, no anchor point removed. The only edit to an
  existing spec (`e2e/settingsDependentRows.e2e.ts`) is pure DRY delegation of three locators to the
  page object with identical selectors.
- **Scope discipline holds.** Nothing under `src/` changed; no jsdom render-parity harness appeared
  (that is `nid_7qot0m6nuxxmd5z0yb9jylsd6_e`).
- **Conventions**: BDD `WHEN … THEN …`, one behaviour per test, page-object locators, labels derived
  from the declared row model via the new `soleRowControlName` / `sizingNumberControlName` (which
  throw loudly on ambiguity rather than silently matching the first row), screenshots to `.out/`
  (gitignored), selector guard satisfied because `.vicinity-graph-settings-error` really is rendered.

## Verified myself vs. taken on trust

**Verified myself** (all output to `.tmp/`):

| Command | Result |
|---|---|
| `npm run check` | **exit 0** (`.tmp/review-check.log`) |
| `npm test` | **exit 0 — 94 files, 1245 tests passed** (`.tmp/review-test.log`) |
| `npm run test:e2e -- settingsTypedInput.e2e.ts` | **exit 0 — 11 passed (4.3 s)**, real Obsidian (`.tmp/review-e2e.log`) |
| `git show 7170c24 --stat -- '*test*'` | empty — no existing test/guard file touched |

I also read `src/view/settingsDebounce.ts`, `src/view/settingsRowAccessors.ts`,
`src/engine/constants.ts` (`clampSizingNumber`), `src/engine/SettingsSpec.ts:229` and
`e2e/obsidianHarness.ts:345-400` in full to check the barrier's premises rather than take the
implementer's description of them.

The per-test timings in my own run corroborate finding #1 independently: test 11 (close-then-assert)
settled in **37 ms** while the tests that wait out the real window took **~900 ms** — the flush is
plainly working, and equally plainly the assertion would still pass at 900 ms.

**Taken on trust**: the FULL e2e suite result (`106 passed`). I ran only the new spec (~10 min for
the full gate). Given the only existing spec touched is `settingsDependentRows.e2e.ts` and the change
there is a mechanical locator delegation I diffed line by line, the risk is low — but I did not
re-run it.

## Documentation updates needed

- Address finding #1 in whichever form the team picks; if it is the "disclose the gap" option, the
  note belongs on the ticket and in `docs-internal/notes/settings.md`.
- `docs-internal/architecture-map.md`: a one-liner that `e2e/settingsWriteWindow.ts` is THE
  typed-input debounce-window pattern for e2e specs (the implementer flagged this for the
  orchestrator; I agree it is worth the line, since the whole point is that other specs copy it).

---

# Round 2 — convergence check

Reviewed commit `79ca22a` ("test(e2e): make the settings flush-on-leaving claims falsifiable") on
the same branch. e2e only; `git show 79ca22a --stat` touches `e2e/settingsTabPage.ts`,
`e2e/settingsTypedInput.e2e.ts`, `e2e/settingsWriteWindow.ts` and two `.ai_out/` notes. No `src/`
file, no `*.test.ts`, no guard, no allowlist.

## Verdict: APPROVED

All six round-1 findings RESOLVED. The MAJOR fix is real, not cosmetic — I falsified it myself by
mutation rather than trusting the implementer's table, and I stress-tested the flakiness question
under a deliberately loaded machine. I signal readiness to converge.

## Per round-1 finding

### 1. [MAJOR] `hide()`-flush test could not fail — **RESOLVED**

`SettingsWriteWindow.expectFlushedAheadOfWindow()` (`e2e/settingsWriteWindow.ts:80-97`) takes the
ACTION, starts the clock itself, polls at 10 ms, and then asserts `elapsedMs <
SETTINGS_WRITE_DEBOUNCE_MS * 0.75`.

**The soundness argument holds.** I checked it rather than accepted it: the fallback path is
`window.setTimeout(…, SETTINGS_WRITE_DEBOUNCE_MS)` armed inside `DebouncedSettingsWrites.schedule()`
at the keystroke; `startedAt` is captured strictly BEFORE `editAndLeave()` runs, so the timer's
earliest possible firing is `startedAt + 400 ms` or later (`setTimeout` may fire late, never early).
Any observation at `< 400 ms` from `startedAt` therefore cannot be the timer, and the 300 ms budget
is strictly inside that. There is no path where the debounce deadline satisfies the assertion. The
budget also derives from the product constant (`SETTINGS_WRITE_DEBOUNCE_MS` imported from
`src/view/constants.ts`), so it tracks the window rather than duplicating a magic 300.

**Falsifiability — verified MYSELF by mutation, not taken on trust.** I temporarily emptied
`VicinityGraphSettingTab.flushOnBlur` (kept the method, dropped the listener), re-ran the blur test,
then `git checkout`-ed the file and confirmed a clean tree plus a green re-run. Result:

```
✘ … WHEN a field is left right after a typed edit THEN the edit is flushed …
Error: leaving a field did not persist the edit … — it only landed after 468ms, i.e. it was the
400ms debounce timer that persisted it, not the flush
```

That is the round-1 complaint answered exactly: the test that previously could not fail now fails,
loudly, with a diagnostic that names the real cause. `flushOnBlur` has genuine coverage where it had
none.

**Flakiness — I do NOT think 12–16 ms vs 300 ms will bite in CI.** I probed the concern directly
rather than reasoning about it: 64 CPU-burning processes on a 32-core box (2× oversubscription),
`--repeat-each=6` over just the two flush tests ⇒ **12/12 passed**. Under that load the whole test
wall-clock rose from ~930 ms to ~1.2 s (≈30 % slower end to end) while the flush assertion never
came close to the budget. To fail spuriously the flush would have to slow by ~20×, at which point
the run's other web-first assertions (15 s timeouts) would be failing first. This is headroom, not a
coin flip. Clean `--repeat-each=5` on the whole spec: **75/75**.

**The close test's honesty caveat matches the name and header.** Name: "WHEN the settings window is
closed right after a typed edit THEN the edit is flushed without waiting out the window" — that is
the OUTCOME claim, and it is exactly what the test proves. The header now says "the flush on leaving
a field or closing the window"; it no longer claims `hide()` in isolation. The in-test comment
states the measured reason (closing also blurs the focused field, so `flushOnBlur` wins the race)
and says the test deliberately does not isolate `hide()`. Naming, header and behaviour agree — which
is the CLAUDE.md requirement the round-1 finding was really about. I agree with the trade: forbidding
the second belt would be testing the implementation.

### 2. [MINOR] `expectPersisted` said `data.json`, read memory — **RESOLVED (both halves)**

Reworded to "the plugin's SETTINGS STORE" with an explicit SCOPE paragraph naming `reloadPlugin()`
as the way to make the file claim, and the stale `data.json` mention at the absence test is gone. A
new LAST test does the real round trip: type → close → `expectPersisted` → `harness.reloadPlugin()`
(`disablePlugin`/`enablePlugin`, which drops the in-memory stores) → read. Ordering is right: it is
last in a `mode: "serial"` file, so replacing the plugin instance cannot disturb anything.

### 3. [MINOR] `drain()` contract — **RESOLVED**

Three bullets, all three of the terms I named: the tab-open precondition (including that violating
it hangs to the `expect` timeout with a misleading message), that it bars the TAB's debouncer only
and not the in-graph panel's, and that it mutates `sizing.depthDecayK` — plus the instruction that a
spec asserting on that field must seed after the last `drain()`.

### 4. [MINOR] cross-test bleed — **RESOLVED**

`givenNoWriteStillPending()` at the top of BOTH GIVENs, after `settingsTab.open()` (correct order —
the drain needs the tab open, and it runs before the seed write). The ordering assumption is now a
fact. Cost is real but acceptable: the spec went 11 tests / 4.3 s to 15 tests / ~18 s, i.e. ~900 ms
per test is now drain. Noted, not objected to — a release gate that is 14 s slower and cannot bleed
is the right trade.

### 5. [NIT] `pre-line` on a row that cannot go multi-line — **RESOLVED**

Moved to the exclusion slot with a genuinely two-bad-line input, and a `toContainText("\n")` first,
so the CSS assertion is now about a message that actually has a break to lose.

### 6. [NIT] `role="alert"` vs `role="status"` unasserted — **RESOLVED**

Two tests, one per side, each naming why the urgency differs. The role names are declared as named
constants with a comment explaining why they are inlined here rather than imported.

## Regressions / weakened guards

None. No `src/` change (`git show 79ca22a --stat` confirms), no `*.test.ts` touched, no guard
allowlist entry, no anchor point removed, no test deleted — test 11 was RESHAPED into a stronger
claim and its old weaker WHY-NOT comment removed along with the weakness it described, which is the
correct direction. The only new page-object method (`SettingsTabPage.blur`) is additive and
documents why it is not "click somewhere else" (clicking another typed row would schedule a
competing write).

## Verified myself vs. taken on trust

**Verified myself** (all logs under `.tmp/`):

| Command | Real result |
|---|---|
| `npm run check` | **exit 0** (`.tmp/r2-check.log`) |
| `npm test` | **exit 0 — 94 files, 1245 tests passed** (`.tmp/r2-test.log`) |
| `npm run test:e2e -- settingsTypedInput.e2e.ts` | **exit 0 — 15 passed (17.9 s)** (`.tmp/r2-e2e.log`) |
| same, `--repeat-each=5` | **exit 0 — 75/75 passed (1.5 m)**, per-test durations 918–939 ms, spread of ~20 ms (`.tmp/r2-e2e-repeat.log`) |
| the 2 flush tests, `--repeat-each=6`, under 64 busy processes on 32 cores | **12/12 passed**, durations 730 ms–1.4 s (`.tmp/r2-e2e-load.log`) |
| MUTATION: `flushOnBlur` listener removed, blur test | **FAILS at 468 ms** (`.tmp/r2-mutation-blur.log`) — my own number, implementer reported 415 ms; same direction, same conclusion |
| after `git checkout src/view/VicinityGraphSettingTab.ts` | tree clean (`git status --porcelain` empty), spec re-run **15 passed** (`.tmp/r2-e2e-postrevert.log`) |

I could not read the flush's `elapsedMs` directly without editing test code (I am read-only), so the
"12–16 ms" figure itself is inferred rather than observed: the two flush tests run 918–939 ms against
a ~912 ms no-flush baseline test in the same run, i.e. a delta in the low tens of ms — consistent
with the implementer's claim. The claim that matters (it is well under 300 ms, and over 400 ms
without the flush) I verified directly.

**Taken on trust**: the FULL e2e suite (`110 passed, 1 skipped`) and the two mutations I did not
reproduce (`hide()`-only removal still passing at 16 ms; BOTH removed failing at 414 ms). The first
is corroborated by my own blur mutation reaching 468 ms via the timer; the second is a claim about
which belt wins, not about whether the test can fail, and I proved the latter myself.

## Readiness signal

**Yes — as REVIEWER I signal readiness to converge.** No BLOCKING, no MAJOR, no new findings. The
one round-1 MAJOR is closed with evidence I generated independently.

## Documentation updates still open (unchanged from round 1, for TOP_LEVEL_AGENT)

- `docs-internal/architecture-map.md`: one line that `e2e/settingsWriteWindow.ts` is THE typed-input
  debounce-window pattern for e2e specs (now doubly worth it — it also owns
  `expectFlushedAheadOfWindow`, the pattern for asserting a flush beat its own timer).
- Ticket/change-log bookkeeping: the ticket's three named gaps (debounce settle, flush on leaving,
  inline feedback) are now all covered; no residual gap to record.
