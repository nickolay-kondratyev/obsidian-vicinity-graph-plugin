---
closed_iso: 2026-08-10T19:38:47Z
id: nid_q4ggdlsjn5wl41mpfv5zd583l_e
title: Fix release
status: closed
deps: []
links: []
created_iso: '2026-08-10T19:28:23Z'
status_updated_iso: 2026-08-10T19:38:47Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-3
---
Release scripts on  

```
Run npm ci
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: '@asamuzakjp/css-color@6.0.5',
npm warn EBADENGINE   required: { node: '^22.13.0 || >=24.0.0' },
npm warn EBADENGINE   current: { node: 'v20.20.2', npm: '10.8.2' }
npm warn EBADENGINE }
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: '@asamuzakjp/dom-selector@8.3.0',
npm warn EBADENGINE   required: { node: '^22.13.0 || >=24.0.0' },
npm warn EBADENGINE   current: { node: 'v20.20.2', npm: '10.8.2' }
npm warn EBADENGINE }
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'jsdom@30.0.1',
npm warn EBADENGINE   required: { node: '^22.22.2 || ^24.15.0 || >=26.0.0' },
npm warn EBADENGINE   current: { node: 'v20.20.2', npm: '10.8.2' }
npm warn EBADENGINE }
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'undici@8.9.0',
npm warn EBADENGINE   required: { node: '>=22.19.0' },
npm warn EBADENGINE   current: { node: 'v20.20.2', npm: '10.8.2' }
npm warn EBADENGINE }
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'whatwg-url@17.1.0',
npm warn EBADENGINE   required: { node: '^22.14.0 || >=24.0.0' },
npm warn EBADENGINE   current: { node: 'v20.20.2', npm: '10.8.2' }
npm warn EBADENGINE }
npm error code EUSAGE
npm error
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
npm error
npm error Missing: esbuild@0.28.2 from lock file
npm error Missing: @esbuild/aix-ppc64@0.28.2 from lock file
npm error Missing: @esbuild/android-arm@0.28.2 from lock file
npm error Missing: @esbuild/android-arm64@0.28.2 from lock file
npm error Missing: @esbuild/android-x64@0.28.2 from lock file
npm error Missing: @esbuild/darwin-arm64@0.28.2 from lock file
npm error Missing: @esbuild/darwin-x64@0.28.2 from lock file
npm error Missing: @esbuild/freebsd-arm64@0.28.2 from lock file
npm error Missing: @esbuild/freebsd-x64@0.28.2 from lock file
npm error Missing: @esbuild/linux-arm@0.28.2 from lock file
npm error Missing: @esbuild/linux-arm64@0.28.2 from lock file
npm error Missing: @esbuild/linux-ia32@0.28.2 from lock file
npm error Missing: @esbuild/linux-loong64@0.28.2 from lock file
npm error Missing: @esbuild/linux-mips64el@0.28.2 from lock file
npm error Missing: @esbuild/linux-ppc64@0.28.2 from lock file
npm error Missing: @esbuild/linux-riscv64@0.28.2 from lock file
npm error Missing: @esbuild/linux-s390x@0.28.2 from lock file
npm error Missing: @esbuild/linux-x64@0.28.2 from lock file
npm error Missing: @esbuild/netbsd-arm64@0.28.2 from lock file
npm error Missing: @esbuild/netbsd-x64@0.28.2 from lock file
npm error Missing: @esbuild/openbsd-arm64@0.28.2 from lock file
npm error Missing: @esbuild/openbsd-x64@0.28.2 from lock file
npm error Missing: @esbuild/openharmony-arm64@0.28.2 from lock file
npm error Missing: @esbuild/sunos-x64@0.28.2 from lock file
npm error Missing: @esbuild/win32-arm64@0.28.2 from lock file
npm error Missing: @esbuild/win32-ia32@0.28.2 from lock file
npm error Missing: @esbuild/win32-x64@0.28.2 from lock file
npm error
npm error Clean install a project
npm error
npm error Usage:
npm error npm ci
npm error
npm error Options:
npm error [--install-strategy <hoisted|nested|shallow|linked>] [--legacy-bundling]
npm error [--global-style] [--omit <dev|optional|peer> [--omit <dev|optional|peer> ...]]
npm error [--include <prod|dev|optional|peer> [--include <prod|dev|optional|peer> ...]]
npm error [--strict-peer-deps] [--foreground-scripts] [--ignore-scripts] [--no-audit]
npm error [--no-bin-links] [--no-fund] [--dry-run]
npm error [-w|--workspace <workspace-name> [-w|--workspace <workspace-name> ...]]
npm error [-ws|--workspaces] [--include-workspace-root] [--install-links]
npm error
npm error aliases: clean-install, ic, install-clean, isntall-clean
npm error
npm error Run "npm help ci" for more info
npm error A complete log of this run can be found in: /home/runner/.npm/_logs/2026-08-10T19_15_43_836Z-debug-0.log
Error: Process completed with exit code 1.
```

## Notes

**2026-08-10T19:38:47Z**

RESOLVED (commit 54325af on branch CC_nid_q4ggdlsjn5wl41mpfv5zd583l_e__fix-release_claude-opus-4-8).

Root cause: the "Release 0.1.2" bump moved package.json/manifest.json/versions.json
to 0.1.2 but left package-lock.json's version at 0.1.1 (npm stores the package
version in TWO spots: top-level `version` and `packages[""].version`). `npm ci`
in .github/workflows/release.yml refuses when the lock's version disagrees with
package.json — that is the "lock file out of sync" failure. scripts/bump-version.py
never touched the lock, and release_update_tag.sh never staged it, so EVERY release
would reproduce this.

(The "Missing esbuild@0.28.2" lines in the log are npm's generic follow-on noise
once it declares the lock out of sync; the primary, actionable error is the version
mismatch. esbuild in this repo is 0.25.x and now fully in sync.)

Fix:
- scripts/bump-version.py: new update_lockfile_version() bumps BOTH root versions in
  package-lock.json (byte-preserving; replaces exactly the first two occurrences,
  refuses on any other count).
- release_update_tag.sh: stages package-lock.json in the release commit; header/inline
  docs updated three-file -> four-file.
- package-lock.json: resynced to 0.1.2 (fixes the already-broken committed state).
- src/releaseVersionConsistency.test.ts: NEW tripwire asserting package.json,
  manifest.json, versions.json and BOTH package-lock.json versions agree. Runs in
  `npm test` (the CI gate), so future drift fails BEFORE a tag is cut. Verified it
  fails on the 0.1.1 lock and passes on 0.1.2.
- docs-internal/RELEASE_CHECKLIST.md §3 updated to four files.

Verification (all green): npm run check; npm test (1827 passed); npm run build;
npm ci --dry-run EXIT=0; ran bump-version.py end-to-end (0.1.2 -> 0.1.3) and
confirmed all four files coherent + npm ci --dry-run still passes, then restored.

NOTE: the EBADENGINE warnings (jsdom/undici/etc. wanting Node >=22 on CI's Node 20)
are pre-existing WARNINGS, not the failure, and are out of scope here. If desired,
bumping actions/setup-node to node-version "22" in release.yml would silence them —
worth a separate ticket rather than folding into this release-blocker fix.
