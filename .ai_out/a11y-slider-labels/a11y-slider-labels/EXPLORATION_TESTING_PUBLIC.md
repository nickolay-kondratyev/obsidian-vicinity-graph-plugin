# EXPLORATION_TESTING_PUBLIC — test feasibility (a11y slider labels)

> Produced by the EXPLORATION (testing) sub-agent; persisted by TOP_LEVEL_AGENT because that
> agent ran read-only. Content is the agent's verbatim findings.

## 1. Vitest + `obsidian`: a DOM settings-tab test is NOT cheap

`vitest.config.ts:1-9` is the whole config — `include: ["src/**/*.test.{ts,tsx}"]`, **no
`environment`, no `setupFiles`, no alias, no `__mocks__` anywhere**. Environment is therefore
`node` (no DOM). No test imports `obsidian`, and `node_modules/obsidian/package.json` has
`"main": ""` (types only, no runtime). The harness documents this at `e2e/obsidianHarness.ts:45-49`:
"importing that module here would drag the `obsidian` package (types-only, no runtime) into the
node-side test process and crash it".

⇒ A real `new Setting(...)` cannot be constructed in vitest. You would need happy-dom/jsdom
(not installed; registry reachable) **plus** a hand-written `Setting` fake — and the test would
then assert *your fake's* DOM, not Obsidian's. Weak signal.

## 2. No React component tests exist

Zero `*.test.tsx` (69 test files, all `.ts`). No `@testing-library/*`, `jsdom`, `happy-dom`,
`linkedom` in `package.json` or `node_modules`. Closest sibling is the pure-logic
`src/view/forceLayoutFieldMeta.test.ts` (asserts main+advanced groups cover `FORCE_LAYOUT_RANGES`
exactly once).

## 3. E2E already does exactly this assertion for the in-graph panel

- `e2e/settingsUxVisual.e2e.ts:88-120` "force layout: 7 sliders, live write, restore defaults" uses
  `forceLayout.getByLabel("Node spacing")`, `getByLabel("Repel force")` — green today because
  `src/view/ForceLayoutSection.tsx:87` already sets `aria-label={meta.label}`.
- Settings-tab specs (`settingsUxVisual.e2e.ts:122-190`, `settingsResetVerify.e2e.ts`,
  `settingsResetReview.e2e.ts`) open the tab via `app.setting.open();
  app.setting.openTabById(pluginId)` and select by CSS class
  (`.vicinity-graph-settings-section`, `.vicinity-graph-settings-reset`).
- `settingsUxVisual.e2e.ts:176` is the tell:
  `page.getByLabel("Node cap").or(page.locator(".vicinity-graph-settings input[type=number]").last())`
  — the `.or()` fallback exists precisely because the label association is missing.
- **No `toHaveScreenshot` baselines anywhere**; screenshots are `page.screenshot({path: .out/...})`
  artifacts only ⇒ they cannot fail. The one visual assertion that could break is
  `settingsUxVisual.e2e.ts:132-133` (`borderTopStyle === "solid"`).
- E2E is feasible in this environment: binary cached at `.tmp/obsidian/obsidian-1.12.7/obsidian`;
  `scripts/run-e2e.sh:22-27` auto-adds `--ozone-platform=headless --disable-gpu` when no `DISPLAY`.
  Run: `npm run test:e2e -- settingsUxVisual.e2e.ts`.

## 4. BDD naming convention

`src/view/settingsResetPlan.test.ts:56` —
`it("WHEN the depth-defaults section is reset THEN both depths return to their spec defaults", …)`.
E2E mixes styles: `e2e/edgeRouting.e2e.ts:211` uses WHEN/THEN; `settingsUxVisual` uses plain
descriptive names.

## 5. Recommendation (Pareto): **e2e only**

Add ~3 lines to the settings-tab test in `e2e/settingsUxVisual.e2e.ts`:
- assert `page.locator(".vicinity-graph-settings").getByLabel("Repel force")` resolves to an
  `input[type=range]`;
- assert `.vicinity-graph-settings input[type=range]:not([aria-label])` has count **0** — this also
  covers "a future eighth slider inherits it";
- drop the `.or(...)` fallback at line 176 as further proof.

Cost: zero new deps, real Obsidian DOM. The vitest alternative costs a new devDep + a fabricated
`Setting` fake for a weaker signal — skip it unless you extract a pure helper.

**Gap to flag:** e2e is a release gate, not `npm test`, so the guard is only as strong as the e2e
cadence. If that matters, pair the e2e assert with a cheap non-DOM unit test that every
`FORCE_LAYOUT_FIELD_META` entry has a non-empty `label`.
