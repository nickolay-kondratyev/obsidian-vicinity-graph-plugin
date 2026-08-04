---
closed_iso: 2026-08-04T22:42:24Z
id: nid_fygwk293msqdumkkorz6gmyrh_e
title: Make the e2e Obsidian version an env knob (OBSIDIAN_VERSION) + add a minAppVersion-floor
  run
status: closed
deps: []
links: [nid_ttnk0jv42aiamw8o3x18j3dde_e, nid_a5jbonflbm3110gsy6puf18ds_e]
created_iso: '2026-08-04T17:59:07Z'
status_updated_iso: 2026-08-04T22:42:24Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: [e2e, testing]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-3
---
Follow-up from `nid_ttnk0jv42aiamw8o3x18j3dde_e` (Analyze the current state of e2e).

Today `scripts/setup-obsidian-bin.sh` hard-codes `OBSIDIAN_VERSION="1.12.7"`, so `npm run test:e2e` only ever exercises ONE Obsidian build. `manifest.json` declares `minAppVersion: 1.12.4` as a FLOOR, and nothing verifies the plugin still works there, nor on a newer release.

Scope (small, keeps Playwright):
- Make the pinned version overridable: `OBSIDIAN_VERSION="${OBSIDIAN_VERSION:-1.12.7}"` in `scripts/setup-obsidian-bin.sh` (keep 1.12.7 as the default so the default run is unchanged and reproducible). Cache dir already keys off the version, so multiple versions coexist under `.tmp/obsidian/`.
- Document in README (e2e section) that `OBSIDIAN_VERSION=1.12.4 npm run test:e2e` runs the manifest floor.
- Optionally: derive the floor from `manifest.json.minAppVersion` rather than a second literal, so the two never drift.

Caveat already recorded in `scripts/setup-obsidian-bin.sh`: on 1.13+ the slider value-readout spec switches to a never-verified matching arm — expect noise when trying newer versions.

Non-goal: migrating to wdio-obsidian-service (analysis in the parent ticket concluded: do NOT migrate).

---------------------------------------------------------------------------------
HUMAN: I am thinking that if we are adding this tweakable environment variable we may as well have a follow up ticket to have the tests run with different version of obsidian. With MIN version and with current version, so that we can spot out the issues.

---------------------------------------------------------------------------------
## RESOLUTION (2026-08-04) — done

### What shipped
- `scripts/setup-obsidian-bin.sh`: `OBSIDIAN_VERSION="${OBSIDIAN_VERSION:-1.12.7}"`. Default
  (and thus the default run) unchanged and reproducible; one run can now target any published
  build. The cache dir already keys off the version, so builds coexist under `.tmp/obsidian/`.
- `scripts/obsidian-floor-version.sh` (new): prints `manifest.json` `minAppVersion`. This is the
  "derive, don't duplicate" option from the scope — there is NO second version literal anywhere.
- `scripts/run-e2e-floor.sh` (new) + `npm run test:e2e:floor`: same suite, same flags, floor
  binary. Extra args pass through. It warns (and does NOT pretend) when `OBSIDIAN_PATH` is set,
  since run-e2e.sh honours that binary and the floor download would be skipped silently.
- `e2e/obsidianVersionKnob.test.ts` (new, part of `npm test`): 5 BDD guards — the `:-` default
  form, the pinned literal declared exactly once, the floor script actually printing
  `manifest.minAppVersion` (executed, not scanned), and the floor runner naming no version
  literal while exporting `OBSIDIAN_VERSION`. Written failing first.
- Docs: README (script table + new "Running against another Obsidian version" section covering
  both `npm run test:e2e:floor` and `OBSIDIAN_VERSION=<v> npm run test:e2e`, the
  `OBSIDIAN_PATH` interaction, caching, and how to read version-dependent noise), `CLAUDE.md`
  commands block, `docs-internal/notes/e2e-obsidian-docker-setup.md`.

### Verification
- `npm run check` — green. `npm test` — 1603 tests / 117 files green.
- `npm run test:e2e:floor` — downloaded Obsidian **1.12.4** and ran the full suite: **135 passed**.
  So the manifest floor is GREEN against current code; the declared floor is now a verified fact,
  not an assumption. The 1.13 slider-readout caveat did not bite (that arm is about NEWER builds).
- `npm run test:e2e` (default, pinned 1.12.7) — **135 passed**, so the knob did not disturb the
  default path. Both versions now sit side by side in `.tmp/obsidian/` and neither re-downloads.

### Follow-up (the HUMAN ask on this ticket)
Created `nid_a5jbonflbm3110gsy6puf18ds_e` — "Run the e2e suite on BOTH Obsidian versions
(floor + pinned) as one gate": one entry point + a decision on whether that matrix is a release
gate or an every-change gate, plus how to read a floor-only red. Linked, and depends on this one.

### Env note (unrelated, fixed in passing)
`node_modules` was stale — `@testing-library/react` was declared in `package.json` but not
installed, so `npm run check` and `npm test` were red BEFORE any change here. `npm install` fixed
it; no dependency edit was made.
