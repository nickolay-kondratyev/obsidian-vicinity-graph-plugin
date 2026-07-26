# IMPLEMENTATION_WITH_SELF_PLAN__PRIVATE — rehydration memory

Status: **DONE**. Commit `967aade` on `e2e-settings-helper-dry`, tree clean, all gates green.
If you are rehydrating after this point there is nothing outstanding except closing the ticket.

## Exact command invocations used

```bash
# baseline, run FIRST on the clean tree (backgrounded, ~55s)
npm run test:e2e > .tmp/e2e-baseline.log 2>&1          # 79 passed / 1 skipped / EXIT=0
cp .tmp/e2e-baseline.log .ai_out/e2e-settings-helper-dry/e2e-settings-helper-dry/

npm run check   > .tmp/check.log   2>&1   # tsc src + tsc -p e2e/tsconfig.json
npm test        > .tmp/vitest.log  2>&1   # 990 tests / 74 files
rm -rf .out/settings-reset-verify && npm run test:e2e > .tmp/e2e-after.log 2>&1
# (the rm is so the theme screenshots I then eyeballed could not be stale artifacts)

# per-spec counts from either log:
grep -E "^  ✓" .tmp/e2e-baseline.log | grep -oE "e2e/[a-zA-Z]+\.e2e\.ts" | sort | uniq -c
```

`npm run test:e2e` DOES work in this environment (`.dev-vault/` present, `scripts/run-e2e.sh`
resolves Obsidian). No blocker. Whole suite runs in one worker, serially — specs share
`.tmp/e2e/vault`, each `launch()` re-prepares it.

## Plan as executed

1. Kick off baseline e2e in background while reading `EXPLORATION_PUBLIC.md` + all four files.
2. Harness first (types + primitives), then the new page object, then the three specs.
3. `npm run check` + `npm test` after each stage, e2e once at the end.
4. Eyeball the theme screenshots (this is what actually validates the `setTheme` decision).
5. One commit (the work is one coherent refactor; splitting it would have left intermediate
   commits with a half-migrated harness).

## Design decisions and the reasoning that is NOT obvious from the diff

- **Page object as a class taking `page`**, constructed in `beforeAll`, rather than free
  functions over a module-level `page` — the specs bind `page` only after `launch()`, so
  free functions would need the same late-binding hack the old copies had.
- **Types come from the engine, not hand-written.** I nearly wrote a `PluginGlobalsSnapshot`
  with hand-copied fields (which is what all three specs did) before checking
  `src/engine/types.ts` and finding `ViewSettings` / `DepthSettings` / `NodeExclusionSettings`
  match exactly. Type-only import ⇒ erased ⇒ the pure engine barrel never loads node-side.
  `ViewSettingsOverride` = `Partial<ViewSettings>` was already exported, so `saveGlobalView`
  needed no new type.
- **Deleted `GlobalViewSnapshot`** rather than aliasing it. Only `controlsRestart.e2e.ts`
  consumed it, structurally; `tsc` confirms.
- **Existing `set*` helpers rewritten to compose the new primitives.** This is what makes
  `pluginDataStore` appear in exactly one file — otherwise the harness itself would have been
  the "fourth idiom".
- **`reloadPlugin()` added** even though only review calls it: it was the last raw
  `app.plugins` evaluate in that spec and it carries the `waitForFunction` that a caller would
  otherwise re-type. `app.setting.close()` deliberately stayed OUT of it (SRP: settings window
  belongs to `SettingsTabPage`); the spec now calls `settingsTab.close()` then
  `harness.reloadPlugin()`.

## The setTheme decision — dead end considered and rejected

First instinct was the ticket's suggestion: promote verify's REAL-API version into the harness
(`app.customCss.setTheme?.(t) ?? app.changeTheme(t)`), mapping light→moonstone / dark→obsidian,
replacing the 200ms sleep with `waitForFunction` on the body class.

Rejected, for reasons worth keeping:
1. The `??` in the original is accidental: `customCss.setTheme` returns `void`, so `changeTheme`
   ALWAYS runs too. It is a legacy-compat idiom (pre-0.9 Obsidian took base-scheme ids on
   `customCss.setTheme`; modern `customCss.setTheme` expects a COMMUNITY theme name).
   Faithfully porting it would mean porting a misuse.
2. `changeTheme` persists into the vault's appearance config. Under `VICINITY_E2E_VAULT` that
   writes to the human's real vault — a genuine (if small) regression of the README safety
   posture, for zero coverage, since nothing asserts the persisted theme id.
3. The body-class toggle is already proven sufficient: `vicinityGraph.e2e.ts` asserts per-theme
   `--text-faint` resolution through it.

So the class toggle survives, and I VERIFIED the outcome rather than assuming it: read
`.out/settings-reset-verify/04-…-light.png` (light), `06-…-dark.png` (dark),
`07-exclusion-confirm-dark.png` (dark, patterns verbatim). If a reviewer disagrees, the switch
is a ~10-line change confined to `ObsidianHarness.setTheme`.

## Mechanics

Spec migrations were done with throwaway Python scripts (`.tmp/mig_review.py`,
`mig_review2.py`, `mig_verify.py`, `mig_ux.py`) using `assert old in s` on every replacement
so a missed pattern failed loudly instead of silently no-op'ing. Regexes used
`(?<![.\w])name\(` to avoid re-replacing already-qualified `settingsTab.card(` calls. Two
leftovers the scripts could not catch (multi-line locators) were fixed by hand afterwards:
`tabPreviewRadio` and the wrapped `expect(...).toHaveCount(3)` in ux-visual.

## Things checked so a reviewer does not have to re-check

- `vaultTarget.test.ts` passes with the new top-level module (it has no `fs` — verified by the
  green `npm test`, which runs that scan over `readdirSync("e2e")`).
- No `PLUGIN_ID` / `pluginDataStore` / `app.setting` reference remains in any of the three
  specs (`grep`ed). Remaining `page.evaluate` calls in them are pure-DOM measurements
  (bounding rects, computed styles, `document.activeElement`) — correctly left alone.
- `.modal-container.mod-dim` in review stayed inline: it is a different, more specific
  assertion than `openModals()`.
