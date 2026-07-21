# PHASE C (README + release + tickets) — PRIVATE memory

Role: IMPLEMENTATION_WITH_SELF_PLAN. Docs/tickets only — NO product code.

## Plan
1. Rewrite `README.md` (public-facing) — preserve dev section (add `setup:dev-vault`). DONE
2. Create `docs-internal/RELEASE_CHECKLIST.md`. DONE
3. Ticket triage:
   - CLOSE `_tickets/hover-pin-...` (frontmatter status → resolved + Resolution note). DONE
   - CREATE `docs-internal/tickets/ticket-culling-visual-smoke.md` (B2 [SHOULD] + e2e workaround revert). DONE
   - Leave other tickets as-is (accurate per exploration §6). No over-touch.
4. `npm run check` green. DONE
5. Write PUBLIC handoff. DONE

## Verified facts (cross-checked against source)
- manifest.json: id=obsidian-neighborhood-graph, name="Neighborhood Graph", version 0.1.0,
  minAppVersion 1.12.4, description present, author "Nickolay Kondratyev", isDesktopOnly false. All 7 present.
- versions.json: {"0.1.0":"1.12.4"} — correct format.
- package.json version 0.1.0 matches; license "SEE LICENSE IN LICENSE.md"; private:true.
- LICENSE.md = KSAL-2.3 (source-available, NOT OSI). Human signed off to state plainly.
- scripts/: run-e2e.sh, setup-dev-vault.sh, setup-obsidian-bin.sh all exist.
- package.json scripts: dev, setup:dev-vault, setup:obsidian, build(=check+esbuild prod), check(=tsc -noEmit),
  test(=vitest run && test:sublib), test:e2e, test:watch, test:sublib.
- .gitignore: main.js, styles.css, .dev-vault/, .out/ all ignored (build outputs / screenshots not source-controlled).
- CSS fix (Phase B1) confirmed in src/view/graph-view.css: pin-button pointer-events:none while hidden (line ~226/263),
  display:none below @container (min-height:72px) threshold (line ~269).
- Settings semantics: exploration §3 + high-level-plan lines 62-70. centralDepths nuance verified there +
  CentralDepthRoundTrip.test.ts.

## Decisions
- No metadata changes needed (id + license intentionally kept per CLARIFICATION §5). No #QUESTION_FOR_HUMAN.
- New culling ticket + e2e-workaround revert combined into ONE ticket (task allowed same-or-sibling).
- Ticket format: `_tickets/` uses `ticket` CLI frontmatter; `docs-internal/tickets/` uses prose "**Status:**".
  New ticket → docs-internal prose style (matches e2e/perf tickets). Hover-pin close → update frontmatter
  status + add "## Resolution" prose block (mirrors docs-internal resolved-ticket convention).
- Changelog NOT written here (TOP_LEVEL owns it); proposed wording in PUBLIC.

## Gates
- `.tmp/phaseC-check.log` — npm run check EXIT 0.
