---
closed_iso: 2026-07-25T17:41:38Z
id: nid_5wiribg2mn0mqcr7ni4ya0cfe_e
title: "settings-tab sliders have no accessible label (a11y)"
status: closed
deps: []
links: []
created_iso: 2026-07-25T04:15:25Z
status_updated_iso: 2026-07-25T17:41:38Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [a11y, settings, ui]
---

Found while adding the "Edge clearance" row in edge-routing__06 (evidence: `.ai_out/edge-routing__06/main/STEP5B_SURFACE__PUBLIC.md`). PRE-EXISTING and PLUGIN-WIDE -- not introduced by that ticket, and not specific to one row.

Every slider rendered through Obsidian `Setting.addSlider(...)` in `src/view/VicinityGraphSettingTab.ts` produces a bare `input[type=range]` with no programmatic association to the visible setting name. The name is rendered in a sibling element, so a screen reader announces the control with no indication of WHICH setting it adjusts -- seven force-layout sliders in a row all announce identically.

Same gap applies to the in-graph panel `src/view/ForceLayoutSection.tsx`, which renders its own sliders from the same shared meta tables (`src/view/forceLayoutFieldMeta.ts`).

This is a plugin-wide accessibility defect, so fix it in ONE place per surface rather than per row -- the shared `addForceLayoutSlider` helper and the equivalent in `ForceLayoutSection.tsx` are the natural seams, and both already have the label text in hand via `FORCE_LAYOUT_FIELD_META`.

## Design

Prefer `aria-label` (or `aria-labelledby` pointing at the existing name element) set inside the shared slider helpers, so every current and FUTURE row inherits it -- the whole point is that adding an eighth slider should not require remembering this.

Check what Obsidian`s own settings UI does before inventing a pattern; matching core behaviour is better than being novel here. If Obsidian already labels its sliders and only our custom rows miss it, mirror core exactly.

Also consider the numeric/text inputs (`addSizingNumber`, the node-cap input) while in there -- likely the same gap, same one-line fix per helper.

## Acceptance Criteria

- Each settings-tab slider is programmatically associated with its visible setting name (verified by reading the rendered DOM, not by inspecting source).
- The association comes from the SHARED helper, so a newly added force-layout field inherits it with no extra work -- demonstrate by reasoning over the helper, or add a test.
- The in-graph ForceLayoutSection sliders get the same treatment.
- A test or e2e assertion covers at least one slider, so the gap cannot silently return.
- No visual change to the settings tab; existing e2e visual assertions stay green.

