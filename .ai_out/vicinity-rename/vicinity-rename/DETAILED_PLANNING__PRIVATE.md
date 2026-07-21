# PLANNER — private notes (vicinity-rename)

## Ground-truth verified against repo (not just exploration doc)
- Case-form line counts (tracked, excl exclusions): neighborhood 317, Neighborhood 167, NEIGHBORHOOD 15, neighbourhood 0.
- **12** files (not 8) have a `neighborhood` basename — exploration undercounted (it grouped `.test`/`.denseFixtures` variants). Full list captured in the plan.
- **PLURAL edge case (critical):** `neighborhoods` appears 4× in prose (README.md:24, high-level-plan, step-02, step-07). Naive substring replace → "vicinitys". MUST replace plural BEFORE singular. No `Neighborhoods`/`NEIGHBORHOODS` found, but handle for robustness.
- Substring-safety: "neighborhood" is a strict superset of "neighbor" only via the `hood` tail; bare `neighbor(s)/neighboring/neighbour(s)` NEVER contains the substring "neighborhood", so a literal-substring replace of "neighborhood" can't hit the graph term. No word-boundary gymnastics needed — but plural-first ordering IS needed.
- camelCase symbols handled by content replace (not file renames): `neighborhoodGraphToElk`, `neighborhoodGraphToFlow` (elkMapping.ts/flowMapping.ts + tests + GraphViewController), type `NeighborhoodGraph` (engine/types.ts), class `NeighborhoodGraphPlugin` (main.ts).
- Import specifiers referencing the 12 renamed files are plain tokens (`./NeighborhoodTraversal`) → auto-fixed by the same content replace; no separate import-fixup pass beyond the global replace.
- ID/literal strings: view-type `neighborhood-graph-view` (2 sites: NeighborhoodGraphView.tsx + duplicated in e2e/obsidianHarness.ts), command ids `open-neighborhood-graph` & `debug-log-neighborhood-graph`, `OPEN_GRAPH_COMMAND_ID` template in harness. All plain tokens → auto-handled.
- CSS: ~60 `.neighborhood-graph-*` classes in graph-view.css, referenced by identical literals in *.tsx and all e2e specs → all swap consistently via lowercase replace (kebab `neighborhood-graph` = lowercase `neighborhood`+`-graph`).
- esbuild.config.mjs reads `manifest.id` at build → derives dev-vault plugin dir. No literal neighborhood in it; picks up new id automatically. Good — no code change there.
- Tests hardcoding id/name/strings: src/manifest.test.ts (assertion text "approved 'obsidian-neighborhood-graph'" + expected value), DocDataStore.test.ts, OrphanSweeper.test.ts (plugin-path strings), e2e/obsidianHarness.ts PLUGIN_ID. manifest.test asserts `manifest.id === "obsidian-neighborhood-graph"` → must become `vicinity-graph` (content replace turns it into `obsidian-vicinity-graph`?? NO — see risk below).

## RISK: the `obsidian-neighborhood-graph` id is NOT a simple neighborhood→vicinity swap
- Target id per CLARIFICATION = `vicinity-graph` (drop `obsidian-` prefix AND `-graph`? No: drop `obsidian-` prefix only; result `vicinity-graph`).
- Blanket content replace turns `obsidian-neighborhood-graph` → `obsidian-vicinity-graph`, which is WRONG (must be `vicinity-graph`).
- => Need a SECOND ordered replacement, applied BEFORE the generic ones: literal `obsidian-neighborhood-graph` → `vicinity-graph`. This covers manifest.json id, package.json name, manifest.test expected value, harness PLUGIN_ID, README install path, RELEASE_CHECKLIST. Verified all `obsidian-neighborhood-graph` occurrences want `vicinity-graph`.
- The manifest.test assertion PROSE ("approved 'obsidian-neighborhood-graph'") — after the special replace it reads "approved 'vicinity-graph'". Correct.

## Description string (manifest.json + package.json)
Current: "Improved visualization of neighboring notes (envisioned to be used in place of local graph)." — contains "neighboring" (a bare-neighbor term, NOT auto-replaced) and already has "local graph" but not "nearby notes".
CLARIFICATION mandates: include "local graph" + "nearby notes", drop "neighboring". This is a MANUAL edit (not scriptable via neighborhood rule, since "neighboring" is out of the rename family). Proposed: "A richer local graph that shows the nearby notes around your active note (an improved alternative to Obsidian's built-in local graph)."

## Historical docs decision
- docs-internal/CHANGELOG.md + RELEASE_CHECKLIST.md contain dated historical records. RELEASE_CHECKLIST:43-48 records the *deferred* `obsidian-` id decision — now EXECUTED by this rename, so the special replace makes that bullet read as if the id were always `vicinity-graph` (mildly revisionist but harmless; the checkbox is a live checklist item, acceptable to update).
- Recommendation: blanket-replace docs too (keeps grep-zero acceptance + updates the 12 now-renamed file references cited in CHANGELOG/tickets so they aren't stale). One optional tidy: mark the RELEASE_CHECKLIST deferred-id bullet as done. Flag, don't block.

## Script decision
- Python (CLAUDE.md: temp scripts = Python; non-trivial ordered-regex logic). Location `.tmp/vicinity-rename/rename.py` throwaway. Rationale: one-shot migration; committing to `scripts/` (holds live dev tooling) leaves dead code (KISS/OCP). Provenance = the migration commit + these .ai_out docs.

## Ordering (final)
1. content replace (special id rule FIRST, then plural, then singular case-forms) across all tracked non-excluded text files
2. manual description edit (manifest.json + package.json)
3. git mv the 12 files (derive target basename via same replace fn)
4. tsc (npm run check) → npm test (vitest, expect ~559 root tests, unchanged count) 
5. optional RELEASE_CHECKLIST tidy
6. commit

## Acceptance greps drafted in plan.
