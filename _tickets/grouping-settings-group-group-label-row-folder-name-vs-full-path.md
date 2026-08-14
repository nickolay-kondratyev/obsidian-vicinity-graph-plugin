---
session_ids: [{"a": "claude", "type": "execution", "id": "311ed0cc-419b-4c30-af2c-462145bac30f"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
id: nid_0nmhmv03071derz5ok30cisaa_e
title: "Grouping settings group: group-label row (folder name vs full path)"
status: in_progress
deps: [nid_9uh2twn8whoqtplbxk0ywzpx7_e]
links: []
created_iso: 2026-08-14T00:18:09Z
status_updated_iso: 2026-08-14T01:39:04Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Part of recursive folder grouping. Full design: plan ticket nid_xko67wo2z4awg5gdrm1xx1chz_e (closed). Signed-off decision A1: DEFAULT is Folder name.

New settings group "Grouping" with ONE row choosing the group label style for collapsed chains: Folder name (leaf only, DEFAULT) vs Full path (collapsed chain like A/B/C). Non-collapsed groups show their folder name under either option. Model as a BOOLEAN spec leaf (e.g. groupLabelFullPath, DefaultSpec<boolean> like showCrossLinks, default false). NOTE (corrected 2026-08-14): there is NO reusable generic toggle control kind - control kinds in src/view/settingsRows.ts are 1:1 with SettingsInteraction arms, so this row gets its OWN new kind (e.g. "group-label-full-path"); copy the boolean-pill presenter pattern of "show-cross-links" / "exclusion-enabled" and let the compile-error-closed switches guide both presenters. Do not shoehorn the field into an existing kind and do not invent an enum control kind for this.

Wiring per repo conventions (all enforced by tripwires): spec leaf in src/engine/SettingsSpec.ts; declared row in src/view/settingsRows.ts (SETTINGS_GROUPS - new "Grouping" group; never hand-type labels in presenters); value accessor in src/view/settingsRowAccessors.ts; default recorded in src/engine/settingsProductDefaults.test.ts (the ONE defaults file); tab + panel presenters via their control-kind switches (compile errors guide); parity + spec-coverage scans must pass. Label rendering itself lands in the flow-rendering ticket - this ticket threads the setting through ViewSettings to FolderGroupNode.

The settings TAB has no npm-test coverage - run the e2e specs touching settings before calling done.

