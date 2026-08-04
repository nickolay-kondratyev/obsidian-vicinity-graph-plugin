---
id: nid_a5jbonflbm3110gsy6puf18ds_e
title: "Run the e2e suite on BOTH Obsidian versions (floor + pinned) as one gate"
status: open
deps: [nid_fygwk293msqdumkkorz6gmyrh_e]
links: [nid_fygwk293msqdumkkorz6gmyrh_e]
created_iso: 2026-08-04T22:41:18Z
status_updated_iso: 2026-08-04T22:41:18Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: [e2e, testing]
---

Follow-up from `nid_fygwk293msqdumkkorz6gmyrh_e` (which made the e2e Obsidian build an env knob).

## State after that ticket
- `scripts/setup-obsidian-bin.sh` reads `OBSIDIAN_VERSION="${OBSIDIAN_VERSION:-1.12.7}"` — the pinned default is unchanged, one run can target any published build, and `.tmp/obsidian/` caches each version separately.
- `npm run test:e2e:floor` (`scripts/run-e2e-floor.sh`) runs the SAME suite against the manifest floor, deriving the version from `manifest.json` `minAppVersion` via `scripts/obsidian-floor-version.sh` (no second literal).
- Guarded by `e2e/obsidianVersionKnob.test.ts` (part of `npm test`).

So running two versions is possible today, but it is TWO manual commands and nothing makes the pair a gate.

## Ask (from the human on the parent ticket)
> if we are adding this tweakable environment variable we may as well have a follow up ticket to have the tests run with different version of obsidian. With MIN version and with current version, so that we can spot out the issues.

## Scope
- One entry point that runs the suite on BOTH the floor and the pinned default and reports per-version results (e.g. `npm run test:e2e:matrix`), rather than the human remembering two commands.
- Decide what a floor-only red MEANS: some specs match Obsidian's own chrome, which moves between releases (see the 1.13 slider-readout caveat in `scripts/setup-obsidian-bin.sh` and the WHY block in `e2e/settingsUxVisual.e2e.ts`). Either the version-sensitive specs stay mechanism-agnostic (preferred) or the matrix run must state which arm it exercised.
- Cost check first: each version is a full Obsidian download (~200MB, cached) plus a full suite run — decide whether the matrix is a release gate or an every-change gate, and record it in README + CLAUDE.md next to the existing "When to run npm run test:e2e" guidance.

## Baseline observed on 2026-08-04
The floor run (`npm run test:e2e:floor`, Obsidian 1.12.4) was executed once against the current code — record its result in this ticket before designing the matrix, since a matrix over an already-red floor is not worth building until the floor is green or its reds are understood.

## Non-goal
Migrating off Playwright (the parent analysis `nid_ttnk0jv42aiamw8o3x18j3dde_e` concluded: do NOT migrate to wdio-obsidian-service).

