# IMPLEMENTATION — a11y toggle labels (PUBLIC)

Ticket `nid_d2z2jgt6v49ssej8hxmwd2xi6_e`. Branch `a11y-toggle-labels`, commit `25e75f6`.
Status: **DONE, all gates green.** Tree clean, probe deleted, no change-log entry, ticket left open (owned by TOP_LEVEL_AGENT).

---

## 1. The empirical evidence (the crux of this ticket)

A throwaway `e2e/_probe.e2e.ts` ran against the real pinned Obsidian **1.12.7**
(`.tmp/obsidian/obsidian-1.12.7/obsidian`, headless) and dumped the rendered settings-tab DOM.
The probe has been **deleted**; its raw output is preserved here and in the PRIVATE file.

### Raw DOM of a sizing-metric row (verbatim probe output, BEFORE the fix)

```
ROW name=[Own file size] control=[<div class="setting-item-control"><label class="checkbox-container is-enabled" tabindex="0"><input type="checkbox" tabindex="0"></label><input type="number" spellcheck="false" min="0" max="100" step="0.5" aria-label="Own file size weight"></div>]
  cb rect=[15x15] opacity=[0] visibility=[visible] display=[block] tabIndex=[0]
ROW name=[Exclude notes from the graph] control=[<div class="setting-item-control"><label class="checkbox-container" tabindex="0"><input type="checkbox" tabindex="0"></label></div>]
  cb rect=[15x15] opacity=[0] visibility=[visible] display=[block] tabIndex=[0]
```

Two corrections to the prior assumption on record: the container is a **`<label>`**, not a `div`
(the ticket text and the old guard comment both said "div.checkbox-container"), and it carries
**no text** — which is precisely *why* the wrapped checkbox has no accessible name. Six such rows
were found, matching the predicted count (5 sizing metrics + 1 exclusion).

### Q1 — Is `toggleEl` the container or the input?

`window.require("obsidian")` is not reachable from the renderer (`REQUIRE_FAILED Error: Cannot find
module 'obsidian'`), so this was resolved by a temporary marker attribute set via
`toggle.then((t) => t.toggleEl.setAttribute("data-probe-toggleel", "1"))`, rebuilt and re-probed:

```
<label class="checkbox-container is-enabled" tabindex="0" data-probe-toggleel="1"><input type="checkbox" tabindex="0"></label>
```

**Answer: `ToggleComponent.toggleEl` is the wrapping `<label class="checkbox-container">`, NOT the
checkbox.** So `nameControl(toggle.toggleEl, …)` would have parked the `aria-label` on a role-less
`<label>` — which names nothing (a `<label>` names its control by its TEXT, not by `aria-label`) and
would not have satisfied the extended guard. The name has to be pushed onto the inner `<input>`.

### Q2 — Is the checkbox usable for `getByLabel(...)` assertions?

`opacity: 0` but `visibility: visible`, a real 15×15 box, and `tabIndex=0`. Playwright treats
opacity-0 elements with a box as visible, so `getByLabel(...)` / `getByRole("checkbox", …)` resolve and
assert fine — the new guard assertions pass against it. **Answer: yes for locating and asserting.**
I did **not** convert the existing `.evaluate(el => el.click())` call sites in
`settingsUxVisual.e2e.ts` / `settingsDependentRows.e2e.ts`: those click programmatically on purpose
(a real click moves focus and destroys what `settingsDependentRows` measures). Out of scope, untouched.

### Q3 — Name text?

**Answer: `"Exclude notes from the graph"` (bare row name — it is the row's only control) and
`` `${label} enabled` `` for sizing metrics.** The tab's rule already says "the row name *plus the
control's role where one row holds two controls*", and the sibling weight input has read
`` `${label} weight` `` since the prior ticket. `"Own file size enabled"` is the consistent partner;
bare `"Own file size"` would also make every default (substring-matching) `getByLabel("Own file size")`
strict-mode-ambiguous against `"Own file size weight"`. The visible row name is contained in the
accessible name, so the AC holds.

### Bonus finding — `setTooltip` is unnecessary

A second probe hovered three controls and read the body-level `.tooltip`:

```
=== TIP checkbox=[Own file size enabled]
=== TIP number=[Own file size weight]
=== TIP resetButton=[Restore depth defaults]
```

**Obsidian 1.12.7 pops its own tooltip for ANY element carrying an `aria-label`.** So the toggles
gain a hover tooltip *for free*, identical in mechanism to the number inputs that shipped with the
prior ticket. **Decision: do NOT call `ToggleComponent.setTooltip`** — it would be a second source of
the same string for zero added behavior. Recorded as a note in the `nameControl` doc comment.

---

## 2. What changed

### `src/view/VicinityGraphSettingTab.ts`

- **`:2`** — `ToggleComponent` added to the type-only `obsidian` import.
- **`:113-126`** — `nameControl`'s doc gains the verified note that Obsidian renders any `aria-label`
  as a hover tooltip, and that this is why nothing here also calls `setTooltip`.
- **`:131-151` (new) `private static nameToggle(toggle: ToggleComponent, accessibleName: string)`** —
  the same one rule for toggles. Does `toggle.toggleEl.querySelector("input")` and delegates to
  `nameControl`. Its doc records the 1.12.7 DOM shape, that it was verified against the rendered DOM
  (the typings say only `HTMLElement`), and why the label itself cannot carry the name.
  **No-ops rather than throwing** if that markup ever changes — a missing a11y attribute must not take
  the whole settings tab down, and the e2e guard is what fails loudly instead.
- **`:346-355` `renderExclusion()`** — the row name is now a local `const name` used for BOTH
  `setName(name)` and `nameToggle(toggle, name)` (one string, cannot drift). The `addToggle` callback
  became a block body.
- **`:498-505` `addSizingMetricRow()`** — `nameToggle(toggle, `${label} enabled`)`; block body.
  The "two controls share this row" WHY moved up to the toggle (it explains both controls) and is
  cross-referenced from the weight input rather than duplicated.

### `e2e/settingsUxVisual.e2e.ts`

- **`:231-244`** — the stale block comment: the whole `checkbox` bullet naming this ticket is gone,
  replaced by a positive statement of *why* toggles are not exempt (textless wrapping `<label>`).
  The **`radio` exemption and its rationale are untouched.**
- **`:244`** — `"input:not([type=radio]):not([type=checkbox])"` → `"input:not([type=radio])"`.
- **`:247-253`** — `MIN_NAMED_CONTROLS` 20 → **26**, with the arithmetic spelled out (10 sliders +
  9 numbers + 1 textarea + 6 toggles).
- **`:275-282`** — three new positive assertions: the exclusion toggle by label, one sizing toggle by
  label, and — the important one — `getByRole("checkbox", { name: "Depth decay enabled" })`. That last
  one is what proves the *browser's own accessible-name computation* resolves, which every
  attribute-level assertion in this file would happily accept from an `aria-label` parked on a
  role-less element.

---

## 3. Gate results (real output)

| Gate | Result |
|---|---|
| `npm run check` | **exit 0** |
| `npm test` | **exit 0** — `Test Files 79 passed (79)` / `Tests 1053 passed (1053)` |
| `npm run test:e2e -- settingsUxVisual.e2e.ts` | **exit 0** — `17 passed (3.3s)` |
| `npm run test:e2e -- settingsDependentRows.e2e.ts` | **exit 0** — `3 passed (1.8s)` |

I did not run the full e2e suite; the known pre-existing red at `vicinityGraph.e2e.ts:160` was
therefore neither reproduced nor touched.

### RED-first evidence

The guard was extended **before** the source fix and failed for the right reason:

```
✘  e2e/settingsUxVisual.e2e.ts:257 › … every input carries its row name as accessible name (15.1s)
   Error: expect(locator).toHaveAttribute(expected) failed
   Locator: locator('.vicinity-graph-settings').getByLabel('Exclude notes from the graph')
   Expected: "checkbox"
   Error: element(s) not found
```

### Mutation check

`VicinityGraphSettingTab.nameToggle(toggle, name)` in `renderExclusion` was replaced by a comment,
rebuilt and re-run — the guard went RED with the identical failure above; the line was then restored
and the suite re-run green. (`git status` at commit time showed only the two intended files.)

---

## 4. "No visual change" — how I checked, honestly

- The change adds **only** an `aria-label` attribute to six existing `<input type="checkbox">`
  elements. No element, class, text node or style is added or removed; `git diff` touches no CSS.
- `grep -rn "aria-label" src/view/*.css styles.css` finds only a **comment** in
  `segmented-control.css` — no stylesheet selects on `[aria-label]`, so nothing restyles.
- All 17 `settingsUxVisual` tests pass, including the segmented-control colour and card-layout
  assertions and their screenshot captures.
- **One caveat, stated rather than glossed:** per the probe above, Obsidian renders any `aria-label`
  as a **hover tooltip**, so hovering a toggle now shows e.g. "Own file size enabled". The resting
  render is byte-identical and nothing moves; this is the same behaviour the sibling number inputs
  and the reset buttons already shipped with. I judged that in-scope-and-fine, but it is a real
  hover-state difference and the reviewer should see it, not discover it.

---

## 5. Deliberately NOT done

- **No `ToggleComponent.setTooltip`** — the tooltip already comes from the `aria-label` (proven above).
- **No change to the slider `setDynamicTooltip()` block** — flagged as blocking by a prior review.
- **No `toggle(name)` helper on `SettingsTabPage`**, and no rewrite of `flipToggleIn` /
  `.evaluate(el => el.click())` in the existing specs to name-based clicking. Now possible, but
  outside minimal scope and those clicks are programmatic on purpose.
- **No `instanceof HTMLInputElement` fallback branch** in `nameToggle` for a hypothetical future where
  `toggleEl` becomes the input. We verified today's shape; the e2e guard is the alarm for drift, and a
  speculative branch would be untestable dead code.
- **No change-log entry, no ticket closure, no merge to main** — all owned by TOP_LEVEL_AGENT.
- **No new ticket filed.** The one adjacent observation (the reset buttons' `setTooltip` is redundant
  now that `aria-label` alone produces the tooltip) is a harmless duplicate string, not a defect, and
  removing it would touch the prior ticket's reviewed code for no user-visible gain.
