---
closed_iso: 2026-08-10T16:39:08Z
id: nid_2d67dgjxs5aq6i8hlasxp7tao_e
title: Get ready for release
status: closed
deps: []
links: []
created_iso: '2026-08-10T16:33:07Z'
status_updated_iso: 2026-08-10T16:39:08Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
TASK: **PLAN**. Lets clarify any gaps that exist for this ticket
  (if you need to explore code base use cheaper Explore-cheap sub-agent)
  ask human any questions that come up that require human decision.
  Finally create detailed plan with requirements of what we want to achieve
  and steps of execution and put it into a new ticket 
  (or multiple tickets if it warrants a split across multiple tickets).
  Close this ticket after planning is complete.


Gets this plugin ready for release towards obsidian,
Make sure the naming of the published aligns with obsidian rules (such as having simple name and not having obsidian in it).
Additionally, get the github workflow ready to build artifact upon tagging.
And finally rename the script 'release.sh' to 'release_update_tag.sh' which will 1) make sure we are on default branch and are synced up with origin/deafult branch to start out. Then go through the testing. Once testing is successful it will REV the version (patch version) commit and tag the commit with updated version.

---

## Planning resolution (2026-08-10)

Planning complete. Verified current state, identified gaps, wrote open decisions
to `.out/current_decision.md` (Q1–Q6), and split the work into two implementation
tickets. This ticket is now CLOSED (planning only).

### Verified current state
- `manifest.json`: id `vicinity-graph`, name `Vicinity Graph` — already
  Obsidian-naming compliant (no `obsidian-` prefix, no "Obsidian"/"plugin" in
  name). Version 0.1.1 agrees across package.json / manifest.json / versions.json.
- No `.github/` directory exists (no CI yet).
- `release.sh` is currently a pure two-version e2e test gate, NOT a version bumper.
- Remote default branch = `origin/main`; repo slug = `obsidian-vicinity-graph-plugin`
  (repo name may contain "obsidian"; the naming rule constrains plugin id/name only).

### Follow-up tickets created
- **`nid_ryf59psd6sj5rsj7pha7zc7yk_e`** — Release automation: `.github/workflows/release.yml`
  (build DRAFT release + raw assets on tag push) AND rename `release.sh` →
  `release_update_tag.sh` (preflight branch/sync → test matrix → patch-bump 3 files
  → commit → tag → push). Includes doc-sync (README/CLAUDE.md/RELEASE_CHECKLIST).
- **`nid_o9hmeo92x5dkmtz5lfzr5jk0s_e`** — Obsidian naming/metadata compliance pass
  (reword description to drop "Obsidian"; decide `isDesktopOnly`).

Both tagged `decide` — they carry the open human decisions (see
`.out/current_decision.md`). They are linked to each other.

### Open decisions awaiting human (in `.out/current_decision.md`)
Q1 push tag/commit from script? Q2 test scope in script (full matrix vs light)?
Q3 draft vs published release? Q4 run tests in CI? Q5 description rewording?
Q6 isDesktopOnly for mobile. Recommended defaults provided for each.
