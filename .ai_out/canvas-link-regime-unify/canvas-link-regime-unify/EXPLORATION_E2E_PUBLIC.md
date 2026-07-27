# EXPLORATION_E2E_PUBLIC — test + doc surface for canvas link regime unification

Written by TOP_LEVEL_AGENT from the EXPLORATION_E2E agent's returned findings (that agent had no
write tools). Reference-heavy; verify line numbers before editing.

## 1. `e2e/edgeRoutingEval.e2e.ts`

- Eval harness, NOT a regression gate (that is `edgeRouting.e2e.ts`). Drives 4 force fixtures with
  routing ON, screenshots to `.out/`, reads `console.debug` perf lines. Header at `:8-25`.
- `ensureCanvasFixtureIsIndexed()` at `:144-164`, called once from `test.beforeAll` (`:105`), before
  `harness.setEdgeVisibility("all-edges")` (`:107`). `CANVAS_FIXTURE_PATH = "test.canvas"` (`:39`),
  `CANVAS_INDEX_TIMEOUT_MS = 20_000` (`:41`). It force-indexes `test.canvas` into
  `metadataCache.resolvedLinks` by `page.evaluate`-checking for the key and, if absent, appending a
  trailing newline via `app.vault.modify` (no-op for canvas JSON but a real content change that
  triggers re-index), then `page.waitForFunction` polls for the key.
- Its doc comment `:116-143` explicitly states the purpose is to pin the measurement to
  `core-indexed` and cites `nid_s676x55uojmtcwh9t4l9mc6zl_e`. It is the suite's ONLY vault write and
  is safety-gated by `ObsidianHarness.launch()` being called without `allowExternalVault`
  (`VICINITY_E2E_VAULT` runs throw before reaching it — see `e2e/vaultTarget.ts`).
- **There is NO hard-coded expected edge count in this file.** `[eval] force/*` lines are printed via
  `console.log` in the `FORCE_FIXTURES` loop (`:323-330`) and the perf-budget test (`:332-342`).
  Labels `sparse`/`medium`/`dense`/`facing` → centrals `note1.md` / `hub-medium.md` /
  `zzdense-hub.md` / `facing/hub-facing.md` (`:316-321`). The only edge-count assertion is
  `assertMetricsDescribeRenderedGraph` (`:243-251`), a self-consistency check comparing
  `metrics.edgeCount` to rendered `.react-flow__edge-path` count — structural, not a fixed number.
  → "Re-baselining the expected count" in the ticket AC means updating the prose/comments that
  reference 10 vs 11, not flipping a constant. Confirm by grepping for `10`/`11` in the file and its
  comments.
- Downstream of the `beforeAll` pin: `renderFixture()` (`:172-182`),
  `waitForRebuildBurstToSettle()` (`:209-236`), `settledMetrics()` (`:274-296`). Only the
  `sparse`/`note1.md` row's edge count is regime-sensitive.

## 2. Other e2e touching canvas / resolvedLinks

- `e2e/vicinityGraph.e2e.ts:31,40` — the only OTHER spec with real canvas-fixture dependence
  (`note1.md` vicinity, counts `test.canvas` among files). **Check whether its expected counts shift
  when text-node edges become deterministic.**
- False positives (HTML canvas / TS flag, unrelated): `e2e/nodeOutline.e2e.ts:249,260`,
  `e2e/obsidianHarness.ts:269`, `e2e/settingsDependentRows.e2e.ts:44`.

## 3. Vault fixture

- `.dev-vault/` at repo root (gitignored), seeded by `scripts/setup-dev-vault.sh` via
  `npm run setup:dev-vault`; `scripts/run-e2e.sh:29-36` reseeds before every non-`VICINITY_E2E_VAULT`
  run. Seeding is idempotent (`write_if_missing`/`copy_if_missing`, `:24-44`) — it only ADDS files,
  never clobbers. Playwright drives a throwaway copy under `.tmp/e2e/vault` (`e2e/vaultTarget.ts`,
  `e2e/vaultCopyReseed.test.ts`).
- `note1.md` (`scripts/setup-dev-vault.sh:52-59`): links out `[[note2]]`, `[[note3]]`, embeds
  `![[pic.jpg]]`.
- `note2.md` (`:61-63`): backlink to `[[note1]]`.
- `note3.md` (`:65-67`): leaf, reachable from note1 and from test.canvas file node.
- `test.canvas` (`:69-77`): file nodes `note1.md` (`n1`) and `note3.md` (`n2`); text node `n3` with
  text `"Text node with a [[note2]] wikilink — skipped in V1."`, `"edges": []`.
  ⚠ That `"skipped in V1"` string is stale fixture commentary and must be updated with the fix.
  ⚠ Since seeding is `write_if_missing`, changing the seeded text does NOT update an existing
  `.dev-vault/test.canvas` — the implementer must delete/refresh the local file (or the throwaway
  copy source) for the change to take effect in e2e.

## 4. `docs-internal/plan/high-level-plan.md`

`### Canvas support`, lines 83-88, verbatim:

> ### Canvas support
>
> - Canvases are first-class docs: they can be nodes, centrals, and pinned.
> - **We prefer not to own canvas parsing.** Adaptive strategy: at build time, detect whether the install's `resolvedLinks` contains `.canvas` keys. If yes, canvas edges flow through the same code path as markdown and our parser never runs. If no, a fallback provider parses `.canvas` JSON (file-type nodes; text-node wikilinks are skipped in V1).
> - The user's install shows canvas backlinks in the backlinks pane; plugin-ecosystem evidence suggests stock Obsidian historically did not index canvases, so this may be core now or plugin-provided. Verify in devtools, but the adaptive design is correct on every install either way.
> - The fallback path is a known stale-data risk and gets dedicated test coverage, including fixtures with canvas entries deliberately absent to exercise detection.

Line 86 (`text-node wikilinks are skipped in V1`) is the sentence to rewrite.

Also:
- Line 137, under `## Deferred to V2+`: `- Canvas text-node wikilink parsing.` — contradicts the
  human decision; remove/reword.
- Lines 109-110 (`### Testing`): LinkProvider seam / canvas fixtures — light touch-up so it reads as
  "the two paths must AGREE" rather than assuming divergence.
- Line 78 (docid stability for canvas docs) and line 12 (product intent) — no change needed.

## 5. Tickets — NOT in `docs-internal/tickets/`, they live in `_tickets/`

- `nid_s676x55uojmtcwh9t4l9mc6zl_e` →
  `_tickets/canvas-link-regime-is-re-detected-per-rebuild-from-a-racing-resolvedlinks-so-canvas-text-node-edges-appear-or-vanish-depending-on-boot-timing.md`
  — **open**, bug, p2. Authoritative AC block at lines 76-84.
- `nid_li45606h8uvcnjm7fss17xl1u_e` →
  `_tickets/e2e-sparse-eval-fixture-flips-between-10-and-11-edges-run-to-run.md` — **closed**
  2026-07-26 (harness-only fix that added `ensureCanvasFixtureIsIndexed`).

## 6. Unit-level canvas fixtures

- `src/adapters/testFixtures/`: `board.canvas`, `malformed.canvas`.
- `src/adapters/ObsidianLinkProvider.test.ts:148-173` —
  `describe("ObsidianLinkProvider canvas TEXT-node wikilinks (the two regimes disagree)")`, canvas
  JSON built INLINE (file node `note-a.md` + text node `see [[note-b]]`):
  - `:161-164` fallback regime → expects `["note-a.md"]`.
  - `:166-172` core-indexed regime → expects `["note-a.md", "note-b.md"]`.
  - Docblock `:140-147` says these are characterization tests, "neither test asserts a preference",
    citing the ticket. **This is exactly what AC line 79 says to update**: the fallback test must
    flip to also expect `note-b.md`, and the docblock must assert the settled semantics.
- `:95-137` — `fallbackSpec` / `board.canvas` file-node-only parity tests; unaffected.

## 7. Commands / runnability

- `npm test` → `vitest run`. `npm run check` → `tsc -noEmit` + `check:e2e`
  (`tsc -noEmit -p e2e/tsconfig.json`).
- `npm run test:e2e` → `bash scripts/run-e2e.sh`: resolves `OBSIDIAN_PATH` via
  `scripts/setup-obsidian-bin.sh` (pinned Obsidian **1.12.7**, cached under `.tmp/obsidian/`), sets
  headless Ozone flags when no `$DISPLAY`, reseeds dev vault, runs
  `npx playwright test --config e2e/playwright.config.ts` (extra args forwarded, e.g.
  `npm run test:e2e -- edgeRoutingEval.e2e.ts`).
- **e2e IS runnable here**: cached binary confirmed at `.tmp/obsidian/obsidian-1.12.7/obsidian`
  (`.tmp/obsidian-bin-path.txt`, `.tmp/obsidian-bin-setup.log`), headless. Expect low single-digit
  minutes for a full run; per-render settle budget 30s.
