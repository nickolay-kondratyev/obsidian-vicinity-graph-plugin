---
closed_iso: 2026-08-11T13:58:22Z
id: nid_6foww1s1ekufrnha1t4j08wnn_e
title: we have moved the e2e into submodule and now github flow is failing
status: closed
deps: []
links: []
created_iso: '2026-08-11T13:40:52Z'
status_updated_iso: 2026-08-11T13:58:22Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
github workflow is failing lets make sure github workflow is not failing
```
Run npm run check

> vicinity-graph@0.1.10 check
> tsc -noEmit && npm run check:e2e


> vicinity-graph@0.1.10 check:e2e
> tsc -noEmit -p e2e/tsconfig.json

error TS5058: The specified path does not exist: 'e2e/tsconfig.json'.
Error: Process completed with exit code 1.
```

We can also SIMPLIFY and just run e2e locally in release shell (release update tag script) and not run them in github.

## Resolution (2026-08-11)

**Root cause.** `.github/workflows/release.yml` checks out the repo with
`actions/checkout@v4` but WITHOUT `submodules: true`. The e2e specs now live in a
private submodule (`.gitmodules` → `e2e`), so `e2e/tsconfig.json` is absent in CI.
`npm run check` → `check:e2e` (`tsc -noEmit -p e2e/tsconfig.json`) then died with
`TS5058: The specified path does not exist: 'e2e/tsconfig.json'`.

**Chosen fix (the SIMPLIFY option).** Kept e2e as the LOCAL release gate — did NOT
wire private-submodule auth into CI (matches `release.yml`'s own "WHY-NOT the
Playwright e2e matrix here" header). Instead `check:e2e` now self-skips when the
submodule is absent:

- Added `scripts/check-e2e.sh`: `exit 0` with a message when `e2e/tsconfig.json`
  is missing, else `exec tsc -noEmit -p e2e/tsconfig.json` (propagates real e2e
  type errors — the skip is guarded to a MISSING file only).
- `package.json`: `check:e2e` → `bash scripts/check-e2e.sh`.
- `release.yml`: renamed the type-check step + comment to note e2e is skipped in
  CI (submodule not checked out).

Because the guard lives inside `check:e2e`, both `npm run check` AND `npm run build`
(which calls `check`) now work in CI without the submodule, while locally and in
`release_update_tag.sh` — where the submodule IS present — the full e2e type-check
still runs.

**Guard so the LOCAL release still runs e2e (never silently skips).** The self-skip
is safe ONLY because it can never suppress e2e in a real release: `release_update_tag.sh`
preflight now REFUSES if the e2e submodule is not checked out
(`git submodule status e2e` prefixes `-` when uninitialised), telling the engineer to
run `git submodule update --init e2e`. So the skip only ever fires in CI (which
intentionally lacks the submodule); a release always runs the real Playwright matrix
(`test:e2e` / `test:e2e:floor`) over actual specs.

**Verified.** `npm run check:e2e` runs `tsc` with the submodule present (passes);
the script prints the skip message + `exit=0` when run where the file is absent;
full `npm run check` passes locally (exit 0). The release preflight guard PASSES with
the submodule present and REFUSES on a simulated uninitialised (`-`) status line. No
test scans package.json scripts, so nothing else needed updating.
