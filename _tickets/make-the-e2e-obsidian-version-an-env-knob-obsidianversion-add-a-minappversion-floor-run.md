---
id: nid_fygwk293msqdumkkorz6gmyrh_e
title: "Make the e2e Obsidian version an env knob (OBSIDIAN_VERSION) + add a minAppVersion-floor run"
status: open
deps: []
links: [nid_ttnk0jv42aiamw8o3x18j3dde_e]
created_iso: 2026-08-04T17:59:07Z
status_updated_iso: 2026-08-04T17:59:07Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: [e2e, testing]
---

Follow-up from `nid_ttnk0jv42aiamw8o3x18j3dde_e` (Analyze the current state of e2e).

Today `scripts/setup-obsidian-bin.sh` hard-codes `OBSIDIAN_VERSION="1.12.7"`, so `npm run test:e2e` only ever exercises ONE Obsidian build. `manifest.json` declares `minAppVersion: 1.12.4` as a FLOOR, and nothing verifies the plugin still works there, nor on a newer release.

Scope (small, keeps Playwright):
- Make the pinned version overridable: `OBSIDIAN_VERSION="${OBSIDIAN_VERSION:-1.12.7}"` in `scripts/setup-obsidian-bin.sh` (keep 1.12.7 as the default so the default run is unchanged and reproducible). Cache dir already keys off the version, so multiple versions coexist under `.tmp/obsidian/`.
- Document in README (e2e section) that `OBSIDIAN_VERSION=1.12.4 npm run test:e2e` runs the manifest floor.
- Optionally: derive the floor from `manifest.json.minAppVersion` rather than a second literal, so the two never drift.

Caveat already recorded in `scripts/setup-obsidian-bin.sh`: on 1.13+ the slider value-readout spec switches to a never-verified matching arm — expect noise when trying newer versions.

Non-goal: migrating to wdio-obsidian-service (analysis in the parent ticket concluded: do NOT migrate).

