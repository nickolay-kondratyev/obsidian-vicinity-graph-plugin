# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE state

Ticket `nid_vqw34wdpmb5qzn52cy6qugqgd_e`. Branch `e2e-controls-panel-disclosure-exhaustiveness`.

## Plan

**Goal**: make an unlisted top-level controls-panel disclosure fail an e2e spec.

**Steps**
1. `e2e/settingsBaseline.ts`: export `CONTROLS_PANEL_DISCLOSURE_SUMMARIES` (mirrors
   `SETTINGS_TAB_SECTION_HEADINGS`) + `PINNED_CENTRALS_SUMMARY` const; update the
   `CONTROLS_PANEL_DISCLOSURES` doc to state the new enforcement mechanism.
2. `e2e/settingsUxVisual.e2e.ts`: new BDD test pinning count + identity + order of
   DIRECT-CHILD `.vicinity-graph-disclosure` of `.vicinity-graph-toolbar__body`,
   filtered against the conditional pinned-centrals disclosure.
3. `npm run check`, `npm test`, `npm run test:e2e -- settingsUxVisual`.
4. Empirical proof: temporary 6th `<Disclosure>` in `GraphToolbar.tsx` → scoped e2e must
   FAIL → revert → green.

**Key DOM facts (verified in source)**
- `GraphToolbar.tsx:42-58` — the five listed disclosures + the conditional
  `Pinned centrals (n)` are all DIRECT children of `.vicinity-graph-toolbar__body`.
- `ForceLayoutSection.tsx:50` — "Advanced spacing" is nested one level deeper →
  excluded structurally by `>`.
- `NodeExclusionSection.tsx:44-56` — its summary is `<span>Node exclusion</span>` plus a
  CONDITIONAL count `<span>` → summary textContent can be `Node exclusion12`.
  => exact-string `toHaveText` IS brittle; use PREFIX regexes instead.

## State

Implementation DONE + review round 1 DONE. See PUBLIC file for results.

## Iteration (review round 1) — done

- S1 tail-anchored regexes (`^…\d*$`) + N1 exact pinned-centrals filter regex → code.
- N2 → ticket `nid_d9j4o9ecp93g5zhury5m1fb43_e`; N3 → ticket `nid_iwd08rsdnsbdziltw1odisuoc_e`.
- Nothing rejected.

**Empirically established DOM fact (do not re-derive):** with the exclusion badge rendered the
summary `textContent` is `"Node exclusion1"` — NO separator, bare integer. Probe:
seed `saveNodeExclusion({enabled:true, patterns:["^projects/beta"]})` + `refreshOpenViews()` in
the fixture, which excludes exactly 1 node from `projects/alpha.md`'s vicinity.

Logs (this iteration): `.tmp/e2e-iter-base.log`, `.tmp/e2e-iter-rename-proof.log`,
`.tmp/e2e-iter-old-form-lets-rename-through.log`, `.tmp/e2e-iter-badge-proof.log`,
`.tmp/e2e-iter-sixth-proof.log`, `.tmp/e2e-iter-final.log`.

## Next steps

None — ticket closure + change_log are TOP_LEVEL_AGENT's.
