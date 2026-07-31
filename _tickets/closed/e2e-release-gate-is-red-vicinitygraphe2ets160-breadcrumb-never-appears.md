---
closed_iso: 2026-07-26T16:23:42Z
id: nid_yccejkvl0ccqc77olsgg5deka_e
title: "e2e release gate is RED: vicinityGraph.e2e.ts:160 breadcrumb never appears"
status: closed
deps: []
links: [nid_c5acy7gm7lj3afz0vtq79k8bx_e, nid_rdx8ea6w1km9eywyvhpx1v7rt_e]
created_iso: 2026-07-26T05:34:46Z
status_updated_iso: 2026-07-26T16:23:42Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, release-gate]
---

`npm run test:e2e` (the release gate) currently fails in this environment, so 6 further
tests never run. Pre-existing, NOT caused by the `settings-e2e-baseline-dry` branch.

Failing test: `e2e/vicinityGraph.e2e.ts:160` — "singleton-folder note shows a folder
breadcrumb and its trimmed frontmatter title".

Failure output (from a clean `main` worktree at d10b817, `npm run test:e2e -- vicinityGraph`
→ 13 passed, 1 failed):

```
Error: expect(locator).toHaveText(expected) failed
Locator: locator('.vicinity-graph-node[data-path="solo/gamma.md"]').locator('.vicinity-graph-node__breadcrumb')
  - waiting for locator(...) — element never found (15.0s timeout)
> 161 | await expect(noteNode(GAMMA_PATH).locator(".vicinity-graph-node__breadcrumb")).toHaveText("solo/");
```

Evidence it is pre-existing: reproduced on `main` in an isolated git worktree with
zero branch changes; the branch also touches zero `src/` files.

Where to start: `e2e/vicinityGraph.e2e.ts:160`, the breadcrumb render in
`src/view/` node components, and the `solo/gamma.md` fixture in the dev vault
(`scripts/setup-dev-vault.sh`). Note the sibling test at `e2e/vicinityGraph.e2e.ts:85`
("root-folder note carries no breadcrumb") passes, so the suspicion is the singleton
folder fixture or the breadcrumb-suppression rule, not the whole feature.

## Acceptance Criteria

`npm run test:e2e` exits 0 with all specs run (no "did not run" tests), and the
breadcrumb behaviour is either fixed in `src/` or the test corrected with a written
rationale for why the old expectation was wrong.


## Notes

**2026-07-26T16:05:03Z**

Root-caused: STALE TEST, not a missing feature. The folder breadcrumb was removed by design in 998fdac (2026-07-23), which also rewrote high-level-plan.md's sizing model; the e2e file was missed because e2e is not part of npm test. Corrected the expectations in e2e/vicinityGraph.e2e.ts (vault-wide guard that the prefix stays removed + kept the real trimmed-frontmatter-title assertion). Gate green: 78 passed, 0 failed, 1 env-gated skip (externalVault, needs VICINITY_E2E_VAULT). No src/ behavior change.

**2026-07-26T16:23:42Z**

RESOLVED — the failing assertion was stale, not a broken feature.

Root cause: commit 998fdac ('feat(node-real-estate): snug capped node width + remove folder prefix', 2026-07-23) deliberately removed the folder breadcrumb end-to-end (render, CSS, breadcrumbFolderOf helper, its unit tests, and the sentence in high-level-plan.md). The e2e assertions in e2e/vicinityGraph.e2e.ts were left behind. Corroborated by _change_log/2026-07-23_22-16-50Z.md:17.

Fix (no src/ behavior change): retired the stale breadcrumb expectations; kept the still-valid trimmed-frontmatter-title assertion (unit-covered at src/adapters/ObsidianLinkProvider.test.ts:286); replaced the vacuous toHaveCount(0) sibling test with a real regression guard relocated to the note1-active section (e2e/vicinityGraph.e2e.ts:177), whose vicinity contains the ungrouped non-root singleton solo/gamma.md. Non-vacuity proven empirically: temporarily re-threading the removed breadcrumb turned the guard RED while the old placement stayed green.

Acceptance met: npm run test:e2e exit 0 — 78 passed, 1 env-gated skip (externalVault.e2e.ts), 0 'did not run'. npm test 990 passed; check and build exit 0. Independently re-run by the reviewer role.

Follow-ups: nid_rdx8ea6w1km9eywyvhpx1v7rt_e [decide] (ungrouped non-root notes now show no folder identity), nid_c5acy7gm7lj3afz0vtq79k8bx_e (npm test excludes e2e, so feature removals cannot go red in the fast loop).

Change log: 883m2pjjyscv9m3a5a51kvd6d
