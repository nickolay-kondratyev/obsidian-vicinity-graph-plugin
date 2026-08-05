---
id: nid_tclb98q9hxhmcuonamvr4ig1f_e
title: "UX decide: hover pin chip is hidden on small nodes — now including a default-sized empty MAIN/pinned central"
status: open
deps: []
links: []
created_iso: 2026-08-04T23:36:52Z
status_updated_iso: 2026-08-04T23:36:52Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [ui, decide]
---

Pre-existing density rule: the hover pin chip renders only when the node is at least 72px CONTENT-box tall (`src/view/graph-view.css`, the @container (min-height: 72px) reveal — about 90px border-box after padding+border). Below that, pin/unpin is only reachable via the node's right-click menu.

Content-fit sizing (ticket nid_cx5zoz7ptucg9nxalibv0mbjb_e, owner-decided) made this the COMMON case: a title-only note now renders at ~minPx (40px), and an EMPTY central sits at the 0.35 prominence floor = 82px border-box (64px content) — so even the MAIN central of an empty note has NO hover pin affordance at shipped defaults. Two e2e pin fixtures had to be padded with headings to keep the hover gesture testable (e2e/controlsRestart.e2e.ts, e2e/pinnedCentralScenario.e2e.ts).

Options to decide between (not exclusive):
1. Always reveal the pin chip on hover regardless of node height (maybe a smaller chip below 72px).
2. Raise CENTRAL_PROMINENCE_FLOOR_SCORE so a default central clears the chip threshold (0.35 -> ~0.42 at 40/160 defaults) — couples a sizing constant to a CSS density threshold.
3. Lower the chip threshold.
4. Accept the context-menu-only affordance for small nodes (status quo; violates do-not-make-me-think for the most common pin gesture).

## Acceptance Criteria

Owner decision recorded; if a change is made, the hover pin affordance on a default-sized (empty, title-only) node and on an empty MAIN central is either present or explicitly decided against, with e2e coverage matching.


## Notes

**2026-08-05T00:55:15Z**

Partly moved by the reveal-floor fix (nid_1mq3t7706vw2kj2kv7ljqlw6l_e): a node carrying an outline or a thumbnail is now floored at 122px and one carrying attachments at 90px, so BOTH clear the chip's 90px threshold. Still open for the cases named above: a title-only note (minPx, 40px) and an EMPTY MAIN/pinned central (prominence floor, 82px) have no hover pin affordance.
