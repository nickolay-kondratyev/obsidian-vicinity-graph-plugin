---
id: nid_zyv1x5w08difwfdopm50bt2lu_e
title: "eslint typed-lint reproduce no-unsafe-member-access locally"
status: open
deps: []
links: [nid_1iskliqzhf6k4euouhn44phiq_e]
created_iso: 2026-08-10T22:25:56Z
status_updated_iso: 2026-08-10T22:25:56Z
type: chore
priority: 2
assignee: nickolaykondratyev
tags: [lint, release, deps]
---

The Obsidian pre-publish check reports many `@typescript-eslint/no-unsafe-member-access` warnings (parent ticket nid_1iskliqzhf6k4euouhn44phiq_e split them into per-group fix tickets, all of which depend on THIS one).

Problem: this repo currently has NO local ESLint (no `node_modules/.bin/eslint`, no `typescript-eslint` dependency, no `eslint.config.*`). So the warnings cannot be reproduced or verified locally — engineers picking up the per-group fix tickets have no way to confirm a fix. This ticket makes the rule reproducible so every downstream fix ticket can be verified.

Scope:
1. Wire ESLint 9 flat config + `typescript-eslint` (type-checked) with `parserOptions.project` pointing at the repo tsconfig(s), so type-aware rules like `@typescript-eslint/no-unsafe-member-access` actually run over `src/` AND `e2e/`. Coordinate with existing ticket docs-internal/tickets/ticket-eslint-adoption.md (adopt the Obsidian sample-template flat config + `eslint-plugin-obsidianmd` in the same pass) — do NOT create a competing config.
2. Add an `npm run lint` script. Confirm it reproduces `@typescript-eslint/no-unsafe-member-access` on the files listed in the parent ticket.
3. Document in the PR the exact command to lint a single file (e.g. `npx eslint e2e/vicinityGraph.e2e.ts`) so downstream tickets can cite it as their verification step.

Do NOT fix the warnings here — only make them reproducible/verifiable. The actual fixes are the per-group tickets. Respect repo layering guards; ESLint config lives at repo root, not inside src/engine.

