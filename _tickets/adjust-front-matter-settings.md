---
session_ids: [{"a": "claude", "type": "execution", "id": "cb05f91a-1d3c-4ae4-ae59-0a6ccc5f7067"}, {"a": "claude", "type": "review", "id": "de70684b-83bb-4589-9e31-223b1dc96435"}, {"a": "claude", "type": "review", "id": "bb1a50f9-f821-429b-a868-d5d3abd2e346"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_gpgudw7pfdy02wcqbs73si21x_e
title: "Adjust front matter settings"
status: in_progress
deps: []
links: []
created_iso: 2026-08-15T05:35:16Z
status_updated_iso: 2026-08-15T05:41:11Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

Adjust how "Frontmatter links" settings are visualized:
1) move them the settings down below "Node Exclusion" above "Performance"
2) Make it so when the frontmatter fields are added they are not entered with comma separation but each added individually and each appears as tag like [link x] with and [x] to remove it.
## Notes

**2026-08-15T05:58:30Z**

__REVIEW_AGAIN__: fixed a real tab bug (chip-list rebuild on blur-commit swallowed an in-flight remove click; now reconciles per field) and added the missing tab-side e2e coverage (settingsIdRefChips.e2e.ts, verified red pre-fix); all gates green but the behavioral fix deserves a fresh pass

**2026-08-15T06:02:17Z**

__READY_AS_IS__: reviewed full diff (chip projection, both presenters, section reorder, e2e); no defects found, fixed nothing; check + npm test (2168 pass) + settings e2e specs (chips/typed/dependent/reset/visual, 46 pass) all green
