---
id: nid_7u0zgl9oy88jupdvwaiyh7xd2_e
title: 'Fix pre-existing e2e failure: settingsResetReview isolation-matrix locator
  strict-mode violation'
status: in_progress
deps: []
links: []
created_iso: '2026-08-01T05:03:21Z'
status_updated_iso: '2026-08-01T05:35:37Z'
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
e2e/settingsResetReview.e2e.ts:60 ("REVIEW: isolation matrix - each section reset touches only its own keys") fails on unmodified code (verified via git stash on 2026-08-01):

  Error: locator.click: strict mode violation: locator('.vicinity-graph-settings-section').filter({ hasText: 'Depth' }).locator('.vicinity-graph-settings-reset button') resolved to 3 elements

The hasText:"Depth" filter now matches 3 settings sections (likely because other sections mention "Depth" in row labels/descriptions). Tighten the section locator (e.g. match the section heading element exactly instead of hasText over the whole section). This aborts the serial file, so 10 downstream REVIEW specs never run.

Unrelated to ticket nid_r5xy3vuw2kj1v75soe4ffwdjz_e (node-click focus/open), during which it was discovered while running the full e2e gate.
