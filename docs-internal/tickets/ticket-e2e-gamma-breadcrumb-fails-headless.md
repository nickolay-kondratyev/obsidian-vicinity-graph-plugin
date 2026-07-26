# Ticket: e2e gamma singleton-breadcrumb test fails (pre-existing on main)

**Status:** CLOSED 2026-07-26 — root-caused as a STALE TEST, not a product bug.

## Resolution

Neither lead below was right. The breadcrumb was **removed by design** in `998fdac`
("snug capped node width + remove folder prefix", 2026-07-23), which deleted the render,
the CSS, `FlowNodeData.breadcrumbFolder`, `breadcrumbFolderOf` **and its unit tests**, and
rewrote the authoritative `docs-internal/plan/high-level-plan.md` sizing model so node
width hugs the title alone. `.vicinity-graph-node__breadcrumb` has existed nowhere in
`src/` since. `npm test` stayed green because the unit tests went with the feature; the
e2e file was simply missed (e2e is not in `npm test`).

So "the breadcrumb element specifically is missing" was correct — it no longer exists.
The `breadcrumbFolderOf` note below is wrong: it was **deleted**, not moved.

The "do NOT weaken the test" instruction below was written on the false premise that the
breadcrumb was live behavior. It is not, and the design source of truth says so, so the
expectation was corrected instead (see `e2e/vicinityGraph.e2e.ts`, which now guards
vault-wide that the folder prefix stays removed and keeps the real trimmed-title
assertion). Gate verified green: 78 passed, 0 failed, 1 env-gated skip.

---

**Original triage (kept for the record) — was:** OPEN — pre-existing; isolated during ticket-03 e2e triage (2026-07-24).
**Scope:** e2e release gate is RED on main independent of the ticket-03 force-collide
change. May be test-infra OR a product regression — needs root-causing.

## Observation

`e2e/vicinityGraph.e2e.ts` › "singleton-folder note shows a folder breadcrumb and its
trimmed frontmatter title" fails under headless Obsidian: the locator
`.vicinity-graph-node[data-path="solo/gamma.md"] .vicinity-graph-node__breadcrumb`
is never found (15s timeout). Because the file is `serial`, the 6 tests after it are
skipped, so the suite reports "2 failed, 7 did not run" together with the already
ticketed radial-gating failure
(`e2e-remove-layeredradial-layout-mode-references-left-by-force-layout-only-ticket`).

## Not a ticket-03 regression (verified 2026-07-24)

- Reproduced with the ticket-03 implementation stashed (`git stash`) on unchanged main
  code, same vault: identical failure (`.tmp/impl2-e2e-baseline.log`).
- Reproduced again after ALSO deleting the ticket-03 dev-vault fixture notes
  (`stranded-*`, `p/ep/**`): identical failure (`.tmp/impl2-e2e-baseline-nofixture.log`).
- Consistent, not flaky: failed in 4/4 observed runs across two agent sessions.

## Leads

- The earlier passing test in the same run ("switching the active file re-renders …")
  counts all 11 nodes of note1's vicinity, which suggests gamma's NODE mounts and the
  BREADCRUMB element specifically is missing — pointing at breadcrumb derivation
  (`breadcrumbFolderOf`, moved during the "node width floored" change) rather than
  viewport culling. Not confirmed — the error-context artifact was inconclusive.
- Alternative: `onlyRenderVisibleElements` culling of an off-viewport gamma in the
  narrow headless pane (would also explain locator-not-found), but that conflicts with
  the 11-node count passing.
- Related-but-different: `ticket-e2e-node-click-flaky-headless.md` (click delivery,
  not element presence).

## Next step

Root-cause with a targeted run that dumps `data-path` + breadcrumb presence for every
mounted node at failure time. Do NOT weaken or delete the test — singleton-folder
breadcrumb is covered behavior.
