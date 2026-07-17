# IMPLEMENTATION_REVIEW — step-01-scaffold — PUBLIC

Reviewed: commits `d6c13bd` + `9e3abb8` vs `25c33bd`, branch `step-01-scaffold`. Reviewer re-ran all exit criteria independently (2026-07-16).

## Verification results (actual runs, not taken from the implementer's report)

| Command | Result |
|---|---|
| `rm -rf .dev-vault && npm run build` (log: `.tmp/review-build.log`) | exit 0; tsc -noEmit then prod bundle; artifacts re-created from scratch in `.dev-vault/.obsidian/plugins/obsidian-neighborhood-graph/` (main.js, manifest.json, styles.css) |
| `npm test` (log: `.tmp/review-test.log`) | exit 0; our suite 1 file / 2 tests passed; sublib suite 6 files / 69 tests passed; submodule working tree clean afterwards |
| `npm run check` (log: `.tmp/review-check.log`) | exit 0 |
| Bundle sanity on prod `main.js` (148K) | `require("obsidian")` present (external honored), `hello graph` + `react.production` present (our code + React bundled), zero absolute `/home/` paths |
| Fresh-clone portability | `package-lock.json` resolves `obsidian-id-lib` as relative `submodules/obsidian-id-lib`, no machine paths; README orders `git submodule update --init` before `npm install` (required for the `file:` dep) — plausible fresh-clone path confirmed |
| Side-effect audit of runtime smoke check | `DocIdServices.createDefault` (submodule `src/DocIdServices.ts:18-26`) only news up collaborators; `CrossPluginPathLock` constructor only stores `registryHost` — construction in `onload` is IO-free as claimed |

Not verifiable headless: the GUI half of exit criterion 1 (view opens in Obsidian, renders "hello graph", no console errors). See question below.

## Findings

| # | Severity | Location | Issue | Suggested fix |
|---|---|---|---|---|
| 1 | SHOULD_FIX | ESLint follow-up (step doc line 27: "if skipped, ticket it") | The "ticket" exists only inside `.ai_out/.../1_IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` Follow-ups. `.ai_out` is per-step agent memory, not a durable ticket home; it will not surface when someone later asks "what's outstanding?" | Record it in a durable spot, e.g. `docs-internal/plan/follow-ups.md` (one line: adopt sample-template ESLint 9 flat config + `eslint-plugin-obsidianmd`; mirrors submodule README follow-up). Trivial; can be folded into the next commit |
| 2 | NIT | `src/view/NeighborhoodGraphView.tsx:12-14` | Explicit `constructor(leaf) { super(leaf); }` is a no-op — the implicit constructor does exactly this | Delete it |
| 3 | NIT | `src/main.ts:18` | `docIdService` field is implicitly public but has no external consumers until step-03 | `private` until a consumer exists (or leave; step-03 will decide visibility) |
| 4 | NIT | `package.json:14` (`test:sublib`) | Nested `npm install` (not `npm ci`) could in theory drift the submodule's lockfile and dirty its tree. Verified clean today; `npm ci` would wipe node_modules every run (slow), so the current choice is defensible | No action required; if the submodule tree ever shows dirty after `npm test`, switch to `npm ci` and eat the cost |

No BLOCKING findings. No security concerns (no secrets, no injection surfaces; `fs` use is dev-tooling only, cwd-relative). No hacks per CLAUDE.md definitions. No lost functionality (greenfield scaffold; no pre-existing tests or anchor points touched).

## Scope compliance

- In scope, all present: esbuild+TS toolchain w/ template layout; React 18 `ItemView` (`createRoot(contentEl)` in `onOpen`, `unmount()`+null in `onClose` — the documented pattern, no leak); vitest + committed passing tests; submodule `file:` wiring, raw TS bundled, `obsidian` external; manifest id/name/minAppVersion; git-ignored `.dev-vault/` + build copy step; `.gitignore` covers node_modules/main.js/*.map/.tmp//.out//.dev-vault/ while manifest/styles/versions stay tracked; strict tsconfig (strict + noUncheckedIndexedAccess + noImplicitReturns + noFallthroughCasesInSwitch + isolatedModules — verified, actually strict); scripts dev/build/test/check.
- Out of scope, correctly absent: no graph logic, no settings, no ESLint, no React Flow/elkjs deps, no unused code.
- One deliberate over-delivery, accepted: the step only required `DocIdServices` to *type-check*; the implementation also constructs it at runtime in `onload`. Verified IO-free, WHY-documented, and it strengthens the bundling proof — fine.

## Binding-decisions compliance (CLARIFICATION__PUBLIC.md)

- [x] `minAppVersion` = "1.12.4" in `manifest.json:5` and `versions.json`; guarded by a test (`src/manifest.test.ts:13-15`).
- [x] Floor-not-ceiling + WHY documented (JSON can't carry comments): `src/main.ts:6-10` comment + README "minAppVersion" section citing the 1.12 changelog; no upper bound, no version-specific hacks anywhere.
- [x] Plugin id `obsidian-neighborhood-graph` / name "Neighborhood Graph" (`manifest.json:2-3`); id guarded by test.
- [x] Submodule vitest suite wired ("IF cheap" → it was): `test:sublib` chained into default `npm test`; leaves submodule tree clean.

## Quality notes

- Tests are honest and focused: real assertions on the committed manifest (they pin the two human-approved values — meaningful, not fake), GIVEN/WHEN/THEN, one assert per test.
- DRY done right: dev-vault plugin dir derived from `manifest.json` id (`esbuild.config.mjs:17-18`, single source of truth); `build` reuses `check` instead of duplicating tsc flags.
- `activateView` reuse-or-create-leaf + null guard is the sample-plugin idiom and is correct under `noUncheckedIndexedAccess`; no leaf-detach in `onunload` is correct per Obsidian guidance.

## #QUESTION_FOR_HUMAN:

GUI exit criterion still owed (cannot be verified headless): open `.dev-vault/` in Obsidian ≥ 1.12.4, enable "Neighborhood Graph", run the "Open neighborhood graph" command → view opens, shows "hello graph", and open/close produces no console errors. Please confirm before the step is declared fully done.

## Verdict

`VERDICT: APPROVED` — all machine-verifiable exit criteria pass under independent re-run; findings are 1 SHOULD_FIX (ticket durability, doc-only) + 3 NITs, none code-defects; GUI confirmation remains a human checkbox.
