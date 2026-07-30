# IMPLEMENTATION_REVIEW — PUBLIC

Ticket `nid_9wed7bqboqb83aghmt1sctv90_e`. Reviewed `f7588b9` + `ec35ce6` against
`ef96122`.

## Verdict: **APPROVE-WITH-FIXES** — 0 BLOCKING, 3 SHOULD-FIX

## Summary

The gate genuinely ran, and I could not find a hack. The diff is **338 insertions,
0 deletions** — nothing was skipped, deleted, relaxed or re-baselined; the only
product change is a 4-line CSS rule with a WHY block, plus one new e2e test.

Evidence I checked myself, not just the report:

| Claim | How I verified it |
|---|---|
| Real Obsidian, not a stub | `.tmp/e2e_run2.log` header: `setup-obsidian-bin: using cached binary (Obsidian 1.12.7)` + `run-e2e: no display detected — using headless Obsidian flags`; `.tmp/obsidian/obsidian-1.12.7` present |
| Baseline green before any change | `.tmp/e2e_run1.log` → `94 passed, 1 skipped (54.8s)` |
| Final green | `.tmp/e2e_run2.log` → `95 passed, 1 skipped (55.0s)` |
| The 1 skip is pre-existing | `e2e/externalVault.e2e.ts:30` — `test.skip` gated on `VICINITY_E2E_VAULT`, untouched by this branch. No new skip in `e2e/` |
| All four at-risk specs really ran | run1 lists `settingsDependentRows` (3), `settingsResetReview` (11), `settingsResetVerify`, `settingsUxVisual` — all ✓, all unmodified |
| RED before the fix | `.tmp/red2.log` fails at `settingsUxVisual.e2e.ts:178` naming 5 clipped sections with shown/needed px. Non-vacuous, and the numbers match the reported pre-fix geometry |
| No hand-edited artifacts | working tree clean; `main.js` / `styles.css` are not tracked |
| Independent re-run | my `npm run check` exit 0; my `npm test` 87 files / 1139 tests passed |

**The CSS fix is the right root-cause fix, not a nudge.**
`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/view/graph-view.css:489`
makes the body a `flex-direction: column` box with `max-height: 60vh; overflow-y: auto`;
its only children are `<Disclosure>` sections (`src/view/GraphToolbar.tsx:45-55`), and
`.vicinity-graph-disclosure` (`:593`) is `overflow: hidden`. Default `flex-shrink: 1` is
therefore exactly the defect: the sections absorb the overflow and clip themselves
instead of letting the body scroll. Pinning `flex-shrink: 0` restores the intended
scroll. It is a **no-op when the content fits** (nothing sets `flex-grow`), so the
non-overflow case cannot regress, and `> *` stays correct if a non-disclosure child is
added later. I also swept for the same bug class elsewhere — `settings-tab.css:75`
(`.vicinity-graph-confirm-items`) and `node-outline.css:25` are block boxes, not
shrinkable flex children — so there is no sibling occurrence left unfixed.

Layering, BDD naming, DRY reuse of `setOpen` / `CONTROLS_PANEL_DISCLOSURES` and the
restore-to-declared-defaults teardown all follow repo convention.

## 🚨 CRITICAL Issues

None.

## ⚠️ SHOULD-FIX

### 1. Sub-pixel flake risk in the clip comparison
`e2e/settingsUxVisual.e2e.ts:163-170` — `.filter((section) => section.neededPx > section.shownPx)`
compares two integer-rounded metrics exactly. `clientHeight` and `scrollHeight` round
differently for fractional layout heights, so on a host with `devicePixelRatio ≠ 1` or
a different UI font (the README documents running the gate on macOS/Windows via
`OBSIDIAN_PATH`) a section can report `scrollHeight === clientHeight + 1` while nothing
is actually clipped. That is a false red on the release gate.

Requested change: introduce a named tolerance and filter on it, keeping the px in the
message:

```ts
/** clientHeight/scrollHeight round independently; 1px is rounding, not a cut row. */
const SECTION_CLIP_TOLERANCE_PX = 1;
…
.filter((section) => section.neededPx - section.shownPx > SECTION_CLIP_TOLERANCE_PX)
```

(1px cannot hide a real cut — the pre-fix damage was 40-200px per section.)

### 2. The WHY comments invert their own meaning
`src/view/graph-view.css:499-505` and `e2e/settingsUxVisual.e2e.ts:146` both say:

> "That is exactly what regressed once (`flex-shrink: 0` on `.vicinity-graph-toolbar__body > *`)"

That reads as *"`flex-shrink: 0` is the thing that regressed"* — i.e. it invites a future
maintainer to delete the very rule the comment defends. It is also not a regression: by
the report's own analysis the shrink behaviour predates the dual-presenter ticket and was
latent from the start. Requested change: reword to name the defect, not the fix, e.g.
*"This was a latent defect the whole time — reachable with Node sizing + Force layout both
open; do not remove this rule, the cap silently clips without it."*

### 3. Bug fix not recorded, ticket not closed, open UX risk not filed
- No `change_log` entry for what is a user-visible bug fix (controls were **unreachable**
  with no error state). The log has plenty of `[bug_fix]` precedent.
- `_tickets/run-the-e2e-release-gate-…md` is still `status: open`.
- The report's open risk #1 (1086px of content against a 479px cap ⇒ "is the panel meant
  to be used several-sections-open?") is a real issue spotted outside the task; CLAUDE.md
  says file a ticket rather than only mentioning it in a report. Suggest a `decide`-tagged
  ticket linked to `nid_0u28xzhz05qewz35jfqkxkvz2_e`.

These are for whoever owns the wrap-up step, not necessarily the implementer.

## 💡 Suggestions (optional)

- The guard opens only **top-level** disclosures, so the nested "Advanced spacing" section
  never contributes to the worst case. Low value (the fix is content-independent), but
  `body.querySelectorAll("details")` in the open-loop would make the guard maximal.
- The non-vacuity assertion (`bodyScrollHeight > bodyClientHeight`) will false-alarm if
  someone deliberately removes the 60vh cap. Its failure message already explains this, so
  I'd leave it — noting it only so nobody is surprised.

## Documentation Updates Needed

None required. The CSS carries its own WHY block (modulo SHOULD-FIX 2); no CLAUDE.md,
README or `high-level-plan.md` statement is contradicted by this change.

---

# Round 2 sign-off — 2026-07-29

Reviewed `2f14e62` + `bcc0e3d` against `3116281`. Scope: SHOULD-FIX **1 and 2** only
(SHOULD-FIX 3 is TOP_LEVEL_AGENT's and is handled in parallel — not re-flagged here).

## Verdict: **APPROVE** — 0 BLOCKING, 0 SHOULD-FIX

### SHOULD-FIX 1 (sub-pixel flake) — resolved, and the guard is still NON-VACUOUS

`e2e/settingsUxVisual.e2e.ts:32-38` defines `SECTION_CLIP_TOLERANCE_PX = 1` as a
module-level const with a WHY docblock, passes it into `evaluate` as its second argument
(so it is not duplicated inside the browser closure), filters on
`neededPx - shownPx > tolerancePx` and interpolates it into the failure message. Exactly
the requested shape.

The important question — does 1px of slack let real clipping through, and does the guard
still fail when it should? — is answered by evidence produced **after** the tolerance
change: `.tmp/it1_red.log` (CSS reverted to `flex-shrink: 1`, dev-vault re-seeded, spec
re-run) still reds, naming **6** sections with the new wording:

| Section | shown / needed | damage |
|---|---|---|
| Node sizing | 151 / 336 | 185px |
| Force layout | 101 / 226 | 125px |
| Node contents | 50 / 113 | 63px |
| Node exclusion | 49 / 108 | 59px |
| Depth (all notes) | 41 / 92 | 51px |
| Performance | 31 / 70 | 39px |

The smallest real cut is 39x the tolerance. 1px is rounding, not a cut row — the
tolerance is correctly sized and the assertion is not weakened.

The non-vacuity assertion (`bodyScrollHeight > bodyClientHeight`, lines 195-198) is
**unchanged** and still present, so the test cannot pass by having nothing to measure.

### SHOULD-FIX 2 (inverted WHY comments) — resolved

Both sites now name the *default* as the defect and the rule as the fix, unambiguously:

- `src/view/graph-view.css:498-514` — opens with `DO NOT REMOVE`, then `WHAT BREAKS: the
  default 'flex-shrink: 1' is wrong for these children` (children absorb the 60vh
  overflow → body `scrollHeight` never exceeds `clientHeight` → no scrollbar → each
  `overflow: hidden` disclosure crops its own rows, measured 336px → 138px), then `WHY 0`,
  that it is a no-op when content fits, and it names the guarding e2e test.
- `e2e/settingsUxVisual.e2e.ts:150-160` — the "That is exactly what regressed once
  (`flex-shrink: 0` …)" sentence is gone; it now says the shrink default was a **latent
  defect for as long as the cap existed** and that `flex-shrink: 0` **is the FIX** which
  this test keeps in place.

The implementer's correction is also right: this was never a regression introduced by the
dual-presenter ticket. Neither comment can now be read as an invitation to delete the rule.

### No scope creep, no hack, no weakened assertion

- `git diff --stat 3116281..HEAD` touches only the two files above plus two `ai_out` docs.
- The CSS diff contains **zero non-comment lines** — I filtered the comment lines out of
  the diff and the remainder is empty, confirming the rule is byte-identical. Comment-only
  change ⇒ no behavior change, and the e2e re-run is a formality rather than the proof.
- No test skipped, deleted, renamed or re-baselined. Working tree clean.
- My own re-runs: `npm run check` exit 0 (`.tmp/rev2_check.log`); `npm test` exit 0 —
  87 files / 1139 tests (`.tmp/rev2_test.log`). Full e2e gate not re-run, per instruction;
  the implementer's `settingsUxVisual` run is 17 passed (`.tmp/it1_uxspec_final.log`).

### 💡 Non-blocking nit (do not gate on this)

The clip filter now carries 1px of slack while the non-vacuity assert still uses an exact
`>`. Asymmetric in principle, but the real overflow margin is ~600px, so it can never
matter. Leave as is.
