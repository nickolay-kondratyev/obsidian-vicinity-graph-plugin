---
closed_iso: 2026-08-11T02:36:44Z
id: nid_dj6lngqbfiel5khjw58ujar2o_e
title: Adjust readme that vicinity graph is in the obsidian communit plugins
status: closed
deps: []
links: []
created_iso: '2026-08-11T02:32:31Z'
status_updated_iso: 2026-08-11T02:36:44Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Adjust the readme to reflect that obsidian graph is in community plugins.

Also take out the info that is not customer focused, keep readme customer focused. Move the non customer focused info either under /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/docs-internal (if its deeper) or into appropriate CLAUDE.md if it should be auto loaded (keep claude.md slim though).

## Resolution (closed)

- **README `Install` section** rewritten: no longer says "not yet in the
  community plugin store." Now leads with **Community plugins (recommended)**
  (Settings → Community plugins → Browse → search "Vicinity Graph" → Install →
  Enable), with **BRAT** (pre-release) and **Manual** as secondary paths. The
  stale `minAppVersion` anchor link was replaced with a plain "Requires Obsidian
  1.12.4 or newer" line.
- **Developer-facing content moved out of README** into a new
  `docs-internal/development.md`: the whole `## Development` section (dev-build
  steps, `## Scripts` table, the full `e2e suite` docs including
  `OBSIDIAN_VERSION` / release-matrix / `VICINITY_E2E_VAULT` subsections), plus
  the `minAppVersion` and `stable-ids-for-obsidian` dependency subsections. The
  README now keeps only a one-line `## Development` pointer to that file, so the
  README stays customer-focused (what it is, install, usage, settings, pinning,
  node size/exclusion/contents, scope/limits, roadmap, license).
- **CLAUDE.md** "Orient here first" list gained a pointer to
  `docs-internal/development.md`; the README bullet was trimmed to "user-facing
  docs" (dropping "dev + e2e setup"). CLAUDE.md's own `## Commands` block was
  left as-is (already slim).
- Verified no dangling in-README anchor links remain (grep for
  `minappversion` / removed section anchors).
