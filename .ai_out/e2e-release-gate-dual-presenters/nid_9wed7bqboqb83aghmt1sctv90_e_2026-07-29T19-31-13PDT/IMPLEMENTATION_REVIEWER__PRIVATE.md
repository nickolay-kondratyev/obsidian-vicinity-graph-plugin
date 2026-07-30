# IMPLEMENTATION_REVIEWER — PRIVATE (rehydration)

Ticket `nid_9wed7bqboqb83aghmt1sctv90_e`.

## Round 1 (commits `f7588b9` + `ec35ce6` vs `ef96122`)

- Diff was **338 insertions, 0 deletions** — pure additive: `e2e/settingsUxVisual.e2e.ts`
  (+69), `src/view/graph-view.css` (+11), 3 ai_out docs. No spec weakened/removed.
- `.tmp/e2e_run1.log` 94 passed / 1 skipped (baseline), `.tmp/e2e_run2.log` 95 passed /
  1 skipped. Real Electron (`Obsidian 1.12.7`, headless flags). `.tmp/red2.log` = genuine
  pre-fix RED. The 1 skip is pre-existing `e2e/externalVault.e2e.ts:30`
  (`VICINITY_E2E_VAULT` gated).
- CSS fix `.vicinity-graph-toolbar__body > * { flex-shrink: 0 }` — root cause, no-op when
  content fits (nothing sets `flex-grow`). Swept siblings: `settings-tab.css:75`,
  `node-outline.css:25` are block boxes, not shrinkable flex children. No other occurrence.
- Verdict: **APPROVE-WITH-FIXES**, 0 BLOCKING / 3 SHOULD-FIX
  (1) exact `neededPx > shownPx` → sub-pixel flake risk, want a named tolerance;
  (2) WHY comments read as if `flex-shrink: 0` was the regression → invites deletion;
  (3) process: no `change_log` entry, ticket still open, cap-UX risk not filed as ticket.

## Round 2 (commits `2f14e62` + `bcc0e3d`, base `3116281`) — scope: findings 1 & 2 only

Verified:
- `git diff --stat 3116281..HEAD`: only `e2e/settingsUxVisual.e2e.ts`, `src/view/graph-view.css`
  and 2 ai_out docs. **The CSS diff contains ZERO non-comment lines** (checked by filtering
  comment lines out of the diff) ⇒ the rule is byte-identical, comment-only rewrite. No
  scope creep, working tree clean.
- (1) `SECTION_CLIP_TOLERANCE_PX = 1` is a module-level const with a WHY docblock, passed
  into `evaluate` as its 2nd arg (not duplicated in the browser closure); filter is
  `neededPx - shownPx > tolerancePx`; failure message interpolates it. Correct, and
  **NOT weakening**: `.tmp/it1_red.log` (produced AFTER the tolerance change, with the CSS
  reverted) still reds naming 6 sections, minimum damage 39px (Performance 31/70), max
  185px (Node sizing 151/336). 1px cannot mask a real cut here.
- Non-vacuity assertion `bodyScrollHeight > bodyClientHeight` unchanged and still present
  (test lines 195-198). Guard remains non-vacuous.
- (2) Both WHY sites rewritten. CSS block now `DO NOT REMOVE` + "the default
  `flex-shrink: 1` is wrong for these children" + WHY 0 + no-op-when-fits + names the
  guarding test. Test docblock names `flex-shrink: 1` as the default defect and
  `flex-shrink: 0` explicitly as "the FIX". The inverted "regressed once" sentence is gone.
  Also correctly reclassifies it as latent, never a dual-presenter regression.
- My runs: `npm run check` exit 0 (`.tmp/rev2_check.log`); `npm test` exit 0, 87 files /
  1139 tests (`.tmp/rev2_test.log`). Full e2e gate NOT re-run (per instruction).

Residual NIT (not raised as a fix): the non-vacuity assert still uses an exact `>` while
the clip filter now has 1px slack — asymmetric, but the real margin is ~600px, so
harmless.

Verdict round 2: **APPROVE**, 0 BLOCKING / 0 SHOULD-FIX in my scope.
SHOULD-FIX 3 is TOP_LEVEL_AGENT's, handled in parallel — deliberately not re-flagged.
