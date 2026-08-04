---
closed_iso: 2026-08-01T19:00:56Z
id: nid_z4wsbv37irjrk6hul0x9jcco1_e
title: minor styling group up the link depth
status: closed
deps: []
links: []
created_iso: '2026-08-01T18:52:26Z'
status_updated_iso: 2026-08-01T19:00:56Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Right now under graph controls we have 6 levers for the link Depth, under 'Graph Controls/Depth'. 
They are actually 3, and 3. 3 for the central nodes and 3 for the pinned nodes.
However, there is not much in the UI to indicate that they are actually 2 groups of 3 levers.
Let's add styling to indicate that they are 2 groups of 3 levers, group them together under 'Depth.'

## Resolution (2026-08-01)

The Depth section's two blocks now NAME themselves on both surfaces: `FROM THE
ACTIVE NOTE` and `FROM EACH PINNED NOTE`, rendered as a quiet uppercase
micro-label above each run of three levers.

Declared once, rendered by both presenters (no per-surface copy):

- `src/view/settingsRows.ts` — new optional `SettingsRowBlock.subheading` (the
  always-open counterpart of `collapsedUnder`) + `SETTINGS_SUBHEADING_CLASS`, the
  one class both surfaces put on the element; the two `depth-defaults` blocks
  declare their subheading. New `EVERY_SETTINGS_BLOCK` export (`EVERY_SETTINGS_ROW`
  now derives from it).
- `src/view/GraphToolbar.tsx` — a named block wraps subheading + rows in ONE
  element, so the disclosure body's inter-block gap cannot space the name away
  from the rows it names.
- `src/view/VicinityGraphSettingTab.ts` — same name as a div before the block's
  `Setting` rows (NOT `setHeading()`, which is the card-heading altitude).
- CSS: `src/view/graph-view.css` (panel) and `src/view/settings-tab.css` (tab, plus
  a separator rule above every group except the one directly under the card
  heading). Theme variables only.

Row labels keep their `Pinned …` prefix on purpose: a subheading is not part of a
control's accessible name, and the labels must stay unambiguous on their own.

Tests: `settingsRows.test.ts` (a block never declares both grouping affordances;
naming is all-or-nothing per section; the depth section names both groups),
`settingsRowParity.test.ts` (both surfaces read `subheading` — the tab cannot be
mounted under `npm test`), `GraphToolbar.component.test.tsx` (rendered: every
declared subheading appears in declared order, and each shares one element with
its own rows). `npm test` 1473 passed, `npm run check` clean, e2e
`vicinityGraph` + `settingsUxVisual` + `controlsRestart` + `pinnedCentralScenario`
46 passed; both surfaces eyeballed in `.out/settings-ux/`.
