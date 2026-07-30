# IMPLEMENTATION_REVIEWER — PRIVATE (rehydration)

Ticket `nid_9wed7bqboqb83aghmt1sctv90_e`. Reviewed commits `f7588b9` (fix + guard test)
and `ec35ce6` (ai_out docs) against base `ef96122`.

## Verification actually performed (all read-only)

- `git diff --stat ef96122..HEAD` → **338 insertions, 0 deletions**. Pure-additive:
  `e2e/settingsUxVisual.e2e.ts` (+69), `src/view/graph-view.css` (+11), 3 ai_out docs.
  ⇒ No spec could have been weakened/removed. Strongest single piece of evidence.
- `.tmp/e2e_run1.log`: `94 passed, 1 skipped (54.8s)`; header shows
  `setup-obsidian-bin: using cached binary (Obsidian 1.12.7)` +
  `run-e2e: no display detected — using headless Obsidian flags`. Real Electron run.
  `.tmp/obsidian/obsidian-1.12.7` exists.
- `.tmp/e2e_run2.log`: `95 passed, 1 skipped (55.0s)`.
- `.tmp/red2.log`: genuine RED for the new test — 5 sections listed with
  shownPx<neededPx (Node sizing 151/…, Force layout 101/226, etc.), failure at
  `settingsUxVisual.e2e.ts:178`. Credible pre-fix demonstration.
- The 1 skip = `e2e/externalVault.e2e.ts:30` `test.skip(vaultDir === undefined …)` —
  **pre-existing**, env-gated by `VICINITY_E2E_VAULT`. No new skip anywhere
  (`grep -rn skip e2e/*.ts` shows only that one + prose in comments).
- All four at-risk specs present and green in run1 (`settingsDependentRows` 3,
  `settingsResetReview` 11, `settingsResetVerify`, `settingsUxVisual`).
- My own runs: `npm run check` exit 0 (`.tmp/rev_check.log`), `npm test` exit 0,
  87 files / 1139 tests (`.tmp/rev_test.log`).
- `git status --porcelain` empty; `git ls-files | grep -E '^(main.js|styles.css)$'`
  empty ⇒ build artifacts untracked, nothing hand-edited into them.

## CSS fix assessment

`src/view/graph-view.css:499-508`. Body (`:489`) is `display:flex; flex-direction:column;
max-height:60vh; overflow-y:auto`. Children are ONLY `<Disclosure>` sections
(`src/view/GraphToolbar.tsx:45-55`), and `.vicinity-graph-disclosure` (`:593`) is
`overflow:hidden` → default `flex-shrink:1` made sections absorb the overflow and clip.
`flex-shrink:0` on `> *` is the correct root-cause fix: no-op when content fits (no
flex-grow anywhere), so zero regression risk to the non-overflow case; `> *` is
future-proof for a non-disclosure child.
Swept for the same bug class elsewhere (`grep -n overflow src/view/*.css`):
`settings-tab.css:75` (`.vicinity-graph-confirm-items`, a `<ul>` block box) and
`node-outline.css:25` (block box, deliberately `flex:1 1 auto; min-height:0`) — neither
is a shrinkable flex child of an overflow container. No sibling occurrences.

## Findings I settled on

- No BLOCKING.
- SHOULD-FIX 1: exact `neededPx > shownPx` (test line 169) — sub-pixel rounding flake
  risk on dPR≠1 hosts (the gate is documented as runnable on macOS/Windows via
  `OBSIDIAN_PATH`). Want a named `SECTION_CLIP_TOLERANCE_PX = 1`.
- SHOULD-FIX 2: the WHY comments (css:505-ish, test:146) say "That is exactly what
  regressed once (`flex-shrink: 0` on …)" — reads as if the FIX was the regression, and
  it never "regressed": it was latent from the start. Invites deletion of the rule.
- SHOULD-FIX 3 (process, not the coder's file to touch here): no `change_log` entry for
  a user-visible bug fix (precedent: many `[bug_fix]` entries), ticket still
  `status: open`, and the report's open risk #1 (1086px content vs 479px cap = a UX
  conversation) was raised but not filed as a ticket per CLAUDE.md.
- NITs: nested "Advanced spacing" disclosure not opened by the guard (harmless, the fix
  is content-independent); the non-vacuity assertion would false-alarm if someone
  legitimately removes the 60vh cap (its message already says so).

## Verdict issued

APPROVE-WITH-FIXES. 0 BLOCKING / 3 SHOULD-FIX.
Public file: `IMPLEMENTATION_REVIEW__PUBLIC.md` in this OUT_DIR.
