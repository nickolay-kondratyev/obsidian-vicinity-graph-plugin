---
closed_iso: 2026-08-10T18:55:53Z
id: nid_ryf59psd6sj5rsj7pha7zc7yk_e
title: 'Release automation: GitHub tag-build workflow + release_update_tag.sh version-bump
  driver'
status: closed
deps: []
links: [nid_o9hmeo92x5dkmtz5lfzr5jk0s_e]
created_iso: '2026-08-10T16:38:33Z'
status_updated_iso: 2026-08-10T18:55:53Z
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

== RESOLUTION (2026-08-10) — DONE ==
Decisions Q1–Q4 implemented at their documented defaults (`.out/current_decision.md`):
Q1 push, Q2 full floor+pinned matrix, Q3 DRAFT release, Q4 headless gates only in CI.
Q5/Q6 (description wording, isDesktopOnly) were out of scope here and already
resolved in `manifest.json` (`isDesktopOnly: true`, "Obsidian" dropped from description).

PART A — `.github/workflows/release.yml` (new): triggers `on: push: tags: ["*"]`,
`permissions: contents: write`, runs on ubuntu-latest with `actions/checkout@v4` +
`actions/setup-node@v4` (Node 20, npm cache) → `npm ci` → `npm run check` →
`npm test` → `npm run build`, then `softprops/action-gh-release@v2` with
`draft: true`, `tag_name/name: ${{ github.ref_name }}`, and `files:` = raw
`manifest.json`, `main.js`, `styles.css`. No e2e in CI (Q4). Header comment
documents WHAT/WHY and the WHY-NOT-e2e rationale.

PART B — `release.sh` → `release_update_tag.sh` (git mv, still executable) extended:
  1. Preflight (cheapest first): resolve default branch via
     `git symbolic-ref refs/remotes/origin/HEAD`; refuse unless on it; refuse on a
     dirty tree (`git status --porcelain`); `git fetch` then refuse if ahead/behind
     via `git rev-list --left-right --count HEAD...origin/<default>`. Actionable
     POLS refusals.
  2. Existing OBSIDIAN_PATH guard + the verbatim two-version e2e matrix (both arms,
     per-version summary). A red matrix exits before any bump/commit/push.
  3. On green: `scripts/bump-version.py` (new helper) revs the PATCH version.
  4. Commit the three-file bump; annotated tag = raw version (no `v`).
  5. Print exactly what will be pushed, then `git push origin <default>` +
     `git push origin refs/tags/<version>` (fires PART A).
Header comment rewritten to describe the driver's full responsibility.

`scripts/bump-version.py` (new): reads package.json version, asserts manifest.json
agrees (refuses on drift), computes patch+1, edits package.json + manifest.json via
targeted regex (byte-preserving, tabs intact) and rebuilds versions.json from its
parsed map with `json.dumps(indent="\t")` adding `"<new>": "<minAppVersion>"`.
Prints ONLY the new version on stdout. Verified on throwaway copies: tabs preserved,
diffs limited to the single version line + one new versions.json entry.

Docs updated in agreement: CLAUDE.md two-version-matrix paragraph, README.md
commands table + release-matrix section, RELEASE_CHECKLIST.md (intro,
§1, §3 bump procedure, §6 rewritten to the tag-triggered DRAFT flow, out-of-scope
bullet). e2e/obsidianVersionKnob.test.ts guard block renamed to
`release_update_tag.sh`. `git grep release.sh` now hits only `_tickets/` +
`_change_log/` history.

Gates run: `npm run check` (exit 0), `npm test` (1817 passed), guard suite
(10 passed), `bash -n`, `py_compile`. The e2e matrix + the live push path were NOT
executed here (needs a display; script refuses off the default branch by design) —
run `./release_update_tag.sh` from a clean, synced `main` to actually cut a release.
