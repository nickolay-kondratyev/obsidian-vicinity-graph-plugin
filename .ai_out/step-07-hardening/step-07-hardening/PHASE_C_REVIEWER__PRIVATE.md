# PHASE C — IMPLEMENTATION_REVIEWER (private working notes)

## Scope of change (git working tree vs HEAD)
- `README.md` — REWRITTEN (dev-only doc → full public doc).
- `docs-internal/RELEASE_CHECKLIST.md` — CREATED.
- `_tickets/hover-pin-button-blankets-tiny-nodes-and-eats-the-open-click.md` — status open→resolved + Resolution block.
- `docs-internal/tickets/ticket-viewport-culling-visual-smoke.md` — CREATED.
- `.ai_out/.../IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` + `__PRIVATE.md` — handoff docs.
- NO product/engine/view/manifest/package/versions changes. Scope discipline PASS.

## Gate
- `npm run check` → EXIT 0 (`.tmp/reviewC-check.log`).

## Accuracy verification (source cross-checks)

### Settings model (BLOCKING-critical section) — ALL ACCURATE
- Pin-on-toggle per-field, no equality-with-default check: confirmed `src/view/settingsWritePlan.ts:11-14` (comment) + `planSettingsWrite` never inspects value vs global. ✓
- Per-direction depth (outbound/incoming independent): `DIRECTION_DEPTH_FIELD[direction]` mapping. ✓
- Reset-to-global deletes field → inherit: `DocDataMutations.setDepthField` "`undefined` REMOVES it" + `setOrRemove` deletes on undefined. ✓
- centralDepths keyed by pinned central's docid, stored in the VIEWING note's doc data: `settingsWritePlan` central-depth → `setCentralDepthField(mainFile, centralDocid, ...)`; `DocDataMutations.setCentralDepthField` writes into `doc.centralDepths[centralDocid]` where `doc` = MAIN(Y). README §Pinning "saved inside Y's own per-note data, keyed by the pinned note's id" — EXACT. ✓
- Pinning = extra central, global set, survives restart, stored in data.json: matches plan lines 63/74 + EXPLORATION §3. ✓
- pin/unpin from hover button OR right-click: `planNodePinAction` (main→none, regular→pin, pinned→unpin) shared by both surfaces. ✓
- Restart-lag caveat + ticket link: matches `ticket-pinned-central-status-lags-after-restart.md` (exists, OPEN). ✓

### Two-weaknesses / V1 scope / V2 roadmap — FAITHFUL
- Two weaknesses verbatim (plan line 3) — exact.
- V1 scope bullets (plan 14-19) — faithful; ONE bullet trims trailing clause "once the data format settles" (→ "come later"). Semantically intact; the dropped idea reappears in the V2 bullet "(the data format is already shaped for it)". NIT.
- V2 roadmap (plan 129-135) — all six bullets faithful (only trivial article additions).

### Install — no false claims
- Explicitly "not yet in the Obsidian community plugin store." ✓
- Manual path uses correct `.obsidian/plugins/obsidian-neighborhood-graph/` (matches manifest id). ✓
- minAppVersion anchor `#minappversion-manifestjson` resolves to the `### minAppVersion (manifest.json)` heading. ✓

### Development section — fresh-clone flow verified against package.json + scripts
- Order: submodule init → npm install → npm run setup:dev-vault → npm run dev. Correct (install needs submodule for `file:` dep; setup needs deps).
- Every command exists: dev, setup:dev-vault, build, check, test, test:e2e — all in package.json. Scripts table accurate.
- `setup-dev-vault.sh` runs `npm run build` and copies artifacts (line 137-140), idempotent — README description accurate.

### License — plain, short, points to LICENSE.md; not relicensed
- KSAL-2.3, "source-available … not an OSI open-source license", LICENSE.md authoritative. Matches CLARIFICATION §5. ✓

## Release checklist — accurate
- 7 manifest fields correct (id/name/version/minAppVersion/description/author/isDesktopOnly all present). ✓
- versions.json shape `{version: minAppVersion}` correct; current `{"0.1.0":"1.12.4"}`. ✓
- obsidian- id prefix marked KNOWN/DEFERRED (not fix-now), per CLARIFICATION §5. ✓
- Store submission OUT OF SCOPE. ✓
- Version agreement across 3 files documented; all agree at 0.1.0. ✓
- GitHub Release: tag == raw version (no v prefix), attach 3 raw assets — correct Obsidian requirement. ✓
- isDesktopOnly:false untested-on-mobile flagged. ✓ KSAL note present. ✓

## Ticket triage — correct
- hover-pin ticket resolved; Resolution points to Phase B1 CSS fix. Verified `src/view/graph-view.css`: pin-button `pointer-events:none` while hidden (263), `@container (min-height:72px)` reveal (269-270), `pointer-events:auto` on hover/focus (277). Matches description EXACTLY. YAML frontmatter (id nid_…) preserved; status_updated_iso bumped. ✓
- New culling-smoke ticket format matches existing docs-internal/tickets style (`# Ticket:` + `**Status:**`). ✓
- No ticket wrongly closed.

## Verdict: APPROVE-WITH-NITS. 0 blocking.
