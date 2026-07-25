# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC (a11y slider labels)

Ticket: `nid_5wiribg2mn0mqcr7ni4ya0cfe_e` — settings-tab sliders have no accessible label.
Branch: `a11y-slider-labels`.

## Design call: option (a), DRY'd into one rule + one row builder

Chosen: **explicit `aria-label` applied from shared helpers**, NOT a post-render DOM sweep.

Rationale:
- Matches the only convention this repo has (`aria-label` from the visibly rendered string;
  zero uses of `aria-labelledby`/`htmlFor`). A sweep over `.setting-item` would be
  action-at-a-distance and would silently mislabel any row whose control is not 1:1 with its
  name (e.g. the sizing rows that hold a toggle *and* a weight field).
- The "future rows inherit it" guarantee comes from two places, both explicit:
  1. **All three slider call sites now go through one builder** — `addLabeledSlider(...)`.
     `addDepthSlider` (2 rows) and `addForceLayoutSlider` (7 rows) delegate to it, and the
     previously inline "Outline depth" slider was routed through it too. There is now **no**
     way to add a slider to this tab without inheriting the label.
  2. An e2e assertion that **no** input in the tab lacks `aria-label` — so an eighth slider or a
     new number field added off-helper fails loudly.
- The rule itself (and its WHY) lives in exactly one place: the private static
  `VicinityGraphSettingTab.nameControl(el, accessibleName)`. The four pre-existing ad-hoc
  `setAttribute("aria-label", …)` sites were re-pointed at it, so the knowledge
  "controls carry an aria-label equal to their setting name" is stated once.

Node cap stayed an explicitly-labeled one-off (its Setting has bespoke integer validation;
forcing it through `addSizingNumber` would have meant a validator parameter for one caller —
not worth it). The e2e `input[type=number]:not([aria-label])` count of 0 is what protects it.

## In-graph `ForceLayoutSection` — criterion already met

`src/view/ForceLayoutSection.tsx:87` already sets `aria-label={meta.label}` on its range input,
covered by `e2e/settingsUxVisual.e2e.ts:88-120` (`forceLayout.getByLabel("Node spacing")` etc.).
**No change made there**; that ticket bullet was stale. No residual gap found on that surface.

## Files changed

`src/view/VicinityGraphSettingTab.ts`
- +`SliderBounds` interface (local); +`DEPTH_SLIDER_STEP`, +`NODE_CAP_STEP` named constants
  (replaced the magic `1`s the refactor surfaced).
- +`private static nameControl(el, accessibleName)` — the single a11y rule + its WHY comment.
- +`private addLabeledSlider(container, name, desc, bounds, value, onChange)` — the ONE slider
  row builder; sets `aria-label` on `slider.sliderEl` via `.then(...)`.
- `addDepthSlider`, `addForceLayoutSlider`, and the "Outline depth" row now delegate to it.
- `addSizingNumber` labels its `inputEl` (covers the 3 sizing number rows).
- "Node cap" input labeled.
- The 4 pre-existing aria sites (2 restore buttons, exclusion textarea, metric weight) now call
  `nameControl` instead of `setAttribute` directly.

`e2e/settingsUxVisual.e2e.ts`
- New test: `settings tab: WHEN the tab renders THEN every input carries its row name as
  accessible name` — asserts `getByLabel("Repel force"|"Outline depth"|"Outgoing depth")` each
  resolve to `type=range`, then that `input[type=range]:not([aria-label])`,
  `input[type=number]:not([aria-label])` and `textarea:not([aria-label])` all have count **0**.
- Simplified line ~176: `page.getByLabel("Node cap").or(<css fallback>)` → `page.getByLabel("Node cap")`.
  The `.or()` existed only because the label was missing; dropping it is itself proof of the fix.

No CSS touched, no DOM structure added — `aria-label` is non-rendering, so the tab is visually
identical.

## Test results (verbatim)

`npm run check` → clean:
```
> vicinity-graph@0.1.1 check
> tsc -noEmit
```

`npm test`:
```
 Test Files  70 passed (70)
      Tests  938 passed (938)
```

`npm run test:e2e -- settingsUxVisual.e2e.ts` (real Obsidian 1.12.7, headless) — EXIT=0:
```
  ✓   3 e2e/settingsUxVisual.e2e.ts:88:1 › force layout: 7 sliders, live write, restore defaults (227ms)
  ✓   6 e2e/settingsUxVisual.e2e.ts:174:1 › settings tab: WHEN the tab renders THEN every input carries its row name as accessible name (26ms)
  ✓   7 e2e/settingsUxVisual.e2e.ts:188:1 › settings tab: a section restore resets ONLY that section (69ms)
  14 passed (3.4s)
```

`npm run test:e2e -- settingsResetReview.e2e.ts settingsResetVerify.e2e.ts` — EXIT=0:
```
  ✓   2 e2e/settingsResetReview.e2e.ts:190:1 › REVIEW: every reset control has a distinct accessible name (10ms)
  19 passed (5.2s)
```

Full suite `npm run test:e2e` — EXIT=1, **1 pre-existing unrelated failure**:
```
  ✘  71 e2e/vicinityGraph.e2e.ts:160:1 › singleton-folder note shows a folder breadcrumb and its trimmed frontmatter title (15.0s)
  1 failed
  70 passed (1.3m)
```
Verified pre-existing: `git stash` + rerun of that spec on the untouched tree reproduces the
identical failure (`.vicinity-graph-node[data-path="solo/gamma.md"] .vicinity-graph-node__breadcrumb`
element not found). It is already tracked as
`docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md`. Not caused by this change.

## Out of scope (tickets filed)

- **`nid_d2z2jgt6v49ssej8hxmwd2xi6_e`** — settings-tab **toggles** (exclusion enable + 4 sizing
  metric toggles) still have no accessible name. Obsidian renders a toggle as
  `div.checkbox-container` around a hidden checkbox; which element should carry the name must be
  confirmed against the real DOM, so it was not guessed at here.
- **`nid_que9qloigra7ku2boh83qizz0_e`** — in-graph panel consistency nits
  (`SizingSection.tsx:116-126` implicit-only label; `ForceLayoutSection.tsx:53-60` restore button
  without `aria-label`).
- No `Restore`-prefixed aria-label was added anywhere, so
  `e2e/settingsResetReview.e2e.ts:190-200`'s exact ordered list is untouched (verified green).

## Risks for the reviewer

1. `addLabeledSlider` uses `.then(() => …nameControl(slider.sliderEl, name))` — `then` is
   `BaseComponent.then`, i.e. synchronous self-application, not a Promise. Same pattern the
   restore buttons already used. Proven by the real-DOM e2e assertion.
2. The e2e "no unlabeled input" guard runs only in the e2e gate, not `npm test` — that is a
   deliberate Pareto call (a vitest version would need jsdom + a fabricated `Setting` fake and
   would assert the fake, not Obsidian).
3. Drive-by: two magic `1`s became named constants (`DEPTH_SLIDER_STEP`, `NODE_CAP_STEP`). Behavior
   identical; flagging because it is technically outside the ticket.
4. The main ticket was left **open** — closing it is TOP_LEVEL_AGENT's call after review.
