# IMPLEMENTATION_REVIEW__PUBLIC — settings-e2e DRY refactor

Reviewed diff: `a9c86fd..HEAD` (`967aade` code, `457b708` docs) on branch
`e2e-settings-helper-dry`. Ticket `nid_g4iae40tww9abtwrexdrvic0y_e`.

## Summary

Pure test-infrastructure refactor. A new page object `e2e/settingsTabPage.ts`
absorbs the settings-window automation (`open` / `close` / `redisplay` / `card` /
`resetButton` / `resetAllRow` / `resetAllButton` / `confirmDialog` /
`dialogButton` / `openModals`) that the three settings specs each carried a
drifted copy of; `ObsidianHarness` becomes the single holder of
`pluginDataStore` knowledge via `readGlobals` / `saveGlobalView` /
`saveGlobalDepths` / `saveNodeExclusion` / `refreshOpenViews` / `reloadPlugin`,
with the pre-existing typed setters now composing those primitives. The
duplicated `setTheme` in `settingsResetVerify` is deleted in favour of the
harness one.

Assessment: **clean, honest refactor.** I diffed all three specs test-by-test
against `a9c86fd` and found no test reordered, renamed, deleted, merged, or
weakened. All five acceptance criteria are met. Gates re-run and green.

### Gates I ran myself

| Gate | Observed |
|---|---|
| `npm run check` | exit 0 |
| `npm test` | **74 files, 990 tests passed**, exit 0 |
| `npm run test:e2e` | not re-run — nothing in the analysis gave concrete cause to doubt the implementer's 79 passed / 1 skipped |

### Acceptance criteria

1. **Shared page object** — `e2e/settingsTabPage.ts`, consumed by all three specs. ✅
2. **Exactly one `setTheme`** — `grep -rn "setTheme" e2e/` shows one definition
   (`obsidianHarness.ts:482`) and only `harness.setTheme(...)` call sites. ✅
3. **No fourth idiom** — `grep -rn pluginDataStore e2e/` returns hits in
   **`e2e/obsidianHarness.ts` only**. `page.evaluate` count in the three specs:
   verify 0, ux-visual 0, review 4 (all legitimate DOM geometry / `activeElement`
   probes, no store access). `app.setting` appears in zero `*.e2e.ts`. ✅
4. **`NodePreviewPreference` type-only import** — done, alongside `DepthSettings`
   / `NodeExclusionSettings` / `ViewSettings` / `ViewSettingsOverride`, all in the
   existing `import type { … } from "../src/engine"` statement that carries the
   erasure comment. Engine barrel exports all five (`src/engine/index.ts:37,47,48,57`). ✅
5. **Green, no reorder** — verified: test titles and their order are byte-identical
   per spec (only line numbers moved). ✅

---

## 🚨 CRITICAL / BLOCKING

**None.**

### What I specifically ruled out (the risks the brief called out)

- **`openSettingsTab` unification (the waiting version everywhere).** All
  ux-visual call sites open the plugin's own tab; there is no site that opens a
  different tab or expects a different card count, so the
  `toHaveCount(SETTINGS_TAB_SECTIONS.length)` wait is not a latent flake. The
  third inlined copy at old line 187 is gone.
- **Serial-state dependencies.** ux-visual's "every input carries its row name"
  still re-enables exclusion itself (`settingsUxVisual.e2e.ts:241`, comment
  intact) rather than relying on an added reseed; the Preview-pill pair at
  `:448`/`:464` is untouched apart from `app.setting.close()` →
  `settingsTab.close()`, so `:464` still consumes the `"image"` write left by
  `:448`; verify's `07-exclusion-confirm-dark.png` still inherits dark from the
  preceding test. No implicit reset was introduced anywhere.
- **`setTheme` decision — the reasoning holds.** Neither of verify's
  theme-touching tests asserts anything about the theme: they assert footer
  copy (`toContain` / `not.toContain`) and then take screenshots. There is no
  computed-style or CSS-variable assertion that a body-class-only switch could
  make vacuous. And the body-class lever is proven to genuinely restyle by a
  pre-existing test: `e2e/vicinityGraph.e2e.ts:199-212` drives
  `harness.setTheme(theme)` and asserts the arrowhead fill equals the theme's
  resolved `var(--text-faint)`. The deleted local version's only *unique* effect
  was persisting the theme id into the vault's appearance config — nothing reads
  it, and under `VICINITY_E2E_VAULT` that is a real-vault mutation. Dropping the
  `waitForTimeout(200)` is correct: a class toggle is synchronous. **This is not
  a weakening.**
- **Multi-statement `evaluate` → several awaited calls.** In `dirtyEverySection`
  and `setExclusion` the write order (depths → view → exclusion → redisplay) is
  preserved and every step awaited. No settings-tab re-render can interleave,
  because the tab only re-renders on `display()`.
- **`seedPreviewPreference` was NOT collapsed.** `settingsUxVisual.e2e.ts:319-321`
  is `saveGlobalView(...)` + `settingsTab.redisplay()` (settings-tab re-render),
  distinct from `harness.setNodePreviewPreference` = `saveGlobalView(...)` +
  `refreshOpenViews()` (graph rebuild). Both document WHY-NOT the other.
- **`vaultTarget.test.ts` compliance.** `e2e/settingsTabPage.ts` imports no `fs`
  at all, so the source scan has nothing to object to; each spec keeps its own
  literal `OUT_DIR` in `beforeAll`. `npm test` (which runs that scanner over
  every top-level `e2e/*.ts`, including the new one) is green.
- **No speculative harness surface.** Every added method has at least one caller:
  `readGlobals` (all three specs), `saveGlobalView`, `saveGlobalDepths`,
  `saveNodeExclusion`, `refreshOpenViews` (`settingsUxVisual.e2e.ts:143`),
  `reloadPlugin` (`settingsResetReview.e2e.ts:247`), and every `SettingsTabPage`
  member. `GlobalViewSnapshot` was deleted cleanly; its one other consumer
  (`controlsRestart.e2e.ts:146,151,165`) type-checks against the real
  `ViewSettings`.

---

## ⚠️ IMPORTANT

**None blocking.** One item is worth an iteration only if you are already
touching the file:

- **`settingsUxVisual.e2e.ts:265** — `await harness.saveGlobalView({ nodeCap: 42 });`
  A typed method for exactly this already exists (`harness.setGlobalNodeCap(42)`),
  and this is the only call site that reaches past it to the raw primitive. It
  re-states at a call site the one piece of knowledge the harness was meant to
  own ("nodeCap lives in the view slice"). One-line fix. (Review's
  `dirtyEverySection` is *not* an instance of this: it writes seven view fields
  in one merge, which is what `saveGlobalView` is for.)

The raised-altitude concern from the brief otherwise checks out: the low-level
`saveGlobalView`/`saveGlobalDepths` seam is justified because the specs write
field combinations no typed setter covers (`outlineMaxDepth`, `sizing.minPx`,
`sizing.depthDecayK`, `forceLayout.*`, both depths), and inventing a typed setter
per combination would be worse. The shallow-merge contract is documented
explicitly rather than hidden behind a deep merge — the right call.

---

## 💡 Suggestions (NIT / OPTIONAL — no iteration required)

- **`settingsUxVisual.e2e.ts:184-185`** — `await expect(sections).toHaveCount(SETTINGS_TAB_SECTIONS.length)`
  can no longer fail independently now that `open()` waits on the same condition;
  a regression surfaces as a timeout inside the page object instead of at the
  assertion. Coverage is unchanged (it still fails), only the failure message
  moves. Keeping it as the test's stated intent is defensible.
- **`ViewSettingsOverride` borrowed as the patch type** (`obsidianHarness.ts`).
  In the engine that name means "a per-doc/MAIN override", not "a partial patch
  for the global slice". It *is* `Partial<ViewSettings>`, so nothing is wrong —
  just a mild POLS wobble for a reader who knows the engine's vocabulary.
- **Body-class theming is state Obsidian does not know about.** If anything ever
  makes Obsidian re-apply its configured theme mid-file (a `css-change` trigger,
  a plugin/app reload), a leftover-dark dependency like verify's
  `07-exclusion-confirm-dark.png` would silently photograph light. Nothing in the
  current order does that, and this property predates the change — but it is now
  relied on by one more file. If it ever bites, assert `body.theme-dark` inside
  the page object's screenshot step rather than reintroducing the real API.
- `SettingsTabPage.openModals()` is strictly modal-stack knowledge, not
  settings-tab knowledge. It earns its place because `confirmDialog()` is built
  on it and the "count of 1 means no confirmation was raised" idiom is what three
  specs actually assert; the doc comment says exactly that. Fine as is.

Docs/comments in `settingsTabPage.ts` are succinct and WHY-focused (the `.last()`
strict-mode rationale, the `openTabById`-returns-before-paint rationale, the
no-`fs` rationale). No dead code, no `@Deprecated`, no swallowed errors.

## Documentation Updates Needed

None. `CLAUDE.md`'s e2e guidance is unaffected; the page object is discoverable
from the specs that import it and self-documents its own contract.

---

**VERDICT: READY** — 0 blocking issues.
