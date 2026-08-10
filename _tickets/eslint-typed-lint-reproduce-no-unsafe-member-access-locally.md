---
closed_iso: 2026-08-10T22:46:16Z
id: nid_zyv1x5w08difwfdopm50bt2lu_e
title: eslint typed-lint reproduce no-unsafe-member-access locally
status: closed
deps: []
links: [nid_1iskliqzhf6k4euouhn44phiq_e]
created_iso: '2026-08-10T22:25:56Z'
status_updated_iso: 2026-08-10T22:46:16Z
type: chore
priority: 2
assignee: nickolaykondratyev
tags: [lint, release, deps]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-4
---
The Obsidian pre-publish check reports many `@typescript-eslint/no-unsafe-member-access` warnings (parent ticket nid_1iskliqzhf6k4euouhn44phiq_e split them into per-group fix tickets, all of which depend on THIS one).

Problem: this repo currently has NO local ESLint (no `node_modules/.bin/eslint`, no `typescript-eslint` dependency, no `eslint.config.*`). So the warnings cannot be reproduced or verified locally — engineers picking up the per-group fix tickets have no way to confirm a fix. This ticket makes the rule reproducible so every downstream fix ticket can be verified.

Scope:
1. Wire ESLint 9 flat config + `typescript-eslint` (type-checked) with `parserOptions.project` pointing at the repo tsconfig(s), so type-aware rules like `@typescript-eslint/no-unsafe-member-access` actually run over `src/` AND `e2e/`. Coordinate with existing ticket docs-internal/tickets/ticket-eslint-adoption.md (adopt the Obsidian sample-template flat config + `eslint-plugin-obsidianmd` in the same pass) — do NOT create a competing config.
2. Add an `npm run lint` script. Confirm it reproduces `@typescript-eslint/no-unsafe-member-access` on the files listed in the parent ticket.
3. Document in the PR the exact command to lint a single file (e.g. `npx eslint e2e/vicinityGraph.e2e.ts`) so downstream tickets can cite it as their verification step.

Do NOT fix the warnings here — only make them reproducible/verifiable. The actual fixes are the per-group tickets. Respect repo layering guards; ESLint config lives at repo root, not inside src/engine.

---

## Resolution (2026-08-10)

Typed ESLint is now wired locally; the rule reproduces. Downstream per-group
tickets can verify their fixes.

### What was added
- **`eslint.config.mjs`** (repo root) — ESLint 9 flat config. It spreads
  `eslint-plugin-obsidianmd`'s `recommended` config (the Obsidian sample-template
  stack), which itself layers in `typescript-eslint`'s **`recommended-type-checked`**
  ruleset — that is where `@typescript-eslint/no-unsafe-member-access` (and the
  other `no-unsafe-*` rules) come from. A single trailing block sets
  `languageOptions.parserOptions.projectService: true` + `tsconfigRootDir`, so
  the type-aware parser auto-discovers BOTH `tsconfig.json` (src/) and
  `e2e/tsconfig.json` (e2e/). No competing config — this IS the adoption of
  `docs-internal/tickets/ticket-eslint-adoption.md` (that ticket updated).
- **`package.json`** — `devDependencies`: `eslint@^9.39.5`,
  `typescript-eslint@^8.67.0`, `eslint-plugin-obsidianmd@^0.4.1`. New script:
  `"lint": "eslint src e2e"`.

### Verification commands
- **Whole repo (src/ + e2e/):** `npm run lint`
- **Single file (cite this in downstream fix tickets):**
  `npx eslint e2e/vicinityGraph.e2e.ts` — or any path, e.g.
  `npx eslint src/main.ts`. Exit code is non-zero when findings exist;
  a fixed file prints `0 problems` for the rule.
- Filter to just this rule:
  `npx eslint <file> | grep no-unsafe-member-access` (empty output = clean).

### Reproduction confirmed
`npm run lint` reports **`@typescript-eslint/no-unsafe-member-access`** (115
occurrences across 11 files at time of writing, including the ticket's example
`e2e/vicinityGraph.e2e.ts`). Type-awareness is proven active even on files that
NO LONGER report the rule: e.g. `src/main.ts` still triggers other type-aware /
obsidianmd rules but has 0 `no-unsafe-member-access` — it was fixed since the
parent ticket's file list was captured (the git log carries merged
`fix-no-unsafe-*` branches). So the parent list is a historical snapshot; the
authoritative list of remaining offenders is whatever `npm run lint` prints now.

### Deliberately NOT done (out of scope / would break the build)
- `no-unsafe-member-access` warnings are NOT fixed — that is the per-group tickets.
- `lint` is NOT folded into `npm run check` / `build` yet: the config surfaces
  422 problems today, so gating the build on it now would break `npm run build`.
  Fold it in AFTER the per-group fixes land (tracked in
  `docs-internal/tickets/ticket-eslint-adoption.md`).
- Removed unused top-level `@eslint/js` / `globals` devDeps I briefly added —
  `eslint-plugin-obsidianmd`'s recommended config already encapsulates them, and
  `eslint.config.mjs` imports neither directly.
