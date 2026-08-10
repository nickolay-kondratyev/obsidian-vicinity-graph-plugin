---
id: nid_ryf59psd6sj5rsj7pha7zc7yk_e
title: 'Release automation: GitHub tag-build workflow + release_update_tag.sh version-bump
  driver'
status: in_progress
deps: []
links: [nid_o9hmeo92x5dkmtz5lfzr5jk0s_e]
created_iso: '2026-08-10T16:38:33Z'
status_updated_iso: '2026-08-10T18:49:52Z'
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [release, ci, decide]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
Deliver release automation for the Vicinity Graph Obsidian plugin. Split out of planning ticket nid_2d67dgjxs5aq6i8hlasxp7tao_e ("Get ready for release").

OPEN DECISIONS live in .out/current_decision.md (Q1-Q4). Defaults below are ASSUMED; confirm with human before implementing. Tagged `decide`.

== PART A: GitHub Actions release workflow ==
There is currently NO .github/ directory. Create `.github/workflows/release.yml` modeled on the obsidian-sample-plugin convention:
- Trigger: on push of a tag (e.g. `on: push: tags: ["*"]`). Obsidian matches the RAW version string with no `v` prefix, and release_update_tag.sh (Part B) creates exactly that tag.
- Steps: checkout -> setup-node (match repo Node; use `npm ci`) -> `npm run check` -> `npm test` (fast headless gates; DEFAULT per Q4 — do NOT run the Playwright e2e matrix in CI, it needs a real Obsidian download + display and is the LOCAL gate) -> `npm run build` (produces main.js + styles.css, which are gitignored build artifacts) -> create a GitHub Release for the pushed tag attaching RAW assets `manifest.json`, `main.js`, `styles.css` (not just inside the source zip; Obsidian/BRAT fetch the raw files).
- DEFAULT per Q3: create a DRAFT release (human reviews + publishes). Use `softprops/action-gh-release` or `gh release create --draft` with GITHUB_TOKEN.
- Reference docs-internal/RELEASE_CHECKLIST.md §6 for the raw-asset requirement.

== PART B: rename release.sh -> release_update_tag.sh and repurpose ==
Current /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1/release.sh is a PURE two-version e2e test gate (git-tracked). Rename it to release_update_tag.sh and extend it into a version-bump-and-tag driver that does, in order:
  1. Preflight: assert current branch IS the default branch (origin default = `main`; resolve via `git symbolic-ref refs/remotes/origin/HEAD`), working tree is CLEAN, and local is in sync with origin/main (fetch, then compare — refuse if ahead/behind/diverged). Clear, actionable refusal messages (POLS).
  2. Testing: run the EXISTING release gate (check -> npm test -> e2e matrix on pinned + floor). DEFAULT per Q2 = keep the full matrix; reuse current logic verbatim. Keep the existing OBSIDIAN_PATH refusal guard.
  3. Only if green: REV the PATCH version and update ALL THREE files coherently (RELEASE_CHECKLIST.md §3): package.json `version`, manifest.json `version`, and add a versions.json entry `"<newVersion>": "<minAppVersion>"` (minAppVersion read from manifest.json). Do this with a small helper (prefer Python per repo bash policy for non-trivial JSON edits; preserve the tab indentation these files use).
  4. Commit the three-file bump, then create an annotated tag equal to the new RAW version string (no `v` prefix).
  5. DEFAULT per Q1: push the commit to origin/main and push the tag (`git push --follow-tags` or explicit), which fires the Part A workflow. Print exactly what will be pushed before doing it.
- Update the git-tracked header comment in the script to describe the new responsibility; the old header only describes the test matrix.

== Docs to keep in agreement (repo rule: README + CLAUDE.md + script header must match) ==
- Update every reference to `release.sh` -> `release_update_tag.sh`: CLAUDE.md (the `./release.sh` mentions in the Commands / two-version-matrix section), README.md, docs-internal/RELEASE_CHECKLIST.md (§1 and §6, and the "Release automation" out-of-scope bullet — automation now EXISTS). grep the repo for `release.sh` and fix all hits.
- RELEASE_CHECKLIST.md §6 currently says "no gh release automation, do by hand" — rewrite to describe the new tag-triggered flow.

== Acceptance ==
- `.github/workflows/release.yml` exists; a pushed tag builds and produces a DRAFT release with the three raw assets.
- release.sh no longer exists; release_update_tag.sh does, is executable, and its preflight/bump/tag/push behavior matches the above.
- `git grep -n "release.sh"` returns only intended historical references (ideally none in docs).
- Version bump helper edits all three files atomically and keeps tab indentation.
- Add a change_log entry after completion.
