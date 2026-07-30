# Ticket: Controls inputs — optimistic local value + last-write-wins for rapid edits

**Status:** CLOSED (2026-07-30) — resolved by `nid_m5hxe4eo9jgt7cfic7s2o3uvi_e`
(settings write/refresh pipeline), commits `7588c2b..5520cfa`. Both halves fixed:

- **Latency** — controls are optimistic locally. `src/view/optimisticValue.ts`
  (pure `PendingEdits`) + `src/view/useOptimisticValue.ts` show the requested
  value immediately while the persisted write is serialised. A request records
  both the burst's baseline and the value the write will *store*, so the
  override releases on the real echo, releases when someone else changes the
  field, releases when a clamp lands the write back on the baseline, and
  releases when a write fails (snapping back — it never displays an unstored
  number indefinitely). Rapid stepper clicks are no longer dropped.
- **Sibling clobbering** — the whole-object write from a one-rebuild-behind
  snapshot is gone. A control now emits a `SettingsInteraction` naming ONE
  field; `src/view/settingsWritePipeline.ts` merges it over globals read
  **fresh** from `PluginDataStore` inside its own serialised slot. The `ctx`
  snapshot prop was removed from all panel components, so writing from a stale
  base is no longer expressible.

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
