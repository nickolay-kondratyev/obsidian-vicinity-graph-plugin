---
id: nid_21xio7iwxv742ze4qc4p4qbmq_e
title: Add external-previews setting (single master toggle, default ON)
status: in_progress
deps: []
links: [nid_mw1az1i1aznfoxqsgcwnfus07_e, nid_tvtm9gj5zaj4tbfbpti3v6sy2_e, nid_15r71ajjkbel5s704kmj6wszw_e]
created_iso: '2026-08-07T15:49:26Z'
status_updated_iso: '2026-08-07T17:07:49Z'
type: feature
priority: 2
assignee: nickolaykondratyev
tags: [external-preview, settings]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Add ONE global boolean setting that gates ALL external content previews in graph nodes (first use: the leading YouTube hero video; later: external images / other providers). KISS: one switch, not per-type.

DEFAULT: ON — the feature should shine out of the box. User can turn it OFF, which stops ALL external requests.

HONEST DISCLOSURE (required, this is the whole point of the toggle): the plugin description AND the setting help text must state plainly that it loads external content referenced in notes and therefore contacts third-party servers (e.g. YouTube/Google), and that turning it OFF stops all such requests. On-by-default is acceptable in Obsidian ONLY if disclosed; do not hide it.

WIRE THROUGH THE ONE SETTINGS PIPELINE (see CLAUDE.md "Settings" sections):
- Add the spec leaf + literal default in src/engine/settingsProductDefaults.test.ts (the single source of shipped defaults).
- Declare the row in src/view/settingsRows.ts (SETTINGS_GROUPS).
- Add the accessor in src/view/settingsRowAccessors.ts.
- Both presenters (settings tab + in-graph panel) render it via their switch; let the compile errors guide you.
- Structural tests over SETTINGS_SPEC will FAIL until the leaf is wired (parse/round-trip/reset/bounds).

TESTS: e2e coverage for the toggle (settings tab has no npm-test coverage; per CLAUDE.md run npm run test:e2e for settings rows). Settle the write via e2e/settingsWriteWindow.ts, never a sleep.

Context / decisions: see _tickets/add-procesing-for-external-url-in-the-graph.md (D4 resolution).


## Notes

**2026-08-07T16:05:02Z**

ADD (2026-08-07): README disclosure is part of THIS ticket.
Update README.md to state that external previews (starting with YouTube hero
videos) load external content and therefore contact third-party servers (e.g.
YouTube/Google), that this is ON by default, and how to turn it OFF via this
setting. Keep it honest and user-facing — same message as the in-app setting help
text, DRY the wording.

**2026-08-07T17:04:36Z**

ADD (2026-08-07): this toggle now also gates FUTURE actual network fetches (thumbnails/favicons for URL nodes), not just embed/poster URLs — the enforcement mechanism is the single external-content seam ticket (nid_tvtm9gj5zaj4tbfbpti3v6sy2_e), which deps this one. Keep the disclosure wording general enough to cover fetched preview data, not only YouTube.
