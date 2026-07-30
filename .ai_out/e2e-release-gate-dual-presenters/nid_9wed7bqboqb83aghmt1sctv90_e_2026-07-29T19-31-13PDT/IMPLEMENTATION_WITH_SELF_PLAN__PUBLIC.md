# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC

Ticket `nid_9wed7bqboqb83aghmt1sctv90_e` — **run the e2e release gate on the
dual-presenter branch**. Branch `nid_9wed7bqboqb83aghmt1sctv90_e_2026-07-29T19-31-13PDT`,
one commit (`f7588b9`).

**Status: RAN WITH FIXES.** The gate ran for real, against a real Obsidian. It was
GREEN on arrival — but the risk the ticket asked me to verify (panel one disclosure
taller, four longer labels on a 260px surface) turned out to hide a REAL, unguarded
layout bug that no assertion covered. Fixed, and now guarded.

## Did the gate actually run? Yes.

No blocker. This Linux container runs the suite exactly as the README promises: a
pinned Obsidian 1.12.7 was already cached under `.tmp/obsidian/`, no display server
is present so `scripts/run-e2e.sh` supplied the headless Ozone flags itself, and
`npm run test:e2e` needed no arguments, no env vars and no workarounds.

| Run | Result |
|---|---|
| `npm run test:e2e` (baseline, before any change) | **94 passed, 1 skipped**, exit 0 — `.tmp/e2e_run1.log` |
| `npm run test:e2e` (final, after the fix + new test) | **95 passed, 1 skipped**, exit 0 — `.tmp/e2e_run2.log` |
| `npm test` | **87 files / 1139 tests passed**, exit 0 — `.tmp/unit1.log` |
| `npm run check` | exit 0 — `.tmp/check1.log` |
| `npm run build` | exit 0 — `.tmp/build_fix.log` |

The 1 skip is `externalVault.e2e.ts`, which is opt-in behind `VICINITY_E2E_VAULT`
and correctly skips. Full run ≈ 55s.

**All four at-risk specs ran and passed unmodified**, on the first run, before any
change of mine: `settingsResetVerify.e2e.ts` (8), `settingsUxVisual.e2e.ts` (16),
`settingsDependentRows.e2e.ts` (3), and the controls-panel disclosure spec — which
is not a separate file: the derived card-heading / disclosure baseline lives in
`e2e/settingsBaseline.ts` and is asserted by `settingsUxVisual.e2e.ts` ("panel
defaults…" and "…top-level disclosures are exactly the listed ones, in order") plus
`settingsResetReview.e2e.ts` (11). The previous ticket's spec rewrites were correct
as written. **Nothing was stale; no assertion was tuned.**

## The bug the gate did NOT catch — and now does

The ticket flagged "the panel is one disclosure taller / wrapping unverified". A
green suite says nothing about that, so I wrote a throwaway geometry probe (deleted
before commit) that opened the panel with EVERY disclosure open and measured it.

**Finding (measured, not inferred):** `.vicinity-graph-toolbar__body` caps itself at
`max-height: 60vh` with `overflow-y: auto`, and it is a column flex container. Its
children — the section `<details>` — inherit the default `flex-shrink: 1`. So once
the open sections exceeded the cap, they SHRANK to fit it instead of overflowing it.
Because `.vicinity-graph-disclosure` is `overflow: hidden`, each section then
silently CLIPPED its own rows, and the body never grew a scrollbar. Measured with
all six sections open:

| Section | Shown | Needed |
|---|---|---|
| Depth (all notes) | 38px | 92px |
| Node sizing | 138px | 336px |
| Node contents | 46px | 113px |
| Force layout | 128px | 311px |
| Node exclusion | 45px | 108px |
| Performance | 29px | 70px |

`bodyScrollHeight === bodyClientHeight === 479` — i.e. the panel did not know it had
overflowed. The controls below each cut were **unreachable, with no error state and
no scrollbar**. Screenshot evidence: `.out/panel-label-probe/panel-all-open.png`
(pre-fix, taken by the probe) vs `.out/settings-ux/panel-all-sections-open.png`
(post-fix, now taken by the permanent test).

**Root cause fix** (`src/view/graph-view.css`, 4 lines + a WHY block):

```css
.vicinity-graph-toolbar__body > * { flex-shrink: 0; }
```

After it: `bodyScrollHeight` 1086 vs `bodyClientHeight` 479, zero clipped sections,
real scrollbar.

**Is it a regression from the dual-presenter ticket?** Not strictly — the shrink
behaviour predates it and was already reachable by opening Node sizing + Force
layout together. But that ticket made it easier to hit (a sixth disclosure, and
three labels that now wrap to two lines), and it is squarely inside the risk the
ticket asked me to verify, so I fixed it here rather than filing it.

**New guard** (`e2e/settingsUxVisual.e2e.ts`): *"panel: WHEN every disclosure is
open THEN the body scrolls and no section clips its own rows"* — opens every
top-level disclosure, compares each section's `clientHeight` to its `scrollHeight`,
asserts the empty set, then asserts non-vacuity (the body must genuinely overflow
its cap, or the test is guarding nothing). It restores the declared default
open/closed state afterwards so the later screenshots are unaffected.
**Verified RED against the pre-fix CSS** (`.tmp/red2.log`) — the failure names each
cut-off section with its shown/needed pixels. This is the kind of bug a locator
assertion cannot see: the clipped rows are still in the DOM and still "visible".

## The label-wrapping risk itself: verified, no action needed

Measured on the real 260px panel with every section open — **nothing is clipped,
nothing is ellipsised, nothing overflows the panel horizontally** (`clippedPx = 0`
and `overflowsPanelRightPx = 0` for every label). Three labels wrap to two lines and
read cleanly next to their inputs:

- `Minimum node size (px)` — 152px, 2 lines
- `Maximum node size (px)` — 152px, 2 lines
- `Exclude notes from the graph` — 176px, 2 lines

`Outgoing depth` / `Incoming depth` (144px) stay on one line, as do all seven
force-layout slider labels (longest: `Group member spacing`, 141px, `nowrap` +
ellipsis with room to spare). So the owner decision in
`nid_0u28xzhz05qewz35jfqkxkvz2_e` can be made on taste, not on damage: the longer
wording costs three two-line rows and clips nothing.

## Files changed

- `src/view/graph-view.css` — the `flex-shrink: 0` rule + the WHY block explaining
  why the cap needs it.
- `e2e/settingsUxVisual.e2e.ts` — the new clipping test, plus a
  `topLevelPanelDisclosures()` helper (the `<details>` twin of the existing
  `topLevelPanelSummaries()`, indexable in the baseline's order).

No spec assertion was weakened, none skipped, nothing hand-edited in `main.js` /
`styles.css` (both regenerated by `npm run build`, both untracked).

## Open risks / notes for the owner

1. **The 60vh cap is still a cap.** With every section open the content is 1086px
   against a 479px viewport-derived cap, so the panel scrolls a lot. That is the
   designed behaviour and it now works, but if the panel is meant to be used
   several-sections-open, a wider or taller panel is a UX conversation — not one I
   opened here.
2. **`summaryAlsoMatchesAnAncestor` in `e2e/settingsBaseline.ts`** (the previous
   ticket's item 4, the one hand-written fact) is confirmed correct by this run:
   the flags as preserved produce a green gate.
3. Nothing else in the suite is flaky in this environment — three consecutive full
   or partial runs produced identical results.
