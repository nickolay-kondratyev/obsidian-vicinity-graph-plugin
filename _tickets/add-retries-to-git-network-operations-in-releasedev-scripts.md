---
id: nid_c7lyivu84154j0rp3azjw2ssp_e
title: "Add retries to git network operations in release/dev scripts"
status: open
deps: []
links: []
created_iso: 2026-08-15T01:12:15Z
status_updated_iso: 2026-08-15T01:12:15Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [release, tooling]
---

PROBLEM: git network operations in our scripts have NO retry on transient network failure, so a flaky connection can abort a release run mid-way or leave a confusing error.

SURFACES (grep for git fetch/push/pull/clone/submodule across scripts):
- release_update_tag.sh:79 — `git fetch --quiet origin <default-branch>` (pre-release freshness check): a transient failure aborts the release before any work.
- release_update_tag.sh:207 — `git push --atomic origin <branch> refs/tags/<version>`: the CRITICAL one. This push IS the publish decision (fires .github/workflows/release.yml). A transient failure here strands a fully-validated release AFTER the version bump + tag were committed locally — the operator must know to manually re-push. Atomic push is idempotent-safe to retry as-is (all-or-nothing).
- Any `git submodule update --init e2e` invocations in scripts (network clone/fetch under the hood).
- .github/workflows: actions/checkout has its own retries; verify any raw git steps we add later follow suit.

FIX SHAPE: one small retry helper in the script (e.g. retry 3 times with short backoff, only for these network commands — NOT for local git ops, where a failure means a real problem). Keep it bash-simple; print each retry attempt so the operator sees what happened. On final failure of the push, print the exact manual re-push command so the stranded-tag state is recoverable without archaeology.

ACCEPTANCE: kill-switch test by pointing origin at an unreachable URL — fetch/push retry the declared number of times with visible attempts, then fail with actionable copy; a mid-run recovery instruction names the exact command.

