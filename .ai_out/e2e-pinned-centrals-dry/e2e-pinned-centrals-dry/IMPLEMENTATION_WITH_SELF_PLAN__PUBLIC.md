# e2e DRY: fold "Pinned centrals" literals onto PINNED_CENTRALS_SUMMARY — DONE

Ticket: `nid_iwd08rsdnsbdziltw1odisuoc_e`. Branch `e2e-pinned-centrals-dry`. NOT committed.

## What changed

Two specs now import the canonical constant instead of re-spelling the summary text.

- `e2e/controlsRestart.e2e.ts`
  - line 4: added `import { PINNED_CENTRALS_SUMMARY } from "./settingsBaseline";`
  - line 81 (`pinnedDisclosure()`): `hasText: "Pinned centrals"` → `hasText: PINNED_CENTRALS_SUMMARY`
- `e2e/pinnedCentralScenario.e2e.ts`
  - line 4: same import
  - line 96 (`pinnedDisclosure()`): same substitution

`e2e/settingsBaseline.ts:137` (the canonical const) untouched. No other files changed.

## Repo-wide sweep result

`grep -rn '"Pinned centrals"' e2e/ src/` → exactly one hit: `e2e/settingsBaseline.ts:137`. Acceptance met.

A full-repo grep for the phrase (excluding node_modules/.git/.dev-vault/.tmp/.ai_out) also surfaced these, all deliberately LEFT ALONE:

- `src/view/GraphToolbar.tsx:47` — `summary={`Pinned centrals (${pinned.length})`}` — this is the PRODUCTION string the const mirrors, in a different layer. Folding e2e's const into `src/` (or vice versa) would couple the test baseline to the implementation and destroy the pin's independent-second-opinion value. Genuinely different knowledge; out of ticket scope.
- `e2e/settingsUxVisual.e2e.ts:102` — already uses `PINNED_CENTRALS_SUMMARY` inside a regex; only its prose comment at line 96 mentions the phrase.
- Prose only: `docs-internal/plan/high-level-plan.md`, `docs-internal/tickets/…`, `_tickets/…`, `_change_log/…`, `src/view/graph-view.css:496` (CSS comment).
- Build artifacts: `main.js`, `styles.css` (generated, never hand-edited).

## Verification (all run from repo root, output in `.tmp/`)

| Command | Result |
|---|---|
| `grep -rn '"Pinned centrals"' e2e/ src/` | 1 hit, `e2e/settingsBaseline.ts:137` only — PASS |
| `npm run check` | exit 0 — PASS (tsc strict for `src/` then `e2e/tsconfig.json`) |
| `npm test` | exit 0 — **75 test files, 1010 tests passed** |
| `npm run test:e2e -- controlsRestart pinnedCentralScenario` | exit 0 — **3 passed (23.3s)** against a REAL Obsidian (Electron/Playwright); includes the real relaunch round-trip |

e2e detail (verbatim from `.tmp/e2e.txt`):

```
  ✓  1 e2e/controlsRestart.e2e.ts:126:1 › depth, pin, node cap and sizing all survive an Obsidian restart (19.1s)
  ✓  2 e2e/pinnedCentralScenario.e2e.ts:120:1 › pinned-central depth is per-MAIN-doc: it adds hops, restores on return, and never touches the pin's own depth (1.3s)
  ✓  3 e2e/pinnedCentralScenario.e2e.ts:169:1 › the MAIN central itself can be pinned, survives switching MAIN, and can be unpinned (331ms)

  3 passed (23.3s)
```

The e2e environment DID run here — no skips, no weakened assertions, no fallbacks.

## Called out

- Nothing broken or removed. No behavior-capturing test touched; both edits are pure substitutions of an identical string value.
- The `src/view/GraphToolbar.tsx` ↔ `settingsBaseline.ts` duplication is intentional (test baseline as independent mirror of production copy) and is what the real-Obsidian e2e run verifies. Not folded.

---

## Iteration 1 — response to IMPLEMENTATION_REVIEW__PUBLIC.md

Reviewer verdict was READY TO MERGE, no blocking issues. Disposition of every point:

| # | Review point | Disposition |
|---|---|---|
| SHOULD-FIX 1 | `settingsBaseline.ts:130-132` doc comment over-claims that "callers wrap this in a regex" | **ACCEPTED — fixed.** The claim was true of the sole pre-existing caller and became false for 2 of the 3 after the fold; read literally it told a future maintainer their (correct) bare-substring locator was wrong. Comment now distinguishes exhaustiveness filters (must anchor the count in a regex) from plain locators (prefix substring is fine). Comment only — no code, test or assertion touched. |
| NIT 2 | `pinnedDisclosure()` duplicated verbatim between the two specs | **LEFT ALONE**, as the reviewer recommended. Pre-existing, 4 lines, two callers; a shared page object here is negative ROI. No ticket. |
| Judgment call | Not folding `src/view/GraphToolbar.tsx:47` into the e2e const | Reviewer independently confirmed the call and grounded it in `e2e/settingsBaseline.test.ts:4-18` (hand-written baseline literals are pinned by the DOM, not by a mirror literal). No change. |

### Comment as it now reads (`e2e/settingsBaseline.ts`)

> The conditional "Pinned centrals (n)" disclosure, without its "(n)" suffix — that is a live
> count no fixture can hard-code. How to use it depends on the caller: an EXHAUSTIVENESS filter
> must spell the count out in an anchored regex (a bare prefix would also swallow any future
> sibling starting with these words); a plain LOCATOR may match this prefix as a substring,
> since it only has to find the disclosure. …

### Verification of the iteration

| Command | Result |
|---|---|
| `npm run check` | exit 0 — PASS |
| `npm test` | exit 0 — **75 files / 1010 tests passed** |
| `npm run test:e2e` | **NOT re-run.** Deliberate: this iteration changed a JSDoc block only — zero runtime bytes reach the bundle or the specs. The prior full-fidelity e2e run (3 passed, 23.3s) remains valid for the code under test. Called out rather than implied. |

Raw logs: `.tmp/iter-check.txt`, `.tmp/iter-test.txt`.
