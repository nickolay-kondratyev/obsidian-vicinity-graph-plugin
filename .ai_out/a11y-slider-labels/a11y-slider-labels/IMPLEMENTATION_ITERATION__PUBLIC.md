# IMPLEMENTATION_ITERATION — PUBLIC (a11y slider labels, iteration 2)

Responds to `IMPLEMENTATION_REVIEW__PUBLIC.md` (verdict READY, 0 blocking, 3 should-fix, 3 nit).
Branch `a11y-slider-labels`, commit `b334209` on top of `f4a193b`. Production a11y code was NOT
re-litigated — the only production edit is nit N1 (removal of a documented no-op).

## Per-finding disposition

| # | Finding | Disposition |
|---|---|---|
| S1 | textarea clause vacuous (`textareaTotal: 0`) | **ACCEPTED** |
| S2 | guard too narrow vs AC-2 (`type=text` / `<select>` leak) | **ACCEPTED** |
| S3 | no positive lower bound on number inputs | **ACCEPTED** |
| N1 | doc oversells deprecated `setDynamicTooltip()` | **ACCEPTED (stronger form)** |
| N2 | `page.getByLabel("Node cap")` is page-scoped | **ACCEPTED** |
| N3 | ticket bullet "check what Obsidian core does" unaddressed in report | **ACCEPTED (documented below)** |

### S1 — ACCEPTED
The guard now enables node exclusion from the store and re-renders the tab *inside the test*,
before asserting, so the exclusion textarea genuinely exists when the count runs:

```ts
await page.evaluate(async (pluginId) => {
    const plugin = (window as any).app.plugins.plugins[pluginId];
    const store = plugin.pluginDataStore;
    await store.saveNodeExclusion({ ...store.nodeExclusion(), enabled: true });
    plugin.app.setting.activeTab.display();
}, PLUGIN_ID);
```
Plus a positive assertion `expect(settings.getByLabel("Exclusion patterns")).toHaveCount(1)`.
Proof it is no longer vacuous: mutation **M2** below (deleting the textarea's `nameControl` call)
now turns the test RED; before this change it stayed green.

Leaving exclusion enabled is safe for the rest of the serial file: the only later tests that read
settings state are the Performance-scoped restore (`:226`) and restore-all (`:246`), which resets
`nodeExclusion` to defaults anyway. Verified by the full-file green run below.

### S2 — ACCEPTED
Selector widened from an allow-list of three types to "any control **except** the two deliberately
deferred families". Written once and derived, so the "unlabeled" variant cannot drift from the
"all" variant:

```ts
const NAMED_CONTROL_SELECTORS = ["input:not([type=radio]):not([type=checkbox])", "select", "textarea"] as const;
const ANY_NAMED_CONTROL = NAMED_CONTROL_SELECTORS.join(", ");
const ANY_UNNAMED_CONTROL = NAMED_CONTROL_SELECTORS.map((selector) => `${selector}:not([aria-label])`).join(", ");
```

Final guard:
```ts
expect(await settings.locator(ANY_NAMED_CONTROL).count()).toBeGreaterThanOrEqual(MIN_NAMED_CONTROLS);
await expect(settings.locator(ANY_UNNAMED_CONTROL)).toHaveCount(0);
```

**Rationale for the exclusions, both explicit in a block comment at the selector:**
- `radio` — the Preview pill's `<label>` *wraps* its radio (`VicinityGraphSettingTab.ts:413-425`),
  so the visible segment text already IS the accessible name. An `aria-label` there would be
  redundant, and requiring one would be a false positive.
- `checkbox` — Obsidian toggles are a `div.checkbox-container` around a hidden checkbox and are
  genuinely still unnamed; deferred to ticket **`nid_d2z2jgt6v49ssej8hxmwd2xi6_e`**, whose id is in
  the comment together with the instruction that closing it means deleting the
  `:not([type=checkbox])` clause. The exclusion is now deliberate and traceable, not accidental.

Proof the widening bites: mutation **M3** adds a plain `addText` row (which defaults to
`type=text`) — exactly the leak the reviewer described — and the guard goes RED. Under the old
three-selector guard that row would have shipped unnamed with the suite green.

### S3 — ACCEPTED, generalised
Two layers, because a bare `getByLabel` only proves *one* control exists:
1. `await expect(settings.getByLabel("Node cap")).toHaveAttribute("type", "number")` — the
   number-input family is proven present-and-named, as asked.
2. A floor on the whole covered family: `MIN_NAMED_CONTROLS = 20` (measured, see M0), asserted with
   `toBeGreaterThanOrEqual`. A **floor**, not an exact count, so adding a settings row does not
   break a pre-existing test (CLAUDE.md robustness rule) while "matched nothing" can never again
   read as "all good".

### N1 — ACCEPTED, in the stronger form
`obsidian.d.ts:6769-6774` marks `SliderComponent.setDynamicTooltip()` `@deprecated` with "The value
is now always shown inline next to the slider" — i.e. a no-op. Rather than only fixing the comment,
I removed the call (CLAUDE.md: clean breaks over carrying `@deprecated` dead code) and left a
WHY-NOT comment on `addLabeledSlider` recording why it is absent. Zero behaviour change: all 14
`settingsUxVisual` tests, including the slider value/restore assertions, stay green.

### N2 — ACCEPTED
`e2e/settingsUxVisual.e2e.ts:228` is now
`page.locator(".vicinity-graph-settings").getByLabel("Node cap")`, with the WHY in a comment.

### N3 — ACCEPTED (no code change; recorded so it is not re-litigated)
The ticket's "check what Obsidian core does first" bullet **is** satisfied and the previous report
failed to say so. Obsidian core renders the row name in a sibling `.setting-item-name` with no
`id`/`for` pairing and sets no `aria-label` on any control it builds — confirmed by the reviewer's
own DOM probe (core-built checkboxes/radios come back `aria: null` with a populated `rowName`).
There is no core behaviour to mirror or inherit; an explicit `aria-label` is the only mechanism
available, which is what this change does.

## Final guard, verbatim

`e2e/settingsUxVisual.e2e.ts:198-224`, selector:
```
input:not([type=radio]):not([type=checkbox]):not([aria-label]), select:not([aria-label]), textarea:not([aria-label])
```
Rationale in one line: deny-list, not allow-list — every focusable control the tab can render must
carry its own accessible name, and the only two exemptions are named, justified and ticket-linked.

## Verification (verbatim)

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
   Start at  17:24:40
   Duration  1.06s (transform 7.66s, setup 0ms, import 11.98s, tests 1.43s, environment 5ms)
TEST_EXIT=0
```

`npm run test:e2e -- settingsUxVisual.e2e.ts` (real Obsidian, headless):
```
UX_EXIT=0
  ✓   1 e2e/settingsUxVisual.e2e.ts:52:1 › panel defaults: every section is a disclosure, only Depth starts open (123ms)
  ✓   2 e2e/settingsUxVisual.e2e.ts:62:1 › exclusion toggle switches on, shows patterns state, and persists (289ms)
  ✓   3 e2e/settingsUxVisual.e2e.ts:88:1 › force layout: 7 sliders, live write, restore defaults (224ms)
  ✓   4 e2e/settingsUxVisual.e2e.ts:122:1 › settings tab renders six framed section cards with plugin CSS applied (279ms)
  ✓   5 e2e/settingsUxVisual.e2e.ts:158:1 › settings tab: every section card ends with its own scoped restore row (110ms)
  ✓   6 e2e/settingsUxVisual.e2e.ts:198:1 › settings tab: WHEN the tab renders THEN every input carries its row name as accessible name (44ms)
  ✓   7 e2e/settingsUxVisual.e2e.ts:226:1 › settings tab: a section restore resets ONLY that section (73ms)
  ✓   8 e2e/settingsUxVisual.e2e.ts:246:1 › settings tab: restore-all asks first, then resets every section (288ms)
  ✓   9 e2e/settingsUxVisual.e2e.ts:308:1 › settings tab: the Preview pill shows one segment per option and checks the stored one (51ms)
  ✓  10 e2e/settingsUxVisual.e2e.ts:320:1 › settings tab: clicking a Preview segment persists the new preference (59ms)
  ✓  11 e2e/settingsUxVisual.e2e.ts:329:1 › settings tab: the segmented-control stylesheet reaches the settings modal DOM (21ms)
  ✓  12 e2e/settingsUxVisual.e2e.ts:342:1 › settings tab: the selected Preview segment is filled distinctly from the trough (323ms)
  ✓  13 e2e/settingsUxVisual.e2e.ts:380:1 › controls panel: clicking its Preview segment writes the SAME global the tab writes (56ms)
  ✓  14 e2e/settingsUxVisual.e2e.ts:396:1 › controls panel: the pill re-checks itself from the rebuilt snapshot (11ms)
  14 passed (3.2s)
```

`npm run test:e2e -- settingsResetReview.e2e.ts` (the ordered `Restore*` label list at `:190` is
untouched and green):
```
RESET_EXIT=0
  ✓   1 e2e/settingsResetReview.e2e.ts:105:1 › REVIEW: isolation matrix — each section reset touches only its own keys (389ms)
  ✓   2 e2e/settingsResetReview.e2e.ts:190:1 › REVIEW: every reset control has a distinct accessible name (16ms)
  ✓   3 e2e/settingsResetReview.e2e.ts:208:1 › REVIEW: section reset re-renders the tab so displayed values actually move (56ms)
  ✓   4 e2e/settingsResetReview.e2e.ts:228:1 › REVIEW: exclusion reset shows the hidden patterns it is about to delete (225ms)
  ✓   5 e2e/settingsResetReview.e2e.ts:244:1 › REVIEW: cancelling the exclusion confirmation keeps every pattern (75ms)
  ✓   6 e2e/settingsResetReview.e2e.ts:252:1 › REVIEW: with no patterns stored, the exclusion reset applies without a dialog (62ms)
  ✓   7 e2e/settingsResetReview.e2e.ts:265:1 › REVIEW: confirm modal — Escape is non-destructive and Cancel holds initial focus (123ms)
  ✓   8 e2e/settingsResetReview.e2e.ts:279:1 › REVIEW: confirm modal — keyboard-only confirm restores everything (64ms)
  ✓   9 e2e/settingsResetReview.e2e.ts:302:1 › REVIEW: reset survives closing/reopening the tab AND a plugin reload (93ms)
  ✓  10 e2e/settingsResetReview.e2e.ts:326:1 › REVIEW: tab-wide reset sits further from the last card than cards sit apart (10ms)
  ✓  11 e2e/settingsResetReview.e2e.ts:340:1 › REVIEW: visual evidence — dark theme and a narrow settings pane (505ms)
  11 passed (2.7s)
```

### Mutation check — I watched this guard fail, four ways

Driver: `.tmp/mutate.py` (temp file, not committed). Each mutation patches
`src/view/VicinityGraphSettingTab.ts`, runs the spec against a real rebuilt plugin, then restores
the file from git. Tree verified clean afterwards (`git status --porcelain` → empty).

**M0 — measuring the floor.** `MIN_NAMED_CONTROLS` raised to 999:
```
    Error: expect(received).toBeGreaterThanOrEqual(expected)

    Expected: >= 999
    Received:    20
```
→ the guard covers **20** controls today (10 `range` + 9 `number` + 1 `textarea`), which is exactly
the floor now committed. This is the number that makes "count 0 unlabeled" meaningful.

**M1 — slider label removed** (`.then(() => nameControl(slider.sliderEl, name))` → `.then(() => undefined)`):
```
===== M1_slider_label_removed: exit=1 -> RED (guard caught it) =====
  ✘   6 … WHEN the tab renders THEN every input carries its row name as accessible name (15.0s)
  Error: expect(locator).toHaveAttribute(expected) failed
  Expected: "range"
  Error: element(s) not found
```

**M2 — exclusion textarea label removed** (this is the mutation the OLD guard survived):
```
===== M2_textarea_label_removed: exit=1 -> RED (guard caught it) =====
  Error: expect(locator).toHaveCount(expected) failed
  Expected: 1
  Received: 0
```

**M3 — a new unlabeled `addText` row** (the S2 leak: `Setting.addText` defaults to `type=text`):
```
===== M3_new_unlabeled_text_row: exit=1 -> RED (guard caught it) =====
  Error: expect(locator).toHaveCount(expected) failed
  Expected: 0
  Received: 1
```
Before/after for the unlabeled count under M3: old guard `0` (green, blind) → new guard `1` (red).

Known pre-existing unrelated failure `vicinityGraph.e2e.ts:160` (gamma breadcrumb,
`docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md`) was not touched and not
re-run.

## Files changed this iteration

- `e2e/settingsUxVisual.e2e.ts` — non-vacuous, widened, floored accessible-name guard; scoped
  `Node cap` locator in the section-restore test.
- `src/view/VicinityGraphSettingTab.ts` — dropped the deprecated no-op `setDynamicTooltip()` and
  corrected `addLabeledSlider`'s doc (N1). No a11y logic changed.

Commit: `b334209 test(a11y): make the settings-tab accessible-name guard non-vacuous and complete`.

## Readiness

**READY.** All three should-fix items are addressed with a mutation-verified guard; all three nits
are accepted (none rejected). No assertion was weakened or removed. The main ticket
`nid_5wiribg2mn0mqcr7ni4ya0cfe_e` remains open — closing it is TOP_LEVEL_AGENT's call. No
`change_log` entry was written, per instruction.
