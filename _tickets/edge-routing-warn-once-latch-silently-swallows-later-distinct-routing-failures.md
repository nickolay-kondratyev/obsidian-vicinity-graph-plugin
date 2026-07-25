---
id: nid_eim1ftv60ybxzcucgf7rf4gk8_e
title: "edge routing: warn-once latch silently swallows later, distinct routing failures"
status: open
deps: []
links: []
created_iso: 2026-07-25T15:23:01Z
status_updated_iso: 2026-07-25T15:23:01Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [edge-routing, observability]
---

`GraphViewController.resolveRoutes()` (src/view/GraphViewController.ts, around :301) guards its console warning with a `this.routingFailureWarned` boolean latch, so only the FIRST routing failure per view instance is ever reported. Every later failure -- including one with a completely different cause -- is swallowed silently while edges quietly render straight.

Found during review of the teardown-flush fix (ticket nid_oy3vas85xhr34n2dby1mvows4_e). Not introduced by that work; the latch predates it. It matters more now that we know routing can fail for structurally different reasons (contract violation vs. non-finite geometry vs. a dead wasm module).

The latch exists to avoid flooding the console on every rebuild, which is a legitimate concern -- do not simply remove it.

## Design

Keep flood protection but stop losing distinct signals. Cheapest reasonable option: latch per distinct failure signature (e.g. error name + message) rather than a single boolean, so a NEW kind of failure still warns once. Weigh against simply logging at debug level for repeats.

## Acceptance Criteria

- A second routing failure with a DIFFERENT error still produces exactly one warning.
- A repeated identical failure still warns only once (no console flood).
- BDD test in src/view/GraphViewController.test.ts using the existing FakeEdgeRouter.
- npm run check and npm test green.

