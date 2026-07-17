# IMPLEMENTATION — step-01-scaffold — PUBLIC

READY_FOR_REVIEW: yes

## What was built

Complete plugin dev environment on branch `step-01-scaffold` (commit "Scaffold plugin dev environment (step-01)"):

- **Toolchain**: `package.json` (type: module), `tsconfig.json` (strict + noUncheckedIndexedAccess +
  isolatedModules + `jsx: react-jsx` + resolveJsonModule — mirrors the submodule's strictness),
  `esbuild.config.mjs` (sample-template externals: `obsidian`, `electron`, `@codemirror/*`, `@lezer/*`,
  node builtins; cjs/es2021; inline sourcemaps in dev, minify in prod).
- **React 18 view**: `src/view/NeighborhoodGraphView.tsx` — `ItemView` with `createRoot(this.contentEl)`
  in `onOpen`, `root.unmount()` in `onClose`; renders `src/view/HelloGraph.tsx` under `<StrictMode>`.
  View type `neighborhood-graph-view`. `src/main.ts` registers the view + an "Open neighborhood graph"
  command that activates it in the right sidebar.
- **Submodule wiring**: `"obsidian-id-lib": "file:submodules/obsidian-id-lib"`; raw TS bundled by our
  esbuild (verified: id-lib's registry-key string and react are IN `main.js`; `require("obsidian")`
  stays external). Smoke check is real: `main.ts` imports `DocIdServices` and constructs
  `DocIdServices.createDefault(this.app.vault)` in `onload` (verified side-effect-free/no-IO
  construction) with a WHY comment; real consumers arrive in step-03.
- **Tests**: `src/manifest.test.ts` (BDD GIVEN/WHEN/THEN, one assert per test): manifest id and
  minAppVersion floor. `vitest.config.ts` includes `src/**/*.test.{ts,tsx}` only (keeps the
  submodule's suite out of our runner — it needs its own obsidian mock alias).
- **Submodule test loop** (clarification item 3 → wired, it was cheap): `npm test` =
  `vitest run && npm run test:sublib`; `test:sublib` = `npm --prefix submodules/obsidian-id-lib install
  && npm --prefix ... test`. Leaves the submodule working tree clean (own .gitignore + lockfile stable).
- **Dev vault**: esbuild `onEnd` plugin copies `main.js`/`manifest.json`/`styles.css` into
  `.dev-vault/.obsidian/plugins/<manifest.id>/` after every successful build (dev watch AND prod).
  Plugin dir derived from `manifest.json` id — single source of truth.
- **Hygiene**: `.gitignore` (node_modules, main.js, *.map, .dev-vault/, .tmp/, .out/, .idea/, data.json),
  `versions.json` ("0.1.0": "1.12.4"), README dev-setup section.

## Key decisions + rationale

1. **minAppVersion "1.12.4"** (human-approved, BINDING): floor only, no upper bound. WHY recorded in
   README ("minAppVersion" section, cites 1.12 changelog) and as a comment atop `src/main.ts` —
   JSON can't carry comments. The old "canvas metadata.frontmatter version" premise is false.
2. **`build` = `npm run check && node esbuild.config.mjs production`** — DRY: type-check reused, not
   duplicated inline like the sample template.
3. **React pinned to ^18.3.x** (deps AND @types) — plan decision / React Flow compat; do not bump to 19.
4. **Sublib suite chained into default `npm test`** — the clarification's "cheap single-npm-script"
   bar was met; nested `npm install` is ~0.6s warm.

## How to run

```bash
git submodule update --init && npm install   # fresh clone
npm run build   # tsc -noEmit + bundle + copy to dev vault
npm test        # our vitest (2 tests) + sublib suite (69 tests)
npm run check   # tsc -noEmit (includes DocIdServices import smoke)
npm run dev     # watch mode, re-copies artifacts on rebuild
```

## Verification results (actual runs, 2026-07-16)

- `npm run check` → exit 0.
- `npm run build` → exit 0; `main.js` (149 KB) produced; artifacts present in
  `.dev-vault/.obsidian/plugins/obsidian-neighborhood-graph/` (main.js, manifest.json, styles.css).
- `npm test` → exit 0; ours: 1 file / 2 tests passed; sublib: 6 files / 69 tests passed.
- Bundle sanity: `require("obsidian")` present (external), "hello graph" + id-lib lock-registry key
  present (bundled). Submodule git tree clean after test:sublib.

## Human verification still needed (cannot run GUI here)

- Open `.dev-vault/` in Obsidian ≥1.12.4, enable community plugins + "Neighborhood Graph", run the
  "Open neighborhood graph" command → view opens, renders "hello graph", no console errors on
  load/open/close.

## Follow-ups / tickets

1. **ESLint setup** — out of scope for step-01 per plan. Adopt the sample template's ESLint 9 flat
   config + `eslint-plugin-obsidianmd` later; mirrors the same follow-up already noted in the
   submodule's README.
2. Environment note for future agents: the bare `npm` shell wrapper in this env intermittently exits 1
   with no output — use `/usr/local/bin/npm` explicitly in Bash tool calls (npm-run scripts internally
   are unaffected).

## #QUESTION_FOR_HUMAN

None — all clarification decisions were implementable as approved.
