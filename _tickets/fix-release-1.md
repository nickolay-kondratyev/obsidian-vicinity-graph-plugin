---
id: nid_shrhvp6kmzbqwc4chd1k7irzg_e
title: fix release
status: in_progress
deps: []
links: []
created_iso: '2026-08-10T21:11:45Z'
status_updated_iso: '2026-08-10T21:12:28Z'
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
latest release failed on github when we pushed new tag.

Errors below
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
npm error A complete log of this run can be found in: /home/runner/.npm/_logs/2026-08-10T21_09_29_014Z-debug-0.log
Error: Process completed with exit code 1.
```
root cause and fix.
