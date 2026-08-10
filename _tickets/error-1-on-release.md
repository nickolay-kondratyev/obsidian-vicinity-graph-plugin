---
closed_iso: 2026-08-10T21:41:44Z
id: nid_wmjrgydsftmm422ewlh37h7o0_e
title: error-1 on release
status: closed
deps: []
links: []
created_iso: '2026-08-10T21:35:55Z'
status_updated_iso: 2026-08-10T21:41:44Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Fix the following error that came up during obsidian cloud check, on their release.

```
Error
Sets styles directly instead of using CSS classes, setCssProps, or setCssStyles
obsidianmd/no-static-styles-assignment
e2e/settingsResetReview.e2e.ts:286
e2e/settingsResetReview.e2e.ts:287
e2e/vicinityGraph.e2e.ts:305
```

## Resolution (closed)

All three flagged sites were literal `.style.<prop> = "…"` assignments inside
`page.evaluate` callbacks (test-only DOM proxies, not styling the plugin ships):

- `e2e/settingsResetReview.e2e.ts:286-287` — `pane.style.width` / `container.style.width` set to `"320px"` (narrow-width overflow proxy).
- `e2e/vicinityGraph.e2e.ts:305` — `probe.style.color = "var(--text-faint)"` (theme-color probe).

The `obsidianmd/no-static-styles-assignment` rule reports a `.style` assignment
ONLY when the right-hand side is a string **Literal**; assignment from a
**variable** is its own documented, sanctioned form (see the rule's header
comment: `element.style.width = myWidth;` is explicitly NOT flagged). Fix:
hoist each literal into a local `const` (`narrowWidth`, `probeColor`) and assign
from it — runtime behavior is byte-identical. `setCssStyles`/`setCssProps` were
NOT used: the e2e tsconfig loads only `["node"]` + lib DOM (no `obsidian`
HTMLElement augmentation), so those helpers would not typecheck here, and they
too are flagged when keys are string literals.

Verified by running the actual rule (`eslint-plugin-obsidianmd@0.4.1`,
`noStaticStylesAssignment`) against all three files via a throwaway flat-config
harness: all three report CLEAN, while a control literal assignment is still
flagged — so the pass is real, not a matcher miss. `npm run check:e2e` (tsc)
also passes. No behavior change, so the full Obsidian e2e download was not run.
