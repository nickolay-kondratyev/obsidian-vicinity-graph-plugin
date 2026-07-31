---
id: nid_6kjmn2y8jc8a9gxynudusbmlk_e
title: 'Unused DEFAULT_LINK_DEPTH_OUT / DEFAULT_LINK_DEPTH_IN engine exports: delete
  or complete'
status: in_progress
deps: []
links: []
created_iso: '2026-07-30T04:34:36Z'
status_updated_iso: '2026-07-31T18:01:42Z'
type: chore
priority: 4
assignee: CC_WITH-nickolaykondratyev
tags: [settings, cleanup]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
src/engine/constants.ts exports DEFAULT_LINK_DEPTH_OUT and DEFAULT_LINK_DEPTH_IN (re-exported from src/engine/index.ts). Their ONLY readers are src/engine/SettingsSpec.test.ts, which asserts they alias the spec - i.e. they are tested but unused.

Noticed while adding `embedDepthOut` (ticket nid_fay1hu5sxcoygizopkkg0f0d7_e): the new field deliberately did NOT get a third alias, because adding an unused export to match two other unused exports is worse than the asymmetry. That leaves the family inconsistent, which is the POLS smell this ticket exists to remove.

Decide ONE of: (a) delete both aliases plus the test that pins them, and read SETTINGS_SPEC directly wherever a default is ever needed (the sibling DEFAULT_NODE_CAP / DEFAULT_MIN_NODE_PX etc. should be audited the same way - some of those may have real callers); or (b) keep the family and add DEFAULT_EMBED_DEPTH_OUT for symmetry.

Recommend (a): the spec IS the single source of truth and every other consumer reads it through EngineDefaults.
