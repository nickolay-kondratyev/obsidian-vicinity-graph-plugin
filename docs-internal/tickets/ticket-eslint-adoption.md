# Ticket: Adopt ESLint

**Status:** OPEN
**Origin:** step-01-scaffold (ESLint was explicitly out of scope per [[../plan/steps/step-01-scaffold]], "if skipped, ticket it").

Adopt the Obsidian sample-template ESLint 9 flat config + `eslint-plugin-obsidianmd`,
wired as an `npm run lint` script (and folded into `npm run check` or CI once present).

Related: `submodules/obsidian-id-lib/README.md` carries the same follow-up for the
submodule — adopt for both in one pass to keep the config consistent.

---

## Progress (2026-08-10, via `nid_zyv1x5w08difwfdopm50bt2lu_e`)

**Config adopted — done.** `eslint.config.mjs` at repo root now spreads
`eslint-plugin-obsidianmd`'s `recommended` (which layers in `typescript-eslint`
type-checked) with a type-aware parser (`projectService`) over `src/` + `e2e/`.
`npm run lint` runs it. See that ticket for the single-file verification command.

**Still open here:**
- Fold `lint` into `npm run check` / CI as a gate — BLOCKED until the per-group
  `no-unsafe-*` fix tickets land (config surfaces 422 problems today; gating now
  would break `npm run build`).
- Submodule adoption: no `submodules/` dir currently exists in this mirror; revisit
  if/when the submodule is present.
