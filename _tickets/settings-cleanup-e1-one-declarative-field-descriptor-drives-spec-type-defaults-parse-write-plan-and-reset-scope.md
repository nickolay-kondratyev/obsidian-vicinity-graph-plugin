---
id: nid_wimjq4ewgbg21n4zx9d4qq3a0_e
title: "Settings cleanup E1: one declarative field descriptor drives spec, type, defaults, parse, write plan and reset scope"
status: open
deps: [nid_niz5dz6uqeyv237ckm15ittqa_e]
links: []
created_iso: 2026-07-29T17:29:26Z
status_updated_iso: 2026-07-29T17:29:26Z
type: epic
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [settings, architecture, dx]
---

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

