---
id: nid_v5510dvzp7nw9p4qrrpw7d35s_e
title: 'dev-vault: migrate every e2e-MEASURED fixture to the authoritative write_fixture
  writer'
status: in_progress
deps: []
links: []
created_iso: '2026-08-05T01:26:07Z'
status_updated_iso: '2026-08-06T15:55:26Z'
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, dev-env]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
---
Found in adversarial review of `a150312..HEAD` (content-fit node sizing).

PROBLEM: `scripts/setup-dev-vault.sh` seeds `.dev-vault/` with `write_if_missing`, and `scripts/run-e2e.sh` runs Playwright against a COPY of that vault. So a change to a fixture BODY is a silent no-op on every machine whose `.dev-vault/` already exists — the suite then measures different content than the script declares, and passes on a fresh checkout while failing on an older vault with no clue why.

This bit that review concretely: the content-fit sizing change padded `facing-near*.md` with three headings so those nodes reach the 122px preview-reveal floor (the scale `e2e/edgeRouting.e2e.ts`'s facing-side guard is tuned around) — invisible on any pre-existing vault.

FIXED FOR THE FACING CLUSTER ONLY: `write_fixture` (created when absent AND rewritten on drift) was added to `scripts/setup-dev-vault.sh` and applied to `facing/hub-facing.md`, `facing/facing-m*.md` and `facing-near*.md`.

STILL ON `write_if_missing` though an e2e spec measures or counts them — sweep these and decide per file:
- `outline-note.md` / `outline-cover.md` (`e2e/nodeOutline.e2e.ts` asserts outline density and node height bands)
- `note1.md`, `note2.md`, `note3.md`, `projects/*`, `solo/gamma.md`, `assets/*`, `test.canvas`, `test2.canvas` (`e2e/vicinityGraph.e2e.ts` node/edge/attachment counts)
- `hub-medium.md`, `zzdense-*`, `stranded-*`, `p/ep/*` (routing + culling specs)

Keep `write_if_missing` only for fixtures no spec reads, so a human can still enrich them.

## Acceptance Criteria

Every dev-vault fixture an e2e spec reads is written through `write_fixture` (or moved into the harness fixture map), so a fixture edit reaches every existing vault on the next `npm run setup:dev-vault`; fixtures kept on `write_if_missing` are the ones no spec touches, stated in the script.
