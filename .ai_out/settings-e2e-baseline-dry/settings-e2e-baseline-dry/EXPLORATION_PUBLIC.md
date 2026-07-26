# EXPLORATION_PUBLIC — settings-e2e-baseline-dry

Findings from the Explore agent (it ran read-only; TOP_LEVEL_AGENT transcribed them here
verbatim in substance). Line numbers were accurate at exploration time — re-verify before
editing.

## 1. The triplicated baselines — exact sites and literals

**`.vicinity-graph-settings-section` count = 6** (3 sites)
- `e2e/settingsResetReview.e2e.ts:81` — inside `openSettingsTab()`:
  `await expect(page.locator(".vicinity-graph-settings-section")).toHaveCount(6);`
- `e2e/settingsResetVerify.e2e.ts:59` — inside `openSettingsTab()`, byte-identical line.
- `e2e/settingsUxVisual.e2e.ts:128-130` — `const sections = page.locator(".vicinity-graph-settings-section");`
  + comment `// Depth defaults, node sizing, node contents, force layout, node exclusion, performance.`
  + `await expect(sections).toHaveCount(6);`
- 4th, related count: `e2e/settingsUxVisual.e2e.ts:160-161` —
  `page.locator(".vicinity-graph-settings-section .vicinity-graph-settings-reset")` … `toHaveCount(6)`.

**Restore-button NAME lists**
- `e2e/settingsResetReview.e2e.ts:196-204` — 7 entries; `aria-label`s filtered by
  `startsWith("Restore")`, asserted with `expect(resetNames).toEqual([...])`:
  `"Restore depth defaults"`, `"Restore node sizing defaults"`, `"Restore node contents defaults"`,
  `"Restore force layout defaults"`, `"Restore node exclusion defaults"`,
  `"Restore performance defaults"`, `"Restore all Vicinity Graph settings"`.
  Followed by `expect(new Set(resetNames).size).toBe(resetNames.length);`
- `e2e/settingsUxVisual.e2e.ts:163-170` — the same 6 section entries (no `all`), asserted as
  `.setting-item-name` texts via `toHaveText([...])`.
- The 7th string also appears standalone at `settingsResetReview.e2e.ts:270`, `:283`,
  `settingsUxVisual.e2e.ts:253`, `settingsResetVerify.e2e.ts:165`.

**Panel-disclosure enumeration** — `e2e/settingsUxVisual.e2e.ts:52-58`, test
`"panel defaults: every section is a disclosure, only Depth starts open"`:
`disclosure("Depth").first()` → `toHaveAttribute("open","")`, then `not.toHaveAttribute("open","")`
for `"Node exclusion"`, `"Node sizing"`, `"Node contents"`, `"Force layout"` (`.first()`).
Panel order in `GraphToolbar.tsx`: Depth → (Pinned centrals) → Node exclusion → Node sizing →
Node contents → Force layout. **Different from the settings-tab card order**;
`Pinned centrals (n)` is conditional and unasserted.

**Other hand-maintained baselines in these specs**
- Card heading strings used as `hasText` selectors: `"Depth defaults"`, `"Node sizing"`,
  `"Node contents"`, `"Force layout"`, `"Node exclusion"`, `"Performance"` —
  `settingsResetReview.e2e.ts:110,122,138,151,164,179,211,225,232,247,259,305,309,323`;
  `settingsResetVerify.e2e.ts:94,97,114,125,130,136,144,182,198`;
  `settingsUxVisual.e2e.ts:239,304,314,345`.
- `settingsUxVisual.e2e.ts:97` `input[type=range]` `toHaveCount(7)`; `:187-196`
  `NAMED_CONTROL_SELECTORS` / `MIN_NAMED_CONTROLS = 20`; `:315` preview pill `toHaveCount(3)`.
- Default values re-typed in specs: `nodeCap` `100` (review:181,294,321; ux:241),
  `{outgoingDepth:1,incomingDepth:1}`, `outlineMaxDepth` `2`, `nodePreviewPreference` `"auto"`.
- Confirm/button copy: `"Delete patterns and restore defaults"`, `"Restore all defaults"`,
  `"Restore node exclusion defaults?"`, `"This cannot be undone."`,
  `"Per-note depth overrides and pinned notes are kept."` — all also literal in
  `src/view/settingsResetPlan.ts`.
- Duplicated helpers across the three files: `openSettingsTab()`, `card()`, `resetButton()`,
  `confirmDialog()`, `readGlobals()`, `dirtyEverySection()`/`setExclusion()`, plus two divergent
  `setTheme` impls (`harness.setTheme` vs. `settingsResetVerify.e2e.ts:154-157` local
  `setTheme("moonstone"|"obsidian")`).

## 2. Plugin-side source of truth

- **Reset rows/labels ARE data-driven**: `src/view/settingsResetPlan.ts` —
  `SETTINGS_RESET_SCOPES` (`Readonly<Record<SettingsResetScope, SettingsResetScopeSpec>>`, `.label`
  = row name = button `aria-label` = tooltip), `SECTION_RESET_SCOPES` (the 6, documented as "in
  settings-tab render order"), `ALL_SETTINGS_RESET_SCOPE = "all"`.
  So `SECTION_RESET_SCOPES.map(s => SETTINGS_RESET_SCOPES[s].label)` reproduces the 6-list exactly,
  and `[...that, SETTINGS_RESET_SCOPES.all.label]` the 7-list. `SECTION_RESET_SCOPES.length` = 6.
- **Card headings are NOT data-driven**: `src/view/VicinityGraphSettingTab.ts:120-134` `display()`
  calls six hand-written `renderX()` methods; each creates `createSection()` (`:140-142`) and a
  literal heading — `:282 "Depth defaults"`, `:303 "Node sizing"`, `:373 "Node contents"`,
  `:216 "Force layout"`, `:240 "Node exclusion"`, `:435 "Performance"`. No scope→heading table
  exists. Each `renderX` passes its scope literal to `addSectionReset` (`:151-166`).
- **Panel disclosures are hand-written JSX**: `GraphToolbar.tsx:43,47` +
  `NodeExclusionSection.tsx:44` (summary is a JSX fragment; label text in a
  `<span class="vicinity-graph-exclusion__summary-label">`), `SizingSection.tsx:41`,
  `NodeContentsSection.tsx:46`, `ForceLayoutSection.tsx:48` (+ nested `:50 "Advanced spacing"`).
  No enumeration constant anywhere.

**Can e2e import from src? YES — precedent exists.** `e2e/vicinityGraph.e2e.ts:3-5` imports
`asFolderPath` from `../src/engine`, and `hiddenOverlayText, linkCountBadgeText,
orphanBreakdownTitle, plusNText` from `../src/view/badgeText`, `attachmentGroupLabel` from
`../src/view/attachmentIcons`. `e2e/tsconfig.json` extends `../tsconfig.json` with
`include: ["./**/*.ts"]`; `npx tsc -p e2e/tsconfig.json` runs in `scripts/run-e2e.sh:39`.
Playwright transpiles TS at runtime.

**Constraint**: the module must not pull `obsidian` at runtime. `obsidianHarness.ts:57-60`
documents exactly this — it deliberately duplicates `VIEW_TYPE_VICINITY_GRAPH` because importing
that module "would drag the `obsidian` package … into the node-side test process and crash it".
`settingsResetPlan.ts` is safe: it imports only `../engine` (pure), `./nodePreviewPreferenceMeta`
(type-only engine import), and `./settingsWritePlan` (engine values only). No `obsidian`, no `react`.

**Verdict**: reset-name list + count are genuinely derivable from `src/view/settingsResetPlan`.
Card headings and panel-disclosure summaries are NOT — those need a hand-written
`e2e/settingsBaseline.ts` const (or a src-side table extraction, a bigger change).

## 3. Shared e2e module conventions

- `e2e/obsidianHarness.ts` (25 KB) — long WHY/WHY-NOT header doc; exports
  `interface GlobalViewSnapshot` (:47), `const PLUGIN_ID = "vicinity-graph"` (:52),
  `OPEN_GRAPH_COMMAND_ID` (:54), `class ObsidianHarness` (:109). Named exports, camelCase filename,
  no default export, no `.test.ts` of its own.
- `e2e/vaultTarget.ts` — pure module ("validates … and NEVER creates, writes or deletes anything");
  exports env-var consts, a discriminated union, and
  `vaultDirOf`/`resolveVaultTarget`/`assertExternalLaunchAllowed`/`assertExternalVaultReady`.
- `e2e/vaultTarget.test.ts` — vitest, BDD `WHEN … THEN …`, `.tmp/` scratch dirs, `afterAll` cleanup.
- **vitest include globs** (`vitest.config.ts`): `["src/**/*.test.{ts,tsx}", "e2e/**/*.test.ts"]`.
  `npm test` = `vitest run`. Playwright `testMatch: "**/*.e2e.ts"` (`e2e/playwright.config.ts:20`)
  — the two never overlap. A new `e2e/settingsBaseline.test.ts` is picked up by `npm test`
  automatically.

## 4. The e2e harness guard / mutation scan

`e2e/vaultTarget.test.ts`, `describe("e2e harness destructive calls")` (:154-206).
`scannedFiles = fs.readdirSync(<repo>/e2e).filter(name.endsWith(".ts") && name !== basename(import.meta.url))`
— **flat scan of every `.ts` in `e2e/`, so any new `e2e/settingsBaseline.ts` is automatically in
scope**. Four assertions:
1. `:170` every mutating `fs.*` destination must match
   `SAFE_WRITE_ROOTS = /^(VAULT_COPY_DIR|SANDBOX_CONFIG_DIR|OUT_DIR)\b/` after peeling
   `path.join(|dirname(|resolve(` wrappers.
2. `:180` no `node:fs/promises` / `fs.promises` in any e2e source.
3. `:193` any line containing `"node:fs` must match
   `NAMESPACE_FS_IMPORT = /^import \* as fs from "node:fs";$/` (added by commit `260a205`).
4. `:204` a self-test that the scanner reports an arbitrary path.

Supporting tables at `:130-153`: `READ_ONLY_FS_MEMBERS`, `DESTINATION_ARG_INDICES`,
`mutatingDestinations()`, `topLevelArguments()`. `src/engine/importGuard.test.ts` is the src-side
layering guard (does not scan `e2e/`).

## 5. Risk / non-obvious notes

1. **The `OUT_DIR` name is load-bearing.** All three specs call
   `fs.mkdirSync(OUT_DIR, { recursive: true })`. If a refactor extracts that into a shared helper
   taking a parameter (`fs.mkdirSync(outDir)`) or renames the const, guard assertion #1 fails
   (`SAFE_WRITE_ROOTS` is a literal-identifier regex). Any shared module doing the mkdir must keep
   a local const literally named `OUT_DIR`/`VAULT_COPY_DIR`/`SANDBOX_CONFIG_DIR`.
2. **Deriving from `SECTION_RESET_SCOPES` weakens nothing but shifts what is asserted.**
   `display()` renders the six cards in a hand-written order and each `renderX()` passes its own
   scope literal; nothing in src asserts `display()` order == `SECTION_RESET_SCOPES` order, so a
   derived DOM-order assertion remains meaningful. But `expect(resetNames).toEqual(derived)` no
   longer catches a *copy change* in `settingsResetPlan.ts` (it would silently follow it) — today
   those literals are an independent second opinion. `src/view/settingsResetPlan.test.ts:263-300`
   already covers label shape (never a bare "Restore defaults"; tab-wide label exact string;
   tab-wide description enumerates every section noun), which mitigates this.
3. **Panel vs. tab are different lists.** Panel: Depth, [Pinned centrals (n)], Node exclusion,
   Node sizing, Node contents, Force layout (+ nested Advanced spacing). Tab cards: Depth defaults,
   Node sizing, Node contents, Force layout, Node exclusion, Performance. No "Performance" or
   "Depth defaults" in the panel; no "Pinned centrals"/"Advanced spacing" in the tab.
   **One shared const cannot serve both — two are needed.**
4. **`disclosure("Force layout").first()` and `disclosure("Depth").first()` need `.first()`**
   because `hasText` is substring-based and ancestor `<details>` also match (documented at
   `settingsUxVisual.e2e.ts:91-93`). A loop-driven rewrite must preserve per-entry `.first()` /
   nested-`details` handling; `disclosure("Node exclusion")`/`"Node sizing"`/`"Node contents"`
   currently have **no** `.first()` — a naive uniform loop changes strict-mode behavior.
5. **`hasText` heading selectors are substring matches on the whole card.** Safe today; adding a
   card whose description mentions another card's heading would break it silently.
6. `settingsResetVerify.e2e.ts:154` has its own `setTheme("moonstone"|"obsidian")` bypassing
   `harness.setTheme` — different API surface; **out of ticket scope**.
7. **Each spec launches its own `ObsidianHarness`** and is `mode: "serial"`; tests within a file
   depend on prior state (e.g. `settingsUxVisual` "restore-all" at `:257` expects `outgoingDepth` 4
   left by the previous test). **Do not reorder while refactoring.**
8. **Ticket**: `_tickets/e2e-settings-section-count-and-reset-name-baselines-are-triplicated-with-no-shared-constant.md`
   (`nid_3399ajdcy5lq21lx5v0jxh9i4_e`, open, chore, p3). Related:
   `_tickets/research-cut-the-per-setting-plumbing-cost-one-field-currently-costs-15-files-and-8-hand-maintained-lists.md`.
9. **CLAUDE.md guardrails**: BDD `WHEN … THEN …` naming, preserve `ap_XXX_E` anchors and
   behavior-capturing tests, file a ticket rather than patch out-of-scope issues.
