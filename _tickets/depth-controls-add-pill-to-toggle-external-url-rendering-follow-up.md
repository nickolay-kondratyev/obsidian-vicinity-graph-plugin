---
id: nid_uqgew1fuqgrdyvas6eum6vaf2_e
title: "Depth controls: add pill to toggle external-URL rendering (follow-up)"
status: open
deps: [nid_ccsw8o1rjcs2l7o1elgmlqx5i_e, nid_prsk9olcj9u2fpzqgv5gb6zhe_e]
links: [nid_mw1az1i1aznfoxqsgcwnfus07_e, nid_hyzwoqadcfyvisveczuet3e8c_e, nid_prsk9olcj9u2fpzqgv5gb6zhe_e, nid_ccsw8o1rjcs2l7o1elgmlqx5i_e]
created_iso: 2026-08-07T00:01:59Z
status_updated_iso: 2026-08-07T00:01:59Z
type: task
priority: 4
assignee: nickolaykondratyev
tags: [view, settings, external-url, follow-up]
---

# Depth controls — pill to toggle external-URL rendering (follow-up)

Parent: `nid_mw1az1i1aznfoxqsgcwnfus07_e` (planning). **Depends on**
`nid_prsk9olcj9u2fpzqgv5gb6zhe_e` (engine/adapter) and
`nid_ccsw8o1rjcs2l7o1elgmlqx5i_e` (view rendering) — those ship URL nodes rendered
ALWAYS (from central/pinned). This ticket makes that behavior a user setting.

## Goal (from parent ticket)

Add a PILL-like control in the "Depth" configuration area controlling whether
external URLs are rendered. Default preserves whatever the initial ship decided
(propose: ON, matching the shipped-always behavior — confirm).

## Requirements

- New GLOBAL boolean setting (every setting is global — see
  `docs-internal/plan/high-level-plan.md`), e.g. `showExternalUrls`, declared in
  the ONE spec (`src/engine/SettingsSpec.ts`, `SETTINGS_SPEC`) with a default, and
  wired through the ONE row model (`src/view/settingsRows.ts`, `SETTINGS_GROUPS`)
  and its accessor (`src/view/settingsRowAccessors.ts`). Both presenters (settings
  tab + in-graph controls panel) render it from that one declaration — see the
  "Settings rows"/"Settings values" conventions in `CLAUDE.md`.
- Placement: alongside the Depth controls, as a pill/toggle (match the existing
  Preview pill pattern — see `src/view/nodePreviewPreferenceMeta.ts` and how the
  preview pill renders in both surfaces).
- When OFF, the engine's external-URL collection pass (from the engine ticket) is
  skipped, so no url-nodes/edges are produced.
- Follow the settings-spec tripwire convention: the new leaf must round-trip,
  reset-to-default, and honour bounds via the id-keyed table in
  `src/engine/settingsProductDefaults.test.ts`, and be covered by the row-coverage
  guard (`src/view/settingsRowSpecCoverage.test.ts`).

## Possible scope extension (decide at pickup)

The parent floated eventually widening WHERE URLs come from (beyond central/pinned)
via this control. Keep THIS ticket to the on/off toggle; if a scope/depth dimension
for URLs is wanted, split it into its own ticket rather than overloading the pill.

## Testing

- Settings spec/round-trip/reset tests (structure-walking suites).
- Tab-vs-panel parity (`src/view/settingsRowParity.test.ts` + a rendered
  `*.component.test.tsx`).
- e2e that toggling the pill OFF removes url-nodes and ON restores them
  (settle the write window via `e2e/settingsWriteWindow.ts`, never a sleep).

## Acceptance

- One global pill toggles external-URL rendering across both settings surfaces;
  all settings tripwires + parity + e2e green.

