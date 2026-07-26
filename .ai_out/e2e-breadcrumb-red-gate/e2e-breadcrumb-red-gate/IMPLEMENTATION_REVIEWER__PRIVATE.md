# IMPLEMENTATION_REVIEWER — PRIVATE (rehydration notes)

## State: review complete, 1 BLOCKING issue raised (B1). Verdict: stale-test call is CORRECT.

## Evidence I verified myself (don't redo)

- `git show 998fdac --stat` + body: removal is in the **commit subject** ("remove folder
  prefix"), body, `_change_log/2026-07-23_22-16-50Z.md:17`, and `998fdac`'s PUBLIC file.
  Deliberate, product-level. Settled.
- **Plan doc nuance**: `high-level-plan.md` is SILENT at HEAD (0 grep hits), NOT documenting
  absence — IMPL's PUBLIC overclaims. BUT the stronger fact: `998fdac` *deleted* the
  sentence "Ungrouped singletons reserve extra width for their `folder/` breadcrumb" from
  `:59`. Verified via `git grep breadcrumb 998fdac^ -- docs-internal/plan/high-level-plan.md`.
  Affirmative deletion from the source of truth = a decision. Conclusion holds on better
  evidence than IMPL cited.
- `998fdac` deleted 5 behaviour tests (flowMapping breadcrumb describe + width test,
  graphIdentity breadcrumbFolderOf describe). Legitimate — deleting tests for behaviour you
  deliberately delete. Disclosed 3 places. Not a blocker.

## B1 — the finding worth defending

`e2e/vicinityGraph.e2e.ts:96` `page.locator(".vicinity-graph-node__breadcrumb")` runs at
spec #63, when active file is still ALPHA (set in `beforeAll:53`) → only 3 nodes: alpha,
beta (both **grouped** in `projects/`), note1 (**vault root**).
Per `998fdac^:src/view/graphIdentity.ts:49-54`, `breadcrumbFolderOf` returns `undefined`
for grouped OR root. **All three → undefined even pre-removal.** So the "fixed" test would
have passed against pre-998fdac code — identically vacuous to the `:85` test it replaced,
while its JSDoc:92-94 claims it is "vault-wide" and fixes that exact vacuity.

Fix: move it after `:157` `harness.openFile(NOTE1_PATH)` — note1 vicinity includes
`solo/gamma.md`, ungrouped singleton in a non-root folder, the ONE node that rendered
`solo/` pre-998fdac. Then correct the JSDoc.

Mitigant I noted so as not to overstate: `:179` `toHaveText(GAMMA_TRIMMED_TITLE)` is exact-
match and WOULD catch a returning prefix (old DOM rendered breadcrumb inside
`.vicinity-graph-node__title`). Suite is not blind; B1 is about a mislabelled decoration.

## Gate verification — ALL CLAIMS REPRODUCE, no discrepancies

Logs: `.tmp/review-e2e.log`, `.tmp/review-test.log`, `.tmp/review-check.log`,
`.tmp/review-build.log`.
- e2e: `E2E_EXIT_CODE=0`, `1 skipped` / `78 passed (51.9s)`. Skip = `externalVault.e2e.ts:53`
  (env-gated on VICINITY_E2E_VAULT). 79 numbered specs all accounted for → 0 "did not run".
  Specs 73–79 (the formerly stranded 6) all ✓.
- `npm test`: `Test Files 74 passed (74)` / `Tests 990 passed (990)`, TEST_EXIT=0.
- CHECK_EXIT=0, BUILD_EXIT=0. `git status` post-build: no main.js/styles.css drift → the
  "byte-identical artifacts" claim holds.

## Verified-clean (rejected concerns — don't re-litigate)

- Trimming coverage: `src/adapters/ObsidianLinkProvider.test.ts:286` exists and passes;
  `ObsidianLinkProvider.ts:311-315` still `value.trim()`. IMPL's citation is exact.
- `toHaveText` is exact-match → gamma change is not a loosening. No skip/regex/try-catch/
  silent fallback anywhere in the diff. Not a HACK.
- `ObsidianLinkProvider.ts:313` = 1 comment line only. `setup-dev-vault.sh:409` fixed an
  actively-wrong human smoke instruction (improvement). Ticket edits preserve original triage
  under a `---`. All honest.

## SHOULD-FIX follow-ups raised

S1 `step-05-rich-rendering.md:45` still claims breadcrumb derivation is vitest-covered (the
   3rd stale bullet in the file they fixed 2 of).
S2 `docs-internal/tickets/ticket-folder-color-ux-design-pass.md:8` — **OPEN** ticket whose
   premise ("folder identity via breadcrumb titles") is now false; not harmless history.
S3 No `[decide]` ticket filed for the acknowledged UX gap (ungrouped non-root notes have zero
   folder context). Flagged only in `.ai_out/` → evaporates on merge. CLAUDE.md requires a
   ticket.
S4 Root process gap: `npm test` excludes e2e, so feature removals can't go red. Left the gate
   red 3 days; `_change_log/2026-07-24_03-57-33Z.md:20` recorded it as accepted
   "pre-existing". Suggest grep tripwire: every CSS class asserted in `e2e/**` must exist in
   `src/view/`.

## If resuming

Only open item is B1 (and whether S1–S4 got filed). Re-running the gates is unnecessary —
already verified at HEAD `c2ea883`; a B1 fix touches only e2e test ordering, so a single
`npm run test:e2e` re-run would suffice to confirm.
