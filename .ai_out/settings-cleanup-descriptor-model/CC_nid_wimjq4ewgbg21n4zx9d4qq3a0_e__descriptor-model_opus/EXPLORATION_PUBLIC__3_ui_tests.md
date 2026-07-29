# UI + Tests exploration — settings descriptor model (nid_wimjq4ewgbg21n4zx9d4qq3a0_e)

## 0. Field surface (from `src/engine/types.ts`)

`ViewSettings` (types.ts:286-298): `nodeCap`, `outlineMaxDepth`, `nodePreviewPreference`, `sizing` (`SizingSettings`: `metrics` × 5 + `minPx`/`maxPx`/`depthDecayK`), `forceLayout` (`ForceLayoutSettings` × 7 fields). Plus `DepthSettings` (`outgoingDepth`/`incomingDepth`) and `NodeExclusionSettings` (`enabled`/`patterns`). This is the complete field surface both renderers cover (minus per-doc/pinned depth overrides, which are a separate `CentralDepthControls` concern, panel-only).

## 1. Row metadata inventory — tab vs panel, with DIVERGENCE

| Field / row | Settings tab (`VicinityGraphSettingTab.ts`) | Controls panel (React) | DIVERGENCE |
|---|---|---|---|
| Outgoing/Incoming **default** depth | `renderDepthDefaults` (:459-478), slider 1–stepper-max, step 1 | **Not present.** Panel only has per-central `DepthStepper` (own/pinned depth, not the *default*) | Tab-only card ("Depth defaults"); panel has no global-default depth control at all |
| Central/pinned depth (outgoing/incoming) | **Not present** (no per-view surface per code comment at :62-63) | `CentralDepthControls.tsx` → `DepthStepper.tsx`, ± buttons, min/max clamp, "Reset to global default" button shown only when pinned | Panel-only |
| Sizing metric enable+weight (5 metrics) | `addSizingMetricRow` (:505-570): one `Setting` row, toggle `${label} enabled` + text `${label} weight`, `type=number`, range from `SIZING_RANGES.metricWeight` | `SizingSection.tsx` (:40-75): checkbox + number input, `aria-label={`${label} weight`}`, same range | Tab has an inline feedback slot pattern generally but NOT on metric rows; panel has no feedback slot either. Copy source shared (`SIZING_METRICS`) |
| minPx / maxPx / depthDecayK | `addSizingNumber` (:747-782) via `SizingRowWrite`: alert-role feedback slot, rejects inverted `max<min` pair, shows "Stored as N — allowed range is X–Y" cap notice | `SizingSection.tsx` `SizingNumber` (:106-135): plain `<input type=number>`, **no feedback/rejection UI at all** — silently clamps via `planSettingsWrite`/`clampSizingSettings` | **Real divergence**: tab refuses an inverted min/max pair with visible message; panel has no such guard/feedback (tracked by satellite ticket `nid_hatwq2jlkhno5t6awcz0q6t9q_e`) |
| Node preview preference (Preview pill) | `addNodePreviewSegmented` (:623-648): native radios in `role=radiogroup`, `NODE_PREVIEW_RADIO_GROUP` constant name, row desc shown as `<Setting>.setDesc` | `NodeContentsSection.tsx` (:26-80): same radios, `useId()` group name, desc NOT shown (panel has no room) — carried as `title` tooltip per option instead | Tab shows row description text; panel omits it (title-only) |
| Outline depth | `addLabeledSlider` inside `renderNodeContents` (:593-607), slider, bounds `MIN/MAX_OUTLINE_DEPTH` | **Not mirrored** — `NodeContentsSection.tsx` doc comment (:23-24) says explicitly "deliberately NOT mirrored here; that pre-existing parity gap is tracked separately" | **Confirmed gap**, tracked by satellite `nid_klkdpmx6axf90y4xj8khwrlf2_e` |
| Force layout (7 sliders: centerPullStrength, repelStrength, linkStrengthFactor, linkGapPx main; collidePaddingPx, elkNodeSpacingPx, edgeRoutingClearancePx advanced) | `renderForceLayout` (:330-342) + `addForceLayoutSlider` (:797-814), `setDynamicTooltip()` hover readout, description text shown via `setDesc` | `ForceLayoutSection.tsx` (:27-100): same fields/order/bounds from shared `FORCE_LAYOUT_FIELD_META`/`FORCE_LAYOUT_RANGES`, value shown inline next to label (`.vicinity-graph-forcelayout__value`) instead of hover tooltip, description as `title` attr, own "Restore defaults" button (`EngineDefaults.forceLayoutSettings()` directly, NOT `planSettingsReset`) | Value-readout mechanism differs (hover-tooltip vs inline live number) by necessity (no room); panel has its **own inline restore button** that calls `EngineDefaults.forceLayoutSettings()` directly rather than going through `SETTINGS_RESET_SCOPES["force-layout"].plan` — same effective values today, but it is a **second copy of "what force-layout defaults are/how they're applied"** |
| Node exclusion enable toggle | `renderExclusion` toggleRow (:360-388), row name "Exclude notes from the graph" | `NodeExclusionSection.tsx` (:22-81): `ToggleSwitch` labelled "Exclude notes" (**different accessible-name text**) | **Label divergence** |
| Exclusion patterns (list/edit) | `addExclusionPatterns` (:425-457): editable `<textarea>`, live per-line invalid-regex feedback (`describeInvalidExclusionPatterns`), hidden when disabled | Panel shows patterns **read-only** (`<ul><li><code>`) plus hint "Patterns are edited in the plugin settings." when enabled; "No patterns yet — add them in the plugin settings." when empty | By design — editing is tab-only; panel also shows an excluded-node **count badge** in its `<summary>` (`excludedNodeCount`), which the tab has no equivalent of |
| Node cap | `renderPerformance` (:650-675), `type=number`, `min=MIN_NODE_CAP`, step 1 | **Not present** — panel has no Performance section/card at all (comment at :62-63) | Tab-only card |
| Section/card restore-defaults (6 scoped + 1 all) | `addSectionReset`/`renderRestoreAll` (:262-317), driven by `SETTINGS_RESET_SCOPES` | Only **Force layout** has a restore button (`.vicinity-graph-forcelayout__restore`, ForceLayoutSection.tsx:53-60); no other panel section has any reset affordance, and that one bypasses the shared reset-scope plan | **Confirmed divergence** — panel offers 1 of 7 tab reset affordances |

## 2. Renderer file map, with hand-maintained lists

**Settings tab** — `src/view/VicinityGraphSettingTab.ts` (903 lines)
- `display()` (:166-180) hand-calls 7 `renderX()` methods in a fixed literal order — this method order *is* the card order; nothing enumerates it as data.
- Card headings are literal strings inside each `renderX()` (`"Depth defaults"` :461, `"Node sizing"` :482, `"Node contents"` :588, `"Force layout"` :332, `"Node exclusion"` :356, `"Performance"` :652) — a second copy lives in `e2e/settingsBaseline.ts:41-48` (`SECTION_CARD_HEADINGS`).
- `addSectionReset`/`SETTINGS_RESET_SCOPES` (imported from `settingsResetPlan.ts`) is the reset-affordance list — 7 entries (6 section + `all`), each carrying `label`, `description`, `plan`, `confirmation`.
- Per-row constants at top of file: `EXCLUSION_TEXTAREA_ROWS`, `OUTLINE_DEPTH_SLIDER_STEP`, `DEPTH_SLIDER_STEP`, `NODE_CAP_STEP`, `NODE_PREVIEW_RADIO_GROUP` (:66-85).
- `nameControl`/`nameToggle` (:134-158) — the tab's one a11y rule, applied by hand at every `addXxx` call site; nothing enforces every row calls it (only `settingsUxVisual.e2e.ts`'s DOM scan catches an omission).

**Controls panel (React)** — top-level `GraphToolbar.tsx` (61 lines) hand-lists 5 top-level `<Disclosure>` children in fixed JSX order (:37-60): Depth (+Pinned centrals conditional), Node exclusion, Node sizing, Node contents, Force layout. Mirrored by the e2e-side `CONTROLS_PANEL_DISCLOSURES` list.
- `SizingSection.tsx` (136 lines): iterates `SIZING_METRICS` for the 5 metric rows, then 3 hand-written `SizingNumber` calls (:76-95) for minPx/maxPx/depthDecayK — a second hand-listing of the same 3 fields the tab's `renderSizing()` (:492-494) lists.
- `ForceLayoutSection.tsx` (101 lines): maps `FORCE_LAYOUT_MAIN_FIELDS`/`FORCE_LAYOUT_ADVANCED_FIELDS` (shared with tab), but its own "Restore defaults" button (:53-60) calls `EngineDefaults.forceLayoutSettings()` directly — bypassing `settingsResetPlan.ts`, a fourth site that must agree on "what is the force-layout default."
- `NodeContentsSection.tsx` (81 lines): maps `NODE_PREVIEW_PREFERENCES` for the 3 pill options; outline-depth slider absent by design comment (:23-24).
- `NodeExclusionSection.tsx` (82 lines): single toggle + read-only pattern list.
- `CentralDepthControls.tsx` (64 lines): 2 hand-written `<DepthStepper>` calls (outgoing, incoming).

**Shared copy tables** (both surfaces import — the descriptor's natural home for row metadata):
- `src/view/forceLayoutFieldMeta.ts` — `FORCE_LAYOUT_FIELD_META` (label+description per field, `Record<keyof ForceLayoutSettings,...>`, compile-exhaustive) + `FORCE_LAYOUT_MAIN_FIELDS`/`FORCE_LAYOUT_ADVANCED_FIELDS` (grouping, type-level completeness assert at :72-74; disjointness only via `forceLayoutFieldMeta.test.ts`).
- `src/view/nodePreviewPreferenceMeta.ts` — `NODE_PREVIEW_OPTION_META` + `NODE_PREVIEW_ROW_LABEL`/`NODE_PREVIEW_ROW_DESCRIPTION`.
- `src/view/sizingMetrics.ts` — `SIZING_METRICS` (id+label, order-bearing array, NOT a `Record`, so a missing metric is **not** a compile error — a genuinely under-guarded list).
- `src/view/settingsResetPlan.ts` — `SETTINGS_RESET_SCOPES` (label/description/plan/confirmation per scope), `SECTION_RESET_SCOPES`/`ALL_SETTINGS_RESET_SCOPE` (compile-guarded at :195-197).
- `src/view/settingsWritePlan.ts` — `SettingsInteraction`/`SettingsCommand` unions + `planSettingsWrite` — the row→persistence-call mapping every control routes through.
- `src/view/settingsWriteScope.ts` — `settingsWriteScope()`, exhaustive switch over `SettingsCommand.kind` → `"global"|"per-doc"` (exhaustive over *command kind*, not per-field).

## 3. Test blast radius — every test hardcoding settings names/counts/labels

**Unit (vitest, `npm test`)**
- `src/view/settingsResetPlan.test.ts` (309 lines) — hand-lists all 7 scope labels/descriptions as literals (`:56`, `:273`, `:281`); `:262-265` asserts `[...SECTION_RESET_SCOPES, "all"].sort()` equals `Object.keys(SETTINGS_RESET_SCOPES).sort()`; `:296-309` reduces each section label to a "noun" and asserts it appears in the `all` description.
- `src/view/forceLayoutFieldMeta.test.ts` — `:12-15` asserts `[...MAIN_FIELDS, ...ADVANCED_FIELDS].sort()` == `Object.keys(FORCE_LAYOUT_RANGES).sort()`.
- `src/view/nodePreviewPreferenceMeta.test.ts` — 3 option labels distinct and non-colliding with row label.
- `src/view/settingsWriteScope.test.ts` — one literal test per `SettingsCommand.kind` (5 kinds today) pinning `"global"`/`"per-doc"`.
- `e2e/settingsBaseline.test.ts` (37 lines, runs under `npm test`, NOT Playwright) — **the tightest literal pin**: `:24-31` hardcodes the exact 6 section reset-row copy strings and `:35` the all-scope label, explicitly as "the independent second opinion" so a rename can't be self-fulfilling.
- `e2e/selectorGuard.test.ts` (279 lines, `npm test`) — string-scan tripwire: every `.vicinity-graph-*` class an `e2e/*.ts` selector references must appear as a rendered `className`/`cls` literal under `src/view/`. **Fires on any renderer rewrite that renames a class.**

**e2e (Playwright, `npm run test:e2e`)** — baselines come from `e2e/settingsBaseline.ts` (derived from `SECTION_RESET_SCOPES`/`SETTINGS_RESET_SCOPES`, but still hand-hardcodes tab **card headings** `SECTION_CARD_HEADINGS` :41-48 — "nothing in `src` exposes them as data" — and the **panel disclosure list** `CONTROLS_PANEL_DISCLOSURES` :117-123, 5 entries, not derived from `GraphToolbar.tsx`).
- `e2e/settingsUxVisual.e2e.ts` (561 lines): `:66-79` disclosure open/closed state; `:106-130` panel disclosure count+identity+order (5); `:142-148` "no Pinned centrals disclosure" absence pin; `:170-199` **literal "7 sliders"** + 3 hand-named advanced slider labels + literal "Repel force" interaction; `:201-229` tab section-card count/headings; `:222-229` reset-row count; `:245-286` `MIN_NAMED_CONTROLS = 26` **literal floor** ("10 sliders + 9 number inputs + 1 textarea + 6 toggles"); `:257-287` 8 hand-named `getByLabel(...)` literals; `:358-375` Preview-pill option count (3) and labels; `:499-536` "Outline depth" hover-readout probe.
- `e2e/settingsResetReview.e2e.ts` (293 lines): full **cross-section isolation matrix** (`:53-136`) hand-lists every field per section by literal value and re-asserts the other 6 sections are untouched after each single-section reset — most likely to silently rot when a new field is added. `:138-146` distinct accessible names over every "Restore*" button, count vs `EVERY_SETTINGS_RESET_NAME` (7).
- `e2e/settingsResetVerify.e2e.ts` (168 lines): literal pattern-count copy, literal confirm/cancel button text, literal description-substring checks.
- `e2e/settingsDependentRows.e2e.ts` (261 lines): `UNRELATED_CONTROL_LABEL = "Node cap"` (:38); `METRIC_UNDER_TEST = SIZING_METRICS[0]` (derived); DOM-identity/scroll/focus probes.
- `e2e/settingsTabPage.ts` (page object, 97 lines) — `open()` waits for `.vicinity-graph-settings-section` count == `SETTINGS_TAB_SECTIONS.length`; `card()`/`resetButton()` locators keyed by heading text.

**Net for this ticket**: `SETTINGS_RESET_SCOPES` (7-entry), `SECTION_CARD_HEADINGS` (6-entry, e2e-only, hand-typed because nothing in `src` exposes headings as data), `CONTROLS_PANEL_DISCLOSURES` (5-entry, e2e-only), `FORCE_LAYOUT_FIELD_META`+`_MAIN_FIELDS`+`_ADVANCED_FIELDS`, `NODE_PREVIEW_OPTION_META`, `SIZING_METRICS` (not compile-exhaustive — a real hole), and the two ForceLayout "restore defaults" call sites are the concrete lists to collapse. `MIN_NAMED_CONTROLS = 26` and the isolation-matrix literals are the tests most likely to under-assert once a new field lands (ticket 5 is scoped to fix that).

## 4. Copy/labels table (verbatim, must be preserved)

| Row | Tab name | Tab description | Panel label/summary |
|---|---|---|---|
| Depth defaults heading | "Depth defaults" | — | n/a (no panel card) |
| Outgoing default depth | "Outgoing depth" | "How many hops of outgoing links to expand from a central note by default." | n/a |
| Incoming default depth | "Incoming depth" | "How many hops of incoming links (backlinks) to expand by default." | n/a |
| Central depth stepper (panel only) | n/a | n/a | `DepthStepper label="Outgoing"` / `"Incoming"`; aria-labels "Decrease/Increase {label} depth", "Reset {label} depth to global default" |
| Node sizing heading | "Node sizing" | "Enable metrics and weight their contribution to each node's size. Sizes are normalised across the graph." | Disclosure summary "Node sizing" |
| Sizing metrics (`SIZING_METRICS`) | "Own file size", "Total linker size", "Backlinks", "Outlinks", "Depth decay" (+ " enabled"/" weight" suffix for aria-label) | — | same labels |
| Min node size | "Minimum node size (px)" | — | "Min px" |
| Max node size | "Maximum node size (px)" | — | "Max px" |
| Depth decay k | "Depth decay k" | — | "Depth decay k" |
| Node contents heading | "Node contents" | — | Disclosure summary "Node contents" |
| Preview pill | `NODE_PREVIEW_ROW_LABEL = "Preview"` | `NODE_PREVIEW_ROW_DESCRIPTION = "Which preview a node shows when it has both a heading outline and an image. A note that only has one of the two always shows that one."` | "Preview" label, NO description text (title-tooltip only, per-option) |
| Preview options | "Auto" / "Outline" / "Image" | "Let the note decide: the image wins only when it sits before the first heading." / "Prefer the heading outline. Notes without headings still show their image." / "Prefer the first image. Notes without an image still show their outline." | same (shared table) |
| Outline depth | "Outline depth" | "How many heading levels a note's outline shows inside its node." | **not rendered** |
| Force layout heading | "Force layout" | — | Disclosure summary "Force layout" |
| Force layout fields (`FORCE_LAYOUT_FIELD_META`) | "Center force" / "Repel force" / "Link force" / "Link distance" / "Node spacing" / "Group member spacing" / "Edge clearance" | "Pull of every node toward the graph centre. Keeps loosely-linked notes from drifting away." / "How strongly nodes and folder groups push each other apart." / "Stiffness of the springs that pull linked notes together. 1 is the built-in default." / "Extra resting distance (px) a link keeps between the two linked boxes." / "Minimum gap (px) enforced between any two boxes at the top level of the graph." / "Gap (px) between the notes inside a folder group." / "Gap (px) a connecting line keeps from the boxes it bends around on its way." | same labels; descriptions carried as `title` tooltip instead of visible text |
| Advanced spacing summary | "Advanced spacing" | — | Nested disclosure "Advanced spacing" |
| Force layout restore | "Restore force layout defaults" (from `SETTINGS_RESET_SCOPES`) | "Resets every force layout slider, including the ones under Advanced spacing." | plain button text "Restore defaults", `title="Reset all force layout sliders to their shipped defaults."` (own, un-shared copy) |
| Node exclusion heading | "Node exclusion" | — | Disclosure summary "Node exclusion" (+ optional excluded-count badge) |
| Exclusion enable toggle | Row name **"Exclude notes from the graph"**; desc "Hide matching neighbor notes before the graph is built. Central and pinned notes are never excluded." | | Label/aria-label **"Exclude notes"** (shorter — divergence) |
| Exclusion patterns | Row name "Exclusion patterns"; desc "One regular expression per line, tested (case-sensitively, unanchored) against each note's vault path including extension. E.g. `^archive/` matches the archive folder at the vault root; `templates/` matches anywhere. Invalid patterns are ignored." | | read-only list; hints "Patterns are edited in the plugin settings." / "No patterns yet — add them in the plugin settings." |
| Performance heading | "Performance" | — | n/a (no panel section) |
| Node cap | "Node cap" | "Maximum number of non-central nodes rendered. Central and pinned notes are never capped." | n/a |
| Reset-scope labels/descriptions (`SETTINGS_RESET_SCOPES`, verbatim) | "Restore depth defaults" / "Resets the default outgoing and incoming depth. Per-note depth overrides are kept." · "Restore node sizing defaults" / "Resets every sizing metric and weight, the minimum and maximum node size, and the depth decay k." · "Restore node contents defaults" / "Resets the outline depth to {N} heading levels and the node preview to {Label}." · "Restore force layout defaults" / "Resets every force layout slider, including the ones under Advanced spacing." · "Restore node exclusion defaults" / "Turns exclusion off and deletes every exclusion pattern." · "Restore performance defaults" / "Resets the node cap to {N}." · "Restore all Vicinity Graph settings" / "Resets every Vicinity Graph setting — depth defaults, node sizing, node contents, force layout, node exclusion and performance — to its shipped default. Per-note depth overrides and pinned notes are kept." | | only Force-layout restore exists in the panel, with its own unrelated copy |
| Exclusion reset confirm | title "{label}?", body "Turns exclusion off and deletes the following {N} exclusion pattern(s). This cannot be undone.", confirmText "Delete patterns and restore defaults" | | n/a |
| All-scope confirm | title "Restore all Vicinity Graph settings?", body = description + " This cannot be undone.", confirmText "Restore all defaults" | | n/a |

## 5. Constraints

**Obsidian `Setting` API limits**
- Cannot mount inside React (`ForceLayoutSection.tsx:23-25`, `NodeContentsSection.tsx:16-17`) — why two renderer implementations must always exist.
- No built-in collapsible group → both surfaces hand-roll native `<details>`/`<summary>` for "Advanced spacing" (tab :336-337; panel nested `Disclosure`).
- `Setting.setDynamicTooltip()` is `@deprecated` in 1.13 typings but is the *only* value readout on the pinned floor (`minAppVersion` 1.12.4, e2e pins 1.12.7) — comment at `VicinityGraphSettingTab.ts:683-691`: removing it "silently blanks the value on every supported build below 1.13". Do not drop it.
- Toggle a11y: `ToggleComponent.toggleEl` is the wrapping `<label class="checkbox-container">`, not the checkbox — `aria-label` must be set on the inner `<input>` (`nameToggle`, :153-158), or `settingsUxVisual.e2e.ts`'s unnamed-control scan (MIN 26) goes red.
- Obsidian renders the row name in a DOM *sibling* of `.setting-item-control` with no `for`/`id` pairing → every bare input needs an explicit `aria-label` (:120-133). Rows with 2 controls need 2 *different* names ("X enabled" / "X weight").
- Radio grouping is document-scoped outside a `<form>` — tab uses a fixed constant name (`NODE_PREVIEW_RADIO_GROUP`), panel uses `useId()` per mount so multiple open graph views don't fuse radiogroups (`NodeContentsSection.tsx:34-40`). A shared descriptor must not centralize this into one literal name.

**CSS / styling conventions**
- `src/view/settings-tab.css`: every section is a framed card (`.vicinity-graph-settings-section`), all colors from Obsidian theme vars (zero plugin-owned colors), each card's last row is its scoped reset (`.vicinity-graph-settings-reset`), the tab-wide reset (`.vicinity-graph-settings-reset-all`) sits outside every card. Row-level inline feedback (`.vicinity-graph-settings-error`) is hidden via `:empty` CSS (no JS visibility state).
- `e2e/selectorGuard.test.ts` enforces repo-wide (under `npm test`) that every `.vicinity-graph-*` class an e2e locator targets is rendered under `src/view/` — **any renderer rewrite that renames/removes a CSS class must update e2e locators in the same commit**.

**Anchor points**
- Searched `ap_[a-z0-9_]*_[Ee]` across `src/`, `e2e/`, `docs-internal/` — **none exist in this repo**. No `ap_XXX_E` anchors to preserve in the settings UI files.
