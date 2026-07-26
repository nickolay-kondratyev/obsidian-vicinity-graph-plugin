# IMPLEMENTATION (self-plan) — `VICINITY_E2E_VAULT` (ticket nid_se3h2v45c10x9j42utbm8v2sn_e)

Branch `e2e-vault-override`. Commits: `8b1c026` (feature), `debb1d7` (fix found by real
verification), `3b42b81` (review round 1: B1 + S1–S5).

## Review round 1 — disposition (all 6 INCORPORATED, none rejected)

| # | Disposition |
|---|---|
| **B1** opt-in | **Fixed** as suggested. New `LaunchOptions.allowExternalVault` + pure `assertExternalLaunchAllowed()` in `vaultTarget.ts` (it now owns BOTH external-mode refusals: no opt-in, and no `extraFixtures`). `externalVault.e2e.ts` is the sole opt-in caller. 4 new unit tests. **Verified live**: `VICINITY_E2E_VAULT=… run-e2e.sh settingsResetVerify.e2e.ts` now fails *before Obsidian launches* with the actionable message. The optional `run-e2e.sh` spec-filter default was **skipped** — the throw already blocks it at the only place that matters, and defaulting a spec filter would silently change what `test:e2e` runs. |
| **S1** false WHY-NOT | **Fixed** in `vaultTarget.ts` (`assertExternalVaultReady` doc), `obsidianHarness.ts` (`waitForAlreadyEnabledPlugin` doc) and the README. Honest reason recorded: `setEnable(true)` only loads what the vault already lists, and we refuse to load plugin code (which writes `data.json`/`doc-data/`) into a vault where the human has not enabled it. |
| **S2** consequence, not rejected option | **Fixed**: the comment now says "ACCEPTED CONSEQUENCE — every community plugin enabled in that vault loads and runs"; the README caveat gained the same sentence. |
| **S3** guard under-scoped | **Fixed**: the scan is now an ALLOWLIST of read-only `fs` members over every `e2e/*.ts` (the test file itself excluded — it builds scratch vaults on purpose), with per-member destination arg positions (`cpSync`→arg2, `renameSync`→both), a balanced-paren arg splitter, an assertion that no scanned file imports `node:fs/promises`, and a test proving the scan REPORTS an injected `fs.unlinkSync(path.join(target.vaultDir, …))`. Safe roots are `VAULT_COPY_DIR`/`SANDBOX_CONFIG_DIR`/`OUT_DIR` (the last is `.out/`, where every spec already screenshots). Doc comment states the node-side-only scope. |
| **S4** symlink recipe | **Fixed**: README + the error message now symlink `main.js`/`manifest.json`/`styles.css` individually, never the repo root. `doc-data/` added to `.gitignore` as belt-and-braces. |
| **S5** truncation caveat | **Fixed**: folded into the README caveat, which now also names `core-plugins.json` (observed in this round's scratch run). Graceful-close-before-SIGKILL was **not** implemented — out of scope for this ticket and it would touch the shared shutdown path used by the green default suite. |

## Review round 2 — the remaining NIT, closed

The scan keys off the literal `fs.` prefix, so `import { unlinkSync } from "node:fs"` or
`fs.promises.*` would have slipped past it. Now enforced rather than assumed:

- New BDD test: **"WHEN an e2e source imports node:fs THEN it uses the `import * as fs`
  namespace form the scan keys off"** — every line mentioning `"node:fs` in a scanned file
  must be exactly `import * as fs from "node:fs";`.
- The async-API test was widened from "does not import `node:fs/promises`" to "does not USE
  the async fs API" (also catches `fs.promises.*`).
- Three pre-existing specs (`settingsResetReview`, `settingsResetVerify`, `settingsUxVisual`)
  used the default-import form `import fs from "node:fs"`. That is equally prefix-safe, but
  normalising them to the namespace form leaves ONE enforceable rule instead of two accepted
  spellings. Import form only — no behaviour touched.
- **Mutation-tested**: dropped `e2e/zzprobe.ts` containing
  `import { unlinkSync } from "node:fs"` → the new test failed, naming the file and line;
  removed it → green again.

Round-2 gates (observed): `npm test` **green, 986 tests** (was 985), `npm run check` green,
`npx tsc -p e2e/tsconfig.json` green. No e2e re-run (source-scan/import-form change only).

NITs: added the WHY-NOT line about `target.copyDir` vs the `VAULT_COPY_DIR` constant.
`~` expansion and the import-time scratch dir were left alone (cosmetic, and moving the
scratch dir into `beforeAll` buys nothing for a file that needs it in every test).

### Round-1 verification (all observed)

`npm test` **green 985 tests** (was 979; +6). `npm run check`, `tsc -p e2e/tsconfig.json`,
`npm run build` — green. `bash scripts/run-e2e.sh` (var unset) — **71 passed / 1 skipped /
1 failed**, the failure being the same accepted pre-existing gamma-breadcrumb test
(`.tmp/e2e-default-r2.log`). Scratch-vault run with the new flag — **1 passed**,
`.out/external-vault-graph.png` regenerated; afterwards the vault's plugin dir held only
the 3 symlinks, `community-plugins.json` was unchanged, and the repo working tree was
clean (no `doc-data/` leak).

---
*(Original round-0 record below.)*

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
