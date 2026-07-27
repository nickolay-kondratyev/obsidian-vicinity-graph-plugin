# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC

Ticket `nid_6mack3e3ql9qtaxf1edezjpfs_e` — e2e vault reseed must wipe `doc-data/`.

## What changed

`e2e/obsidianHarness.ts` only (no other production or test file touched).

1. `prepareVaultCopy` now deletes the per-doc persistence dir right after the existing
   `data.json` deletion:
   ```ts
   fs.rmSync(path.join(VAULT_COPY_DIR, ".obsidian", "plugins", PLUGIN_ID, "doc-data"), {
       recursive: true, force: true,
   });
   ```
   The destination literally names the `VAULT_COPY_DIR` module constant, so the
   `vaultTarget.test.ts` destructive-call source scan sees it — the guard was **not**
   weakened or modified in any way.
2. The WHY comment above the two deletions was rewritten to cover BOTH slices and to
   name the actual leak direction for `doc-data/`: it is not a previous aborted run, it
   is `.dev-vault` itself (a pin a human makes during manual QA is pulled in by `cpSync`).
3. The `prepareVaultCopy` doc comment mentioned only `data.json` and only the
   copy→human-vault leak; it now also names `doc-data/` and the reverse leak the wipe closes.

No doc file went stale: `e2e/vaultTarget.ts:120,129` and the `waitForAlreadyEnabledPlugin`
comment already described `data.json`/`doc-data/` as a pair — the code has now caught up
to the docs, so those needed no edit.

## Testing decision — no new automated test (justified)

> **SUPERSEDED** by `IMPLEMENTATION_ITERATION__PUBLIC.md`. The rejections below hold for
> *behavioral* tests, but a read-only *source-scan* test was always available and has since
> been added (`e2e/vaultCopyReseed.test.ts`). Read this section as "why no behavioral test".

`prepareVaultCopy` is `private static`, so the only lever is a permanent test file in
`e2e/`. I verified that is **not** achievable without weakening the guard:

- `vaultTarget.test.ts`'s scan covers every `e2e/*.ts` except itself (excluded by
  `path.basename(import.meta.url)`). A new `e2e/obsidianHarness.test.ts` must build a
  scratch SOURCE vault to copy from, and those `fs.cpSync`/`writeFileSync` destinations
  cannot root at `VAULT_COPY_DIR`/`SANDBOX_CONFIG_DIR`/`OUT_DIR` — they would be reported
  as offenders. Making them pass means broadening the exclusion to all `*.test.ts`, i.e.
  weakening the one guard that keeps the harness away from real vaults. Explicitly out of
  bounds, and a bad trade: the guard protects a human's vault, the test protects a fixture.
- It would additionally have to reach the private method through bracket access
  (`(ObsidianHarness as any)["prepareVaultCopy"]`) — fragile and POLS-violating.

**Rejected: an exported `STALE_PLUGIN_STATE_RELATIVE_PATHS` list** consumed by the deletion
loop with a test asserting it contains `"doc-data"`. It would pass the guard (same shape as
the existing fixture-write loop), but the test is a tautology — it asserts a constant equals
itself and would stay green if the `rmSync` loop were deleted outright. Per CLAUDE.md that
is a test that lies, so it was not written.

So the change is covered by the existing static source scan plus the one-off behavioral
proof below.

## Verification

| Check | Result |
|---|---|
| `npm test` | PASS — 75 files, 1010 tests (`.tmp/npm-test.log`). Includes the unmodified destructive-call guard. |
| `npm run check` (tsc strict + `check:e2e`) | PASS (`.tmp/npm-check.log`) |
| Behavioral proof of the wipe | PASS, with negative control (below) |
| `npm run test:e2e -- settingsUxVisual.e2e.ts` | **PASS — 17/17**, real Obsidian 1.12.7 (cached binary, headless `--ozone-platform=headless`). Acceptance test #3 "WHEN no central is pinned THEN the panel has no Pinned centrals disclosure" green. Log: `.tmp/e2e-attempt.log`. |

### Behavioral proof (throwaway, `.tmp/proof/`, not source-controlled)

Drove the REAL private `prepareVaultCopy` (bracket access) against a scratch copy of
`.dev-vault` seeded with `doc-data/scratch-pin.json` + `data.json`, then asserted:
`doc-data/` and `data.json` absent from `.tmp/e2e/vault`, `main.js` present (the copy really
happened), and the pin still present in the SOURCE (the method never touches `.dev-vault`).

- With the fix: **PASS**.
- **Negative control** — same proof with the fix `git stash`ed: **FAIL**
  (`AssertionError: expected true to be false`), i.e. the stale pin demonstrably survived
  before this change and demonstrably does not after.

`.dev-vault` was never written to; the proof copied it into `.tmp/`. `git status` confirms
`.dev-vault` is clean.

## Honest gaps

- **The green e2e run does not by itself prove the fix.** `.dev-vault/…/doc-data/` is
  currently EMPTY, so that run had no stale pin to leak — it proves no regression, not the
  repair. The repair is proven by the negative-controlled file-level proof above.
- **I could not reproduce the failure at the e2e layer.** Doing so needs a pin file keyed to
  the docid of the spec's MAIN note (`projects/alpha.md`), but that fixture has no stable
  `id:` in its frontmatter — obsidian-id-lib assigns it at runtime, inside the throwaway
  copy, differently each run. Pre-planting a pin under `note1`'s stable docid would not
  reproduce anything, since `note1` is not MAIN in that spec. Adding an `id:` to `alpha.md`
  was judged too invasive a fixture mutation for a proof.

## Follow-up filed

`nid_7fq9y51mbucmduzf9z31hmwmq_e` (chore, p3) — share the `doc-data` dir name as one
exported constant. It is currently a bare literal in 5 places (`src/main.ts` `docDataDirPath()`,
now `e2e/obsidianHarness.ts`, and 3 `src/persistence/*.test.ts`); a rename would silently
disable this wipe with no test failing. **Not done inline** because `e2e/` imports from `src/`
TYPE-ONLY today and `src/persistence/` has no barrel — a runtime import into the node-side
harness is a new precedent needing its own verification, out of scope for a Pareto fix.

## Not done (owned by TOP_LEVEL_AGENT)

No `change_log` entry; ticket left open.
