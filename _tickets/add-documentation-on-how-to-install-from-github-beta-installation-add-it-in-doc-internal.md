---
closed_iso: 2026-08-12T18:27:19Z
session_ids: [{"a": "claude", "type": "execution", "id": "602fe4c6-25ef-4e46-915c-a94140e1918d"}, {"a": "claude", "type": "review", "id": "4e4ea694-a23f-4448-b43b-509c07d93c1a"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_vj0hr144r96v38c9nl0vdufor_e
title: "add documentation on how to install from github, beta installation add it in doc internal"
status: closed
deps: []
links: []
created_iso: 2026-08-12T17:29:37Z
status_updated_iso: 2026-08-12T18:27:19Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

How to install the plugin from github tree so that it can be tested prior to being released.

## Resolution

Added **[`docs-internal/beta-install.md`](../docs-internal/beta-install.md)** —
a developer/tester-facing guide to running Vicinity Graph in a real vault before
it reaches the community store. Three routes, since "from github" can mean a
tagged pre-release or an untagged branch:

- **Option A — BRAT** (recommended): install from the repo URL
  `https://github.com/nickolay-kondratyev/obsidian-vicinity-graph-plugin`, track
  latest or pin a tag, auto-updates. Works because `release.yml` publishes the
  raw `manifest.json` / `main.js` / `styles.css` assets on every tag, and the
  workflow enforces tag-name == manifest version (so BRAT's raw-tag match is
  always consistent).
- **Option B — manual**: download the three assets from a Release into
  `.obsidian/plugins/vicinity-graph/`, reload, enable.
- **Option C — from source checkout**: `npm run build` a branch/commit with no
  tag yet, then copy/symlink the three artifacts (same layout as
  `development.md`'s "driving your own vault").

Includes the scratch/backed-up-vault caveat (early betas can change stored-data
shapes without migrations, per CLAUDE.md).

Cross-linked from **CLAUDE.md** ("Orient here first") and
**docs-internal/development.md** (header). Kept out of the user-facing README,
which documents only the store install path.

Assumptions made (non-interactive): documented all three install routes rather
than guessing which the human meant, since the ticket's "from github tree …
tested prior to being released" spans both a pre-release build and a raw source
checkout. BRAT repo cited as `TfTHub/obsidian42-brat`.
## Notes

**2026-08-12T18:28:39Z**

__READY_AS_IS__: docs-only branch; beta-install.md claims (repo slug, manifest version/floor, command name, release-tag/manifest guard, cross-refs) all verified against the repo; no code touched.
