# IMPLEMENTATION_REVIEW — PUBLIC

Ticket `nid_6mack3e3ql9qtaxf1edezjpfs_e` — e2e vault reseed must wipe `doc-data/`.
Branch `e2e-vault-reseed-doc-data` (`f475d68`) vs `main`.

## Summary

One production-relevant file changed: `e2e/obsidianHarness.ts`. `prepareVaultCopy` now
`rmSync`s `<copy>/.obsidian/plugins/vicinity-graph/doc-data` (recursive, force) immediately
after the pre-existing `data.json` deletion, with the WHY comment extended to cover both
slices and to name the real leak direction for `doc-data/` (`.dev-vault` manual QA →
`cpSync` → run, not "a previous aborted run"). Plus one follow-up ticket file. The change is
minimal, correct, POLS-respecting, and exactly the shape the acceptance criteria asked for.

Independently verified by me (not taken on trust):

| Check | Result |
|---|---|
| `npm test` | PASS — 75 files / 1010 tests (`.tmp/rev-test.log`, exit 0) |
| `npm run check` (tsc strict + `check:e2e`) | PASS (`.tmp/rev-check.log`, exit 0) |
| `.tmp/e2e-attempt.log` contains a real `17 passed` for `settingsUxVisual.e2e.ts` | Confirmed |
| Guard `e2e/vaultTarget.test.ts` byte-identical to `main` | Confirmed |
| `git status` clean, `.dev-vault` untouched | Confirmed |
| No `sanity_check.sh` in repo | Confirmed (n/a) |

Correctness cross-checks:
- **Dir name is right.** `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/main.ts:124-128` — `docDataDirPath()` returns `` `${pluginDir}/doc-data` ``. The harness literal matches the authoritative producer.
- **Completeness of the wipe.** The plugin persists exactly two slices: `data.json` (`src/persistence/PluginDataStore.ts:70` → `saveData`) and `doc-data/<docid>.json` (`src/persistence/DocDataStore.ts`). There is no third slice, so after this change the plugin's state in the copy is fully reseeded.
- **Guard integrity.** The new destination is `path.join(VAULT_COPY_DIR, …)`; the scan's wrapper-peel + `SAFE_WRITE_ROOTS` regex accept it *on merit*. No exclusion widened, no allowlist edited, no `fs/promises`, namespace `fs` import preserved.
- **Honesty.** The implementer's stated gap ("the green e2e run proves no regression, not the repair, because `.dev-vault/…/doc-data/` is currently empty") is accurate — I confirmed that dir is empty. Publishing that gap rather than implying the e2e run proved the fix is exactly right.

## 🚨 MUST-FIX

None.

## ⚠️ SHOULD-FIX

### 1. The "no guard-safe test is possible" argument is overstated — a clean source-scan test exists
`IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md:29-51` rejects (a) a behavioral test in a new
`e2e/*.test.ts` and (b) an exported-constant-list tautology test. Both rejections are
**correct** as argued, and refusing to write the tautology is the right call per CLAUDE.md.
But the conclusion "so no automated test" does not follow: `readFileSync` is on
`READ_ONLY_FS_MEMBERS` (`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/e2e/vaultTarget.test.ts:132`), so a **pure source-scan consistency test is fully guard-safe**, and this repo already leans hard on source scans (`src/engine/importGuard.test.ts`, the destructive-call scan itself).

Concrete suggestion — add to `e2e/vaultTarget.test.ts`, next to the existing scan describe:

```ts
/**
 * The harness's stale-state wipe and the plugin's own dir name are two spellings of one
 * fact. Cross-check them textually (no runtime import from `src/`, so this stays a
 * node-side, read-only scan) — a rename on either side, or deletion of the wipe, fails here.
 */
it("WHEN the plugin's per-doc dir name changes THEN the e2e vault-copy wipe must follow it", () => {
    const mainSource = fs.readFileSync(path.join(REPO_ROOT, "src", "main.ts"), "utf8");
    // `return `${pluginDir}/doc-data`;` — the AUTHORITATIVE producer of the dir name.
    const docDataDirName = mainSource.match(/\$\{pluginDir\}\/([\w-]+)`/)?.[1];
    const harnessSource = fs.readFileSync(path.join(REPO_ROOT, "e2e", "obsidianHarness.ts"), "utf8");
    expect(harnessSource).toContain(`PLUGIN_ID, "${docDataDirName}"`);
});
```

This is **not** a tautology: it fails if `src/main.ts` renames the dir without the harness
following (precisely the silent regression `nid_7fq9y51mbucmduzf9z31hmwmq_e` warns about),
and it fails if the `rmSync` line is deleted. It is also the cheap 80/20 that makes deferring
the shared-constant refactor genuinely safe rather than merely tracked.

If the implementer/human prefers to fold this into the follow-up ticket instead, that is
defensible — but then the follow-up should be re-prioritized above p3, because today the
*only* thing standing between a rename and a silently-reintroduced bug is a ticket file.

### 2. `.obsidian/workspace.json` leaks the same way — file a ticket (do not fix here)
`.dev-vault` is **not** git-tracked (`git ls-files .dev-vault` → empty), so every byte of its
`.obsidian/` is human-QA state, including a 5.8 KB `workspace.json` that `cpSync` carries into
every run and nothing wipes. Leaving it out of *this* ticket is defensible — it is not plugin
state, it carries no pins, and `obsidianHarness.ts:289-302` already detaches stray right-split
leaves, so no current assertion depends on it. But it is the same class of leak (manual QA →
e2e run) and deserves its own ticket rather than silence.

## 💡 NIT

- `e2e/obsidianHarness.ts:526-527` — "Both destinations name the VAULT_COPY_DIR constant literally — see the WHY-NOT above and the source scan in `vaultTarget.test.ts`" partially restates the WHY-NOT block 20 lines up (`:502-505`). One pointer would do. Not worth a round-trip on its own.
- The doc comment (`:491-496`) now says "the copy's plugin state is wiped after the copy" — accurate and a genuine improvement in POLS over the old data.json-only wording.

## Deferral judgment (DRY)

Deferring the shared `DOC_DATA_DIR_NAME` constant to `nid_7fq9y51mbucmduzf9z31hmwmq_e` is
**right**. The blocker cited is real: `e2e/` imports from `src/` type-only today
(`obsidianHarness.ts:15`), `src/persistence/` has no barrel, and a runtime import into the
node-side harness process is a new precedent needing its own tsx/tsc/Playwright verification.
Pulling that into a one-line wipe fix would be the opposite of 80/20. The ticket is
well-written and states the WHY-NOT. My SHOULD-FIX #1 is the cheap guard that makes the
deferral safe in the meantime.

## Documentation Updates Needed

None. `e2e/vaultTarget.ts:120,129` and `obsidianHarness.ts:661` already described
`data.json`/`doc-data/` as a pair — the code has caught up to the docs, so no doc went stale.
No CLAUDE.md change warranted (this is volatile harness detail, not stable knowledge).

## Verdict

**READY** — 0 MUST-FIX. Merge is safe as-is. SHOULD-FIX #1 (guard-safe source-scan test) is
the one item I would push for before closing the ticket, or explicitly folded into the
follow-up with a priority bump; SHOULD-FIX #2 is a ticket, not a code change.
