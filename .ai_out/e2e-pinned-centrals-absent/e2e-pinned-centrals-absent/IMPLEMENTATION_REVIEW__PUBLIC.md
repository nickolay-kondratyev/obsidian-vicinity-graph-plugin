# IMPLEMENTATION_REVIEW__PUBLIC — ticket `nid_d9j4o9ecp93g5zhury5m1fb43_e`

Reviewing commit `e77f700` on `e2e-pinned-centrals-absent` (2 e2e files, `src/` untouched).

## Summary

The change adds the missing ABSENCE assertion for the conditional "Pinned centrals (n)"
disclosure and extracts the anchored summary regex + the top-level summary selector so the
exhaustiveness filter and the new assertion share ONE definition of the shape they scope to.
Acceptance is met, honestly. **Verdict: CONVERGED — no blocking issues.**

## Independent verification (I ran these; I did not take the PUBLIC file at face value)

| check | result |
|---|---|
| `git diff main --stat -- src/ e2e/` | only `e2e/settingsBaseline.ts` + `e2e/settingsUxVisual.e2e.ts` → **no leftover mutation in `src/`** |
| `npm test` | 75 files / **1010 passed**, exit 0 |
| `npm run check` | exit 0 |
| `npm run test:e2e -- settingsUxVisual.e2e.ts` (real Obsidian) | **17 passed (3.4s)**, exit 0; new test is #3 at 5ms |

I did **not** re-run the mutation experiment — I am read-only for `src/`. I did corroborate
the implementer's captured evidence at `.tmp/e2e-mutation.log:268-295`
(`Expected: 0 / Received: 1`, `1 failed`), and the mutation's effect is analytically
certain: `{true && (<Disclosure summary={`Pinned centrals (${pinned.length})`}>` renders
`Pinned centrals (0)` as a DIRECT child of `.vicinity-graph-toolbar__body`, which the
anchored `^Pinned centrals \(\d+\)$` filter matches → count 1 → red.

## Acceptance, point by point

- Binds to the anchored shape: yes — `PINNED_CENTRALS_SUMMARY_PATTERN = ^Pinned centrals \(\d+\)$`.
- Binds to the top-level scope: yes — the same `TOP_LEVEL_PANEL_SUMMARY_SELECTOR`
  (`body > disclosure > summary`) the exhaustiveness locator uses, so the two cannot drift.
- Wrong COUNT (e.g. `(0)` when nothing is pinned): caught — `\d+` matches any count.
- The complementary mutation (guard dropped AND the count label removed) is caught by the
  EXISTING exhaustiveness test (count 6, `hasNotText` no longer matches). The two specs
  cover each other; that is the right split.
- **Residual gap, out of scope:** a disclosure that renders unconditionally but at a
  DEEPER nesting level escapes both (direct-child selector). Hypothetical refactor; both
  PRESENCE specs use unscoped locators and would still work. Noted, not worth a ticket.

## No vacuous pass (the thing that mattered most)

`setOpen(toolbar(), true)` calls `locator.first().evaluate(...)`, which auto-waits for
`.vicinity-graph-toolbar` to be attached and **throws** if it never appears. `GraphToolbar`
emits `__body` and its unconditional disclosures in the same render pass as the toolbar
`<details>`, so "toolbar present" ⇒ "panel rendered". A non-rendered panel therefore fails
at the GIVEN rather than passing a hollow `toHaveCount(0)`. Adding an explicit "panel has N
summaries" precondition would only duplicate the exhaustiveness test — correctly not done.

Order-independence: the file is `mode: "serial"` and nothing above the new test pins; the
harness reseeds a throwaway `.dev-vault` copy per launch, so no cross-file pin leaks either.
The WHY block records the ordering constraint for the next author. Good.

## 🚨 CRITICAL Issues

None.

## ⚠️ IMPORTANT Issues

None blocking. Everything below is optional.

## 💡 Suggestions (all optional, none blocking merge)

1. **Fixture hygiene, worth a follow-up ticket (not this branch).**
   `ObsidianHarness.prepareVaultCopy` deletes `data.json` ("fresh plugin settings: a stale
   data.json would silently change caps/settings under the assertions") but NOT
   `.obsidian/plugins/vicinity-graph/doc-data/`, where **pins** live. `.dev-vault` is
   gitignored and used for human manual QA; a human who pins a central there leaves a
   `doc-data/<docid>.json` that the throwaway copy inherits. The new absence test is the
   first spec to depend on the seeded vault being pin-free, so it could go spuriously RED on
   such a machine. It is empty today, and the failure mode is a loud red (never a false
   green), so this is not a blocker. One-line fix, same WHY as the existing wipe:
   `fs.rmSync(path.join(VAULT_COPY_DIR, ".obsidian", "plugins", PLUGIN_ID, "doc-data"), { recursive: true, force: true });`
2. Untouched, and I agree with leaving it: the duplicated `pinnedDisclosure()` helper in
   `controlsRestart.e2e.ts` / `pinnedCentralScenario.e2e.ts`. Two copies, out of scope.

## Checked and clean

- **selectorGuard compliance**: the assertion is one chained statement on one line; it names
  no `.vicinity-graph-*` literal at all (it uses the constant), so the guard's line-scoped
  exemption is satisfied twice over. The constant's own line names classes that `src/view/`
  really renders. `npm test` (which runs the guard) is green.
- **DRY/SRP**: `PINNED_CENTRALS_SUMMARY_PATTERN` belongs in `settingsBaseline.ts` (shared
  rendered-text knowledge, next to the bare constant it is DERIVED from — no duplication).
  `TOP_LEVEL_PANEL_SUMMARY_SELECTOR` correctly stays spec-local (only that file scopes to
  the panel's top level). The bare/pattern pair is a real distinction ("find it" vs "it and
  nothing else"), not gratuitous indirection.
- **Exhaustiveness filter semantics**: identical — same anchored regex, same `hasNotText`,
  same selector. Verified by reading the pre/post lines, and the test still passes.
- **Docs**: the "filters vs locators" guidance is accurate post-split; `CONTROLS_PANEL_DISCLOSURES`
  now correctly says the exclusion is covered by a separate absence assertion.
- **House rules**: BDD `WHEN … THEN …` name, one behavior, WHY comments explain the blind
  spot and the ordering constraint, strict TS clean, nothing weakened or deleted, no anchor
  points touched.

## Documentation Updates Needed

None. This is stable-but-narrow e2e knowledge; it lives correctly in the constants' doc
comments, not in `CLAUDE.md`.
