---
id: nid_jbsbfqqxyy1brm26ul7873v5h_e
title: "Embed nesting P4: settings toggle + e2e coverage"
status: open
deps: [nid_qy5rc7sq261z23bp79bk8wsem_e]
links: [nid_e79vxubva52s9gq24idypb77x_e, nid_r3qiyd7xx3bund6f73wf5h0vd_e, nid_1moqnutin09drbiyxkd3l7r5k_e, nid_qy5rc7sq261z23bp79bk8wsem_e]
created_iso: 2026-08-07T01:54:03Z
status_updated_iso: 2026-08-07T01:54:03Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [embed-nesting]
---

Part 4 (final) of the embed-nesting feature (decisions: ticket nid_e79vxubva52s9gq24idypb77x_e). Builds on rendering from ticket nid_qy5rc7sq261z23bp79bk8wsem_e.

SCOPE:
1. Global toggle "Nest embedded notes" (default ON, decision Q9), following the repo settings conventions EXACTLY: spec leaf in src/engine/SettingsSpec.ts; literal default recorded ONLY in src/engine/settingsProductDefaults.test.ts; declared row in src/view/settingsRows.ts SETTINGS_GROUPS (both presenters — settings tab switch arm and src/view/SettingsRowView.tsx — via the existing toggle control kind if one exists, else close the new kind in both switches); accessor in src/view/settingsRowAccessors.ts; writes go through the ONE settings pipeline (src/view/settingsWritePipeline.ts) with a SettingsInteraction naming this ONE field. Coverage guards (settingsRowSpecCoverage.test.ts, settingsRowParity.test.ts, spec iteration suites) must pass without allowlist entries. Toggle OFF restores today's flat rendering (nesting module simply not applied in flowMapping).
2. e2e specs (e2e/, Playwright vs real Obsidian, run via npm run test:e2e): dev-vault fixture notes exercising: nested rendering in embed order; edge from an outside note attaches to the outermost container and its link preview lists the true pair; central (active) note wins containment; pinned-vs-regular precedence; toggle OFF flattens. If a spec types into a settings field, settle via e2e/settingsWriteWindow.ts — never sleep.
3. Update docs: docs-internal/plan/high-level-plan.md gains an embed-nesting section (rules + decisions summary); docs-internal/architecture-map.md mentions src/view/embedNesting.ts; README.md user-facing description of the toggle.

npm run test:all green.

## Acceptance Criteria

Toggle declared once and rendered by both presenters with guards green; e2e proves nesting order, edge collapse + preview truth, precedence, and toggle-off; docs updated; npm run test:all green.

