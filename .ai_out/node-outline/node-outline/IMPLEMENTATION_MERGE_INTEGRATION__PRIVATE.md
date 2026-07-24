# IMPLEMENTATION_MERGE_INTEGRATION — PRIVATE rehydration memory

**Role:** `IMPLEMENTATION_MERGE_INTEGRATION`. **Status: COMPLETE.** Work committed, tree clean.
Public record: `./.ai_out/node-outline/node-outline/MERGE_INTEGRATION__PUBLIC.md`.

## What this task was

Semantic integration of merge `9b786ab` (`node-outline` × main's settings restore-defaults
refactor `3c86c7f`). Textual merge compiled; the semantic gap was that `node-outline` added a
6th settings card ("Node contents" / `outlineMaxDepth`) that never met main's reset machinery.

## Mental model of this settings subsystem (the thing to reload first)

```
VicinityGraphSettingTab.display()      // obsidian glue ONLY, one card per renderX()
  → createSection()                    // .vicinity-graph-settings-section div
  → addSectionReset(section, scope)    // LAST row of each card, copy from SETTINGS_RESET_SCOPES
  → renderRestoreAll()                 // OUTSIDE every card, always confirms
requestReset(scope)                    // the ONE reset entry point
  → planSettingsResetConfirmation()    // decides confirm-vs-not, next to the key-set
  → applyReset() → planSettingsReset() → persist() → refreshOpenViews() → display()
```

Render order (= `SECTION_RESET_SCOPES` order, a documented contract):
`depth-defaults, node-sizing, node-contents, force-layout, node-exclusion, performance`, then
the tab-wide `all` footer. **6 cards, 7 reset buttons.**

Key invariants worth not re-deriving:

- Section scopes that touch `globalView` emit a **merge** write (`{...ctx.globalView, X}`);
  the `all` scope emits **whole-slice** writes (`EngineDefaults.viewSettings()`) precisely so
  it also clears persisted fields with no UI. This is why restore-all already covered
  `outlineMaxDepth` — whole-slice, not merge.
- Confirmation rule: only scopes destroying user-authored *content* confirm. Today that is
  exactly `node-exclusion` (patterns) and `all` (blast radius). Numeric knobs apply instantly.
- `_assertEveryResetScopePlaced` in `settingsResetPlan.ts` is a compile-time guard that every
  scope is either a section scope or the tab-wide one. It caught nothing here (the gap was a
  *missing* scope, not an orphaned one) — hence the new runtime enumeration test.
- `ALL_SCOPE_DESCRIPTION` is used **twice**: footer row description AND confirm-modal body.
  Editing it edits the modal. That is why the missing "node contents" was a modal-honesty bug.

## Changes made (all committed)

1. `settingsResetPlan.ts` — `"node-contents"` scope + `SECTION_RESET_SCOPES` entry +
   `ALL_SCOPE_DESCRIPTION` enumeration + "five cards" → "six" doc.
2. `VicinityGraphSettingTab.ts` — `addSectionReset(section, "node-contents")`; count comments.
3. `settingsResetPlan.test.ts` — `TUNED_VIEW.outlineMaxDepth: 5` (strengthens 3 existing
   assertions) + 6 new tests.
4. Three e2e specs — counts 5→6, reset-row names, `dirtyEverySection` now truly dirties every
   section, new Node-contents isolation branch.
5. Ticket rewritten (3 stale baselines → the 1 remaining) + sibling-ticket cross-reference.
6. CHANGELOG: one clause added to the existing `outlineMaxDepth` bullet. **No new section, no
   `change_log` entry** (both were explicitly out of scope).

## Status of the runs (as of completion)

- `npm run check`: PASS.
- `npm test`: 1 failed / 852 passed. The 1 is the **pre-existing, do-not-touch**
  `SettingsSpec.test.ts` limits baseline (`linkStrengthFactor.max` 2 vs 4). Baseline before
  this work was 1 failed / 846 passed.
- `npm run test:e2e`: 58 passed / 2 failed / 7 did not run. Both failures pre-existing
  (radial routing gate; gamma breadcrumb — `ticket-e2e-gamma-breadcrumb-fails-headless.md`).
  The 7 non-runs are serial-mode fallout in those same two files. All settings specs green.

## If this is picked up again

- **Do NOT** re-pin `linkStrengthFactor.max`. That is the author's call; the ticket says so.
- Adding a 7th settings section? Do all four: `SettingsResetScope` union,
  `SETTINGS_RESET_SCOPES` entry, `SECTION_RESET_SCOPES` (render order!), and the
  `ALL_SCOPE_DESCRIPTION` enumeration. The last one is now test-enforced; the first three are
  type- or test-enforced already.
- e2e section-count assertions live in **three** files
  (`settingsResetReview`, `settingsResetVerify`, `settingsUxVisual`) — an obvious DRY target,
  deliberately not refactored here (out of scope: integration only, no opportunistic
  refactors). Worth a ticket if someone touches this area again.
- Mutation-verification scripts were `.tmp/mutate.py` / `.tmp/mutate2.py` (temp, not
  committed). Pattern: patch → `npx vitest run <file>` → assert RED → restore original text.

## Judgement calls made (defensible, but flag if reviewed)

- Added the generic "tab-wide description enumerates every section" test with label→noun
  string surgery rather than a second hardcoded list of section names. Rejected adding a
  `noun` field to `SettingsResetScopeSpec` as over-engineering. Guarded against vacuity with
  the companion non-empty test.
- Strengthened `TUNED_VIEW` and `dirtyEverySection` instead of leaving their "EVERY setting"
  docstrings as lies. This makes pre-existing assertions stricter, never looser.
- Left both settings-baseline tickets in place (one CLOSED, one OPEN) with a cross-reference,
  rather than deleting the closed historical record.
