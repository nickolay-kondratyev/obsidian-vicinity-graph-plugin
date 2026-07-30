# Ticket: Controls inputs — optimistic local value + last-write-wins for rapid edits

**Status:** OPEN — deferred from step-06 (not a V1 blocker).
**Origin:** step-06-controls IMPLEMENTATION_REVIEW (Minor/follow-up) + PARETO_COMPLEXITY_ANALYSIS note. Not data loss; bounded and low-frequency. Filing so it isn't lost.

## Problem

The in-view controls are fully **controlled** off `snapshot.controls`, which is only republished after a full persist → `graphBuilder.build` → layout round-trip:

1. **Depth steppers** (`src/view/DepthStepper.tsx`, rendered by `src/view/GlobalDepthControls.tsx`): each `+`/`−` waits a full write→rebuild before the value updates, so rapid clicks feel laggy and coalesce. Since `nid_ez38gf1mrdgh5kxedzrdicwzl_e` this is the ONE global outgoing/incoming pair (the per-central `CentralDepthControls.tsx` is deleted), which shrinks the surface but not the substance — still bounded by `MAX_STEPPER_DEPTH = 5`, so at most a few clicks.
2. **In-view sizing** (`src/view/SizingSection.tsx`): builds its whole-object `global-sizing` write from the one-rebuild-behind snapshot (the settings tab, by contrast, reads globals **fresh** from `PluginDataStore` per edit — `src/view/VicinityGraphSettingTab.ts`). Rapid successive in-view sizing edits could write from a stale base and clobber a just-written sibling field.

## Fix (when picked up)

- Give the numeric/toggle controls an **optimistic local value** (local state seeded from the snapshot, updated immediately on input, reconciled when the next snapshot arrives) so the UI feels instant.
- For the in-view sizing writes, build the `SettingsInteraction` from a **freshly-read** `globalView` (mirror the settings-tab path: read `pluginDataStore.globalView()` at write time) rather than the snapshot's `controls.globalView`, so concurrent field edits don't clobber. The single-field-merge rule already lives in `planSettingsWrite` — only the ctx source changes.

## Acceptance

- Rapid stepper clicks update the displayed value immediately; final persisted value matches the last click after rebuild settles.
- Rapid distinct sizing-field edits in the in-view section never lose a field (each merges onto the latest persisted globals).
- No new business rule outside the existing `planSettingsWrite` contract; add a focused test for the "stale-base merge does not clobber" case if the fix introduces a shareable pure seam.

## Why deferred (PARETO)

Low frequency, bounded by the tiny depth range, no data loss on the common path, and the naive fix (optimistic state) is drift-prone — worth doing deliberately, not under step-06's UI push.
