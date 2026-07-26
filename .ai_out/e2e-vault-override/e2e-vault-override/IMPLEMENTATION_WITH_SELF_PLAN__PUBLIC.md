# IMPLEMENTATION (self-plan) — `VICINITY_E2E_VAULT` (ticket nid_se3h2v45c10x9j42utbm8v2sn_e)

Branch `e2e-vault-override`. Commits: `8b1c026` (feature), `debb1d7` (fix found by real verification).

## What changed

| File | Change |
|---|---|
| `e2e/vaultTarget.ts` (new) | Pure resolution: `resolveVaultTarget(envValue, repoRoot)` → `{mode:"dev-vault-copy",sourceDir,copyDir} \| {mode:"external-in-place",vaultDir}`; validates existence / is-a-directory / has `.obsidian/`. Plus `assertExternalVaultReady()` (plugin `main.js` present + id listed in `community-plugins.json`). No mutations anywhere in this module. |
| `e2e/obsidianHarness.ts` | Early branch in `launch()`. `prepareVaultCopy(target, …)` now takes the `DevVaultCopyTarget` and asserts `copyDir === VAULT_COPY_DIR` before anything destructive. `prepareSandboxConfigDir(vaultDir)` is the only shared plumbing. External mode: `extraFixtures` throws; `enablePlugin()` skipped; loud error if the plugin never loads. Mode is carried on the instance for `relaunch()`. |
| `e2e/vaultTarget.test.ts` (new) | 13 BDD tests incl. a source scan proving every `rmSync/cpSync/mkdirSync/writeFileSync` destination in the harness roots at `VAULT_COPY_DIR`/`SANDBOX_CONFIG_DIR`. |
| `vitest.config.ts` | `include` += `e2e/**/*.test.ts`. Playwright's `testMatch` is `**/*.e2e.ts` — verified `--list` shows 0 `vaultTarget` entries. |
| `e2e/externalVault.e2e.ts` (new) | `test.skip` when the var is unset; otherwise opens `VICINITY_E2E_NOTE` and screenshots to `.out/external-vault-graph.png`. |
| `scripts/run-e2e.sh` | Var set ⇒ `npm run build` instead of `npm run setup:dev-vault`. Unset path byte-identical. |
| `README.md` | New "Driving your own vault" subsection with the exact `ln -s` install command and a ⚠️ caveat block. |

## Deviation from the given design (D4) — REQUIRED, verified empirically

D4 said skip **both** `setEnable(true)` and `enablePlugin(id)` in external mode. That
makes the mode **unusable**: with a fresh sandbox `--user-data-dir`, Obsidian's
"community plugins on" master flag is OFF (it lives in the user-data dir, *not* the
vault), so **nothing** loads and the run fails with "Plugin never loaded" — observed
in `.tmp/e2e-external.log` before the fix.

Resolution (commit `debb1d7`): call `setEnable(true)` — sandbox-local, and it only
loads what the vault's `community-plugins.json` already lists — and keep
`enablePlugin(id)` skipped, since **that** is the call that rewrites the vault's
`community-plugins.json`. Verified after a full run: the scratch vault's
`community-plugins.json` was byte-identical and all four notes' md5s unchanged; the
only vault write was Obsidian's own `.obsidian/workspace.json` (the documented caveat).

## Verification actually observed

- `npm test` — **green**, 73 files / 979 tests (was 72/966).
- `npm run check` — green. `npx tsc -p e2e/tsconfig.json` — green. `npm run build` — green.
- `bash scripts/run-e2e.sh` (var **unset**) — **71 passed, 1 failed, 1 skipped** (`.tmp/e2e-default.log`).
  The failure is `vicinityGraph.e2e.ts:160` "singleton-folder note shows a folder breadcrumb…".
  **Pre-existing, not a regression**: reproduced identically after reverting
  `e2e/obsidianHarness.ts` + `vitest.config.ts` + `scripts/run-e2e.sh` to `edc9941`
  (`.tmp/e2e-vg-base.log` vs `.tmp/e2e-vg-retry.log`), and already tracked in
  `docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md` (so no new
  ticket was filed). The 1 skipped test is the new `externalVault.e2e.ts` — criterion 1
  (default behaviour unchanged) holds.
- Criterion 2: built a scratch vault under `.tmp/scratch-vault` (4 wikilinked notes,
  `.obsidian/` + symlinked plugin + `["vicinity-graph"]`), ran
  `VICINITY_E2E_VAULT=… VICINITY_E2E_NOTE=center.md bash scripts/run-e2e.sh externalVault.e2e.ts`
  → **1 passed**, `.out/external-vault-graph.png` written and eyeballed (center MAIN +
  alpha + beta, correct vicinity). Scratch vault deleted afterwards.
- Criterion 3: the 13 unit tests (incl. the source scan) plus inspection — the only
  `rmSync`/`cpSync`/`writeFileSync` calls sit in `prepareVaultCopy`
  (dev-vault-copy-only, guarded) and `prepareSandboxConfigDir`/`seedWindowState`
  (`.tmp/e2e/obsidian-config`). `resolveVaultTarget` returns no `copyDir` at all in
  external mode.
- Criterion 4: README documents the var, the install command and the caveat.

## Rejected options

- **Parameterising `prepareVaultCopy` with a `mutateInPlace` flag** — safety would rest
  on a boolean check; the union makes an external path unreachable by construction (D1).
- **Auto-installing/symlinking the plugin into the target vault** — a write inside
  someone's real vault, and hard to make reversible. We fail loudly with the command instead.
- **Hosting the guard test under `src/`** — `src/` is plugin runtime code; the widened
  vitest `include` keeps the test next to what it guards (D3).
- **Snapshot/restore of `community-plugins.json`** — unnecessary once `enablePlugin` is
  never called; restore-on-crash would be its own failure mode.

## Open questions / notes

- Obsidian truncated `.obsidian/workspace.json` to 0 bytes in the target vault when the
  harness SIGKILLs it — harmless (Obsidian rebuilds it), and covered by the README
  caveat, but another reason to point the var at a scratch/backed-up vault.
- `externalVault.e2e.ts` asserts only "≥1 node renders" — the vault's content is unknown,
  so anything stronger would be a lie. It is a repro/screenshot harness, not a gate.
