---
id: nid_fqb570fmygcijuer2cjxtbana_E
title: "Layout mode: optional per-doc override UI + settings-tab surface"
status: open
deps: []
links: []
created_iso: 2026-07-21T19:47:00Z
status_updated_iso: 2026-07-21T19:47:00Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
---

The graph layout mode (layered | radial | force) landed as a ViewSettings field with a GLOBAL-writing selector in the graph toolbar (src/view/LayoutSection.tsx).

The cascade machinery already supports per-doc pin-on-toggle overrides (src/engine/ViewSettingsResolver.ts, src/persistence/persistedShapes.ts parses layoutMode in per-doc view overrides too), but no UI writes a per-doc layoutMode yet, and the plugin settings tab (src/view/VicinityGraphSettingTab.ts) does not expose the global layout choice.

Follow-ups (do only if wanted):
1. Per-doc layout override control (mirrors how depth overrides work).
2. Add the same layout dropdown to the settings tab for discoverability parity with sizing.

Context: chosen defaults + elk probe results are in the commit that introduced LayoutMode (see src/view/constants.ts ELK_ROOT_OPTIONS_BY_MODE and src/view/elkMapping.ts projectedRootEdges for the radial/force compound handling).

