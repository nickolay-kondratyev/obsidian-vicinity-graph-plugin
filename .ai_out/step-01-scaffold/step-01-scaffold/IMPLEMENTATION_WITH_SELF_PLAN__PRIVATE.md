# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE memory (step-01-scaffold)

## Task understanding
Scaffold the plugin dev environment per docs-internal/plan/steps/step-01-scaffold.md.
Binding decisions (CLARIFICATION__PUBLIC.md): minAppVersion "1.12.4" (floor, no ceiling; WHY = 1.12 core canvas
link indexing, NOT "canvas metadata.frontmatter version" — that premise is false); id `obsidian-neighborhood-graph`,
name "Neighborhood Graph"; sublib vitest wired if single-npm-script cheap.

## Environment facts
- node v26.5.0, npm at /usr/local/bin. Shell profile prints red `NVM_SH` noise to stderr — harmless, ignore.
- Branch: step-01-scaffold. `ask.dnc.md` + `.idea/` are ignored via the USER's global gitignore (not repo).
- Do NOT use `_git.save` (hangs on /dev/tty). Plain git add/commit.
- Redirect npm/tsc output to .tmp/ files.

## Plan

**Goal**: Working dev loop — build, test, check, dev-vault artifact placement — before any product code.

**Steps**:
1. [x] Recon (done — EXPLORATION_PUBLIC.md was complete; verified DocIdServices + CrossPluginPathLock ctor is side-effect free → safe to construct in onload)
2. [x] Config files: package.json, tsconfig.json (strict, jsx react-jsx, resolveJsonModule), esbuild.config.mjs (externals per sample template + copy-to-dev-vault onEnd plugin, plugin dir derived from manifest.id — DRY), vitest.config.ts (include src/** only — keeps submodules/ tests out of our runner; they need their own obsidian mock alias), manifest.json, versions.json, styles.css, .gitignore
3. [x] npm install (log to .tmp/) — 69 pkgs, ok
4. [x] src/main.ts (plugin: registerView + command to open view + DocIdServices smoke wiring), src/view/NeighborhoodGraphView.tsx (createRoot in onOpen / unmount in onClose), src/view/HelloGraph.tsx
5. [x] src/manifest.test.ts (BDD, one assert per test: id, minAppVersion)
6. [x] Verify: build exit 0 (main.js 149KB + 3 artifacts in .dev-vault/.obsidian/plugins/obsidian-neighborhood-graph/), check exit 0, test exit 0 (ours 2 passed; sublib 69 passed; submodule tree stays clean after test:sublib)
7. [x] README stub update (fresh-clone flow, scripts table, dev vault usage, minAppVersion WHY)
8. [x] PUBLIC/PRIVATE .ai_out files, commits at milestones (commit 1 = scaffold; commit 2 = .ai_out)

**Key decisions**:
- `test` = `vitest run && npm run test:sublib`; `test:sublib` = `npm --prefix submodules/obsidian-id-lib install && npm --prefix submodules/obsidian-id-lib test`. This IS the "cheap single-npm-script" wiring approved in clarification; chained into default `npm test` so the loop actually runs it.
- `build` = `npm run check && node esbuild.config.mjs production` (DRY: reuses check; template does tsc inline).
- DocIdServices smoke = real value import + `createDefault(this.app.vault)` in onload stored as a field
  (constructor chain does zero IO — verified CrossPluginPathLock lazily creates its registry). WHY comment in main.ts.
- React 18 pinned (^18.3.x) with WHY (plan decision; React Flow compat) — do not upgrade to 19.
- Component return types: explicit `ReactElement` (avoids JSX global namespace ambiguity).
- View type id: `neighborhood-graph-view`; icon `network` (lucide).
- versions.json included ("0.1.0": "1.12.4") — standard release plumbing, one line.
- ESLint: OUT OF SCOPE per task → follow-up in PUBLIC file.
- GUI load verification impossible here → human step, noted in PUBLIC.

**Files touched**: package.json, package-lock.json, tsconfig.json, esbuild.config.mjs, vitest.config.ts,
manifest.json, versions.json, styles.css, .gitignore, README.md, src/main.ts,
src/view/NeighborhoodGraphView.tsx, src/view/HelloGraph.tsx, src/manifest.test.ts, .ai_out/… files.

## State
- COMPLETE. All exit criteria verified except Obsidian GUI load (human step, noted in PUBLIC).
- READY_FOR_REVIEW: yes. No #QUESTION_FOR_HUMAN items.

## Iteration (post-review, ITERATION instance)
Review verdict APPROVED; 1 SHOULD_FIX + 3 NITs. Dispositions in IMPLEMENTATION_ITERATION__PUBLIC.md:
- #1 SHOULD_FIX: ESLint follow-up → durable `docs-internal/tickets/ticket-eslint-adoption.md` (new tickets/ convention, orchestrator-mandated; references submodule README follow-up).
- #2 NIT: no-op ctor deleted in NeighborhoodGraphView.tsx (+ unused WorkspaceLeaf import).
- #3 NIT: `docIdService` → `private` (safe: no noUnusedLocals in tsconfig, so write-only private field type-checks).
- #4 NIT: npm install vs npm ci in test:sublib → REJECTED (reviewer said no-action; ci = slow node_modules wipe every run).
Re-verified after code changes: build=0, test=0 (2 + 69 passed), check=0 (logs .tmp/iter-*.log).
CONVERGED: yes. Remaining: human GUI check only.

## Gotchas discovered
- Bare `npm` in this env's Bash intermittently exits 1 with ZERO output (shell wrapper issue;
  the red `NVM_SH not found` stderr line is unrelated noise). Fix: call `/usr/local/bin/npm` explicitly.
  npm-run script internals (sh) are unaffected — `test:sublib`'s nested npm works fine.
- `node --version` etc. also get their output eaten sometimes; write to a file and cat, or use full path.
- npm audit: 0 vulnerabilities; esbuild postinstall scripts ran (code 0) despite allow-scripts warning.
- `ask.dnc.md` and `.idea/` are ignored by the USER's global gitignore, not the repo (repo .gitignore
  still lists .idea/ for other clones).
- Submodule's own `npm install` (test:sublib) does NOT touch its package-lock.json → submodule pointer
  stays clean; safe to run in the default test loop.
