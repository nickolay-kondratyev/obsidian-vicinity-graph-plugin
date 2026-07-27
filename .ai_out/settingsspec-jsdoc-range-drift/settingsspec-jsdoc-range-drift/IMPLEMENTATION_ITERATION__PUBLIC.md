# IMPLEMENTATION_ITERATION — round 1 — PUBLIC

Branch `settingsspec-jsdoc-range-drift`. Responds to `IMPLEMENTATION_REVIEW__PUBLIC.md`
(review of `7892edf`). Still **docs-only**, still uncommitted.

## Disposition per review item

### SHOULD-FIX #1 — pointer at a stale ticket carrying a known-false attribution — **INCORPORATED**

Valid, and I confirmed the new evidence myself:

```
$ git log -1 --format=%B 258ec5a
fix(engine): align the settings-limits baseline to the shipped linkStrengthFactor max
...
Human-decided (2026-07-24): the shipped spec value is the intended one.
```

I had missed this in round 0 and it materially changes the framing: `max: 4` is **intended**,
not an accident that slipped through. My round-0 wording ("raised … as a bare hand-edit … with
no rationale recorded") was factually true but insinuated accident. Removed.

The `docs-internal/` ticket path is gone from the source comment (see #2), which removes the
"production source points at a known-wrong doc" problem at the root rather than by patching the
target. I also corrected the ticket itself — see below.

### SHOULD-FIX #2 — proportionality / archaeology in source — **INCORPORATED**

Agreed, and it is the CLAUDE.md rule verbatim ("stable knowledge, not volatile details",
SUCCINCT). A raw commit hash plus a ticket filename in a JSDoc is exactly the payload that goes
stale next; `git log -L '/linkStrengthFactor: {/,+1:src/engine/SettingsSpec.ts'` reproduces all
of it on demand. 10 lines → **7**, all of them about the setting rather than about the repo.

### SHOULD-FIX #3 — "past 1 the spring over-corrects every tick" overclaims — **INCORPORATED**

Correct, and the sharpest of the three. That sentence was a claim about d3's per-tick update
dynamics that I could not substantiate any better than the "above ~2 … stops converging
cleanly" line I deleted for being unsubstantiated — it just moved the threshold from 2 to 1.
It also sat badly next to `default: 1`, which the paragraph above calls d3's own stable
default. Softened to what is actually observable from `d3ForceRefinement.ts`: the static run is
a precomputed fixed tick count (`:96-98`), so what bounds a stiff spring there is alpha decay,
not the spring reaching equilibrium.

### NIT — `outlineMaxDepth` prose vs user-settable `maxPx` 400 — **NOT DONE (out of scope)**

Reviewer itself scoped it out. Worth a follow-up ticket; TOP_LEVEL_AGENT's call, not mine to
file mid-iteration.

### Reviewer's proposed wording — adopted with two edits

I used it nearly verbatim. Changes: "deliberately-chosen" → "**maintainer-chosen** headroom
ceiling" (keeps the round-0 phrasing that the neighbouring JSDocs' voice already matches, and
now carries the `258ec5a` backing), and "rather than the spring settling on its own" → "rather
than on the spring settling by itself" (parallelism with "relies on"). I deliberately did NOT
add a "(human-confirmed 2026-07-24)" parenthetical: "maintainer-chosen" already asserts intent,
and the citation would re-introduce exactly the volatile archaeology #2 asks me to remove.

## Final comment: before → after

`src/engine/SettingsSpec.ts`, JSDoc above `linkStrengthFactor` (spec entry unchanged at
`{ default: 1, min: 0.25, max: 4, step: 0.05 }`). First paragraph of the JSDoc unchanged; only
the range paragraph differs.

**Before (round 0, `7892edf`):**

```
 * `[0.25, 4]`: `min 0.25` keeps a degree-1 leaf's spring dominant over
 * the strongest center pull the ranges allow (see above). `max 4` is a
 * maintainer-chosen ceiling, NOT a measured stability limit — it was
 * raised 2 → 4 as a bare hand-edit in `dee64c3` with no rationale
 * recorded (tracked by
 * `docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md`).
 * What IS mechanical: the factor scales d3's `1 / min(degree)`, so a
 * degree-1 leaf's spring strength IS the factor — past 1 the spring
 * over-corrects its resting distance every tick and only d3's alpha
 * decay settles it within the fixed-tick static run.
```

**After (this iteration):**

```
 * `[0.25, 4]`: the factor scales d3's `1 / min(degree)`, so for a
 * degree-1 leaf the spring strength IS the factor — `min 0.25` therefore
 * keeps such a leaf's spring dominant over the strongest center pull the
 * ranges allow (see above). `max 4` is a maintainer-chosen headroom
 * ceiling, NOT a measured stability limit: well above 1 the fixed-tick
 * static run relies on d3's alpha decay rather than on the spring
 * settling by itself.
```

Net vs base `3e85ecb`: **7 insertions / 3 deletions, all inside one JSDoc block.**

### Constraints re-checked

- `centerPullStrength`'s cross-reference (`:203-207`) names `linkStrengthFactor` **min 0.25** —
  min untouched, still accurate, and the new text still explains the 0.25-vs-0.15 relationship
  the cross-reference depends on.
- No `ap_XXX_E` anchor in or near the region.
- Zero spec values, tests, or behavior touched. No rationale invented.

## What I changed in `docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md`

Verified the attribution myself before touching it:

| Check | Result |
|---|---|
| `git show 22bd5cb -- src/engine/SettingsSpec.ts` | touches **only** `linkGapPx.max 150→250` and `collidePaddingPx 20→50 / max 80→100`. Its "increase one of the max" refers to `linkGapPx`. |
| `git show dee64c3` | 1 file / 1 insertion / 1 deletion: `linkStrengthFactor … max: 2` → `max: 4`. Message: `Modified file: SettingsSpec.ts`. |

Two edits, no restructuring, **status left OPEN**:

1. §"Why it is NOT fixed in passing" — the false `` `22bd5cb` raised the max deliberately ``
   replaced with the correct attribution to `dee64c3`, explicitly noting `22bd5cb` touched only
   `linkGapPx.max` / `collidePaddingPx`. The "nothing records what `4` was validated against"
   point is preserved — it is still true.
2. Appended a dated note recording `258ec5a`'s `Human-decided` trailer, which puts `4` being
   **intended** on record while leaving open what it was **validated against** (the ticket's
   step 1 asks for a dev-vault look). I did not close it and did not change Status — that
   remains a human call, and the ticket says so.

I left the ticket's `**Origin:**` header alone: `22bd5cb` genuinely is the origin of the wider
baseline staleness this ticket was filed for, so it is not false; only the sentence attributing
the `linkStrengthFactor` raise to it was.

**Untouched, flagged only:** `docs-internal/tickets/ticket-settings-spec-baseline-tests-stale-after-node-spacing-bump.md`
(CLOSED sibling) also names `22bd5cb`, but only for the `collidePaddingPx` / `linkGapPx` re-pin
— that usage is **correct**, no fix needed.

## Verification (actual results)

| Command | Result |
|---|---|
| `npm run check > .tmp/iter-check.log 2>&1` | **exit 0** |
| `npm test > .tmp/iter-test.log 2>&1` | **exit 0** — `Test Files 79 passed (79)`, `Tests 1053 passed (1053)` |
| `src/` diff is comment-only | **confirmed** — `git diff 3e85ecb -- src/` filtered for non-`*`/`/**`/`*/` changed lines → **empty output** |

## Convergence

**I signal readiness to converge.** All three SHOULD-FIX items are incorporated, none rejected;
the one doc dependency the reviewer said blocks sign-off (the `22bd5cb` misattribution) is
fixed at the source AND no longer referenced from production code. No BLOCKING items existed.
No re-review needed beyond confirming the 7-line diff above, which is exactly the reviewer's own
proposed wording.

Remaining for TOP_LEVEL_AGENT / human (unchanged, none blocking this branch):
- commit + `change_log` + ticket closure (explicitly not mine).
- optional follow-up ticket for the `outlineMaxDepth` "≤160px" prose vs user-settable `maxPx`.
- `ticket-settings-baseline-tests-stale-after-spacing-change.md` stays OPEN pending the human's
  read of whether `258ec5a`'s trailer discharges its step 1.
