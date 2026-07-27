# EXPLORATION_PUBLIC — e2e "Pinned centrals" disclosure ABSENCE

Ticket: `nid_d9j4o9ecp93g5zhury5m1fb43_e`. Findings from a read-only Explore pass
(verify anything you depend on — line numbers are from branch `e2e-pinned-centrals-absent`).

## 1. The blind spot

`e2e/settingsUxVisual.e2e.ts` → `topLevelPanelSummaries()`:

```ts
return page
  .locator(".vicinity-graph-toolbar__body > .vicinity-graph-disclosure > .vicinity-graph-disclosure__summary")
  .filter({ hasNotText: new RegExp(`^${PINNED_CENTRALS_SUMMARY} \\(\\d+\\)$`) });
```

Asserted against `CONTROLS_PANEL_DISCLOSURE_SUMMARIES` (5 sections: Depth, Node
exclusion, Node sizing, Node contents, Force layout). The anchored `hasNotText`
filter is deliberate (a substring filter would also swallow a future unrelated
"Pinned centrals defaults" section) — but it makes the spec blind to the
disclosure rendering unconditionally. This file's fixture (`projects/alpha.md`)
never pins anything, so the absence is currently implicit, never asserted.

No spec anywhere asserts `toHaveCount(0)` for this disclosure.

## 2. Shared constant

`e2e/settingsBaseline.ts` (~:129-140): `export const PINNED_CENTRALS_SUMMARY = "Pinned centrals";`
— plain string, no `(n)` suffix; deliberately NOT part of `CONTROLS_PANEL_DISCLOSURES`
(no default open/closed state on a fresh view). Its doc comment (commit `3d2f67b`)
splits two usages:

- **exhaustiveness filter** → wrap in fully-anchored count regex `^… \(\d+\)$`
- **plain locator** (find it) → bare substring via `hasText` is fine

Existing presence assertions use the plain-locator form:
`e2e/controlsRestart.e2e.ts:79-83` and `e2e/pinnedCentralScenario.e2e.ts:94-98`
both define an identical `pinnedDisclosure()` helper and assert `toBeAttached()`
AFTER a pin.

## 3. Render site

`src/view/GraphToolbar.tsx` (~:35, :46-52):

```tsx
const pinned = controls.centrals.filter((central) => central.kind === "pinned");
{pinned.length > 0 && (
  <Disclosure summary={`Pinned centrals (${pinned.length})`}> … </Disclosure>
)}
```

Direct child of `.vicinity-graph-toolbar__body`, same structure as the 5 stable
sections. Mutation for verification = drop the `pinned.length > 0 &&` guard
(renders `Pinned centrals (0)`).

## 4. Harness / isolation

- `ObsidianHarness.launch()` seeds a FRESH throwaway copy of `.dev-vault` per spec
  file and `fs.rmSync(...plugins/<id>/data.json)` — so **no pin leaks across spec files**.
- `relaunch()` (used only by `controlsRestart.e2e.ts`) intentionally keeps the same
  vault copy so persisted pins survive a restart.
- Within one file, `mode: "serial"` means pins from an earlier `test()` DO persist
  into later ones → an absence assertion must run before any `clickPin(...)` in that file.
- `openGraphView()` waits for `.vicinity-graph-flow, .vicinity-graph-empty`.
- `e2e/playwright.config.ts`: `testMatch **/*.e2e.ts`, `workers: 1`, `fullyParallel: false`, `retries: 0`.

## 5. selectorGuard convention (IMPORTANT)

`e2e/selectorGuard.test.ts` (vitest, runs under `npm test`) scans e2e files for
`.vicinity-graph-*` selectors and requires each to be rendered under `src/view/`.
It exempts lines matching `ABSENCE_ASSERTION_PATTERN = /toHaveCount\(\s*0\s*\)/`.
→ Keep the new absence assertion as a **single chained statement on ONE line**:
`await expect(<locator>).toHaveCount(0);` — a locator hoisted into a variable and
asserted on a later line is NOT exempted.

## 6. Recommended home

`e2e/settingsUxVisual.e2e.ts` — fixture never pins, helpers + the
`PINNED_CENTRALS_SUMMARY` import already exist. Add a dedicated sibling `test(...)`
next to the top-level-disclosures test. Scope the locator to
`.vicinity-graph-toolbar__body > .vicinity-graph-disclosure > .vicinity-graph-disclosure__summary`
to mirror the exhaustiveness selector.

Run: `npm run test:e2e -- settingsUxVisual.e2e.ts` (auto-downloads pinned Obsidian
when `OBSIDIAN_PATH` unset; headless flags auto-applied when no display).
