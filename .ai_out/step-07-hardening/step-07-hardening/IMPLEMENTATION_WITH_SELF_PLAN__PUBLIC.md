# PHASE C (README + release readiness + ticket triage) — Reviewer handoff

Role: IMPLEMENTATION_WITH_SELF_PLAN. Docs + tickets ONLY — **zero product/engine/view
code changed**. NOT committed (working tree left dirty for review). Phase B handoff
archived at `PHASE_B_IMPLEMENTATION__PUBLIC.md`.

## Gate
- `npm run check` → EXIT 0 (`.tmp/phaseC-check.log`). No TS touched; run as a safety net.
- No `npm test` / `npm run build` needed (no source change). Not run.

## Files changed / created

| File | Action | Notes |
|---|---|---|
| `README.md` | REWRITTEN | Public-facing doc; dev section preserved + `setup:dev-vault` added. |
| `docs-internal/RELEASE_CHECKLIST.md` | CREATED | Obsidian community-plugin artifact checklist. |
| `_tickets/hover-pin-button-blankets-tiny-nodes-and-eats-the-open-click.md` | CLOSED | frontmatter `status: open`→`resolved` + `## Resolution` block (Phase B1). |
| `docs-internal/tickets/ticket-viewport-culling-visual-smoke.md` | CREATED | Phase B review [SHOULD] #1 + e2e-workaround-revert note. |

## README section list (all required sections present)
1. Title + one-line intro.
2. **What it is / Why** — verbatim two-weaknesses framing ("every node looks the same, and there is no grouping") + informative-nodes / folder-grouping / depth control / pinning + sidebar placement.
3. **Install** — manual (copy manifest.json + main.js + styles.css into `.obsidian/plugins/obsidian-neighborhood-graph/`) + BRAT. Explicitly states NOT in community store yet. minAppVersion note.
4. **Settings model** — global defaults (depth / sizing global-only / grouping / node cap 100); per-note depth overrides (touching a control pins per-field even if == global default; reset-to-global deletes); pinning = extra central, global set survives restarts; the centralDepths nuance (pinned central's depth saved in the *viewing* note Y's data, keyed by pinned id); restart-lag caveat with ticket link.
5. **V1 scope / limits** — verbatim plan bullets + node cap 100 + canvas text-node skip.
6. **V2 roadmap** — verbatim plan "Deferred to V2+" list.
7. **Development** — fresh clone → running dev build (submodule init, npm install, setup:dev-vault, dev) + scripts table (verified against package.json) + e2e section (preserved, accurate) + minAppVersion rationale + submodule note.
8. **License** — one short paragraph: KSAL-2.3, source-available (not OSI), LICENSE.md authoritative.

Accuracy: every command verified against `package.json` scripts + `scripts/*.sh`. `setup:dev-vault` added to the fresh-clone flow (it builds + copies + seeds `.dev-vault/`, idempotent). Screenshots left as a "TBD" note (no binaries source-controlled; `.out/` is gitignored).

## Release checklist location
`docs-internal/RELEASE_CHECKLIST.md`. Covers: green gates (check/test/build/e2e); pre-ship gates (step-06 human smoke still OPEN — flagged as a gate, not this step's exit criterion); version agreement across package.json/manifest.json/versions.json; manifest 7-field correctness (obsidian- id prefix marked KNOWN/DEFERRED per CLARIFICATION §5; isDesktopOnly:false untested-on-mobile flagged); versions.json format; manual GitHub Release step (tag == version, attach 3 raw assets); KSAL-2.3 license note. Store submission explicitly OUT OF SCOPE (repo move + rename planned).

## Tickets
**Closed:** `_tickets/hover-pin-button-blankets-tiny-nodes-and-eats-the-open-click.md`
→ `resolved`, pointing to Phase B1 CSS fix (`src/view/graph-view.css`: pointer-events:none while hidden + 72px container-query `display:none`) and the Phase B PUBLIC/REVIEW docs.

**Created:** `docs-internal/tickets/ticket-viewport-culling-visual-smoke.md`
→ Phase B review [SHOULD] #1: `onlyRenderVisibleElements` needs a one-time visual/e2e smoke (folder-group subflows + edges when panned off-screen; its safety rests on RF-internal `forceInitialRender`, no automated guard). Same ticket carries the e2e ALPHA-graph-workaround revert now B1 is fixed.

**Reviewed, left as-is (accurate — NOT touched):** the other parked tickets in EXPLORATION_readme §6 are correctly categorized — `ticket-eslint-adoption` (OPEN), `ticket-e2e-view-type-constant-dedup` (OPEN), `ticket-folder-color-ux-design-pass` (OPEN→V2), `ticket-node-drag-reposition` (CLOSED, out-of-V1→V2), `ticket-controls-optimistic-input-latency` (OPEN), `ticket-dev-vault-recognizable-thumbnail` (OPEN), `ticket-edge-arrowhead-and-badge-visual-polish` (RESOLVED, pending human real-render confirm), `ticket-e2e-node-click-flaky-headless` (OPEN, test-infra), `ticket-pinned-central-status-lags-after-restart` (OPEN — surfaced in README caveat), `ticket-step-03/04/05-human-smoke-run` (DONE), `ticket-step-06-controls-human-smoke-run` (OPEN — release gate). No stale/miscategorized ones found; none wrongly closed. Pareto: no over-touch.

## Proposed changelog wording (TOP_LEVEL writes the single entry — NOT written here)
Suggested entry for `docs-internal/CHANGELOG.md`:

> ## <date> — step-07-hardening: ship-readiness — dense fixtures, perf pass, public README
>
> Confidence at the edges before V1. Committed deterministic dense-vault fixture generator + engine edge-case suite (Phase A); performance pass (Phase B) — hover-pin CSS fix so the transparent pin button no longer eats click-to-open on tiny nodes ([[_tickets/hover-pin-button-blankets-tiny-nodes-and-eats-the-open-click]] resolved), viewport culling (`onlyRenderVisibleElements`), rebuild-debounce + elk-skip-rate + 500-file orphan-sweep tests; and a public **README** (what it is / install / settings model / V1 scope / V2 roadmap / dev setup / KSAL-2.3) plus `docs-internal/RELEASE_CHECKLIST.md` (Phase C). New follow-up: [[tickets/ticket-viewport-culling-visual-smoke]]. Store submission deferred (repo move + rename planned).
>
> Verified: `npm run check` + `npm test` + `npm run build` green.

(TOP_LEVEL: reconcile exact test counts + date at closeout.)

## Metadata / #QUESTION_FOR_HUMAN
- **No metadata files changed.** manifest.json / versions.json / package.json are all correct and internally consistent (version 0.1.0, minAppVersion 1.12.4). The `obsidian-` id prefix and KSAL-2.3 license are intentional per CLARIFICATION §5 — kept, not changed.
- **No `#QUESTION_FOR_HUMAN`.**

## Reviewer accuracy-check pointers
- Settings nuance (centralDepths on the *viewing* note's data) — source of truth: high-level-plan lines 62-70 + EXPLORATION §3 + `CentralDepthRoundTrip.test.ts`.
- README dev commands — cross-check `package.json` scripts + `scripts/setup-dev-vault.sh` (idempotent, builds + seeds vault).
- Node cap default 100, sizing global-only, canvas text-node skip — plan lines 14-19 + 48.
