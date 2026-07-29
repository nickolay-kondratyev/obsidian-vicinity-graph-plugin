---
closed_iso: 2026-07-29T19:46:32Z
id: nid_wimjq4ewgbg21n4zx9d4qq3a0_e
title: "Settings cleanup — descriptor model: one declarative field descriptor drives spec, type, defaults, parse, write plan and reset scope"
status: closed
deps: [nid_niz5dz6uqeyv237ckm15ittqa_e]
links: []
created_iso: 2026-07-29T17:29:26Z
status_updated_iso: 2026-07-29T19:46:32Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [settings, settings-cleanup, architecture, dx]
---

Overarching context, ordering rationale and standing owner decisions: docs-internal/notes/settings.md (grouping tag: settings-cleanup, step 2 of the chain).

Part of the settings cleanup approved by the owner on 2026-07-29 (larger rewrite explicitly authorised). Root-cause ticket: nid_8p0nn2g34d97finokwlz3u1dt_e.

PROBLEM: adding ONE settings field currently costs ~15 files and ~8 hand-maintained parallel lists. The lists drift silently, which has already produced three separate symptom tickets.

IMPORTANT SCOPING FACT (verified, corrects the research ticket): ViewSettingsResolver.resolve is NOT a silent hole -- its return type is ViewSettings, so an omitted field is already a COMPILE error. The genuinely silent holes are only:
  1. src/persistence/persistedShapes.ts parseViewOverride branch table
  2. the reset-scope table (src/engine/settingsResetPlan.ts / settingsWriteScope)
  3. tab-vs-panel UI parity (no guard at all)

GOAL: a single field descriptor per setting, from which the spec entry, the ViewSettings field, the default, the override parse branch, the write plan, the reset scope, and the row-rendering metadata are all DERIVED.

MUST PRESERVE: the deliberate ViewSettings vs ViewSettingsOverride split, where an ABSENT override means "inherit" (not "false"/"zero"). This is the main thing a naive descriptor rewrite would break -- treat it as the primary design constraint.

Also fold in: nid_3k0a4zl6in0mj8lcjibkjq2dx_e (EDGE_VISIBILITY_MODES re-listed in persistence with no completeness guard) becomes a free side effect once unions are declared once.

Unpublished repo => clean break on the data.json / doc-data shape is allowed. No migrations, no dual-key read shims.

ACCEPTANCE: adding a new field requires editing ONE declaration plus its UI copy; compile-time completeness guards (satisfies Record<keyof ViewSettings, ...>) make every remaining table exhaustive.


## Notes

**2026-07-29T19:46:32Z**

DONE. Implemented on branch CC_nid_wimjq4ewgbg21n4zx9d4qq3a0_e__descriptor-model_opus (8 commits, 17a162c..83e2a1d).

DELIVERED: five previously-silent drift sites now fail COMPILATION and name the offending field — parseViewOverride parse table, section reset map, SIZING_METRICS, spec entries (missing + orphan), and the hand-typed SizingRangeField union. A sixth (depth parse) was found and guarded during review. The panel's force-layout restore no longer builds its own defaults; it routes through the shared reset plan. The 'absent override = inherit' rule collapsed from 7 hand-written sites to 1.

VERIFICATION: npm test 1144 passed (baseline 1131) + 1 pre-existing expected fail (it.fails at d3ForceStranding.test.ts:230, unrelated); npm run check exit 0. All test changes are +219/-0 — pure additions. src/view/settingsResetPlan.test.ts is byte-identical to its pre-branch state, which is the refactor's own correctness proof. IMPLEMENTATION_REVIEWER independently re-ran every compile-guard probe (all fired), proved the inherit invariant at runtime (pinned 0/false survive; absent fields stay absent KEYS — significant because exactOptionalPropertyTypes is off), transcribed the six pre-branch reset closures and confirmed the derived plans emit identical commands, and injected a defect to confirm the guards catch it. Verdict: IMPLEMENTATION_APPROVED.

ACCEPTANCE AMENDED BY OWNER (2026-07-29): the literal 'adding a new field requires editing ONE declaration' was NOT met — five edit sites remain, four compiler-named. Reaching one declaration would require deriving ViewSettings from a runtime array, weakening ViewSettingsResolver.resolve()'s return-type completeness, which the owner's standing constraints forbid. Owner ratified 'compile-forced N declarations' as the bar. Recorded in docs-internal/notes/settings.md.

SCOPE HELD: no renderer-loop rewrite (ticket 4), no depth rename (ticket 6), no user-facing copy change, no CSS class rename, no persisted-shape change, zero e2e churn.

FOLLOW-UPS FILED: nid_llfhrqo1ecg8tuxigo7bcrrrf_e (duplicate SETTINGS_SECTIONS/SECTION_RESET_SCOPES naming, deps -> ticket 4); nid_zwhec6kznw0utd9sz0n5g60ex_e (false WHY comment + dead throw in e2e/settingsDependentRows.e2e.ts). Sub-ticket nid_3k0a4zl6in0mj8lcjibkjq2dx_e closed as moot. Per-field cost measurement deliberately left to ticket 6 so it stays honest.
