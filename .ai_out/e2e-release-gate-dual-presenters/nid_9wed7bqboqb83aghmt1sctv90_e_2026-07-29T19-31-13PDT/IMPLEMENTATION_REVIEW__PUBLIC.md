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
