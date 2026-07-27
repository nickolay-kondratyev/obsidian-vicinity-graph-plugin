# IMPLEMENTATION_ITERATION — PUBLIC

Ticket `nid_6mack3e3ql9qtaxf1edezjpfs_e`, branch `e2e-vault-reseed-doc-data`.
Iteration on `IMPLEMENTATION_REVIEW__PUBLIC.md` (verdict READY, 0 MUST-FIX, 2 SHOULD-FIX).

## SHOULD-FIX 1 — guard-safe source-scan regression test → **ACCEPTED**

The reviewer is right and my predecessor's "no automated test is possible" was overstated:
it conflated *behavioral* testability (genuinely blocked — `prepareVaultCopy` is
`private static` and a fixture-building test file would trip the destructive-call scan)
with *source-scan* testability. `readFileSync` is on `READ_ONLY_FS_MEMBERS`
(`e2e/vaultTarget.test.ts:132`), so a read-only scan file is accepted by that guard **on
merit** — nothing widened, nothing excluded.

Added **`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/e2e/vaultCopyReseed.test.ts`** — one BDD test:

> `WHEN the plugin's per-doc dir name changes THEN the e2e vault-copy wipe names the same dir`

It extracts the dir name from the AUTHORITATIVE producer (`src/main.ts`
`docDataDirPath()` → `` `${pluginDir}/doc-data` ``) and asserts `e2e/obsidianHarness.ts`
contains `PLUGIN_ID, "<that name>"`.

Deviations from the reviewer's snippet, both deliberate:
1. **Own file, not a third `describe` in `vaultTarget.test.ts`.** That file's header declares
   it guards "the ONE safety property" (never touch a real vault); reseed *consistency* is a
   different property. SRP. Being in its own file also means it IS covered by the destructive
   scan (which excludes only `vaultTarget.test.ts` itself) — strictly better.
2. **The regex miss throws with a message** instead of silently degrading to
   `toContain('PLUGIN_ID, "undefined"')`. If `docDataDirPath()` is refactored, the failure
   says why rather than looking like a harness bug.

The stringly-typed shape is justified inline: the WHY comment states it exists only because
the shared-constant refactor is deferred, names ticket `nid_7fq9y51mbucmduzf9z31hmwmq_e`, and
instructs that ticket's implementer to **delete this file**. A matching note was added to that
ticket, so the instruction is visible from both ends.

**Proven to bite (not assumed)** — both drift directions, each restored afterwards:

| Perturbation | Result |
|---|---|
| `src/main.ts`: `doc-data` → `per-doc` (harness untouched) | FAIL — `expected … to contain 'PLUGIN_ID, "per-doc"'` |
| `e2e/obsidianHarness.ts`: the `doc-data` `rmSync` deleted | FAIL — `expected … to contain 'PLUGIN_ID, "doc-data"'` |

Not a tautology: neither literal is imported from the other, and deleting the wipe fails.

## SHOULD-FIX 2 — `.obsidian/workspace.json` leak → **ACCEPTED as a ticket (no code change)**

Filed **`nid_0jzq3ev878kjd0zhn3zxyje8q_e`** (task, p3), linked to
`nid_6mack3e3ql9qtaxf1edezjpfs_e`. Records: what leaks (`.dev-vault` is untracked, so its
~6 KB `workspace.json` — open leaves, splits, active file, recents — rides `cpSync` into every
run and nothing wipes it), why it matters (same manual-QA → e2e leak class, nondeterministic
per machine; no assertion depends on it *today* only because the harness defensively detaches
stray right-split leaves), why deferred (out of this ticket's scope per the reviewer), a
candidate fix, and the constraint that any new deletion must name `VAULT_COPY_DIR` literally
for the source scan. No harness code touched.

## NIT — not addressed

The reviewer's own "not worth a round-trip" judgement on the partially-restated WHY-NOT at
`e2e/obsidianHarness.ts:526-527` is accepted. Churning a comment adds diff noise for no
behavior; and the new guard file now also points at the harness, so trimming that pointer
would leave the wipe with *less* local context, not more.

## Verification

| Check | Result |
|---|---|
| `npm test` | PASS — 76 files, **1011** tests (was 75/1010; +1 file, +1 test). `.tmp/iter-npm-test.log` |
| `npm run check` (tsc strict + `check:e2e`) | PASS. `.tmp/iter-npm-check.log` |
| Destructive-call scan still green with the new file in scope | PASS (it is scanned; `readFileSync` only) |
| Drift detection, both directions | PASS — see table above; `src/main.ts` and `e2e/obsidianHarness.ts` restored, `git diff` clean for both |
| `.dev-vault` untouched | Confirmed |

No `npm run test:e2e` re-run: this iteration adds a node-side unit test and touches no
harness runtime code, so the previously recorded 17/17 `settingsUxVisual.e2e.ts` run stands.

## Not done (owned by TOP_LEVEL_AGENT)

No `change_log` entry; `nid_6mack3e3ql9qtaxf1edezjpfs_e` left open.
