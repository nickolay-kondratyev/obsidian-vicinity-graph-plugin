# IMPLEMENTATION (self-plan) — VICINITY_E2E_VAULT — working notes

STATUS: **DONE**. Commits `8b1c026` (feature) + `debb1d7` (setEnable fix) on `e2e-vault-override`.
Working tree clean apart from these `.ai_out/` docs. See `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md`
for decisions/verification; this file holds the rehydration details.

## Plan (all steps done)
1. [x] `e2e/vaultTarget.ts` — pure union resolution + `assertExternalVaultReady`.
2. [x] `e2e/obsidianHarness.ts` — early branch; destructive ops confined to `prepareVaultCopy`.
3. [x] `vitest.config.ts` include widened; `e2e/vaultTarget.test.ts` (13 tests).
4. [x] `scripts/run-e2e.sh` conditional seeding.
5. [x] `e2e/externalVault.e2e.ts` demo spec.
6. [x] README section + caveat.

## Gotchas discovered (do not re-learn the hard way)
- **`setEnable(true)` is mandatory even for an external vault.** The "community plugins on"
  flag lives in the sandbox `--user-data-dir`, so a fresh sandbox always boots with plugins
  off. Only `enablePlugin(id)` writes the vault's `community-plugins.json`; that one stays
  skipped. Exploration doc §1 claimed `setEnable` persists into the vault — that is wrong,
  disproved by diffing the scratch vault before/after a full run.
- The source-scan guard test needs the harness to reference `VAULT_COPY_DIR` /
  `SANDBOX_CONFIG_DIR` **directly** at every mutating call — hence the fixture loop inlines
  `path.join(VAULT_COPY_DIR, relativePath)` twice instead of using a local alias (comment in
  the code says so; keep it if you refactor).
- `e2e/tsconfig.json` needed NO change: `import { … } from "vitest"` brings its own types;
  `types:["node"]` only gates global @types.
- `npx playwright test --config e2e/playwright.config.ts --list | grep -c vaultTarget` → 0.
- Scratch vault recipe (deleted after use; recreate under `.tmp/`):
  4 notes with `[[wikilinks]]`, `.obsidian/app.json` `{}`, `.obsidian/community-plugins.json`
  `["vicinity-graph"]`, `ln -s "$PWD" .tmp/scratch-vault/.obsidian/plugins/vicinity-graph`.
  Beware: that symlink points back at the repo, so recursive globs over `.tmp/` loop — delete it.

## Logs (may be pruned)
`.tmp/e2e-default.log` (full suite, var unset), `.tmp/e2e-vg-retry.log` (failing spec, our code),
`.tmp/e2e-vg-base.log` (same spec at edc9941 — identical failure), `.tmp/e2e-external.log`
(external-vault run, 1 passed).

## Known-red, NOT ours
`vicinityGraph.e2e.ts:160` gamma breadcrumb — pre-existing, tracked in
`docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md`. A duplicate ticket I
created was deleted once I found the existing one.
