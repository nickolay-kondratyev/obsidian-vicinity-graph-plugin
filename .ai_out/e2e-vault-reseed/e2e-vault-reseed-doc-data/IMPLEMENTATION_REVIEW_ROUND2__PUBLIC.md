# IMPLEMENTATION_REVIEW — ROUND 2 (PUBLIC)

Ticket `nid_6mack3e3ql9qtaxf1edezjpfs_e`, branch `e2e-vault-reseed-doc-data`.
Scope: **only `git diff HEAD~1 HEAD`** (commit `033e864`). The core fix (`f475d68`) was
approved in round 1 and is not re-litigated here.

## Summary

`033e864` responds to the two round-1 SHOULD-FIXes:

1. **ACCEPTED** — adds `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/e2e/vaultCopyReseed.test.ts`: a read-only source scan that extracts the per-doc dir
   name from the authoritative producer (`src/main.ts` `docDataDirPath()`) and asserts the
   harness wipe in `e2e/obsidianHarness.ts` names the same dir.
2. **ACCEPTED as a ticket** — `nid_0jzq3ev878kjd0zhn3zxyje8q_e` for the `workspace.json` leak,
   no code change. Correct call; that was explicitly ruled out of this ticket's scope.

Plus doc/ticket bookkeeping: the superseded "no automated test" section in
`IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` is marked SUPERSEDED rather than rewritten
(honest — the record of the earlier wrong conclusion is preserved), and
`nid_7fq9y51mbucmduzf9z31hmwmq_e` gained a note telling its implementer to delete the guard.

**No production code changed in this commit.** Only one new test file + markdown.

## Independent verification (run by me, not taken on trust)

| Check | Result |
|---|---|
| `npm test` | **PASS** — 76 files / **1011** tests, exit 0 (`.tmp/rev2-test.log`) |
| `npm run check` (`tsc -noEmit` + `check:e2e`) | **PASS**, exit 0 (`.tmp/rev2-check.log`) |
| `git status` clean after my run | Confirmed |
| `sanity_check.sh` present? | No — n/a |

The implementer's claimed 76/1011 and PASS numbers are **truthful**.

### Is the guard genuine? — simulated drift, both directions

I did **not** perturb the working tree. Instead I replayed the guard's exact logic
(`/\$\{pluginDir\}\/([\w-]+)`/` → `toContain('PLUGIN_ID, "<name>"')`) over in-memory mutated
copies of both sources:

| Scenario | Guard verdict | Correct? |
|---|---|---|
| baseline | PASS | yes |
| A — `src/main.ts` renames `doc-data` → `per-doc`, harness untouched | **FAIL** | yes — the exact silent regression `nid_7fq9y51mbucmduzf9z31hmwmq_e` warns about |
| B — the harness `doc-data` `rmSync` statement deleted | **FAIL** | yes |
| C — `docDataDirPath()` refactored to `[pluginDir, "doc-data"].join("/")` | **THROWS** with a guidance message | acceptable — loud + actionable, not a silent `undefined` degrade |
| E — harness *comment* text mentioning `` `doc-data/` `` reworded/removed | PASS | yes — **not brittle to comment edits** |
| F — `rmSync` swapped for a non-destructive call, `path.join(...)` kept | PASS | tolerable — see below |

So it is **not a tautology**: neither literal is derived from the other, and the two realistic
regressions (rename-without-follow, wipe-deleted) both bite. Two structural facts back this
up: `${pluginDir}/` occurs exactly **once** in `src/main.ts` (no first-match ambiguity), and
`[\w-]+` cannot swallow a `.`, so a hypothetical `${pluginDir}/data.json` sibling would not
be mis-matched. The regex is tighter than it looks.

Scenario F is a real but acceptable limit: the test name says "…**names** the same dir", not
"…wipes it", so behavior matches naming — no POLS violation, no lie. Full deletion (B), the
realistic form of the regression, is caught.

### Guard integrity (`e2e/vaultTarget.test.ts`)

Not weakened, not edited at all in this commit. Concretely:
- `scannedFiles` excludes only `path.basename(import.meta.url)` (= `vaultTarget.test.ts`), so
  the new file **is** in scope of the destructive-call scan — the implementer's "strictly
  better than a third describe" claim checks out.
- The new file uses `readFileSync` only, which is on `READ_ONLY_FS_MEMBERS` — accepted **on
  merit**, nothing allowlisted or excluded for it.
- Its `import * as fs from "node:fs";` matches `NAMESPACE_FS_IMPORT` exactly, so the
  bare-member-import guard stays satisfied.

### Placement (own file vs. third `describe`)

**Sound, and I prefer it to my predecessor's snippet.** `vaultTarget.test.ts` declares itself
the vault-*safety* guard; reseed *consistency* is a different reason to change (SRP). And as
above, living outside the one excluded file means the new file is itself scanned. Duplicating
the `REPO_ROOT` one-liner is fine — five e2e files already spell it that way, so this is
consistency with an existing pattern, not new duplication.

### WHY-comment quality

Good. It states the property, why the name is spelled twice, why a stringly-typed scan
instead of a shared constant (runtime-import-from-`src/` precedent, deliberately deferred),
names `nid_7fq9y51mbucmduzf9z31hmwmq_e`, and instructs **DELETE this guard when that ticket
lands**. I confirmed the reciprocal note exists on that ticket file, so the instruction is
discoverable from both ends — a maintainer cannot land the refactor and miss the stale guard.
The inline `/** Matches `` return `${pluginDir}/doc-data`; `` … */` on the regex is exactly the
CLAUDE.md "WHAT comment for a TERSE expression" case.

## 🚨 MUST-FIX

**None.**

## ⚠️ IMPORTANT

**None.**

## 💡 Suggestions (optional, non-blocking)

1. **Formatting brittleness (scenario D).** If the harness `rmSync` call were ever reflowed to
   one-arg-per-line, `PLUGIN_ID,` and `"doc-data"` land on different lines and the guard
   false-fails on a behavior-preserving reformat. Risk today is **low** — the repo has no
   Prettier config, no ESLint, no `format` script, and the line is 87 chars — so I would not
   block on it. A one-token hardening if desired:
   ```ts
   const harnessSource = fs.readFileSync(...).replace(/\s+/g, " "); // whitespace-insensitive
   ```
2. Nothing else. No new out-of-scope work spotted; no ticket needed beyond the two already
   filed.

## Documentation Updates Needed

None. This is volatile harness detail, not stable knowledge — correctly kept out of
`CLAUDE.md`. Docs touched in the commit (`SUPERSEDED` banner, ticket cross-notes) are accurate.

## Verdict

**READY** — 0 MUST-FIX, 0 IMPORTANT, 1 optional suggestion. The commit does what it claims,
the new guard is genuine in both drift directions, it weakens no existing guard, and the
reported test/check results are honest.
