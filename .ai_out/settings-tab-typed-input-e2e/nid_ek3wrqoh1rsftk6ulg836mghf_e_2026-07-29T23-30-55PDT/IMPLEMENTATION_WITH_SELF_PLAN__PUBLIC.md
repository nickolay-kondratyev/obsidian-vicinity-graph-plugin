# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC

Ticket `nid_ek3wrqoh1rsftk6ulg836mghf_e` — "e2e: no spec types into a settings-tab text/number input".
Branch `nid_ek3wrqoh1rsftk6ulg836mghf_e_2026-07-29T23-30-55PDT`, commit `7170c24`. Tree is CLEAN.

## Status: DONE, and actually VERIFIED against a real Obsidian

| Gate | Command | Result |
|---|---|---|
| Types | `npm run check` (`tsc` + `check:e2e`) | **exit 0** (`.tmp/check.log`) |
| Unit / guards | `npm test` | **exit 0 — 94 files, 1245 tests passed** (`.tmp/test.log`) |
| New spec, real Obsidian | `npm run test:e2e -- settingsTypedInput.e2e.ts` | **11 passed (4.4s)** (`.tmp/e2e.log`) |
| FULL e2e suite | `npm run test:e2e` | **106 passed (59.2s)** (`.tmp/e2e-full.log`) |

The e2e suite DOES run in this environment (the pinned Obsidian resolved without manual setup), so
nothing here is an unexecuted liability and no environment follow-up ticket is needed. I ran the
full suite as well because I touched an existing spec (see "DRY" below).

## Acceptance criteria

- ✅ "types an inverted maximum node size and asserts the inline rejection is visible and the value
  did NOT persist" — three tests: the message is visible **under that row**, the input carries
  `aria-invalid="true"`, and after the settle window has demonstrably drained the store still holds
  the seeded maximum (the typed text is left in the field, which is the product's intent).
- ✅ "types an invalid regex line and asserts the line is named" — the feedback reads exactly what
  `describeInvalidExclusionPatterns` composes, i.e. `Line 2: "[unterminated" is not a valid regular
  expression — ignored.`; a second test pins that the line is nonetheless STORED (the declared
  "surface, never reject" policy).
- ✅ "must account for the `SETTINGS_WRITE_DEBOUNCE_MS` window — establish the pattern" — see below.
- ✅ also-wanted: the feedback element is asserted **under the row** (the locator is scoped through
  the row's `.setting-item-description`), and `.vicinity-graph-settings-error` is asserted styled as
  intended: colour resolves to the theme's `--text-error`, `white-space: pre-line` survives, and an
  empty slot computes `display: none`.

## The debounce pattern (the part worth reviewing)

`e2e/settingsWriteWindow.ts`, class `SettingsWriteWindow`. **There is not a single
`waitForTimeout`/sleep in any of this.** Two methods, because a typed-input spec asks two different
questions:

- `expectPersisted(read, expected, message)` — "did it land?" → `expect.poll` on the harness's view
  of the store. Web-first, no timing assumption.
- `drain()` — "did it NOT land?", which no poll can settle. Answered by **ordering, not wall
  clock**: `DebouncedSettingsWrites` keeps ONE settle window shared by every typed row and drains
  all pending thunks together, so `drain()` makes a *sentinel* edit in another debounced row
  (`Depth decay k` — the only sizing number with no cross-field rule) and polls until the sentinel
  is in `data.json`. Seeing the sentinel land proves the shared window opened after the edit under
  test and drained; a pending write for the edit under test would have drained in the same pass.
  It doubles as a positive control — if `.fill()` were not driving the real handler, `drain()` fails
  loud instead of turning the caller's absence assertion into a vacuous pass.

`SETTINGS_WRITE_DEBOUNCE_MS` is imported and used as the documented reason the barrier exists and in
the failure message, never as a magic sleep. **WHY-NOT** the two alternatives: a
`waitForTimeout(400 + margin)` is the hack the ticket forbids; calling the tab's private
`settlePendingWrites()` through `page.evaluate` would be deterministic but replaces the very
debounce under test with a barrier of our own making.

## Files changed (repo-relative)

- `e2e/settingsTypedInput.e2e.ts` **(new)** — the spec, 11 tests, serial, its own harness.
- `e2e/settingsWriteWindow.ts` **(new)** — the reusable debounce-window pattern described above.
- `e2e/settingsTabPage.ts` — added `root()`, `control(name)`, `rowHolding(name)`,
  `feedbackUnder(name)`, `typeInto(name, text)`. `feedbackUnder` is deliberately scoped through
  `.setting-item-description`, so "the message appears under the row it is about" is part of the
  assertion rather than a separate hope.
- `e2e/settingsBaseline.ts` — added `soleRowControlName(kind)` and `sizingNumberControlName(field)`,
  deriving a control's accessible name from the declared row model (`SettingsRowNames` /
  `settingsRowsFor`). **No label, message or stored value is hand-typed anywhere in the new spec.**
- `e2e/settingsDependentRows.e2e.ts` — **DRY only**: its three module-local locator helpers
  (`settingsRoot`/`control`/`rowHolding`) now delegate to the page object. Identical selectors, no
  behaviour change; verified by the full e2e run.

## Decisions a reviewer should know

1. **Nothing here re-tests logic.** Every expected string and every expected stored value is
   COMPUTED at assert time by importing the same pure module the tab renders from
   (`describeSizingRejection`, `describeInvalidExclusionPatterns`, `parseExclusionPatterns`). The
   spec therefore cannot disagree with the product about copy, and a copy change does not need a
   second edit here — it needs one in `settingsValidation.test.ts`, where it belongs.
2. **No product bug found.** The wiring behaved exactly as documented: the debounce settles, the
   refused value is never written, the feedback renders under the row with the right `role`, and
   `aria-invalid` lands on the input. Nothing was papered over.
3. **The `hide()`-flush test asserts "the edit is not lost", not "it was flushed early."** WHY-NOT
   the stronger claim: proving the flush rather than the timer means asserting the write landed in
   under 400ms — a wall-clock race, on a box also running Electron, on the release gate. I chose one
   claim less over a flaky gate, and said so in a comment in the spec. (Empirically that test
   settles in ~46ms against ~900ms for the tests that wait out the real window, so the flush is
   plainly working — it is just not something I am willing to assert.)
4. **No guard was weakened and no allowlist entry added.** `selectorGuard` is satisfied because
   `.vicinity-graph-settings-error` really is rendered in `VicinityGraphSettingTab.ts`;
   `vaultTarget`'s scan is satisfied because neither new file imports `fs` (Playwright creates the
   screenshot directory itself).

## Iteration 1 — response to review (`IMPLEMENTATION_REVIEW__PUBLIC.md`)

Every finding INCORPORATED; none rejected. The MAJOR was correct and I took the stronger of the
two routes it offered, because I could show by measurement that it is not flaky.

### 1. [MAJOR] the `hide()`-flush test could not fail — **INCORPORATED**

New `SettingsWriteWindow.expectFlushedAheadOfWindow(editAndLeave, read, expected, message)`. It
takes the ACTION rather than a start time, so the thing the claim rests on — the clock starting
BEFORE the keystroke — is structural, not a caller convention.

**Why it cannot pass for the wrong reason, at any load:** the fallback path is a
`window.setTimeout(…, SETTINGS_WRITE_DEBOUNCE_MS)` armed at the keystroke, and `setTimeout` may
fire late but never early. So a timer-driven write is unobservable before `start + 400ms`, and
the budget being *under one whole window* is what makes the assertion sound. The margin
(0.75 × window = 300ms) is therefore pure anti-flake headroom, not the load-bearing part.

**Measured, real Obsidian, not asserted from theory:**

| Experiment | Result |
|---|---|
| `--repeat-each=5` on the spec | **75/75 passed (1.5 m)** |
| flush latency, 10 samples | **12–16 ms** (~20× under the 300 ms budget) |
| MUTATION: `flushOnBlur` removed | blur test **FAILS at 415 ms** |
| MUTATION: only `hide()`'s flush removed | close test still **passes at 16 ms** |
| MUTATION: BOTH removed | close test **FAILS at 414 ms** |

The third row is a finding of its own and it is now written into the spec: closing the settings
window BLURS the focused field, so `flushOnBlur` gets there before `hide()`. The close test
therefore honestly claims the OUTCOME — "leaving does not cost you the keystroke" — and
deliberately not "`hide()` specifically flushed". Isolating one of two deliberate belts would be
testing the implementation; both belts failing is what the user would feel, and that fails.

`flushOnBlur` now has genuine, mutation-verified coverage (it had none). The file header and both
test names say exactly this and nothing more. No residual gap, so no follow-up ticket.

### 2. [MINOR] `expectPersisted` said `data.json`, read memory — **INCORPORATED (both halves)**

Reworded to "the plugin's settings store", with an explicit SCOPE paragraph naming
`reloadPlugin()` as the way to make the file claim. And the file now makes it once: a last test
types, closes, `harness.reloadPlugin()` (which drops every in-memory store), then reads — so the
`data.json` round trip is gated for real, exactly once. Kept last because it replaces the plugin
instance the rest of the file drives.

### 3. [MINOR] `drain()`'s contract — **INCORPORATED**. Three bullets: the tab-open precondition
(and that violating it hangs to the `expect` timeout rather than telling the truth), that it bars
the TAB's debouncer only and not the in-graph panel's, and that it MUTATES `sizing.depthDecayK`.

### 4. [MINOR] cross-test bleed — **INCORPORATED**. `givenNoWriteStillPending()` (a `drain()` with
a name that says why) at the top of BOTH GIVENs. The reviewer's "harmless by luck, one reordering
from an intermittent failure" was exactly right; it is now a fact rather than an ordering
assumption. Cost: ~400 ms per test, ~5 s on the suite.

### 5. [NIT] white-space asserted on a row that cannot go multi-line — **INCORPORATED**. Moved to
the exclusion slot with a two-bad-line input, plus a `toContainText("\n")` so the assertion is
about a message that genuinely has a line break to lose.

### 6. [NIT] `role="alert"` vs `role="status"` unasserted — **INCORPORATED**. Two tests, one per
side, each naming the reason the urgency differs (a refusal interrupts; an accepted-with-warning
edit must not).

### Iteration 1 verification (all re-run, all observed)

| Gate | Result |
|---|---|
| `npm run check` | **exit 0** (`.tmp/check.log`) |
| `npm test` | **exit 0 — 94 files, 1245 tests passed** (`.tmp/test.log`) |
| `npm run test:e2e -- settingsTypedInput.e2e.ts` | **15 passed (17.6 s)** (`.tmp/e2e.log`) |
| same, `--repeat-each=5` | **75 passed (1.5 m)** (`.tmp/e2e-repeat.log`) |
| `npm run test:e2e` (FULL) | **exit 0 — 110 passed, 1 skipped (1.2 m)** (`.tmp/e2e-full.log`) |

The 1 skip is pre-existing and unrelated: `externalVault.e2e.ts` opts out unless
`VICINITY_E2E_VAULT` is set. The count checks out — 106 before, minus this spec's 11, plus its 15.

The spec is now 15 tests (was 11). No product code changed: the mutations above were temporary,
reverted with `git checkout`, and the tree was verified clean afterwards.

## Open items for the orchestrator

- The ticket is met and can be closed; I did not touch `_tickets/`, `docs-internal/change_log` or
  `docs-internal/architecture-map.md` — ticket/doc bookkeeping is TOP_LEVEL_AGENT's. The
  architecture map may want a one-liner that `e2e/settingsWriteWindow.ts` is where the typed-input
  debounce pattern lives.
- No follow-up tickets needed: no environment problem, no out-of-scope defect spotted.
