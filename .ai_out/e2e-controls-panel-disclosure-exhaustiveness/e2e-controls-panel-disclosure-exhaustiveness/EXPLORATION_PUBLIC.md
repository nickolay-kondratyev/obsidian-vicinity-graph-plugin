# EXPLORATION_PUBLIC — controls-panel disclosure exhaustiveness pin

Ticket `nid_vqw34wdpmb5qzn52cy6qugqgd_e`. Findings gathered by the Explore role
(read-only; persisted here by TOP_LEVEL_AGENT verbatim in substance).

## 1. `e2e/settingsBaseline.ts`

```ts
// :83-96
export interface PanelDisclosure {
	readonly summaryText: string;
	readonly startsOpen: boolean;
	readonly summaryAlsoMatchesAnAncestor: boolean;
}

// :98-110  (doc comment above explains it is a SEPARATE list from the tab cards on
// purpose, and that "Pinned centrals" (conditional) and nested "Advanced spacing"
// are deliberately unlisted)
export const CONTROLS_PANEL_DISCLOSURES: readonly PanelDisclosure[] = [
	{ summaryText: "Depth",          startsOpen: true,  summaryAlsoMatchesAnAncestor: true  },
	{ summaryText: "Node exclusion", startsOpen: false, summaryAlsoMatchesAnAncestor: false },
	{ summaryText: "Node sizing",    startsOpen: false, summaryAlsoMatchesAnAncestor: false },
	{ summaryText: "Node contents",  startsOpen: false, summaryAlsoMatchesAnAncestor: false },
	{ summaryText: "Force layout",   startsOpen: false, summaryAlsoMatchesAnAncestor: true  },
];
```

Analogous already-exhaustive tab consts: `SETTINGS_TAB_SECTIONS` (:60-64, derived from
`SECTION_RESET_SCOPES` in `src/view/settingsResetPlan`) and `SETTINGS_TAB_SECTION_HEADINGS` (:66-69).
There is **no** `…_SUMMARIES` string array for the panel — a `toHaveText` assertion needs
`CONTROLS_PANEL_DISCLOSURES.map(d => d.summaryText)` (extracting this as an exported const would
mirror the tab's `SETTINGS_TAB_SECTION_HEADINGS` shape).

## 2. `e2e/settingsUxVisual.e2e.ts`

- Local locator helpers (:43-57): `toolbar()` → `.vicinity-graph-toolbar`;
  `disclosure(summaryText)` → `.vicinity-graph-disclosure` filtered by a **descendant**
  `.vicinity-graph-disclosure__summary` `hasText` substring match (hence the
  `summaryAlsoMatchesAnAncestor` + `.first()` dance); `setOpen(details, open)` via `evaluate`.
- The gap (:59-72, test "panel defaults: every section is a disclosure, only Depth starts open"):
  loops the listed entries and asserts each one's `open` state. **Nothing counts or pins the
  full set** → a 6th disclosure escapes assertion entirely.
- Panel opened once via `setOpen(toolbar(), true)`; file is `test.describe.configure({ mode: "serial" })` (:22).
- The model to replicate — the settings TAB assertion (:140-147) pins count + identity + order:
  ```ts
  const sections = page.locator(".vicinity-graph-settings-section");
  await expect(sections).toHaveCount(SETTINGS_TAB_SECTIONS.length);
  await expect(sections.locator(".setting-item-heading .setting-item-name"))
      .toHaveText(SETTINGS_TAB_SECTION_HEADINGS);
  ```
- This spec never pins a central (fixture: `projects/alpha.md`, single main central), so
  "Pinned centrals (n)" never renders here today.

## 3. DOM nesting (the critical part)

`src/view/GraphToolbar.tsx` :37-60:
```tsx
<details className="vicinity-graph-toolbar nowheel nodrag nopan">
  <summary className="vicinity-graph-toolbar__header">…</summary>
  <div className="vicinity-graph-toolbar__body">
    <Disclosure summary="Depth" defaultOpen>…</Disclosure>
    {pinned.length > 0 && <Disclosure summary={`Pinned centrals (${pinned.length})`}>…</Disclosure>}
    <NodeExclusionSection … />   {/* each of these four section components returns a  */}
    <SizingSection … />          {/* bare top-level <Disclosure> — no wrapper element, */}
    <NodeContentsSection … />    {/* so they land as direct children of __body         */}
    <ForceLayoutSection … />
  </div>
</details>
```
`src/view/Disclosure.tsx` renders `<details class="vicinity-graph-disclosure …">` with
`<summary class="vicinity-graph-disclosure__summary">` + `<div class="vicinity-graph-disclosure__body">`.

`src/view/ForceLayoutSection.tsx` :47-61 nests "Advanced spacing" **inside** the Force-layout
`<Disclosure>`'s children → it lives in Force layout's own `__body`, one level deeper.

Conclusions:
- **Scoping root = `.vicinity-graph-toolbar__body`**, not `.vicinity-graph-toolbar`
  (the toolbar's only direct children are its `<summary>` and the body `<div>`).
- A `>` direct-child selector **naturally excludes "Advanced spacing"** regardless of fixture state.
- **Real trap:** "Pinned centrals (n)", when rendered, IS a direct child of `__body` at the same
  depth as the other five → a bare direct-child count becomes 6 the moment a central is pinned.
  `settingsUxVisual.e2e.ts` never pins one today, but that is an implicit fixture invariant.
  Recommended hardening: `.filter({ hasNotText: "Pinned centrals" })` on the direct-child locator
  (substring match, consistent with the existing `disclosure()` helper style).
- Suggested assertion shape (count + identity + order, mirroring the tab):
  direct-child `.vicinity-graph-disclosure` of `.vicinity-graph-toolbar__body`, pin-filtered,
  their `> .vicinity-graph-disclosure__summary` text `toHaveText(<summaries array>)`.
  Note summary text may include extra child text (e.g. counts/hints) — verify against real DOM;
  fall back to `toHaveCount` + per-entry existence if `toHaveText` proves brittle.

## 4. Helpers / guard tests

- `e2e/obsidianHarness.ts` → `ObsidianHarness` (`launch`, `page`, `openGraphView`, `openFile`,
  `setTheme`, `close`), `PLUGIN_ID`. No shared panel-disclosure helper exists; the new assertion
  belongs in `settingsUxVisual.e2e.ts` alongside `toolbar()`/`disclosure()` (consider adding a
  `panelBody()` locator).
- `e2e/settingsBaseline.test.ts` (vitest, run by `npm test`) guards only the **derived** values;
  its own doc comment (:13-19) says the hand-written parts' "real pin is the DOM" in
  `settingsUxVisual.e2e.ts`. So a vitest guard **cannot** satisfy the acceptance criterion —
  the pin must be a Playwright assertion.
- `e2e/pinnedCentralScenario.e2e.ts` is the only spec that creates a pinned central (separate
  fixture/file; does not affect this spec's invariant).

## 5. Running e2e

- `npm test` → vitest (no Obsidian).
- `npm run test:e2e` → `scripts/run-e2e.sh`: downloads pinned Obsidian if `OBSIDIAN_PATH` unset,
  auto headless Ozone flags when no `DISPLAY`, runs `setup:dev-vault` (type-checks src + e2e),
  then Playwright. Runnable here but heavy.
- **The full suite is already RED** at `e2e/vicinityGraph.e2e.ts:160` (pre-existing, tracked as
  `nid_yccejkvl0ccqc77olsgg5deka_e`) → run scoped: `npm run test:e2e -- settingsUxVisual`.

## Prior art

- Raised as **N-1** in `.ai_out/settings-e2e-baseline-dry/settings-e2e-baseline-dry/IMPLEMENTATION_REVIEW__PUBLIC.md`
  (:110-118, deferral confirmed :178-179) — same pinned-central trap identified there.
- Ticket file: `_tickets/e2e-controls-panel-disclosures-have-no-exhaustiveness-pin.md`.
- Change log `_change_log/2026-07-26_05-42-35Z.md` created `settingsBaseline.ts` and filed this follow-up.
