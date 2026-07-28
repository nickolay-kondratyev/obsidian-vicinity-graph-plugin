# IMPLEMENTATION_REVIEW — iteration 2 (`67c6c2f`), branch `compact-group-layout`

Reviewed range `24294ec..HEAD`. Everything below was re-measured against the real
elkjs pipeline, not read off the plan.

**VERDICT: NEEDS_ITERATION** — 1 blocking (a test-coverage hole on this iteration's
own riskiest claim), 4 should-fix, all small. The engineering judgement is sound and
the reporting is honest; what is missing is the lock and the record.

## Summary

Iteration 1 packed group interiors with elk `rectpacking`. The human rejected the
result in a real vault as "obviously non-frugal with space". Iteration 2 re-diagnosed:
the wasted area was the member GAP, not the placement. Shipped: `elkNodeSpacingPx`
default 40 -> 20, and — because that knob also fed the root force seed, where 20 blew
the stranding budget — the two spacings were split in code behind a new internal
`ELK_ROOT_SEED_NODE_SPACING_PX = 40`, with no new user setting.

## Independent verification

Probe: a throwaway `*.test.ts` driving `vicinityGraphToElk` + `ElkLayoutRunner` on the
shipped fixtures (since deleted; working tree is clean).

| claim | measured | verdict |
|---|---|---|
| screenshot fixture @40 = 433x459, fill 0.509 | 433x459, **0.509** | exact |
| screenshot fixture @20 = 413x419, fill 0.591 | 413x419, **0.591** | exact |
| box area -13% | 198,747 -> 173,047 = **-12.9%** | exact |
| hetero13 0.515 -> 0.660 | **0.5154** @40 via the real fixture | exact |
| 15px would give 0.61 | **0.614** | exact |
| fill ceiling ~0.58 at 40px gap | sum(w·h)/sum((w+40)(h+40)) = **0.579** | reproduces |
| root seed byte-identical for default users | `elk.spacing.nodeNode` = `"40"` | holds |

`npm test` -> exit 0 (84 files, 1151 passed + **1 expected fail** — the iteration-1
`it.fails` landscape-stranding pin is untouched and still failing honestly).
`npm run check` -> exit 0.

### (a) "gap, not placement" — DIAGNOSIS HOLDS

The 0.579 number reproduces to three digits. Caveat worth stating: it is a *heuristic*
upper bound, not a proof — it charges every rectangle a full gap on all four sides,
including the outermost ones, so the true ceiling sits somewhat above 0.58. But the
implementer's independent skyline measurement (0.537–0.573 at 40px) brackets it from
below, and elk was already at 0.509. So at most ~+14% relative was available from a
perfect packer, while dropping the gap delivered +16%. Rejecting the packer swap was
correct, and the ~100-lines-for-<5% reasoning is the right 80/20 call.

Secondary note: `layOutGroup`'s `fillRatio` subtracts `2 * GROUP_SIDE_PADDING_PX`
vertically, but the container's top padding is 36, not 16. The real member band fills
0.534 @40 / 0.623 @20. Pre-existing from iteration 1, and it makes the metric slightly
pessimistic — which only strengthens the diagnosis — but the JSDoc calls it "the
padded-in interior", which it is not.

### (b) root-pass split — CORRECT FOR DEFAULTS, SILENT FOR EVERYONE ELSE

Verified: with `elkNodeSpacingPx: 90` the root still emits `"40"`. So

- **default-settings user**: root pass genuinely byte-identical. Claim verified.
- **user with a saved non-default value**: their root seed now *silently ignores* the
  slider it used to feed. This is a real behaviour change, not a no-op.

Assessment: this is *not* the classic "internal constant shadows a user knob" smell,
because the knob no longer reaches that pass at all — one knob, one meaning (SRP), and
the field label always said "Group member spacing". The old UI description explicitly
advertised the coupling ("also spaces the initial layout pass") and that sentence was
correctly removed. The seed is also only a starting arrangement that d3 then refines.
I judge the split justified. **RESOLVED: the human decided to keep it — the slider is
intra-group only, and stays named as it is.**

One doc tension: `ELK_ROOT_SEED_NODE_SPACING_PX`'s first paragraph says the value "is
not what a user sees" and "only shapes the starting arrangement", and its third
paragraph then reports that changing it 40->20 blew a 100px budget. Soften the first
claim so the two do not fight.

### (c) changing a DEFAULT is a migration event — REAL, UNDER-SURFACED

`persistedShapes.ts:219` falls back to the new default only when the key is ABSENT.
`settingsResetPlan`'s `global-view` commands persist the WHOLE view slice, so any user
who has ever touched an unrelated setting in that slice already has
`elkNodeSpacingPx: 40` on disk and will see **no change whatsoever** from this iteration.

Concretely: **the human's own vault almost certainly holds 40, so re-testing this
branch without hitting "Restore force layout defaults" first will reproduce the exact
layout that was already rejected.** That is the single likeliest cause of a third
rejection round. It is mentioned as #QUESTION_FOR_HUMAN 2, but it belongs at the top of
the hand-off as a retest precondition, not as question 2 of 3.

Restore-defaults scope itself is correct: `force-layout` and `all` both re-read
`EngineDefaults.forceLayoutSettings()`, never re-typed values, so a reset does deliver
20. No settings-version mechanism exists for VALUE migrations; given the plugin is
unreleased (0.1.1, no tags) I would NOT build one — a retest note is the 80/20 answer.

### (d) is 20 principled — YES

Slider grid is `min 10, step 5` -> {10, 15, 20, ...}; `GROUP_SIDE_PADDING_PX` is 16;
20 is indeed the first grid value at or above it. Documented as WHY in
`SettingsSpec.ts`, and the rejected alternative (15 -> 0.614) is recorded and was
measured, so it is derived rather than fixture-tuned. Nit: the PLAN's prose ("a member
is never farther from its folder-mates than from the group's wall") is backwards —
20 > 16 means it *is* slightly farther. The code comment states it correctly
("without members ever crowding tighter than the wall inset"); fix the plan wording.

### (e) tests — no cardinal sin, but one hole and one overstatement

Confirmed by reverting `graphFixtures.elkNodeSpacingPx` to 40 and re-running
`groupPacking.test.ts`: **3 tests fail** — screenshot 0.5087 vs floor 0.54, hetero13
0.5154 vs floor 0.55 (x2). Both the new and the raised floor genuinely fail on the
pre-iteration-2 layout, both are derived from member geometry rather than elk pixels,
both are BDD with one assert.

No assertion was skipped, deleted or realigned to fit. The `it.fails` stranding pin is
byte-for-byte untouched and still reports as an expected failure. `SettingsSpec.test.ts`
and `forceLayoutSettings.test.ts` changes are the legitimate mechanical consequence of
the default move. The `elkMapping.test.ts` rename inverts a behaviour assertion, which
is a real behaviour change and is documented as such in its JSDoc — honest, not a
weakening. The stranding suite does build on `graphFixtures`, so it really did exercise
the 20px interiors; the "regression came entirely from the root seed" claim is
corroborated by that suite staying green.

## BLOCKING

1. **Nothing pins the root seed spacing any more — the iteration's own
   "byte-identical" claim has no regression lock.** The replaced assertion was
   `toBe("80")`, which at least proved the option existed and carried a value. The new
   one compares two computed values:

   ```ts
   expect(vicinityGraphToElk(custom).layoutOptions?.["elk.spacing.nodeNode"]).toBe(
       vicinityGraphToElk(graph).layoutOptions?.["elk.spacing.nodeNode"],
   );
   ```

   If `elkForceRootOptions()` ever stops emitting `elk.spacing.nodeNode`, both sides are
   `undefined` and this passes vacuously. A grep confirms no other test asserts the root
   `elk.spacing.nodeNode` value anywhere. Fix: keep the knob-independence test AND add a
   one-line lock — export `ELK_ROOT_SEED_NODE_SPACING_PX` and assert
   `expect(root.layoutOptions?.["elk.spacing.nodeNode"]).toBe(String(ELK_ROOT_SEED_NODE_SPACING_PX))`.
   `src/view/elkMapping.test.ts:38`, `src/view/constants.ts:110`.

## SHOULD-FIX

2. **The change log now states something false about the shipped product.**
   `_change_log/2026-07-28_00-47-39Z.md:17` reads "no change to ... settings (the single
   `elkNodeSpacingPx` knob still drives both passes)" — both halves are now untrue, and
   there is no iteration-2 entry at all. Add one recording: default 40 -> 20, the
   root/interior spacing split, and the "existing `data.json` keeps 40" consequence.

3. **`graphFixtures.elkNodeSpacingPx: 20` hand-mirrors the shipped default, and the new
   JSDoc leans on that mirror.** `groupPacking.test.ts:156` claims the 0.55 floor "fails
   if either the spacing default or the packing algorithm regresses" — it cannot see a
   `SettingsSpec` default regression, because the fixture duplicates the value instead of
   deriving it. (`SettingsSpec.test.ts` does pin the default, so nothing escapes the
   suite — but the two can silently diverge.) Either derive the fixture field from
   `EngineDefaults.forceLayoutSettings()` or add
   `expect(fixtureSpacing).toBe(EngineDefaults.forceLayoutSettings().elkNodeSpacingPx)`
   and soften the comment. `src/view/testFixtures/graphFixtures.ts:62`.

4. **Retest precondition must lead the hand-off** (see (c)): "Restore force layout
   defaults" — or drag the slider to 20 — BEFORE judging the branch in the real vault.

5. **`ELK_ROOT_SEED_NODE_SPACING_PX` JSDoc contradicts itself** (see (b)); and
   `_tickets/decide-pre-release-force-layout-tuning-...md:32` still lists
   "elkNodeSpacingPx 40" as a ship-time default.

## SUGGESTIONS (non-blocking)

- `fillRatio`'s denominator should use the real member band
  (`height - GROUP_TOP_PADDING_PX - GROUP_SIDE_PADDING_PX`) or the JSDoc should stop
  calling it the padded-in interior. All floors would move up ~0.03 accordingly.
- The stranding JSDoc's "113px against the 100px budget" was measured with 40px group
  interiors; interiors are now 20. Worth a re-measure before that number is quoted again.
- Ticket `nid_uzwco7e4y2bw5vzfk5vhs814a_e` is marked `closed` while the human's
  acceptance of iteration 2 is still open. Consider leaving it open until the retest.

## Documentation Updates Needed

- New `_change_log/` entry for iteration 2 (item 2).
- No `README.md` change required: it never documented the root-seed coupling, only the
  slider's existence.
- No `CLAUDE.md` change required.

## Human decisions (SETTLED)

1. The "Group member spacing" slider no longer feeds the root layout seed. **DECIDED:
   keep it** — narrower, label-honest meaning; no rename.
2. **Before you retest**: your vault's `data.json` almost certainly still says 40, which
   will reproduce the layout you already rejected. Hit *Restore force layout defaults*
   (or set the slider to 20) first. **DECIDED: no migration code** — pre-release,
   restore-defaults is the upgrade path.
3. If 0.591 still reads as airy: 15px -> 0.614 is verified and is a one-constant change,
   at the cost of members sitting closer to each other than to the group wall.
