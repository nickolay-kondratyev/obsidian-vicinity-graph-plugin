# CLARIFICATION — settings descriptor model (ticket 2 of the settings-cleanup chain)

Owner answered 2026-07-29. These are **binding** for PLANNER, PLAN_REVIEWER,
IMPLEMENTATION and IMPLEMENTATION_REVIEWER.

## D1 — View-layer reach: publish descriptors + migrate shared meta tables ONLY

Ticket 2 builds the descriptor table (spec entry, `ViewSettings` field, default,
override parse branch, write plan, reset scope) and folds the **existing shared
view tables** into it as descriptor data:

- `src/view/forceLayoutFieldMeta.ts` — `FORCE_LAYOUT_FIELD_META`, `FORCE_LAYOUT_MAIN_FIELDS`, `FORCE_LAYOUT_ADVANCED_FIELDS`
- `src/view/nodePreviewPreferenceMeta.ts` — `NODE_PREVIEW_OPTION_META`, row label/description
- `src/view/sizingMetrics.ts` — `SIZING_METRICS` (currently an unguarded order-bearing array)
- `src/view/settingsResetPlan.ts` — `SETTINGS_RESET_SCOPES` reset-scope table

The tab and panel **keep their current row-building code**; they simply read from
the descriptor instead of the old tables.

**NOT in scope**: rewriting `VicinityGraphSettingTab.display()` or `GraphToolbar`
to iterate the descriptor list. That is ticket 4 (dual presenters).

Consequence: **no visual change, no user-facing copy change, no e2e baseline
churn.** If an e2e literal has to move, that is a signal the change overreached —
except for CSS-class renames, which `e2e/selectorGuard.test.ts` catches under
`npm test` and which must be avoided entirely here.

## D2 — Depth rename is DEFERRED to ticket 6

Keep `outgoingDepth` / `incomingDepth` and their current UI copy ("Outgoing
depth" / "Incoming depth"). The `linkDepthOut` / `embedDepthOut` / `linkDepthIn`
rename recorded in `docs-internal/notes/settings.md` lands with ticket 6, where
`embedDepthOut` gives it a reason to exist.

WHY-NOT now: the rename only pays off once a third depth field disambiguates the
names; doing it here churns user-facing copy plus ~6 e2e literals for no
structural benefit, and mixes copy risk into a structural review.

**Follow-up**: PLANNER must note this in the plan so ticket 6 is not surprised.

## D3 — Family shape: PLANNER decides and justifies

The three settings families have genuinely different cascade semantics:

| Family | Cascade | Override? |
|---|---|---|
| `ViewSettings` (5 fields) | main override → ranked pinned → global | `Partial<ViewSettings>` |
| `DepthSettings` (2 fields) | own-doc override → global (per-root, no pin ranking) | `DepthOverride` |
| `NodeExclusionSettings` (2 fields) | none — global only | none |

PLANNER must choose between **one unified descriptor list with a declared
cascade strategy** vs **three per-family tables**, and justify the choice
against: the ticket's acceptance criterion ("adding a new field requires editing
ONE declaration"), DRY/SRP, and the risk of over-generalising three genuinely
different things. PLAN_REVIEWER critiques the choice. Do not treat either option
as pre-approved.

## Standing constraints (from the ticket + notes, restated so no agent re-litigates them)

1. **Absent override = inherit.** `ViewSettingsOverride = Partial<ViewSettings>`;
   presence is tested with `!== undefined` (never truthiness, never `||`) so a
   pinned `0` / `false` stays a pin. This is the primary design constraint.
2. **`sizing` and `forceLayout` are atomic** units of `ViewSettings` — the whole
   object is pinned/inherited as one. Their leaves carry range metadata but have
   **no** independent inherit semantics. The unit of resolution is
   `keyof ViewSettings`, not "every leaf number".
3. **Clean break on stored data is allowed** (unpublished repo): no migrations,
   no dual-key read shims. Announce any reset in the release note.
4. **Engine purity**: anything placed under `src/engine/` or `src/shared/` may not
   import `obsidian` / `obsidian-id-lib` / `react` (`src/engine/importGuard.test.ts`).
   UI metadata carried in a descriptor must therefore be plain data — strings and
   POJOs, never a `Setting` or React reference. Placement of the descriptor table
   determines which guarantee applies; PLANNER must state the placement and why.
5. **Preserve the compile-time safety already present**: `ViewSettingsResolver.resolve()`
   is safe today *because its return type is `ViewSettings`*. Do not replace that
   with a runtime loop that can silently produce a wider/narrower object.
6. **`Setting.setDynamicTooltip()` stays** — deprecated in 1.13 typings but the only
   value readout on the `minAppVersion` floor (1.12.4).
7. **No `ap_XXX_E` anchors exist in this repo** (verified) — nothing to preserve.

## Ticket corrections established during exploration

- Reset-scope / write-scope tables are at `src/view/settingsResetPlan.ts` and
  `src/view/settingsWriteScope.ts`, **not** `src/engine/` as the ticket text says.
- The fold-in sub-ticket `nid_3k0a4zl6in0mj8lcjibkjq2dx_e` (`EDGE_VISIBILITY_MODES`
  re-listed with no completeness guard) is **already moot** — `edgeVisibility` was
  deleted by ticket 1 and the symbol no longer exists. The live analogous pattern
  is `NODE_PREVIEW_PREFERENCES` + its `_assertEvery…Listed` compile guard
  (`src/engine/types.ts:164-177`). TOP_LEVEL_AGENT will close that sub-ticket at
  the end of this flow.
- `SIZING_METRICS` (`src/view/sizingMetrics.ts`) is a real unguarded list — an
  order-bearing array, not a `Record<SizeMetricId, …>`, so a missing metric is not
  a compile error today. Closing this is in scope.

## Additionally folded in (TOP_LEVEL_AGENT decision, low risk, same root cause)

The panel's force-layout "Restore defaults" button
(`src/view/ForceLayoutSection.tsx:53-60`) calls `EngineDefaults.forceLayoutSettings()`
directly instead of going through `SETTINGS_RESET_SCOPES["force-layout"].plan` —
a **fourth** independent copy of "what the force-layout defaults are". Route it
through the shared reset plan. Values are identical today, so this is a
structural fix with no behavioural change; if PLANNER finds it forces a
behavioural change, it must flag rather than proceed.
