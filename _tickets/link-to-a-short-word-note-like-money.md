---
closed_iso: 2026-08-10T19:23:07Z
id: nid_vtizb5sqefquytcnfe1r73ybe_e
title: link to a short word note like money
status: closed
deps: []
links: []
created_iso: '2026-08-10T18:42:21Z'
status_updated_iso: 2026-08-10T19:23:07Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
---
When we link to a note that is short named it renders poorly.

Example lets say we are in a note 'hi' (main note) and we link to the note named money. 

```
[hi] --> [money]
```

Right now it will render as 
```
[hi] -> [mone
            y]
```

With the 'y' going on the next line.

## Resolution (2026-08-10) — CLOSED

**Root cause.** A node's width is the char-count label estimate
`estimateNodeLabelWidthPx` (`src/engine/constants.ts`), `ceil(len * NODE_TITLE_CHAR_WIDTH_PX) + padding`.
`NODE_TITLE_CHAR_WIDTH_PX` was `7` — a snug MEAN glyph advance. For a short title
whose glyphs run wider than the mean (`money`: its `m` alone is ~0.8em), the box
came out a hair too narrow, and the title's `overflow-wrap: anywhere`
(`src/view/graph-view.css`) then broke the trailing letter onto a second line
(`mone` / `y`). Long titles were unaffected — they pin to `NODE_MAX_LABEL_WIDTH_PX`
and wrap onto the 4 clamp lines by design.

**Fix.** Bumped `NODE_TITLE_CHAR_WIDTH_PX` 7 → 8 (a slight OVER-estimate). The
overshoot only widens SUB-cap titles — exactly where the one-line fit must hold —
while over-cap titles still pin to the cap and wrap as before. One constant; both
the node width (`src/view/graphIdentity.ts`) and the title-line-count height
estimate (`src/engine/NodeSizer.ts`) read it, so they stay consistent.

**Tests.**
- New real-Obsidian e2e `e2e/nodeTitleWrap.e2e.ts`: a note linking to `money`
  must render its title on ONE line (measured via `scrollHeight / lineHeight`).
  Confirmed RED before the fix (2 lines), GREEN after. This is the true behavior
  capture — the fit is a browser-layout fact no jsdom/vitest test can observe.
- Updated the stale `15*7` arithmetic comment in `src/view/graphIdentity.test.ts`
  (the assertion reads the constant, so it stayed green).

**Collateral fixed.** Wider nodes shifted `fitView` layout enough to expose a
PRE-EXISTING fragility in `e2e/localPinScenario.e2e.ts`: its fixtures used bare
filename titles (`lp_a`), sizing nodes so narrow that the LEFTMOST of the three
hover chips (the local-pin) was clipped almost entirely outside the node, its
centre landing on the pane (the accepted narrow-node edge in
`docs-internal/tickets/ticket-pin-offset-centre-clearance.md`). The test passed
by luck at the old zoom. Gave those fixtures descriptive frontmatter `title`s so
the nodes are wide enough to hold all three chips — `[[lp_a]]` wikilinks still
resolve by filename, so only the rendered width changed.

**Verification.** `npm run check` (tsc src + e2e), `npm test` (1817 unit),
`npm run test:e2e` (162 e2e, pinned build) — all green.
