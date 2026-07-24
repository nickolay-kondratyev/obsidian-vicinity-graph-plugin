# UI_IMPLEMENTATION_REVIEW — PRIVATE working notes (rehydration state)

## Status
Iteration-1 VERIFICATION COMPLETE (commit `a6668b5`). Verdict READY. Nothing
outstanding from me. Public report (both passes):
`.ai_out/settings-ux-improvements/settings/UI_IMPLEMENTATION_REVIEW__PUBLIC.md`.

## Environment facts (re-usable)
- e2e works here out of the box: `npm run build` then
  `npm run test:e2e -- <specFile>`. `OBSIDIAN_PATH` is already set in the env.
- Playwright config only picks up `e2e/*.e2e.ts` — a scratch spec must live there
  (a spec under `.tmp/` yields "No tests found").
- Screenshots → `.out/settings-reset-review/` (untracked).
- `npm test`: 756 pass / 3 fail — the 3 are the known pre-existing
  SETTINGS_SPEC + forceLayoutSettings `collidePaddingPx` baselines (ticketed).
  `npm run check` exit 0.

## Traps hit while reviewing (do not re-litigate)
- `applyReset` awaits its slice writes in sequence; reading the store immediately
  after a click/Enter races the LAST write. Use `expect.poll`. This is a TEST
  artifact, NOT a product bug — the tab re-renders only after all writes.
- Narrow-width check by forcing container `width: 320px` is a proxy only:
  Obsidian's own responsive settings rules key off `is-mobile`, not width. The 5
  overflowing rows it reports are the pre-existing sizing-metric rows
  (toggle + number in ONE row) — pre-existing, out of scope, do not report.
- `groupByFolder` / `edgeVisibility` have NO UI surface anywhere (confirmed by
  grep over `src/view` + `src/adapters`). The `all` scope resetting them is
  invisible to users → NOT a scope-honesty finding. Initially suspected; dropped.

## Measurements captured
- Modal focus probe: initial `Cancel` `focusVisible=false`; Tab1 → confirm
  `focusVisible=true`; Tab4 escapes to the file-explorer tree, Tab5 returns.
- Footer spacing: `beforeFooter > betweenCards` asserted numerically (gap
  `--size-4-4` + `margin-top: --size-4-4`, additive in flex).

## Judgment calls (rationale, if challenged)
- MAJOR-1 (unconfirmed exclusion-pattern deletion) is deliberately NOT called
  BLOCKING: the description states the behavior, so it is honest; it is a
  friction-vs-blast-radius policy call that TOP_LEVEL already decided (#2) without
  seeing the asymmetry. Human decision, not a correctness defect.
- NIT-2 (focus escape) is attributed to stock Obsidian `Modal`; ConfirmModal adds
  no tabindex. Not worth a fix in this repo. If ever challenged, the way to settle
  it is to tab through any core Obsidian modal and compare.
- NIT-4 (details no longer last in the Force layout card) was verified visually
  (`card-forcelayout-light.png`) — the reset row genuinely reads as a footer, so
  the skill's intent is met even though its letter is not.

## Files
- NEW (kept): `e2e/settingsResetReview.e2e.ts` — 9 tests, all passing.
- `src/` untouched (readonly per instructions).


---

## Iteration-1 verification notes (commit `a6668b5`)

### Outcome
MAJOR-1 fixed WELL (better than my suggestion: confirmation is data on the scope
spec, `requestReset()` is the single entry point — not a call-site branch).
NIT-3 fixed. NIT-1/2/4 rejections all accepted; do NOT reopen them.

### The one thing that needed real digging
`npm run test:e2e` (WHOLE suite) is RED: 47 passed / 2 failed / 7 did not run.
Do NOT panic-report this as a regression — I chased it down:
1. Reproduces standalone (`vicinityGraph.e2e.ts` gamma breadcrumb +
   `edgeRoutingEval.e2e.ts` radial gating).
2. NOT caused by leftover `.dev-vault` settings state — still fails with
   `data.json` deleted. (So the new settings specs do not pollute later specs.)
3. Reproduces IDENTICALLY at base commit `22bd5cb` — proved in a throwaway
   worktree (`git worktree add .worktree/base-<sha>`, symlink the repo's
   `node_modules` in, `npm run setup:dev-vault`, then run the two specs).
   Worktree removed afterwards.
4. Already ticketed with exactly this "2 failed, 7 did not run" signature:
   `docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md` and
   `_tickets/e2e-remove-layeredradial-layout-mode-references-left-by-...md`.
The earlier passes only ever ran INDIVIDUAL spec files, which is why nobody had
seen the full-suite red before.

### Environment facts (additions)
- The base-commit worktree recipe above works and is cheap (~1 min). Reuse it
  whenever "is this pre-existing?" comes up.
- `npm test` is now 769/0 — the 3 stale-baseline failures were genuinely fixed by
  realigning the baselines to the SHIPPED values (human decision 1), not silenced.
- Theme switching in e2e: `app.customCss.setTheme("obsidian"|"moonstone")` works
  and does NOT leak into `.dev-vault/.obsidian/appearance.json` (stays `{}`).

### Verification technique worth reusing
Fixtures with regex metacharacters AND markup (`<b>templates</b>/`) are what
actually prove "verbatim": plain patterns would pass even if the list rendered
HTML. Same idea for the 40-pattern list — it is the only way to catch a
confirmation whose safe exit gets pushed out of the viewport.

### Files
- NEW (kept): `e2e/settingsResetVerify.e2e.ts` — 8 tests, complements
  `settingsResetReview.e2e.ts` (no matrix duplication; I trimmed that out after
  re-running it green).
- `src/` untouched by this pass.
