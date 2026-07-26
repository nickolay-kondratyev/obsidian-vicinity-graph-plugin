# IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC — settings-e2e DRY refactor

Ticket: `nid_g4iae40tww9abtwrexdrvic0y_e`. Branch `e2e-settings-helper-dry`, one commit
`967aade`. Tree clean.

---

## 1. Gate results (honest, both runs actually executed)

| Gate | Baseline (clean tree, BEFORE any edit) | After |
|---|---|---|
| `npm run test:e2e` (real Obsidian) | **79 passed, 1 skipped, exit 0** (53.1s) | **79 passed, 1 skipped, exit 0** (52.6s) |
| `npm test` (vitest) | — | **990 passed / 74 files, exit 0** |
| `npm run check` (tsc src + e2e) | — | exit 0 |

Baseline log saved at `.ai_out/e2e-settings-helper-dry/e2e-settings-helper-dry/e2e-baseline.log`;
after-log at `.tmp/e2e-after.log`. Per-spec baseline counts: review 11, verify 8,
ux-visual 16 — identical after. **Nothing was flaky or failing pre-change**, so there is
no pre-existing breakage to attribute.

The 1 skipped test is `externalVault.e2e.ts`, which self-skips unless `VICINITY_E2E_VAULT`
is set. Unchanged by this work.

---

## 2. What was built

### `e2e/settingsTabPage.ts` (new) — the shared page object

```ts
class SettingsTabPage {
	constructor(page: Page)
	async open()            // opens Obsidian settings on the plugin tab AND waits for it to render
	async close()           // app.setting.close()
	async redisplay()       // app.setting.activeTab?.display() — re-render after a store write
	card(headingText)       // .vicinity-graph-settings-section, hasText
	resetButton(headingText)// that card's scoped restore button
	resetAllRow()           // .vicinity-graph-settings-reset-all
	resetAllButton()        // its button
	confirmDialog()         // openModals().last()
	dialogButton(text)      // a button inside the confirmation
	openModals()            // every .modal-container, INCLUDING the settings window
}
```

Constructed once per spec in `beforeAll` (`settingsTab = new SettingsTabPage(page)`).

`vaultTarget.test.ts` compliance: **the module imports no `fs` at all** — nothing for the
source scan to object to. Each spec keeps its own literal `OUT_DIR`; the screenshot
directory was deliberately NOT parameterised through the shared module.

### `ObsidianHarness` — now the ONE holder of `pluginDataStore` knowledge

Added:

| Method | Why it had to exist |
|---|---|
| `readGlobals(): PluginGlobalsSnapshot` | the 3-slice read all three specs wrote by hand; one round trip |
| `saveGlobalView(patch: ViewSettingsOverride)` | shallow merge over the stored view |
| `saveGlobalDepths(DepthSettings)` | no harness method existed |
| `saveNodeExclusion(NodeExclusionSettings)` | no harness method existed |
| `refreshOpenViews()` | the graph-view side effect, now explicit |
| `reloadPlugin()` | removes the spec's last raw `app.plugins` evaluate (disable/enable + wait) |

Changed:
- `readGlobalView()` now returns the engine's real `ViewSettings` and is defined as
  `(await readGlobals()).view` — one primitive, not two.
- `setGlobalNodeCap` / `setMaxNodeSizePx` / `setEdgeVisibility` / `setNodePreviewPreference`
  keep their signatures and behavior but now **compose** the primitives instead of each
  carrying its own `page.evaluate`. That is the "no fourth idiom" guarantee: after this
  change `pluginDataStore` appears in exactly ONE file, `e2e/obsidianHarness.ts`.
- `GlobalViewSnapshot` (a hand-written 2-field subset) **deleted** — clean break, its one
  consumer (`controlsRestart.e2e.ts`) type-checks unchanged against `ViewSettings`.

`saveGlobalView` merges **shallowly**, exactly like the store's own callers, and says so in
its doc: a caller changing one key of `sizing`/`forceLayout` must spread the current nested
value itself (read it via `readGlobalView()`). Chosen over a deep merge because a deep merge
silently decides which level it is patching.

---

## 3. How each divergence was resolved

**`readGlobals` — three shapes → one.** Not a fourth hand-written interface: the snapshot is
typed off the engine's own `ViewSettings` / `DepthSettings` / `NodeExclusionSettings` via a
type-only import from `../src/engine` (same erasure trick as the existing `EdgeVisibilityMode`
import). So a field rename in `src/engine/types.ts` is now a `tsc` failure in the specs
instead of a silently-`undefined` assertion. **No spec's assertions were widened or narrowed**:
`settingsUxVisual` merely gains access to fields it does not assert on, and
`settingsResetVerify`'s whole-store `toEqual(before)` compares the same runtime value it did
before (it was `Promise<any>`; it is now typed).

**`openSettingsTab` — the waiting version won**, everywhere, including the third inlined copy
in `settingsUxVisual` (~line 187). Confirmed safe: every call site opens the plugin's own tab,
which always renders exactly `SETTINGS_TAB_SECTIONS.length` cards — and the e2e run proves it
(all 16 ux-visual tests green, including the one that then asserts that same count itself;
that assertion was kept, it is the test's own behavior pin, not a duplicate of the wait).

**`setTheme` — ONE API survives: `harness.setTheme("dark" | "light")`, the body-class toggle.**
The local `setTheme("moonstone"|"obsidian")` in `settingsResetVerify` is gone, and with it the
`waitForTimeout(200)`.

This is the one judgement call worth reviewing, so the full reasoning:
- The class toggle is not a stub — it is Obsidian's own switching mechanism. `vicinityGraph.e2e.ts`
  already asserts that `--text-faint` resolves differently per theme *through this exact lever*,
  which is proof it genuinely restyles.
- Nothing in the suite reads or asserts the *persisted* theme id, so `changeTheme`'s extra
  effect (writing the choice into the vault's appearance config) buys no coverage — and under
  `VICINITY_E2E_VAULT` it would mutate the human's REAL vault for a purely visual assertion.
- A class toggle is synchronous, so the 200ms sleep needed no replacement wait at all. No
  race is being masked.
- **Verified, not assumed:** after the e2e run I opened `settingsResetVerify`'s own evidence
  screenshots. `04-restore-all-row-light.png` renders light, `06-restore-all-row-dark.png`
  renders dark, and `07-exclusion-confirm-dark.png` (which depends on dark state *left over*
  from the preceding test) is genuinely dark with the tricky patterns verbatim. The evidence
  artifacts still say what their filenames claim.

**`card`/`resetButton`/`confirmDialog`/`dialogButton`** — all folded into the page object, and
`settingsUxVisual`'s inlined equivalents migrated onto it too. `dialogButton` (previously
review-only) is now used by verify as well, replacing two
`confirmDialog().locator("button").filter({hasText})` copies.

**`seedPreviewPreference` vs `harness.setNodePreviewPreference`** — kept distinct, as required.
`seedPreviewPreference` is now `saveGlobalView({nodePreviewPreference}) + settingsTab.redisplay()`
(settings-tab re-render); `setNodePreviewPreference` is `saveGlobalView(...) + refreshOpenViews()`
(graph-view rebuild). Both side effects are now named methods, and each function documents
WHY-NOT the other.

**`setNodePreviewPreference`** now takes `NodePreviewPreference` from the engine barrel
(type-only), matching the `EdgeVisibilityMode` pattern. `settingsUxVisual` uses the same type
for `seedPreviewPreference` / `storedPreviewPreference`.

---

## 4. Ordering / behavior preservation

- **No test was reordered, added, removed, renamed, or re-scoped.** All three specs remain
  `mode: "serial"` with one harness per file.
- **No implicit reseeding was added.** The three known cross-test dependencies are intact and
  still relied upon: ux-visual's "every input carries its row name" (still explicitly turns
  exclusion back ON, with its comment about the exclusion test above it), the Preview-pill pair
  where the second test consumes the `"image"` write left by the first, and verify's dark
  screenshot inheriting dark theme from the preceding test.
- Multi-statement `page.evaluate` blocks became several awaited calls (e.g. write-then-redisplay).
  Order is preserved and each step is still awaited; the e2e run confirms no timing regression.
- One deliberate strengthening: in ux-visual's "a section restore resets ONLY that section",
  `section.getByRole("button")` became `settingsTab.resetButton("Performance")`, i.e. the
  `.vicinity-graph-settings-reset button` selector. Same element today, more specific about
  which button it means.

---

## 5. Deliberately NOT done

- **No new vitest guard for `settingsTabPage.ts`.** Following the rationale already written in
  `settingsBaseline.test.ts`: literal-pinning applies to *data* copied out of `src`; this module
  is behavior (locators + actions), and its correctness is proven by the real-Obsidian run.
  It consumes `SETTINGS_TAB_SECTIONS` rather than re-typing any count.
- **No parameterised `OUT_DIR`** in the shared module — that is exactly the coupling
  `vaultTarget.test.ts` is designed to prevent.
- **The e2e architecture was not redesigned.** No fixtures, no base-test, no helpers nobody
  calls. Every added harness method has at least one caller.
- **`app.setting.close()` did NOT move onto the harness.** It is settings-window state, so it
  lives on `SettingsTabPage`; `harness.reloadPlugin()` documents "close the outgoing instance's
  UI first" as a precondition rather than doing it silently.
- The ticket itself was not closed — leaving that to the orchestrating agent.

---

## 6. Where to look when reviewing

- `e2e/settingsTabPage.ts` — new, ~90 lines, read in full.
- `e2e/obsidianHarness.ts` — the `--- persisted plugin state ---` block and `setTheme`'s
  new WHY-NOT.
- `git show 967aade -- e2e/settingsUxVisual.e2e.ts` — the largest and riskiest spec diff.
