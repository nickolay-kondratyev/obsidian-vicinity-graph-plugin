---
id: nid_yccejkvl0ccqc77olsgg5deka_e
title: "e2e release gate is RED: vicinityGraph.e2e.ts:160 breadcrumb never appears"
status: open
deps: []
links: []
created_iso: 2026-07-26T05:34:46Z
status_updated_iso: 2026-07-26T05:34:46Z
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

