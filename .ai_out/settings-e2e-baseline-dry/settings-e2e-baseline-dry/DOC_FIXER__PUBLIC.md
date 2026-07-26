# DOC_FIXER — Round 2 doc closeout

Scope: the three doc-only findings from `IMPLEMENTATION_REVIEW__PUBLIC.md` "Round 2".
No code, tests, or `CLAUDE.md` touched. No change_log entry (TOP_LEVEL_AGENT owns that).

## Findings — all three verified stale against current code, all three fixed

### R2-1 (SHOULD-FIX) — `README.md` Scripts table

Verified: table listed `npm run check` as `tsc -noEmit` (strict type check), and the
`build` row as `tsc -noEmit type check`, while `package.json` now has
`"check": "tsc -noEmit && npm run check:e2e"`.

Fixed — the table lists scripts individually, so `check:e2e` was added as its own row:

| Script | What it does |
|---|---|
| `npm run build` | `npm run check`, then production bundle to `main.js` + dev-vault copy |
| `npm run check` | strict `tsc -noEmit` over `src/`, then `check:e2e` |
| `npm run check:e2e` | `tsc -noEmit -p e2e/tsconfig.json` (type-checks the e2e specs) |

Mirrors the already-updated CLAUDE.md Commands wording.

### R2-2 (NIT) — `docs-internal/notes/e2e-obsidian-docker-setup.md`

Verified: the quoted `run-e2e.sh` recipe still contained `npx tsc -p e2e/tsconfig.json`
and the prose "Seed the vault, type-check specs, run Playwright".

Fixed: dropped the tsc line, retitled step 3 to "Build + seed the vault, run Playwright",
and added a one-line WHY-NOT so a future reader does not re-add it:

```bash
# 3. Build + seed the vault, run Playwright (extra args pass through).
#    No `tsc -p e2e/tsconfig.json` here: the build's `check` step already covers `e2e/`.
```

### R2-3 (NIT) — `scripts/run-e2e.sh` header comment

Verified: header read "Then seeds the dev vault, type-checks the specs, and runs
Playwright" — type-checking is now only indirect, via `build` → `check` → `check:e2e`.

Fixed: header now reads "Then builds (which type-checks src + e2e), seeds the dev vault,
and runs Playwright." Comment-only; the executable body is untouched
(`bash -n` clean).

### R2-4 — no action, correctly classified

Review flagged it as a conscious tradeoff, not a doc drift. Left alone.

## Phase 2 — Thorg

- No `thorg://notes/...` references in any file changed by this branch
  (`git diff main...HEAD --name-only | xargs grep -l "thorg://notes"` → none).
- No anchor points added: this closeout changed prose only, no code worth referencing.
- No `ap_XXX_E` identifier and no `[[wiki.link]]` / `![[embedded]]` form was touched.

## Verification

- `npm run check` → **exit 0** (`.tmp/doc_fixer_check.txt`).
- `bash -n scripts/run-e2e.sh` → clean.

## Files changed

- `README.md`
- `docs-internal/notes/e2e-obsidian-docker-setup.md`
- `scripts/run-e2e.sh` (comment only)
