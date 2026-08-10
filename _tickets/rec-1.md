---
closed_iso: 2026-08-10T21:39:56Z
id: nid_jcl7f8gzco0c04clhv8omo2aj_e
title: rec-1
status: closed
deps: []
links: []
created_iso: '2026-08-10T21:37:34Z'
status_updated_iso: 2026-08-10T21:39:56Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
Fix the following rec that came up during obsidian cloud check, on their release.

```
Recommendation
Missing GitHub artifact attestations for release assets
main.js, styles.css
Artifact attestations let users cryptographically verify the provenance of the release assets, proving they were built from the source repository. Learn more
```

## Resolution (closed)

Added GitHub artifact attestations to the tag-triggered release workflow
(`.github/workflows/release.yml`):

- Granted the `release` job `id-token: write` + `attestations: write`
  permissions (alongside the existing `contents: write`).
- Inserted an `actions/attest-build-provenance@v2` step AFTER `npm run build`
  and BEFORE the GitHub Release step, attesting `main.js` and `styles.css` —
  the two built assets the Obsidian cloud check flagged. `manifest.json` is
  source-controlled (not built in CI), so it is not attested.
- Updated `docs-internal/RELEASE_CHECKLIST.md` §6 to document the attestation
  step and a post-release verification (`gh attestation verify main.js`).

Effect: each release run now emits provenance attestations for the two build
outputs, so users can cryptographically verify they were built from this repo.
Verified end-to-end on the next tag push (attestations run on GitHub Actions,
not locally).
