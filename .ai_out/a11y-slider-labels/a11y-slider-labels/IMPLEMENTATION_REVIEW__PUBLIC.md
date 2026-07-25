# IMPLEMENTATION_REVIEW — PUBLIC (a11y slider labels)

Reviewed commit `b59a65a` ("fix(a11y): give every settings-tab control an accessible name") against
`a970bc7`. Ticket `nid_5wiribg2mn0mqcr7ni4ya0cfe_e`. Reviewer ran read-only; no source touched.

**Verdict: READY** — 0 BLOCKING, 3 SHOULD-FIX (all in the e2e guard, none in production code), 3 NIT.

---

## 1. Verification results (verbatim, run by the reviewer)

`npm run check`:
```
> vicinity-graph@0.1.1 check
> tsc -noEmit

CHECK_EXIT=0
```

`npm test`:
```
 Test Files  70 passed (70)
      Tests  938 passed (938)
   Start at  17:16:27
   Duration  1.05s
TEST_EXIT=0
```

`npm run test:e2e -- settingsUxVisual.e2e.ts` (real Obsidian 1.12.7, headless):
```
  ✓   1 e2e/settingsUxVisual.e2e.ts:52:1 › panel defaults: every section is a disclosure, only Depth starts open (119ms)
  ✓   2 e2e/settingsUxVisual.e2e.ts:62:1 › exclusion toggle switches on, shows patterns state, and persists (311ms)
  ✓   3 e2e/settingsUxVisual.e2e.ts:88:1 › force layout: 7 sliders, live write, restore defaults (218ms)
  ✓   4 e2e/settingsUxVisual.e2e.ts:122:1 › settings tab renders six framed section cards with plugin CSS applied (286ms)
  ✓   5 e2e/settingsUxVisual.e2e.ts:158:1 › settings tab: every section card ends with its own scoped restore row (110ms)
  ✓   6 e2e/settingsUxVisual.e2e.ts:174:1 › settings tab: WHEN the tab renders THEN every input carries its row name as accessible name (26ms)
  ✓   7 e2e/settingsUxVisual.e2e.ts:188:1 › settings tab: a section restore resets ONLY that section (69ms)
  ✓   8 e2e/settingsUxVisual.e2e.ts:206:1 › settings tab: restore-all asks first, then resets every section (295ms)
  ✓   9 …268:1 › the Preview pill shows one segment per option and checks the stored one (63ms)
  ✓  10 …280:1 › clicking a Preview segment persists the new preference (61ms)
  ✓  11 …289:1 › the segmented-control stylesheet reaches the settings modal DOM (15ms)
  ✓  12 …302:1 › the selected Preview segment is filled distinctly from the trough (350ms)
  ✓  13 …340:1 › controls panel: clicking its Preview segment writes the SAME global the tab writes (51ms)
  ✓  14 …356:1 › controls panel: the pill re-checks itself from the rebuilt snapshot (9ms)
  14 passed (3.2s)
EXIT=0
```

`npm run test:e2e -- settingsResetReview.e2e.ts`:
```
  ✓   2 e2e/settingsResetReview.e2e.ts:190:1 › REVIEW: every reset control has a distinct accessible name (14ms)
  11 passed (2.7s)
EXIT=0
```

`sanity_check.sh`: not present in this repo.

### 1a. Independent DOM-level verification (the AC demands DOM, not source)

A throwaway probe spec was added to `e2e/`, run, and **deleted** (`git status` clean afterwards). It
dumped every control under `.vicinity-graph-settings` in the live settings tab:

- **10 `input[type=range]`**, each with `aria-label` **exactly equal** to its `.setting-item-name`:
  `Outgoing depth`, `Incoming depth`, `Outline depth`, `Center force`, `Repel force`, `Link force`,
  `Link distance`, `Node spacing`, `Group member spacing`, `Edge clearance`.
  The last three live inside the **collapsed** `details.vicinity-graph-settings-advanced` and are
  still labeled — the guard counts hidden nodes, so advanced rows ARE covered.
- **9 `input[type=number]`** all labeled: 5 metric weights (`… weight`), `Minimum node size (px)`,
  `Maximum node size (px)`, `Depth decay k`, `Node cap`.
- **7 `button`** all labeled (6 scoped `Restore …` + `Restore all Vicinity Graph settings`).
- Raw counts: `rangeUnlabeled: 0, numberUnlabeled: 0, textUnlabeled: 0, selectUnlabeled: 0,
  checkboxUnlabeled: 6, textareaTotal: 0`.

**Mutation check (proves the guard is not vacuous):** stripping every `aria-label` from that subtree
in-page raised the combined `range+number` unlabeled count from `0` to **19** (= 10 ranges +
9 numbers, i.e. every control the guard covers was genuinely labeled by the fix). The new assertion
would go red on revert. Test honesty: **confirmed**.

**Pre-existing failure spot-check:** `docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md`
exists and was committed at `507a27a`, long before this branch; the failing spec `vicinityGraph.e2e.ts`
is untouched by this diff (diff stat: 2 files, `src/view/VicinityGraphSettingTab.ts` +
`e2e/settingsUxVisual.e2e.ts`). Genuinely unrelated.

---

## 2. Summary of the change

`VicinityGraphSettingTab` grew one private static rule, `nameControl(el, name)`
(`src/view/VicinityGraphSettingTab.ts:114`), which every aria site now routes through — including
the four that previously called `setAttribute` inline. All three slider call sites were collapsed
into a single row builder `addLabeledSlider(container, name, desc, bounds, value, onChange)`
(`:461`), which sets `aria-label` from the SAME `name` string it passes to `setName` (one source of
truth — no drift possible). `addSizingNumber` (`:518`) and the node-cap input (`:444`) were labeled.
An e2e test (`e2e/settingsUxVisual.e2e.ts:174-186`) asserts three sliders by accessible name and
that no `range`/`number`/`textarea` in the tab lacks one; the `.or(...)` fallback at old line 176
was dropped because the label now exists.

Assessment: the shape is right and matches the only convention this repo has (`aria-label` from the
visibly rendered string; zero `aria-labelledby`/`htmlFor` anywhere). The refactor is mechanical and
behaviour-preserving. The residual weakness is entirely in how much the e2e guard actually guards.

### Regression audit, row by row (the highest-risk part)

| Row | Before | After | Verdict |
|---|---|---|---|
| Outgoing / Incoming depth | `setLimits(MIN_STEPPER_DEPTH, MAX_STEPPER_DEPTH, 1)`, `clampStepperDepth`, `global-depth` | same via `DEPTH_SLIDER_STEP = 1` | identical |
| Outline depth | `setLimits(MIN_OUTLINE_DEPTH, MAX_OUTLINE_DEPTH, OUTLINE_DEPTH_SLIDER_STEP)`, `clampOutlineMaxDepth` | same, moved into `addLabeledSlider`, same section position (after Preview, before reset) | identical |
| 7 force-layout | `setLimits(range.min, range.max, range.step)` from `FORCE_LAYOUT_RANGES[field]` | whole `FORCE_LAYOUT_RANGES[field]` passed as `SliderBounds` (structural, same 3 fields) | identical |
| Node cap | `step = "1"` literal | `String(NODE_CAP_STEP)`, `NODE_CAP_STEP = 1` | identical |
| Sizing numbers / weights / toggles / Preview pill / resets | untouched | untouched | identical |

Ordering and section placement confirmed **from the rendered DOM dump**, not from source: the
control sequence matches `FORCE_LAYOUT_MAIN_FIELDS` then `FORCE_LAYOUT_ADVANCED_FIELDS`, and every
section still ends with its reset button.

One subtle change worth naming and clearing: `setValue(...)`'s argument is now evaluated at
`addLabeledSlider` **call** time instead of inside the `addSlider` callback. Obsidian invokes that
callback synchronously inside `addSlider`, and `display()` is synchronous, so the store read is the
same read. No behaviour change. Nothing calls `setValue`/`setLimits` after `.then(...)`, so the
attribute cannot be wiped.

`e2e/settingsResetReview.e2e.ts:190-200` is safe: no new `Restore`-prefixed `aria-label` was
introduced (probe confirms exactly the 7 expected button labels); spec re-run green.

No `ap_XXX_E` anchor appears anywhere in the diff (grep: zero hits) and no test was removed or
weakened — dropping `.or(<css fallback>)` at `e2e/settingsUxVisual.e2e.ts:190` **strengthens** the
assertion, since the CSS branch could previously mask a missing label.

---

## 🚨 BLOCKING

None.

---

## ⚠️ SHOULD-FIX

### S1. The `textarea` half of the guard is vacuous — verified, not theorised
`e2e/settingsUxVisual.e2e.ts:185`
```ts
await expect(settings.locator("textarea:not([aria-label])")).toHaveCount(0);
```
The probe reports `textareaTotal: 0` in the exact state this test runs in. Reason: the exclusion
textarea only renders when `nodeExclusion.enabled` is true (`VicinityGraphSettingTab.ts:253`), and
the preceding serial test (`settingsUxVisual.e2e.ts:62-86`) deliberately ends by clicking the toggle
back **off**. So this line asserts "0 out of 0" and protects nothing — it would stay green if
`addExclusionPatterns`'s `nameControl` call were deleted tomorrow.

**Fix:** enable exclusion from the store before `openSettingsTab()` in the new test, then assert both
directions:
```ts
await page.evaluate(async (pluginId) => {
    const store = (window as any).app.plugins.plugins[pluginId].pluginDataStore;
    await store.saveNodeExclusion({ ...store.nodeExclusion(), enabled: true });
}, PLUGIN_ID);
await openSettingsTab();
…
await expect(settings.getByLabel("Exclusion patterns")).toHaveCount(1); // the row is actually there
await expect(settings.locator("textarea:not([aria-label])")).toHaveCount(0);
```
(Leaving the flag enabled is safe for the later tests in the file; if it is not, restore it at the
end of the test.) Alternatively delete line 185 — an assertion that cannot fail is worse than none.

### S2. The "future rows inherit it" guarantee has real holes
`e2e/settingsUxVisual.e2e.ts:183-185`

The guard enumerates exactly three selectors: `input[type=range]`, `input[type=number]`, `textarea`.
It is airtight for **sliders** (the only slider builder is the private `addLabeledSlider`, and an
inline `addSlider` would still be caught by the range selector). It is **not** airtight for the
broader claim in the implementer's report ("no input in the tab may lack a name"):

- `Setting.addText(...)` **defaults to `type=text`**. The two existing number inputs are only
  `type=number` because the call sites set `inputEl.type` by hand. A new plain-text row (say a
  "Default central folder" path) ships with no accessible name and the suite stays green.
- `Setting.addDropdown(...)` renders a `<select>` — not covered. `addSearch` likewise.
- Probe confirms `textUnlabeled: 0` and `selectUnlabeled: 0` **only because no such control exists
  today**. The guard's protection is coincidental for these.

**Fix (one line, replaces the three):**
```ts
// Radios are named by their wrapping <label>; checkboxes are tracked separately
// (nid_d2z2jgt6v49ssej8hxmwd2xi6_e). EVERY other control must carry aria-label.
await expect(
    settings.locator(
        "input:not([type=radio]):not([type=checkbox]):not([aria-label]), select:not([aria-label]), textarea:not([aria-label])",
    ),
).toHaveCount(0);
```
This is what makes the second acceptance criterion ("a newly added field inherits it with no extra
work") true for the whole control family rather than for sliders alone.

### S3. No positive lower bound on the number inputs
`e2e/settingsUxVisual.e2e.ts:183-185`

The three `getByLabel(...)` assertions above are strict-mode single-match, so they prove the range
count is non-zero. Nothing plays that role for `input[type=number]`: if the Performance/Sizing
sections stopped rendering, `numberUnlabeled === 0` would still pass. One line closes it and makes
the node-cap label a first-class assertion instead of an incidental dependency of the *next* test:
```ts
await expect(settings.getByLabel("Node cap")).toHaveAttribute("type", "number");
```

---

## 💡 NIT

### N1. `addLabeledSlider`'s doc oversells `setDynamicTooltip()`
`src/view/VicinityGraphSettingTab.ts:456-459` says the builder means "the accessible name … and the
tooltip behaviour are decided once", but `SliderComponent.setDynamicTooltip()` is marked
`@deprecated` in `obsidian.d.ts` ("value is now always shown inline") — i.e. a no-op. Pre-existing
call, carried forward, but the new comment now asserts behaviour that does not exist. Either drop
the `setDynamicTooltip()` call (CLAUDE.md: clean breaks over `@Deprecated`) or drop the tooltip
clause from the comment.

### N2. `page.getByLabel("Node cap")` is page-scoped
`e2e/settingsUxVisual.e2e.ts:190` — correct today (grep confirms "Node cap" exists on exactly one
surface), but it will become a strict-mode violation the day the controls panel grows a node-cap
row. `page.locator(".vicinity-graph-settings").getByLabel("Node cap")` is free and future-proof.

### N3. Ticket design bullet "check what Obsidian core does first"
Not called out in the implementer's report. It is in fact **satisfied**: the probe shows core
renders the row name in a sibling `.setting-item-name` with no `id`/`for` and sets no `aria-label`
on any control it builds (the checkboxes and radios come back `aria: null` with a populated
`rowName`). There is no core behaviour to mirror; the explicit `aria-label` is the right call. Worth
one sentence in the report so the next reader does not re-litigate it.

---

## Acceptance criteria — per-criterion verdict

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Every settings-tab slider programmatically associated with its visible name, **verified from rendered DOM** | ✅ PASS | Reviewer's own DOM dump: 10/10 ranges, `aria-label` === `.setting-item-name`, including the 3 inside the collapsed advanced `<details>` |
| 2 | Association comes from the SHARED helper so a new force-layout field inherits it free | ✅ PASS for sliders / ⚠️ PARTIAL beyond them | `addLabeledSlider` is the sole slider builder and is private; an 8th `FORCE_LAYOUT_ADVANCED_FIELDS` entry inherits with zero work. The broader "any new control" claim leaks on `type=text` / `<select>` — see **S2** |
| 3 | In-graph `ForceLayoutSection` sliders get the same treatment | ✅ PASS | Verified myself: `src/view/ForceLayoutSection.tsx:87` `aria-label={meta.label}`. Ticket bullet was genuinely stale; correct call to change nothing |
| 4 | A test/e2e assertion covers ≥1 slider so the gap cannot silently return | ✅ PASS | 3 named sliders + a count guard; mutation probe (strip all `aria-label`) drives the guard from 0 → 19 unlabeled, so a revert goes red. Caveat: e2e is a release gate, not `npm test` |
| 5 | No visual change; existing e2e assertions stay green | ✅ PASS | `aria-label` is non-rendering, no CSS touched; both touched specs re-run green by the reviewer; `settingsResetReview.e2e.ts:190` ordered label list unchanged |

## Scope discipline

Both deferrals are the right call.
- `nid_d2z2jgt6v49ssej8hxmwd2xi6_e` (6 unlabeled checkboxes — probe confirms the count) genuinely
  needs the real `div.checkbox-container` DOM inspected to decide which element carries the name;
  guessing would have been the wrong kind of speed. It is a **different** control family from the
  ticket's "sliders / numeric inputs" wording.
- `nid_que9qloigra7ku2boh83qizz0_e` is in-graph-panel cosmetic consistency, outside the tab.

Both tickets exist, are well written, and name the constraint (no new `Restore`-prefixed label). The
two drive-by named constants (`DEPTH_SLIDER_STEP`, `NODE_CAP_STEP`) are behaviour-identical and were
surfaced by the refactor itself — proportionate, and correctly flagged by the implementer.

## Documentation Updates Needed

None required. CLAUDE.md's conventions section already covers the repo-wide rules; the a11y rule is
stated once in the code where it is enforced (`VicinityGraphSettingTab.nameControl`), which is the
right home for it — not stable-enough, plugin-wide knowledge to warrant a CLAUDE.md line.
Optional: if S2 is taken, the ticket `nid_d2z2jgt6v49ssej8hxmwd2xi6_e` should note that the guard
now explicitly exempts `input[type=checkbox]`, so closing that ticket means tightening the selector.

## Signal

**READY** — mergeable as-is (production code is correct and the acceptance criteria are met). S1–S3
are e2e-only hardening; S2 in particular is what turns criterion 2's guarantee from "true for
sliders" into "true as advertised", and is a ~3-line change. Recommend taking S1+S2 before closing
`nid_5wiribg2mn0mqcr7ni4ya0cfe_e`.
