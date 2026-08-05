---
closed_iso: 2026-08-05T16:51:35Z
id: nid_rcs31edfd3uadudhlxo1gdjue_e
title: resize affordance UI
status: closed
deps: []
links: []
created_iso: '2026-08-05T16:43:41Z'
status_updated_iso: 2026-08-05T16:51:35Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
---
Right now resize affordance UI looks clear what it does but it doesn't look as pretty as it can.
The thing that throws me off right now is that when we hover over the node to resize the lines to resize go past the round borders of the nodes that at they are resizing creating an unpolished look


Lets say below is the round the border (pretend / is the round border)
```
   | 
---/
```

Right now the resize lines look as
```
   | 
---/
---- <-resize line
```

While we would want the resize line to stop before the rounding starts
```
   | 
---/
---  <-resize line
```

## Resolution (closed)

The edge grips paint their accent line on a `::after` inside a grab band; both
`::after`s ran the FULL length of their edge (`top/bottom: 0`, `left/right: 0`),
so the line overshot the node's corner arcs.

`src/view/graph-view.css`:
- the node's corner radius became ONE declaration —
  `--vicinity-graph-node-radius: var(--radius-m)` on `.vicinity-graph-flow`.
  `.vicinity-graph-node`'s `border-radius` and the resize lines both read it
  through the cascade, so "where the arc starts" is a single number rather than
  two literals kept in step by a test;
- the right line's `top`/`bottom` and the bottom line's `left`/`right` take that
  radius as their inset; the shared `::after` gained
  `border-radius: calc(var(--vicinity-graph-resize-line-px) / 2)` so the
  pulled-back ends read as round caps, not as a bar cut short.

The inset is on the PAINT only, never on the control box: the box is the
grab band the right/bottom drag depends on, and shrinking it would trade a
cosmetic fix for a smaller drag target right at the corners.

Guard: `src/view/resizeLineInset.test.ts` (new) scans the stylesheet and fails
if either painted line loses the inset on either end, or if the inset leaks onto
a grab band — the two CHOICES the CSS states nowhere. It does NOT re-assert that
the two radii match: the shared token makes that structural. Every lookup throws
when its rule block is gone, so the scan can never pass by finding nothing.
Started from that failing test.

Verified: `npm test` (1634 passed), `npm run check`, and
`npm run test:e2e -- nodeResize.e2e.ts` (13 passed) — plus a throwaway
Playwright screenshot of a hovered node confirming the lines now stop short of
the rounding (script deleted, PNG in `.out/`, not source-controlled).
