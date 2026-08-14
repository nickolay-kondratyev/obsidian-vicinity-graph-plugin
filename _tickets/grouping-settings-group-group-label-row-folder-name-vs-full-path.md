---
id: nid_0nmhmv03071derz5ok30cisaa_e
title: "Grouping settings group: group-label row (folder name vs full path)"
status: open
deps: [nid_9uh2twn8whoqtplbxk0ywzpx7_e]
links: []
created_iso: 2026-08-14T00:18:09Z
status_updated_iso: 2026-08-14T00:18:09Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Part of recursive folder grouping. Full design: plan ticket nid_xko67wo2z4awg5gdrm1xx1chz_e (closed). Signed-off decision A1: DEFAULT is Folder name.

New settings group "Grouping" with ONE row choosing the group label style for collapsed chains: Folder name (leaf only, DEFAULT) vs Full path (collapsed chain like A/B/C). Non-collapsed groups show their folder name under either option. Prefer modeling as a BOOLEAN spec leaf (e.g. groupLabelFullPath, default false) rendered with the existing toggle/pill control kind - avoids inventing a new control kind; if an enum control kind already exists, use it, but do not create one for this.

Wiring per repo conventions (all enforced by tripwires): spec leaf in src/engine/SettingsSpec.ts; declared row in src/view/settingsRows.ts (SETTINGS_GROUPS - new "Grouping" group; never hand-type labels in presenters); value accessor in src/view/settingsRowAccessors.ts; default recorded in src/engine/settingsProductDefaults.test.ts (the ONE defaults file); tab + panel presenters via their control-kind switches (compile errors guide); parity + spec-coverage scans must pass. Label rendering itself lands in the flow-rendering ticket - this ticket threads the setting through ViewSettings to FolderGroupNode.

The settings TAB has no npm-test coverage - run the e2e specs touching settings before calling done.

