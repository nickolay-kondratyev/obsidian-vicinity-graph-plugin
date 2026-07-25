# IMPLEMENTATION — PRIVATE working notes (`node-content-preference`, Phases 1+2)

State for rehydration. Written after both commits landed with a clean tree.

## Where things stand

- `7b9995a` = Phase 1, `f065510` = Phase 2. `git status` clean on branch
  `node-content-preference`. `main.js` / `styles.css` are NOT git-tracked in this
  repo (checked with `git ls-files`), so `npm run build` is safe to run — it does
  not dirty the tree. It also re-copies into `.dev-vault/` (untracked).
- Last verified numbers: `npm run check` exit 0; `npm test` → **1 failed | 892
  passed (893)**; the failure is only `linkStrengthFactor.max` (`SettingsSpec.test.ts`
  limits baseline, expects 2, spec says 4). Logs left in `.tmp/`:
  `check3.log`, `test3.log`, `build.log`, plus the red snapshots
  `phase1-red.log` (18 red) and `phase2-red.log` (14 red = 13 mine + 1 known).
- `tsconfig.json` includes ONLY `src/**` ⇒ `npm run check` does **not** typecheck
  `e2e/`. The e2e edits (Phase 5) will not be caught by `npm run check`.
- No prettier/eslint config in the repo. Lines >120 chars are common in test
  titles; I kept new production lines ≤120 and wrapped two that exceeded it
  (`NODE_PREVIEW_PREFERENCES`, a test fact constant).

## Things I verified rather than assumed

- Only TWO `FileMetadata` construction sites exist (`ObsidianLinkProvider`,
  `FakeLinkProvider`) — grep on `isNodeBearing:`. Making the new field required
  therefore had no hidden fan-out.
- `FlowNodeData` is built in exactly one place (`toFlowNodeData`), BUT two test
  files hand-build it as a literal: `flowMapping.test.ts:355` (the `withPositions`
  fixture) and the `:52` "rich payload" `toEqual`. Both needed `preview`. tsc
  caught the first, the test run caught the second.
- `references === null` inside the outline path is effectively unreachable
  (`isOutlineBearingPath` ⇒ markdown, and `orderedReferencesOf` returns null only
  for non-markdown or `cache === null`, both already short-circuited). I kept the
  guard (it was there before) and phrased plan case 25 as the reachable variant:
  "no cache entry ⇒ false". Worth knowing if someone later tries to write a test
  for "cache present but references unorderable" — you cannot construct it.
- `EDGE_VISIBILITY_MODES` in `persistedShapes.ts` was deliberately left alone
  (plan §8.4 ticket, Phase 5).

## Dead ends / near-misses

- I initially left an orphaned comment in `NoteNode.tsx` where the deleted
  `nodePreviewKind` call had been; folded the WHY into the component docblock
  instead so no comment floats above unrelated code.
- The plan's per-phase test lists do not cover §6.A rows 6–15 / §6.D 30-31-34,
  and Phase 2's numbered steps omit `nodePreviewChoice`/`flowMapping` even though
  Phase 2 is "end to end". I implemented the wiring in Phase 2 (deviation D2 in
  the PUBLIC file). If a reviewer expects the `preference` param to appear only in
  a later phase, that is where the disagreement is — but a setting the pipeline
  ignores would make Phase 3's UI a no-op.
- Phase 2 item 8 needs `NODE_PREVIEW_OPTION_META`, which the plan created in
  Phase 3. Created the module early with ONLY the option record (deviation D1).
  Phase 3 must ADD `NODE_PREVIEW_ROW_LABEL`/`NODE_PREVIEW_ROW_DESCRIPTION` to
  that existing file — do not create a second module.

## Doubts / watch items for the next implementer

1. **Not eyeballed in a real Obsidian.** Phase 1's "the DOM is byte-identical"
   claim rests on: nothing but `NoteNode` reads `data.outline`/`data.preview`, and
   `preview` under `auto` reproduces the old rule (tests §6.A/§6.D). A dev-vault
   check with `outline-cover.md` (image before heading ⇒ thumbnail) and
   `outline-note.md` (image after heading ⇒ outline) is still worth doing at the
   Phase 3/4 boundary when the UI exists to flip.
2. **`imagePrecedesOutline` is computed against the FIRST heading in the
   document, while the decision uses the depth-FILTERED count.** Pathological note
   (`### deep` → image → `## shallow` at depth 2) reports `false`. Identical to
   today's behavior; the reviewer explicitly blessed leaving it. Do not "fix" it
   without a fresh decision.
3. `settingsResetPlan.test.ts`'s "every other view field keeps its tuned value"
   pattern spreads the reset fields back over the result — when Phase 3+ adds no
   new reset field this stays correct, but any future field added to
   `node-contents` must be added to that spread too or the test lies.
4. The `node-contents` reset DESCRIPTION string changed. No unit test asserts it
   verbatim, and the e2e reset lists assert LABELS (unchanged) — but if an e2e
   screenshot baseline ever covers that description, Phase 5 should expect a diff.
5. `_assertEveryNodePreviewPreferenceListed` is exported from `types.ts` only
   (not through `index.ts`) — deviation D5. If a reviewer insists on the plan's
   literal wording, adding one name to the index export is a one-line change.

---

# PRIVATE working notes — wave B (Phases 3 + 4)

Appended by the wave-B instance. Wave A's notes above still hold.

## Where things stand

- `2ded9db` = Phase 3 (+ both SHOULD-FIX items), `c50ed40` = Phase 4. Tree clean.
- Numbers: `npm run check` exit 0; `npm test` **1 failed | 894 passed (895)**,
  1 failed file | 67 passed (68); `npm run build` exit 0. Logs in `.tmp/`:
  `p3-red-tsc.log` (the RED), `p3-check.log`, `p3-test.log`, `p3-build.log`,
  `p4-check.log`, `p4-test.log`, `p4-build.log`.
- I installed Playwright's Chromium (`~/.cache/ms-playwright`, ~114MB) — it was
  absent. There is NO Obsidian binary and no `OBSIDIAN_PATH`, so `npm run
  test:e2e` cannot run here at all, and neither can any dev-vault eyeball.
- The visual harness is `.tmp/segmented-harness.html` +
  `.tmp/shoot-segmented.mjs` (`node .tmp/shoot-segmented.mjs`). It links the
  REAL `graph-view.css` + `segmented-control.css` and stubs Obsidian's theme
  variables. Rebuild it if you need to re-eyeball; it is throwaway, not shipped.

## Things I verified rather than assumed

- `DomElementInfo` (obsidian.d.ts:137-165) has `type` and `value` fields, so
  `createEl("input", { type: "radio", value: preference, attr: { name } })`
  typechecks — no `setAttribute` dance needed except for `checked` (a property).
- No existing e2e counts the panel's disclosures, so adding a 6th section breaks
  nothing; `settingsUxVisual.e2e.ts:52-57` hand-enumerates them and simply
  under-asserts until Phase 5 adds case 56. The settings-tab
  `toHaveCount(6)` sites are untouched (I added a ROW to an existing card).
- `hasText` substring matching in `disclosure(...)`: "Node contents" does not
  collide with "Node sizing" or "Node exclusion". Safe.
- Playwright treats an `opacity: 0` input as visible/actionable (bounding box is
  non-empty), so `check()` works on the stretched radios. Confirmed in the probe.
- The repo has NO jsdom / RTL and zero `*.test.tsx`. Do not promise a component
  test for `NodeContentsSection` — adding that infra is a separate decision.

## Dead ends / near-misses

- I first wrote the plan's focus rule (`outline` on `__text`) and only found it
  wrong by rendering: `overflow: hidden` clips it, and focus lands on the
  *checked* radio, where an accent ring on accent fill is invisible. → group-level
  `box-shadow` (deviation B1). Do not "restore" the plan's sketch.
- I considered a `font-weight` bump on the selected segment as a second,
  non-colour differentiator (WCAG "not colour alone"). Dropped: it changes the
  segment's intrinsic width, so the pill jiggles on every flip in the tab (the
  panel's `flex: 1 1 0` would be immune). The selected state is already a filled
  BOX, not just a hue change, so the luminance difference carries it. If someone
  insists on the weight lever, they must reserve the bold metrics first.
- `--size-2-1` vertical padding (plan's sketch) → 21px pill. Measured, bumped to
  `--size-4-1` → 25px.
- The 2 tests in `nodePreviewPreferenceMeta.test.ts` are a11y-name guards, not
  the plan's §6 cases — §6 assigns Phase 3/4 nothing but e2e (54–57). The second
  one ("row label does not collide with a segment label") passed *vacuously*
  before the constant existed, because vitest does not typecheck; the honest RED
  was the tsc error. Said so in the PUBLIC file rather than claiming a red test.

## Doubts / watch items for the next implementer

1. **`--text-on-accent` is not eyeballed in a real Obsidian** (deviation B2). If
   some theme leaves it unset the checked segment's text inherits `--text-muted`
   on an accent fill = poor contrast. I deliberately did NOT add a fallback,
   because every plausible fallback is also illegible and would hide the bug.
   First real-Obsidian screenshot should check this.
2. **`:has()` is the repo's first use.** If it ever needs to go, the restructure
   is: move padding/border/background to `__text` and select it via
   `input:checked + .vicinity-graph-segmented__text`. The CSS says so.
3. `graph-view.css` now has panel-scoped overrides of a SHARED block
   (`.vicinity-graph-nodecontents .vicinity-graph-segmented…`). If a third
   surface ever wants a stretched pill, promote those two rules into a
   `--stretch` modifier in `segmented-control.css` rather than copying them.
4. The tab pill does **not** re-render the tab on change (no `this.display()`).
   That is deliberate — it would eat keyboard focus mid-arrow-key — but it means
   the pill is the one tab control whose siblings are not re-read after a write.
   Nothing in the Node contents card depends on the preference, so this is safe
   today; adding a control that does would need a rethink.
5. SHOULD-FIX 1 left a real gap: NOTHING pins "sizePx must not depend on the
   preference". I reworded the comment to say so honestly. Phase 5 should file
   the ticket; a `NodeSizer` test is the right home.
