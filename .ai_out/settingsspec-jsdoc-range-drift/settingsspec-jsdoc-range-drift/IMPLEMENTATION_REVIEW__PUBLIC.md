# IMPLEMENTATION_REVIEW — PUBLIC

Commit under review: `7892edf` (vs base `3e85ecb`), branch `settingsspec-jsdoc-range-drift`.
Ticket: `_tickets/linkstrengthfactor-jsdoc-documents-025-2-but-spec-ships-max-4.md`.

## Summary

Docs-only. `src/engine/SettingsSpec.ts`: 10 insertions / 3 deletions, **all inside a JSDoc
block**. Verified mechanically — filtering the `src/` diff for non-comment lines yields
**zero** lines. No spec value, no test, no behavior touched. The rest of the commit is
`.ai_out/` process artifacts.

**Verdict: no BLOCKING issues. The change is factually correct and an improvement over the
drift it replaced.** Two SHOULD-FIX items are about proportion and durability of the prose,
not correctness.

## Verification I performed myself (not taken on trust)

| Claim | Result |
|---|---|
| `npm run check` | **exit 0** |
| `npm test` | **exit 0** — 79 files, 1053/1053 passed |
| `./sanity_check.sh` | not present in repo (n/a) |
| Only comments changed in `src/` | **confirmed** (`git diff … \| grep` for non-comment lines → empty) |
| `dee64c3` raised `max: 2 → 4` as a bare hand-edit | **TRUE.** Message literally `Modified file: SettingsSpec.ts`; 1 file / 1 insertion / 1 deletion; the JSDoc 3 lines above left untouched. |
| `docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md` exists and covers this | **TRUE**, and still OPEN. |
| That ticket misattributes the raise to `22bd5cb` | **TRUE.** `22bd5cb` touches only `linkGapPx.max 150→250` and `collidePaddingPx 20→50 / max 80→100`. `git merge-base --is-ancestor dee64c3 22bd5cb` → NO (reverse → YES), i.e. `22bd5cb` *precedes* `dee64c3`. The implementer's correction is right. |
| Mechanical claim: factor scales d3's `1 / min(degree)`; a degree-1 leaf's spring strength IS the factor | **TRUE.** `src/view/d3ForceRefinement.ts:84-88`: `.strength((link) => forceLayout.linkStrengthFactor / Math.min(linkCountOf(source), linkCountOf(target)))`. `min(1, hubDegree) === 1`, so strength === factor. |
| "fixed-tick static run" | **TRUE.** `d3ForceRefinement.ts:96-98` — `simulation.tick(Math.ceil(Math.log(alphaMin)/Math.log(1-alphaDecay)))`, a precomputed tick count, `.stop()`ed sim. |
| `centerPullStrength` cross-ref to `linkStrengthFactor` min 0.25 (`:203-206`) | **still accurate** — `min` untouched; also machine-pinned by `src/engine/forceLayoutSettings.test.ts:64-68`. |

### Acceptance criterion 2 — sweep redone independently

I re-swept every numeric prose claim in `src/engine/SettingsSpec.ts` against its spec entry:
`DEPTH_STEPPER_BOUNDS` `min 0`/`max 5` (:99-101) · `NODE_SIZE_PX_BOUNDS` `min 1`/`max 400`
(:110-115) · `nodeCap` `min 1` (:130-132) · `outlineMaxDepth` `min 1`/`max 6` (:136-141) ·
`metricWeight` `min 0`/`max 100` (:168-174) · `depthDecayK` `min 0`/`max 10` (:178-184) ·
`centerPullStrength` `max 0.15`/`min 0` (:203-209) · `repelStrength` `[50, 1000]` (:216-220) ·
`linkGapPx` `[10, 250]` (:245-250) · `collidePaddingPx` `[0, 100]` (:258-262) ·
`elkNodeSpacingPx` `[10, 120]` (:267-272) · `edgeRoutingClearancePx` `[6, 14]` (:289-301).
**All match. `linkStrengthFactor` was the only contradiction. Criterion 2 satisfied.**

## 🚨 BLOCKING

None.

## ⚠️ SHOULD-FIX

### 1. New evidence the implementer missed: a human DID confirm `max: 4`

`258ec5a` — *"fix(engine): align the settings-limits baseline to the shipped
linkStrengthFactor max"* — ends with:

> `Human-decided (2026-07-24): the shipped spec value is the intended one.`

So the comment's framing is *literally* still true (`4` is not a **measured** limit and no
**rationale** is recorded), but the sentence "*tracked by
`ticket-settings-baseline-tests-stale-after-spacing-change.md`*" points the reader at a
ticket that (a) is stale — its "Problem" table describes a RED test that no longer
reproduces, as the ticket itself admits in its 2026-07-25 note; (b) **misattributes the
raise to `22bd5cb`**, which the implementer independently proved wrong. Pointing production
source at a doc containing a known-false attribution is not acceptable as-is.

**Resolution (pick one):** drop the ticket path from the comment (recommended — see #2), or
first land the one-line correction `22bd5cb` → `dee64c3` in that ticket. Do not ship the
pointer while the target is known-wrong.

### 2. Proportionality — the git archaeology does not belong in the source comment

A one-line bound drift produced 10 lines, ~5 of which are *meta-commentary about the repo's
own history* (a raw commit hash, a `docs-internal/` path, and the fact that a hand-edit had
no message). CLAUDE.md is explicit: comments explain **WHY**, docs must carry **stable
knowledge, not volatile details**, and be **SUCCINCT**. A commit hash and a ticket filename
are exactly the volatile kind — the ticket will be closed and renamed, the hash means nothing
to a reader, and `git blame`/`git log -L` already yields both for free. This comment is a
plausible candidate to become *the next* drift.

The two things a maintainer actually needs are preserved fine without any of that: (a) `4` is
a chosen ceiling, not a measured stability limit; (b) the `1 / min(degree)` mechanic.

**Concrete suggested wording (6 lines, same style as the neighbours):**

```
 * `[0.25, 4]`: the factor scales d3's `1 / min(degree)`, so for a degree-1
 * leaf the spring strength IS the factor — `min 0.25` therefore keeps such a
 * leaf's spring dominant over the strongest center pull the ranges allow (see
 * above). `max 4` is a maintainer-chosen headroom ceiling, NOT a measured
 * stability limit: well above 1 the fixed-tick static run relies on d3's alpha
 * decay rather than the spring settling on its own.
```

### 3. "What IS mechanical" overclaims the second half

Under that heading the comment asserts *"past 1 the spring over-corrects its resting
distance every tick"*. The `1 / min(degree)` scaling is genuinely readable off the code; the
over-correction is a **dynamics/tuning** claim derived from d3's internal
`l = (l - distance)/l * alpha * strength` update — i.e. the same *class* of unsubstantiated
assertion that was just deleted for being unsubstantiated, merely relocated from threshold 2
to threshold 1. It is also awkward next to `default: 1` and the paragraph above it, which
says `1` reproduces d3's own stable default.

**Resolution:** keep the mechanic, soften the dynamics half (the wording in #2 does this:
"relies on alpha decay rather than the spring settling on its own"), or drop it.

## 💡 Suggestions (NIT)

- `outlineMaxDepth`'s JSDoc (`:136`) says "the ≤160px node the engine's sizing can produce",
  but `maxPx` is user-settable to 400 via `NODE_SIZE_PX_BOUNDS`. It is prose about the
  shipped **default**, so out of scope here and correctly left alone — but it is a
  near-neighbour of the same failure mode. A follow-up ticket would be cheap.
- No new test, deliberately. Correct call — the values are already pinned by
  `SettingsSpec.test.ts:190` and `forceLayoutSettings.test.ts:64-68`; a test asserting
  comment text would be hollow.

## Regression / functionality-loss check

No test removed, none skipped, no assertion loosened, no `ap_XXX_E` anchor touched. 1053
tests pass (baseline on `main` was also green). Nothing to flag.

## Documentation Updates Needed

- `docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md` —
  one-line correction of the `22bd5cb` → `dee64c3` attribution (and worth noting `258ec5a`'s
  "Human-decided" line, which arguably discharges its step 1).
- No CLAUDE.md change needed.

## Convergence

**I do NOT yet signal readiness to converge** — SHOULD-FIX #1 (pointer at a doc with a
known-false attribution) should be resolved before merge. Adopting the tighter wording in #2
resolves #1, #2 and #3 in a single edit and needs no re-review beyond a `npm run check`.
If the human explicitly prefers to retain the archaeology in-source, then only #1 must be
handled (correct the ticket) and I would sign off.
