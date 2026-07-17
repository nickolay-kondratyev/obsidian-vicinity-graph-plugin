# IMPLEMENTATION_REVIEWER — PRIVATE memory (step-01-scaffold)

Instance 1, 2026-07-16. Reviewed commits `d6c13bd` (scaffold) + `9e3abb8` (.ai_out memories) vs base `25c33bd` on branch `step-01-scaffold`. Verdict: APPROVED (1 SHOULD_FIX, 3 NITs). Public review: `IMPLEMENTATION_REVIEW__PUBLIC.md` (same dir).

## What I verified myself (do not trust reports — re-run these)

All commands from repo root; used `/usr/local/bin/npm` explicitly (bare `npm` shell wrapper in this env intermittently exits 1 with no output — implementer hit the same; also `node -e` directly emits an NVM stderr warning and can exit 1). Verbose output → `.tmp/review-*.log`.

- `rm -rf .dev-vault && npm run build` → exit 0; artifacts (main.js/manifest.json/styles.css) re-created in `.dev-vault/.obsidian/plugins/obsidian-neighborhood-graph/` (proves copy plugin works from nothing, incl. `mkdirSync recursive`).
- `npm test` → exit 0; ours 1 file/2 tests, sublib 6 files/69 tests. Submodule working tree CLEAN afterwards (`git -C submodules/obsidian-id-lib status --short` empty) — `test:sublib`'s nested `npm install` did not dirty the lockfile.
- `npm run check` → exit 0.
- Bundle sanity on `main.js` (prod, 148K): `require("obsidian")` present ×2 (external kept), `hello graph` present (our React tree bundled), `react.production` present (React bundled), zero `/home/` absolute paths.
- `package-lock.json`: `obsidian-id-lib` resolved as relative `submodules/obsidian-id-lib`; zero absolute paths → fresh-clone portable.
- Fresh-clone order dependency: `file:` dep means submodule MUST exist before `npm install`; README documents `git submodule update --init` first — correct.
- Side-effect check on `DocIdServices.createDefault` (called in `onload`): read `submodules/obsidian-id-lib/src/DocIdServices.ts:18-26` + `CrossPluginPathLock` constructor (line 40, only stores `registryHost` default `globalThis`) — construction is IO-free; implementer's claim holds.
- `ask.dnc.md` at root is untracked and ignored only via the USER's global gitignore (`*.dnc.md` in `/Users/nkondrat/vintrin-env/config/git/.gitignore_global`) — not a repo concern (untracked files don't travel in clones), decided NOT a finding.
- Scope sweep: no ESLint, no settings, no graph logic, no React Flow/elkjs deps. No unused code (styles.css class used by HelloGraph; versions.json is Obsidian release convention).

## Findings I settled on (rationale)

1. SHOULD_FIX: ESLint follow-up "ticket" lives only in `.ai_out` implementer report; step doc line 27 says "if skipped, ticket it". `.ai_out` is agent memory, not a durable ticket home. Suggested `docs-internal/` follow-ups note. Did NOT block on it (committed+discoverable, no code defect).
2. NITs only beyond that: redundant explicit constructor in NeighborhoodGraphView; `docIdService` field implicitly public; `test:sublib` uses `npm install` not `npm ci` (drift risk theoretical; `npm ci` wipes node_modules each run — current choice defensible, verified clean).

## Things I considered and rejected as non-issues

- `activateView` `getLeavesOfType()[0] ?? getRightLeaf(false)` + null guard: correct under noUncheckedIndexedAccess; re-`setViewState` on existing leaf is the sample-plugin idiom.
- No leaf-detach in `onunload`: correct — Obsidian guidance says do NOT detach your view's leaves on unload; `registerView` auto-cleans.
- `createRoot(this.contentEl)` + unmount/null in onClose: the documented React-in-Obsidian pattern; no leak.
- tsconfig `include` only src/**: esbuild.config.mjs (JS) & vitest.config.ts intentionally outside `check` — standard.
- Global `.gitignore` `main.js` pattern: doesn't affect submodule (own index) and no src/*.js exists.
- Duplicate description in package.json/manifest.json: both files require it; conventional.
- Runtime `createDefault` call goes beyond step's "type-checks" smoke requirement — accepted: strengthens bundle proof, WHY-documented, IO-free.

## Outstanding for a future instance / human

- GUI exit criterion (view opens in Obsidian ≥1.12.4, no console errors) is UNVERIFIABLE headless — still owed by human; carried as #QUESTION_FOR_HUMAN in public review. If a future step claims it was done, ask for the human confirmation, don't assume.
- If step-02+ touches the copy plugin or test wiring, re-run the full matrix above; also re-check submodule tree cleanliness after `npm test` (the nested `npm install` is the risk spot).
