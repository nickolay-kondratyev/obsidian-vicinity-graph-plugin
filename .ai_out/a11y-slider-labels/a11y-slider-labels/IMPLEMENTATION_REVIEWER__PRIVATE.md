# IMPLEMENTATION_REVIEWER — PRIVATE notes (a11y slider labels, commit b59a65a)

## Method actually used

1. Read CLAUDE.md, both EXPLORATION docs, the implementer's PUBLIC report.
2. `git diff a970bc7..HEAD -- src/ e2e/` (2 files, +113/-47) and the FULL current
   `src/view/VicinityGraphSettingTab.ts` (613 lines).
3. Ran `npm run check` + `npm test` in background while reading. Then both touched e2e specs.
4. **Wrote a throwaway probe spec** `e2e/zzReviewProbe.e2e.ts`, ran it, deleted it in the same bash
   invocation (`npm run test:e2e -- zzReviewProbe.e2e.ts; rm -f e2e/zzReviewProbe.e2e.ts`).
   `git status` afterwards shows only `.ai_out/.../TOP_LEVEL_AGENT.md` modified (not by me — it was
   already dirty from the orchestrator). Repo otherwise clean. Playwright `testDir: "."` +
   `testMatch: "**/*.e2e.ts"` relative to `e2e/`, so the probe had to live there; nothing else works.

## Raw probe output worth keeping

```
counts: rangeUnlabeled 0, numberUnlabeled 0, textareaTotal 0,
        textUnlabeled 0, checkboxUnlabeled 6, selectUnlabeled 0
PROBE_AFTER_STRIP_UNLABELED = 19   (range+number, after removing every aria-label in-page)
```
19 = 10 ranges + 9 numbers (5 metric weights + min px + max px + depth decay k + node cap).
Decomposition verified against the dump; the guard is genuinely non-vacuous for both selectors.

Full control order dumped from the live DOM (this is the ordering-regression evidence):
Outgoing depth(range), Incoming depth(range), Restore depth defaults(button),
[Own file size cb + Own file size weight num] ×5 metrics (Own file size, Total linker size,
Backlinks, Outlinks, Depth decay), Minimum node size (px)(num), Maximum node size (px)(num),
Depth decay k(num), Restore node sizing defaults, Preview radio ×3, Outline depth(range),
Restore node contents defaults, Center force, Repel force, Link force, Link distance,
Node spacing, Group member spacing, Edge clearance (all range), Restore force layout defaults,
Exclude notes from the graph(cb), Restore node exclusion defaults, Node cap(num),
Restore performance defaults, Restore all Vicinity Graph settings.

Matches FORCE_LAYOUT_MAIN_FIELDS then FORCE_LAYOUT_ADVANCED_FIELDS exactly. No drift.

## Things I checked and cleared (so a re-review doesn't redo them)

- `.then()` timing: `BaseComponent.then` is synchronous self-application (same pattern the restore
  buttons already used pre-change). Placed between `setDynamicTooltip()` and `onChange()`; nothing
  calls `setValue`/`setLimits` afterwards, so the attribute cannot be wiped. Proven by the DOM dump.
- `setValue` argument now evaluated at `addLabeledSlider` call time rather than inside the
  `addSlider` callback. Obsidian calls the callback synchronously; `display()` is synchronous.
  Same store read. Non-issue, but it IS the kind of thing that could have been a bug.
- `SliderBounds` vs `FORCE_LAYOUT_RANGES[field]`: structural typing, same 3 readonly numbers.
  `tsc` clean confirms.
- `settingsResetReview.e2e.ts:190-200` exact ordered list: unchanged, 7 Restore labels, spec green.
- No `ap_XXX_E` anchors anywhere in the diff (grep = 0 hits); the settings-tab file contains none.
- `.or(...)` removal at old line 176 STRENGTHENS the test (the CSS branch could mask a missing
  label). Not a weakening — do not flag it as one.
- ForceLayoutSection.tsx:87 `aria-label={meta.label}` — verified myself, exploration was right.
- Gamma breadcrumb failure: ticket file committed at 507a27a, far predates this branch; the failing
  spec is not in the diff. Genuinely pre-existing.

## Judgement calls I made

- **Not blocking on S1/S2.** Production code is correct and every AC is met at the DOM level. The
  weaknesses are in how much the guard guards, i.e. future-proofing, not current correctness.
  Blocking a correct a11y fix over an e2e selector breadth would be the wrong call — but S2 IS the
  thing the ticket's second AC is actually about, so it must not be soft-pedalled either. Framed it
  as "criterion 2 passes for sliders, partial beyond them" rather than a flat PASS.
- **S1 (vacuous textarea) is the one I feel strongest about**: CLAUDE.md calls silent fallbacks in
  tests lies. An assertion that is structurally incapable of failing is the same species. I verified
  it rather than guessed — `textareaTotal: 0` because `settingsUxVisual.e2e.ts:85` toggles exclusion
  back off and `VicinityGraphSettingTab.ts:253` gates the textarea on `exclusion.enabled`.
- Did NOT temporarily revert production code to prove the test fails — the brief says read-only for
  production code. Used an in-page `removeAttribute` mutation instead, which is equivalent evidence
  and leaves the tree untouched.
- The `nameControl` one-line static wrapper could read as ceremony over `setAttribute`. I did not
  flag it: it is the only place the WHY is written down, and CLAUDE.md's DRY rule is explicitly
  about knowledge duplication ("if you'd write the same WHY comment twice…"). It earns its keep.

## If asked to re-review after fixes

Re-run only `npm run test:e2e -- settingsUxVisual.e2e.ts` and re-check that enabling exclusion in
the new test does not break tests 7-14 in that serial file (they share one Obsidian instance;
test 8 does a restore-all which resets exclusion anyway, so ordering is probably fine — but verify,
don't assume).
