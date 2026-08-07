---
closed_iso: 2026-08-06T16:04:08Z
id: nid_v5510dvzp7nw9p4qrrpw7d35s_e
title: 'dev-vault: migrate every e2e-MEASURED fixture to the authoritative write_fixture
  writer'
status: closed
deps: []
links: []
created_iso: '2026-08-05T01:26:07Z'
status_updated_iso: 2026-08-06T16:04:08Z
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

## Notes

**2026-08-06T16:04:08Z**

RESOLVED.

Swept every fixture in scripts/setup-dev-vault.sh against every e2e spec (mapped
which specs open/measure/count each fixture; several specs supply their OWN
extraFixtures via the harness and touch none of the dev-vault ones).

Migrated to the authoritative write_fixture (created-when-absent AND rewritten
on drift) — every fixture an e2e spec reads or counts:
  - vicinityGraph.e2e.ts: note1/note2/note3.md, test.canvas, test2.canvas,
    projects/alpha.md, projects/beta.md, solo/gamma.md, assets/data.csv,
    assets/report.pdf
  - nodeOutline.e2e.ts: outline-note.md, outline-cover.md
  - edgeRoutingEval.e2e.ts (central hubs it MEASURES + perf budget):
    hub-medium.md + all grp-*/m*.md members, zzdense-hub.md + all zzdense-*.md
    spokes (members define the measured graph even though no spec names one).

Added a binary analog copy_fixture (cmp -s byte-compare, re-copy on drift) and
applied it to the two images specs read: pic.jpg (note1 thumbnail + alpha jpg
chip) and assets/pic2.jpg (outline-cover cover thumbnail). Was copy_if_missing.

KEPT on write_if_missing (no spec reads them; enrichable) — stated in the script
with a WHY comment: the stranded cluster (stranded-main.md, stranded-crowd{1..5}.md,
p/ep/stranded-hub.md, p/ep/stranded-sib.md, p/ep/book/enchiridion.md), exercised
only by the manual smoke-run check, plus the .obsidian config. grep over e2e/
confirms zero spec references to stranded/enchiridion/p/ep — the ticket's guess
that a "culling spec" reads them did not hold.

Also updated the script header + write_fixture docblock to state the new rule
(every spec-read fixture is script-owned) and fixed a now-false comment claiming
"note1.md is never rewritten once present".

No fixture BODY was changed — only the writer choosing WHEN a fixture is
(re)written — so e2e specs measure byte-identical content; suite behavior is
unchanged. Dev-env-only change, so no e2e run warranted.

VERIFIED: bash -n clean; drifted .dev-vault/note1.md (text) and pic.jpg (binary),
re-ran the real script against the existing .dev-vault — both logged
"write ... (declared fixture)" and were restored to declared content
(pic.jpg 50B junk -> 14304B correct image); untouched spec fixtures logged
"keep ... (matches the declared fixture)"; stranded cluster logged
"keep ... (already present)"; build OK. This is exactly the silent-no-op the
ticket describes, now fixed for every existing vault.
