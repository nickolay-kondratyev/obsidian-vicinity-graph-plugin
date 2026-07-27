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

---

# ROUND 2 — confirmation review (fresh instance)

Reviewing the **cumulative** result `git diff 3e85ecb..HEAD -- src/ docs-internal/`
(`7892edf` + fix `8b6ea39`; `1445343` adds only an untracked draft ticket, out of scope).

**Verdict: 0 BLOCKING, 0 SHOULD-FIX. All three round-1 items genuinely resolved. I signal
readiness to converge.**

## 1. Round-1 SHOULD-FIX disposition — all confirmed resolved

| # | Item | Confirmed |
|---|---|---|
| 1 | Source pointed at a stale ticket with a false attribution | **Resolved twice over**: the `docs-internal/` path is gone from the JSDoc, AND the ticket's attribution is corrected. |
| 2 | Archaeology / proportionality (commit hash + ticket path in source) | **Resolved.** No hash, no path, no repo meta-commentary remains. Range paragraph is 7 lines, all about the setting. |
| 3 | "past 1 the spring over-corrects every tick" overclaim | **Resolved.** Sentence removed; replaced by the softened wording. |

## 2. Truthfulness of the final comment text — each clause checked against code

Final text at `src/engine/SettingsSpec.ts:227-233`.

| Clause | Verdict |
|---|---|
| "the factor scales d3's `1 / min(degree)`" | **TRUE** — `src/view/d3ForceRefinement.ts:83-87`: `forceLayout.linkStrengthFactor / Math.min(linkCountOf(source), linkCountOf(target))`. Corroborated by the WHY comment at `:55-58` ("at factor 1 the values are bit-identical to leaving strength unset"). |
| "for a degree-1 leaf the spring strength IS the factor" | **TRUE** — `min(1, anything ≥ 1) === 1`, and `linkCountOf` floors at 1 (`:65`). |
| "`min 0.25` … keeps such a leaf's spring dominant over the strongest center pull the ranges allow" | **TRUE and mutually consistent** — `centerPullStrength.max 0.15` (`:209`) < `0.25`. It is the same relative-magnitude framing the `centerPullStrength` JSDoc (`:203-207`) already states from the other side; the two now agree exactly. |
| "`max 4` is a maintainer-chosen headroom ceiling, NOT a measured stability limit" | **TRUE and now the honest framing.** `258ec5a`'s trailer (`Human-decided (2026-07-24): the shipped spec value is the intended one.`) establishes *intent*; nothing in the repo measures stability at 4. The round-0 insinuation of accident is gone without swinging into an invented rationale. |
| "well above 1 the fixed-tick static run relies on d3's alpha decay rather than on the spring settling by itself" | **Defensible — no longer an overclaim.** The run is a precomputed tick count (`:96-98`, `ceil(log(alphaMin)/log(1-alphaDecay))`) on a `.stop()`ed sim, so "fixed-tick static run" is literally readable off the code. Unlike the deleted "above ~2 … stops converging cleanly", this asserts no threshold, no instability, and no measured behavior — only that with strength > 1 (over-relaxation past the resting distance) what bounds the springs is decaying alpha, not equilibrium. That follows from d3's documented `strength ∈ [0,1]` relaxation semantics, and this is the exact wording round 1 proposed as the acceptable softening. I do not re-open it. |

*Observation, explicitly NOT a finding:* the tick count is factor-independent, so the run
terminates on alpha decay at **every** factor; the "well above 1" qualifier therefore
discriminates less sharply than it reads. The sentence is still true as written (it makes no
claim about factor ≤ 1) and is a net improvement over what it replaced. Not worth another round.

## 3. Ticket edits — accurate, minimal, not restructured, not closed

`docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md`.

- **Attribution correction verified at source:** `git show 22bd5cb -- src/engine/SettingsSpec.ts`
  → 2 insertions / 2 deletions, **only** `linkGapPx.max 150→250` and
  `collidePaddingPx default 20→50 / max 80→100`. `git show dee64c3` → 1 insertion / 1 deletion,
  `linkStrengthFactor … max: 2 → 4`, message literally `Modified file: SettingsSpec.ts`.
  The ticket's new sentence matches both exactly.
- **`258ec5a` note verified:** quoted trailer is verbatim from `git log -1 --format=%B 258ec5a`.
  The note's distinction (**intended** is on record; **validated against** is not) is correct
  and does not overstate what the trailer discharges.
- **`**Origin:** 22bd5cb`** header left intact — correct, since `22bd5cb` genuinely originates
  the wider baseline staleness this ticket was filed for.
- **Status still `OPEN`**, section order unchanged, nothing deleted; the only additions are the
  corrected sentence and the appended dated note. No unauthorized closure.

## 4. `src/` diff purity — re-proved mechanically

`git diff 3e85ecb..HEAD -- src/ | grep -E "^[+-]" | grep -v "^[+-][+-]" | grep -vE "^[+-]\s*\*"`
→ **empty**. Comment-only. `linkStrengthFactor: { default: 1, min: 0.25, max: 4, step: 0.05 }`
unchanged; no test file in the diff; `centerPullStrength` cross-reference to
`linkStrengthFactor` **min 0.25** still accurate (min never touched, and machine-pinned by
`src/engine/forceLayoutSettings.test.ts`).

## 5. Gates — actually re-run this round

| Command | Result |
|---|---|
| `npm run check > .tmp/rev2-check.log 2>&1` | **exit 0** |
| `npm test > .tmp/rev2-test.log 2>&1` | **exit 0** — `Test Files 79 passed (79)`, `Tests 1053 passed (1053)` |
| `./sanity_check.sh` | not present in repo (n/a) |

## 6. Acceptance criteria

1. **JSDoc range matches shipped min/max** — `[0.25, 4]` vs `{ min: 0.25, max: 4 }`. **MET.**
2. **No other `SettingsSpec` JSDoc range contradicts its entry** — the round-1 independent
   sweep of all 12 bounded entries stands (nothing in `SettingsSpec.ts` changed since except
   this one block). **MET.**

## Regression / functionality-loss check

No test removed, skipped, or loosened. No `ap_XXX_E` anchor touched. No ticket closed or
restructured. Nothing to flag.

## Convergence

**Converged.** Ship it. Remaining items are the human's, unchanged and non-blocking: the
optional `outlineMaxDepth` "≤160px" follow-up ticket, and the human read on whether
`258ec5a`'s trailer discharges step 1 of the baseline ticket.
