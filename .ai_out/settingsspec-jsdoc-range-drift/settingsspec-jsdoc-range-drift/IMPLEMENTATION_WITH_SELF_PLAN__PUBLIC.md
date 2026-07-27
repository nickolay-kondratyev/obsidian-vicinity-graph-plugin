# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC

Ticket: `nid_2yygojiqkdi9hp73pgv0w7qfu_e`
(`_tickets/linkstrengthfactor-jsdoc-documents-025-2-but-spec-ships-max-4.md`)
Branch: `settingsspec-jsdoc-range-drift`. **Docs-only change. One file. Not committed.**

## 1. Plan

1. Re-verify the exploration's line numbers on this branch.
2. Establish the *real* history of `max: 2 → 4` before touching the prose — a digit swap
   would have fabricated a rationale.
3. Rewrite the JSDoc to be true.
4. Spot-check the exploration's sweep (acceptance criterion 2).
5. `npm run check` + `npm test`.

## 2. The change

`src/engine/SettingsSpec.ts`, the JSDoc block immediately above
`linkStrengthFactor: { default: 1, min: 0.25, max: 4, step: 0.05 }`. The first paragraph of
that JSDoc (the "UI 'Link force' — multiplier on d3's default …" semantics paragraph) is
**unchanged**; only the range paragraph was replaced.

**BEFORE** (was at `:227-229`):

```
			 * `[0.25, 2]`: min keeps links dominant over the max center pull (see
			 * above); above ~2 the stiff springs overshoot within the fixed-tick
			 * static run and the layout stops converging cleanly.
```

**AFTER** (now `:227-236`):

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

Style matches the neighbouring bound docs (`` `[50, 1000]`: `` / `` `max 0.15`: ``
openers, WHY-focused, same wrap width, same 3-tab indent).

## 3. Evidence for the rationale (why I did NOT write "above ~4 …")

`git log -L '/linkStrengthFactor: {/,+1:src/engine/SettingsSpec.ts'` returns exactly two
commits touching that line:

| Commit | What it did |
|---|---|
| `07c4db7` "refactor(settings): centralize defaults + limits into nested SETTINGS_SPEC" | introduced the entry as `max: 2`, **together with** the "above ~2 … stops converging cleanly" prose |
| `dee64c3` — commit message is literally **"Modified file: SettingsSpec.ts"** | one line, `max: 2 → 4`, **1 file / 1 insertion / 1 deletion**, JSDoc three lines above left untouched |

So the drift is a bare, unannotated hand-edit by the maintainer. There is no design note,
no changelog entry, no measurement behind `4`. `docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md`
independently says the same in its own words: *"nothing records what `4` was validated
against"*, and it is deliberately left OPEN pending exactly that human confirmation.

**Therefore the old rationale could not be transposed and no replacement rationale could
be invented.** Per the task's fallback instruction I wrote the honest minimal bound doc:
state the bound, keep the parts that are substantiated, and name the unsubstantiated part
as unsubstantiated.

What *is* substantiated and kept:

- **`min 0.25`** — real. `src/engine/forceLayoutSettings.test.ts:64-68` machine-pins
  `centerPullStrength.max (0.15) < linkStrengthFactor.min (0.25)`, and
  `centerPullStrength`'s own JSDoc (`:203-207`) cross-references it. Unchanged by this
  edit, so that cross-reference remains accurate.
- **The `1 / min(degree)` mechanic** — read off `src/view/d3ForceRefinement.ts:83-87`
  (`forceLayout.linkStrengthFactor / Math.min(linkCountOf(source), linkCountOf(target))`),
  with the fixed-tick static run at `d3ForceRefinement.ts:96-98`. This is a statement about
  code, not a tuning claim, so it is safe to assert. It is also the closest honest thing to
  a reason a user should be careful up near 4 — without claiming 4 is or is not the
  threshold.

## 4. Sweep (acceptance criterion 2) — I concur with the exploration

I spot-checked, against the live file rather than the report, every entry whose prose makes
a *numeric* claim: `DEPTH_STEPPER_BOUNDS` {0,5,1}, `NODE_SIZE_PX_BOUNDS` {1,400,4},
`nodeCap` min 1, `outlineMaxDepth` {2,1,6,1}, `metricWeight` {1,0,100,0.5},
`depthDecayK` {1,0,10,0.5}, `centerPullStrength` {0.05,0,0.15,0.01},
`repelStrength` {300,50,1000,10}, `linkGapPx` {40,10,250,5},
`collidePaddingPx` {50,0,100,5}, `elkNodeSpacingPx` {40,10,120,5},
`edgeRoutingClearancePx` {11,6,14,1}. Every one matches its prose exactly.
**`linkStrengthFactor` was the only contradiction. Concur with the exploration audit.**

One non-contradiction worth a sentence: `outlineMaxDepth`'s JSDoc (`:136`) says
"the ≤160px node the engine's sizing can produce", while `maxPx` can be dialled to 400.
That is prose about the shipped **default** (160), not a claim about a range, so it is not
in scope here and I left it alone.

## 5. Flagged for the human

1. **`max: 4` has no recorded justification.** The new comment says so explicitly and
   points at the open ticket. If you can state why 4 (e.g. "wanted native-graph-parity
   stiffness headroom", or a dev-vault observation), replace those three lines with the
   real reason — that is strictly better than what I could honestly write.
2. **Misattribution found in an existing doc (not fixed — outside this ticket).**
   `docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md`
   blames `22bd5cb` for the `linkStrengthFactor.max` raise. It was `dee64c3`.
   Verified: `git merge-base --is-ancestor dee64c3 22bd5cb` → false, and `22bd5cb` touches
   only `linkGapPx` and `collidePaddingPx`. Same author, same day, ~2.5h apart. Worth a
   one-line correction when that ticket is next handled.

## 6. Verification

| Command | Result |
|---|---|
| `npm run check > .tmp/check.log 2>&1` | **exit 0** |
| `npm test > .tmp/test.log 2>&1` | **exit 0** — 79 test files passed, **1053 / 1053 tests passed** |

**No new test added, deliberately.** This is a comment-only change; the behaviour it
describes is already pinned by `src/engine/SettingsSpec.test.ts:190` (`max: 4`) and
`src/engine/forceLayoutSettings.test.ts:68` (the `min 0.25` > center-pull invariant).
A test asserting comment text would be hollow and would couple prose to CI.

## 7. Not done (owned by TOP_LEVEL_AGENT)

change_log entry · ticket closure · commit.
