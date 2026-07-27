# PRIVATE rehydration memory — e2e-pinned-centrals-dry

Status: **COMPLETE**. All acceptance criteria met and verified. Nothing left to do except the
TOP_LEVEL_AGENT commit (I was instructed not to commit) and closing ticket
`nid_iwd08rsdnsbdziltw1odisuoc_e`.

## Plan (executed, all steps done)

1. [x] Repo-wide grep for `Pinned centrals`, classify each hit as same-knowledge vs different-knowledge.
2. [x] Add `import { PINNED_CENTRALS_SUMMARY } from "./settingsBaseline";` to the two specs.
3. [x] Replace the two `hasText: "Pinned centrals"` literals.
4. [x] `npm run check`, `npm test`, `npm run test:e2e -- controlsRestart pinnedCentralScenario`.

## Exact working-tree diff (2 files, 4 lines)

- `e2e/controlsRestart.e2e.ts`: import added after line 3 (`./obsidianHarness`); body of
  `pinnedDisclosure()` now `hasText: PINNED_CENTRALS_SUMMARY`.
- `e2e/pinnedCentralScenario.e2e.ts`: identical shape (its `pinnedDisclosure()` is a near-clone).

Both files declare `pinnedDisclosure()` as a module-level helper over a module-level `page: Page`.
The two helpers are themselves duplicated between the specs — NOT folded (out of ticket scope;
the specs own separate vault copies and are otherwise independent). Potential future ticket, but
low value: they are 4 lines each and consolidating would create a shared page-object for two callers.

## Decisions / judgment calls

- `src/view/GraphToolbar.tsx:47` renders `` `Pinned centrals (${pinned.length})` ``. I did NOT import
  the e2e const into `src/` nor the reverse. Rationale: `settingsBaseline.ts`'s own doc comment
  (lines 129-136) frames it as the deliberate mirror/baseline, and `e2e/settingsBaseline.test.ts`
  exists as an "INDEPENDENT second opinion". Coupling them would make the pin self-fulfilling.
  This is different knowledge, so per the task instruction I reported rather than folded it.
- Prose/doc/changelog/ticket mentions and the generated `main.js` / `styles.css` are not literals
  under test control — left alone.

## Environment notes (useful for the next agent)

- The user's bash profile prints ~25 lines of noise on EVERY Bash call. Redirect real output to
  `.tmp/<file>` and read it back with the Read tool, or pipe through `grep` for a marker like
  `EXIT=`. Do not try to read command output inline.
- The real-Obsidian e2e DOES work in this container (headless Electron, pinned Obsidian download).
  `npm run test:e2e -- <spec substrings>` filters by spec name. Full run took ~30s wall clock for
  these 3 tests; the restart spec dominates (19.1s, it relaunches Obsidian for real).

## Verification results (final)

- grep: only `e2e/settingsBaseline.ts:137` retains the literal.
- `npm run check` exit 0.
- `npm test` exit 0 — 75 files / 1010 tests passed.
- `npm run test:e2e -- controlsRestart pinnedCentralScenario` exit 0 — 3 passed (23.3s).

Raw logs (may be pruned): `.tmp/check.txt`, `.tmp/test.txt`, `.tmp/e2e.txt`, `.tmp/grep-after.txt`.
