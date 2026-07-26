# IMPLEMENTATION (self-plan) — VICINITY_E2E_VAULT — working notes

STATUS: **DONE, review round 1 addressed**. Commits `8b1c026` (feature), `debb1d7`
(setEnable fix), `3b42b81` (B1 + S1–S5) on `e2e-vault-override`.

## Round 2 notes
- Import-form guard added (`NAMESPACE_FS_IMPORT`) so the scan's `fs.` prefix assumption is
  enforced. `settingsResetReview/Verify/UxVisual.e2e.ts` were normalised from
  `import fs from "node:fs"` to the namespace form — that is the ONLY change to those files.
- Mutation check recipe: `printf 'import { unlinkSync } from "node:fs";\n' > e2e/zzprobe.ts`,
  run the test (fails, names the file), `rm e2e/zzprobe.ts`.
- Gates after round 2: `npm test` 986 green, `check` green, `tsc -p e2e/tsconfig.json` green.

## Round 1 notes
- B1 gate lives in `vaultTarget.ts::assertExternalLaunchAllowed` (pure ⇒ unit-testable
  without launching Obsidian). `LaunchOptions` moved there too, so the harness imports
  the type rather than declaring it.
- Reviewer decompiled Obsidian 1.12.7 and CONFIRMED `setEnable(true)` writes only
  `localStorage["enable-plugin-<appId>"]`; the vault writer is `enablePluginAndSave`
  (via `saveConfig` → `writeConfigJson("community-plugins", …)`). Our exploration doc and
  my round-0 comments said `enablePlugin` was the writer — wrong, now corrected in code.
- Source-scan gotcha: `fs.cpSync(target.sourceDir, VAULT_COPY_DIR, …)`'s arg1 is a READ
  source, so destination arg positions are per-member (`DESTINATION_ARG_INDICES`).
  `OUT_DIR` had to join the safe roots — 5 existing specs `fs.mkdirSync(OUT_DIR, …)`.
- Live proof of the gate: `VICINITY_E2E_VAULT=… bash scripts/run-e2e.sh
  settingsResetVerify.e2e.ts` → throws before spawn (`.tmp/e2e-refuse.log`).
- Scratch-vault install now uses per-artifact symlinks; Obsidian additionally created
  `core-plugins.json` in the target vault (added to the README caveat).
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
