# EXPLORATION_PUBLIC — surfaces (a11y slider labels)

> Produced by the EXPLORATION (surfaces) sub-agent; persisted by TOP_LEVEL_AGENT because that
> agent ran read-only. Content is the agent's verbatim findings.

## 1. `src/view/VicinityGraphSettingTab.ts` — control inventory

| Line | Control | Shared helper | Label available | How label is set today | Gap? |
|---|---|---|---|---|---|
| 128-136 | `addButton` (section reset) | `addSectionReset(section, scope)` | `SETTINGS_RESET_SCOPES[scope].label` | `setName(label)` + `.setTooltip(label)` + `.then(() => button.buttonEl.setAttribute("aria-label", label))` | **OK — established pattern** |
| 165-171 | `addButton` (restore all) | `renderRestoreAll()` | same | identical trio | OK |
| 216-225 | `addToggle` (exclusion enable) | inline in `renderExclusion` | `"Exclude notes from the graph"` | `setName` only | gap (Obsidian checkbox-container; low priority) |
| 238-248 | `addTextArea` (patterns) | `addExclusionPatterns` | `"Exclusion patterns"` | `setName` + `text.inputEl.setAttribute("aria-label", ...)` (line 240) | OK |
| 282-294 | `addToggle` (per-metric enable) | inline loop over `SIZING_METRICS` | `label` | `setName(label)` only | gap |
| 295-312 | `addText` type=number (metric weight) | inline | `label` | `setName(label)` + line 301 `text.inputEl.setAttribute("aria-label", \`${label} weight\`)` | OK |
| 315-323 → 451-471 | 3× `addSizingNumber` | **`addSizingNumber(container, name, value, min, step, onChange)`** | `name` param | `new Setting(container).setName(name).addText(...)` — no aria | **GAP (shared helper)** |
| 351-362 | `addSlider` (Outline depth) | inline in `renderNodeContents` | `"Outline depth"` | `setName`/`setDesc` only | **GAP (not behind a helper)** |
| 411-422 | `addText` type=number (**node cap**) | inline in `renderPerformance` | `"Node cap"` | `setName`/`setDesc` only | **GAP** |
| 426-449 | 2× `addSlider` via **`addDepthSlider(container, name, desc, direction, current)`** | shared | `name` param | `setName(name).setDesc(desc)` — no aria | **GAP (shared helper)** |
| 479-494 | 7× `addSlider` via **`addForceLayoutSlider(container, field)`** | shared; `meta = FORCE_LAYOUT_FIELD_META[field]` | `meta.label` | `setName(meta.label).setDesc(meta.description)` — no aria | **GAP (primary target, 7 rows)** |
| 378-403 | raw radios (Preview pill) | `addNodePreviewSegmented(controlEl)` | `NODE_PREVIEW_ROW_LABEL` | `role=radiogroup` + `aria-label` on group (382); `<label>` wraps each radio | OK |

Slider helpers live at 426-449 and 479-494; `addSizingNumber` at 451-471. Each already has the
label string in hand — a single `.then((s) => s.sliderEl.setAttribute("aria-label", name))` inside
each helper fixes all current + future rows. There are **no** `addDropdown` call sites in this file.

## 2. In-graph panel — ALREADY FIXED (ticket premise is stale here)

`src/view/ForceLayoutSection.tsx:66-99` `ForceLayoutSlider` renders
`<label className="vicinity-graph-forcelayout__field" title={meta.description}>` wrapping a head
span (label text + live value) and, at 84-97, `<input type="range" className="slider"
aria-label={meta.label} … />`. **`aria-label={meta.label}` is already present (line 87).**
The wrapping `<label>` alone would announce "Center force 300" (label + value span), which is why
the explicit `aria-label` matters — do NOT remove it. `e2e/settingsUxVisual.e2e.ts:100-103` depends
on it (`forceLayout.getByLabel("Node spacing")`).

`src/view/forceLayoutFieldMeta.ts` supplies `{ label, description }` per field (16-45) plus the
`FORCE_LAYOUT_MAIN_FIELDS` (54-59) / `FORCE_LAYOUT_ADVANCED_FIELDS` (61-65) ordering partition.
Bounds (`min/max/step`) come separately from the engine's `FORCE_LAYOUT_RANGES`. No id/htmlFor.

## 3. Established convention

**`aria-label` set from the same string that renders visibly**, plus `title`/`setTooltip` for
description copy. Evidence: `VicinityGraphSettingTab.ts:134,169,240,301,382`;
`ForceLayoutSection.tsx:87`; `SizingSection.tsx:56`; `DepthStepper.tsx:36,48,60`;
`ToggleSwitch.tsx:20,27`; `NodeOutline.tsx:61`; `NoteNode.tsx:150,181`;
`NodeExclusionSection.tsx:60,65`; `nodePreviewPreferenceMeta.ts:12`.
**Zero uses of `aria-labelledby`, `htmlFor`, `setAttr('aria-`, or `.ariaLabel`** anywhere in `src/`.
Where a wrapping `<label>` suffices the code says so in a comment and skips id/for pairing
(`VicinityGraphSettingTab.ts:386-388`, `NodeContentsSection.tsx:55-58`).

### Obsidian API (`node_modules/obsidian/obsidian.d.ts`)
- `Setting` (5695): `settingEl/infoEl/nameEl/descEl/controlEl/components`, `setName/setDesc/setTooltip/setHeading/then`.
- `SliderComponent` (6722): **`sliderEl: HTMLInputElement`**, `setLimits/setValue/setDisplayFormat/onChange`.
  **No `setTooltip`.** `setDynamicTooltip()` is `@deprecated` ("value is now always shown inline"),
  so existing `.setDynamicTooltip()` calls are effectively no-ops.
- `BaseComponent` (497): `then/setDisabled/disabled`. `TextComponent` (7030) → `AbstractTextComponent.inputEl`.
  `ButtonComponent` (1325): `buttonEl` + `setTooltip`.
- Only the `.d.ts` ships in `node_modules/obsidian` (no JS), so **core's runtime aria behaviour
  cannot be verified from source** — verify via rendered DOM per the ticket's AC.

**Recommended shape** (matches the reset-button precedent):
`.addSlider((s) => s.setLimits(...).setValue(...).then(() => s.sliderEl.setAttribute("aria-label", name)).onChange(...))`
and `text.inputEl.setAttribute("aria-label", name)` inside `addSizingNumber` + the node-cap block.

## 4. Other raw controls in `src/view/` (inventory only — do NOT expand scope)

- `SizingSection.tsx:46-50` checkbox wrapped in `<label>` + `<span>{label}` — OK; `:53-67` number input has `aria-label` — OK; `:116-126` `SizingNumber` input wrapped in `<label>` with `<span>{label}` sibling — implicit label, no `aria-label`; acceptable but inconsistent.
- `DepthStepper.tsx:33,45,57` three buttons — all carry `aria-label` (OK).
- `NodeOutline.tsx:91` `<button>` with `title={label}` + text content — OK.
- `NoteNode.tsx:147,177` buttons with `aria-label` + `aria-hidden` icons — OK.
- `ForceLayoutSection.tsx:53-60` "Restore defaults" `<button>` — visible text + `title`; no `aria-label`, unlike its settings-tab twin. Minor inconsistency.
- `NodeContentsSection.tsx:65-71` radios inside wrapping `<label>` in an `aria-label`ed radiogroup — OK.
- `ToggleSwitch.tsx:24-28` requires `ariaLabel` as a mandatory prop — good enforced pattern worth mirroring.

## 5. CSS / visual-change touchpoints

`aria-label` is non-rendering ⇒ a correct fix is visually inert. Relevant files:
`src/view/settings-tab.css` (only `:27` `.setting-item-heading`, `:41`
`.vicinity-graph-settings-reset .setting-item-name` — no `input`/`slider` selectors),
`src/view/graph-view.css:791-830` (`.vicinity-graph-forcelayout__field .slider`, `__head`,
`__label`, `__value`, `__advanced`, `__restore`), `src/view/segmented-control.css`.
**Avoid** adding `id`/`for` pairing or wrapper elements in the settings tab — Obsidian's
`.setting-item` grid and screenshot assertions key off the existing structure.

### Existing test hooks that lock behaviour
- `e2e/settingsUxVisual.e2e.ts:88-103` — 7 sliders; `getByLabel` on panel sliders.
- `e2e/settingsUxVisual.e2e.ts:176` — `page.getByLabel("Node cap").or(… input[type=number]).last()`;
  the `.or()` fallback exists *because* node-cap has no accessible name. Adding
  `aria-label="Node cap"` makes the first branch win — still green.
- `e2e/settingsResetReview.e2e.ts:190-200` — asserts the exact ordered list of `aria-label`s on
  `.vicinity-graph-settings button`; the filter keeps only `Restore*`, so non-reset buttons
  yielding `null` are fine, but **new `Restore`-prefixed labels would break it**.
- `e2e/controlsRestart.e2e.ts:144` — `getByLabel("Own file size weight")`.
