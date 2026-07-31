---
closed_iso: 2026-07-26T05:12:02Z
id: nid_se3h2v45c10x9j42utbm8v2sn_e
title: "e2e: allow pointing the Obsidian harness at an arbitrary vault (VICINITY_E2E_VAULT)"
status: closed
deps: []
links: []
created_iso: 2026-07-25T03:33:44Z
status_updated_iso: 2026-07-26T05:12:02Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, tooling]
---

Two edge-routing tickets have now hit the same wall: a symptom reported from a real personal vault cannot be reproduced under e2e, because `ObsidianHarness` can only ever drive `.dev-vault`.

Specifics (`e2e/obsidianHarness.ts`):
- `DEV_VAULT_DIR` is hardcoded to `<repo>/.dev-vault`, with no env var or constructor override.
- `prepareVaultCopy` `rm -rf`s the destination and full-copies the source into `.tmp/e2e/vault`. Pointing that at a real 457MB personal vault would be slow and destructive-adjacent, so it is not a matter of just swapping the path.

Consequence today: the edge-routing__06 acceptance criterion "screenshot smoke recorded from the real .out/public vault opened on clear-goals.md" could not be automated. It was resolved by recreating an equivalent scenario as a dev-vault fixture instead (the better outcome for that ticket), but the general capability is still missing: when a user reports a graph that looks wrong, there is no way to drive THEIR vault under the harness to see it.

Prior mention: `.ai_out/edge-routing__05/main/DETAILED_PLANNING__PUBLIC.md` proposed exactly this override and it was never built.

## Design

Add an opt-in `VICINITY_E2E_VAULT` env var read by `ObsidianHarness`.

Safety is the whole design, since the target may be a real vault the user cares about:
- NEVER copy or mutate the source vault when the override is set. Either open it READ-ONLY in place, or refuse and require an explicit second opt-in for the copy path.
- The existing `rm -rf` + full-copy behaviour must remain reachable ONLY for `.dev-vault`.
- The plugin still has to be installed into the target vault, which IS a write. Decide deliberately how that is handled (a symlinked plugin dir is a candidate) and document it.
- Fail loudly with an actionable message when the path does not exist or is not a vault.

Keep the default path completely unchanged: with the env var unset, behaviour must be byte-identical to today.

## Acceptance Criteria

- With `VICINITY_E2E_VAULT` unset, e2e behaviour is unchanged and the full suite is green.
- With it set to a scratch vault, a spec can open a note in that vault and screenshot the graph.
- A test or explicit guard proves the source vault is never `rm -rf`ed or otherwise mutated when the override is used.
- README e2e section documents the variable, including the safety caveat about pointing it at a real vault.


## Notes

**2026-07-26T05:12:02Z**

Resolved on branch `e2e-vault-override` (8b1c026..260a205).

`VICINITY_E2E_VAULT` is implemented as a structurally separate harness mode, not a parameter:
- New pure `e2e/vaultTarget.ts` resolves env -> a discriminated `VaultTarget`: `dev-vault-copy` (today's rm -rf + cpSync into `.tmp/e2e/vault`) or `external-in-place`. The destructive path is unreachable in external mode by construction.
- External mode performs ZERO harness writes into the target vault: the plugin must already be installed and enabled there, else it fails loudly with the exact symlink recipe. `extraFixtures` throws. `app.plugins.setEnable(true)` is kept because it writes only localStorage in the sandbox user-data-dir (verified against the decompiled Obsidian 1.12.7 asar); `enablePluginAndSave` -- the call that rewrites the vault's `community-plugins.json` -- is never made.
- Per-spec opt-in `allowExternalVault: true` is REQUIRED, so exporting the env var cannot silently point destructive specs (e.g. `settingsResetVerify.e2e.ts`, which drives "Restore defaults") at a real vault.
- `e2e/vaultTarget.test.ts` (vitest include widened to `e2e/**/*.test.ts`) proves criterion 3: an allowlist scan asserts every mutating `fs` destination in `e2e/*.ts` roots at `.tmp/e2e`, plus a test enforcing the `import * as fs from "node:fs"` form the scan keys off. Both mutation-tested with injected offenders.
- `e2e/externalVault.e2e.ts` (skipped unless the var is set) opens `VICINITY_E2E_NOTE` and screenshots the graph to `.out/`.
- README e2e section documents the variable and states honestly what Obsidian itself still writes into whatever vault it opens (`workspace.json`, incl. 0-byte truncation on SIGKILL, `core-plugins.json`, plugin `data.json`, and that the vault's other community plugins load).

Verified: `npm test` (986), `npm run check`, `tsc -p e2e/tsconfig.json`, `npm run build` green. e2e with the var unset: 71 passed / 1 skipped / 1 pre-existing gamma-breadcrumb failure (tracked separately in docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md). e2e against a scratch vault: passed, screenshot written, vault diffed before/after -- notes and `community-plugins.json` byte-identical.
