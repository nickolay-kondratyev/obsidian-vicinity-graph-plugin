---
id: nid_0jzq3ev878kjd0zhn3zxyje8q_e
title: 'e2e: .dev-vault/.obsidian/workspace.json leaks manual-QA layout into every
  e2e vault copy'
status: in_progress
deps: []
links: [nid_6mack3e3ql9qtaxf1edezjpfs_e]
created_iso: '2026-07-27T16:28:40Z'
status_updated_iso: '2026-07-29T18:38:43Z'
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-4
---
`ObsidianHarness.prepareVaultCopy` (`e2e/obsidianHarness.ts`) copies `.dev-vault/` wholesale into the throwaway vault copy (`.tmp/e2e/vault`) with `fs.cpSync`, then wipes the plugin's persisted state (`.obsidian/plugins/vicinity-graph/data.json` and, since ticket nid_6mack3e3ql9qtaxf1edezjpfs_e, `.obsidian/plugins/vicinity-graph/doc-data/`).

Nothing wipes `.obsidian/workspace.json`. `.dev-vault/` is NOT git-tracked (`git ls-files .dev-vault` is empty), so every byte of its `.obsidian/` is whatever a human left behind during manual QA — including a ~6 KB `workspace.json` recording open leaves, split layout, active file, sidebar state and recent files. That state rides `cpSync` into EVERY e2e run.

Why it matters: it is the same class of leak (manual QA -> e2e run) as the `doc-data/` pin leak, and it is nondeterministic across machines/humans. Today nothing asserts on it and the harness already defensively detaches stray right-split leaves after launch (see the leaf-detaching block in `e2e/obsidianHarness.ts`), so no current spec is known to be affected — but any future assertion about layout, active file, or which leaves exist would be silently coupled to one human's vault.

WHY deferred: raised as SHOULD-FIX #2 in the review of ticket nid_6mack3e3ql9qtaxf1edezjpfs_e and explicitly ruled out of that ticket's scope by the reviewer — it is not plugin state, carries no pins, and no assertion depends on it today.

Candidate fix (evaluate, do not assume): delete `<copy>/.obsidian/workspace.json` in `prepareVaultCopy` alongside the two plugin-state wipes, letting Obsidian regenerate a default layout. Must be verified not to break specs that assume a particular starting layout, and the deletion must name the `VAULT_COPY_DIR` module constant literally so the destructive-call source scan in `e2e/vaultTarget.test.ts` accepts it. Consider also whether the post-launch leaf-detaching workaround becomes redundant.

## Acceptance Criteria

Either (a) the e2e vault copy no longer inherits `.dev-vault/.obsidian/workspace.json`, with `npm test`, `npm run check` and a full `npm run test:e2e` green against a `.dev-vault` deliberately left in a messy layout (extra splits, non-default active file); or (b) a written WHY-NOT recorded in the `prepareVaultCopy` doc comment explaining why the leak is deliberately tolerated.
