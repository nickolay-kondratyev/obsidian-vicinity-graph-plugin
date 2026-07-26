---
id: nid_r8lm69vcsybjkgffqyrfex6j1_e
title: "[decide] edge routing: EdgeRouter.route() has no typed error channel"
status: open
deps: []
links: [nid_eim1ftv60ybxzcucgf7rf4gk8_e]
created_iso: 2026-07-25T16:15:20Z
status_updated_iso: 2026-07-25T16:15:20Z
type: task
priority: 4
assignee: CC_WITH-nickolaykondratyev
tags: [edge-routing, observability]
---

`EdgeRouter` (src/view/edgeRouting.ts, ~:63) is declared as `route(input: EdgeRoutingInput): Promise<EdgeRouteMap>` with no typed error channel, so `GraphViewController.resolveRoutes()` catches `unknown` and must reason about failures purely by stringifying whatever arrives.

Structurally distinct causes currently share that untyped channel:
- retryable wasm-init failure (src/view/libavoidLoader.ts clears its cache on failure, so init is explicitly retryable)
- explicit contract violation (`edge ... references an obstacle with no registered shape`, src/view/edgeRouting.ts ~:474)
- native libavoid/wasm abort surfacing as a JS error (e.g. RangeError)

Surfaced while fixing nid_eim1ftv60ybxzcucgf7rf4gk8_e (warn-latch dedup). That fix works fine on top of the untyped channel — this is a design-quality follow-up, NOT a defect, and may well be judged not worth doing.

## Design

Option A: a discriminated `RoutingFailure` result type (cause: "wasm-init" | "contract" | "router-abort") returned rather than thrown.
Option B: named error subclasses thrown by LibavoidEdgeRouter, so callers can branch on class instead of message text.

Weigh honestly against 80/20: the ONLY consumer today is one catch block that logs and falls back to straight edges. Typed causes buy little unless a caller wants to act differently per cause (e.g. retry wasm-init but not a contract violation). Closing this as WONTFIX is an acceptable outcome.

## Acceptance Criteria

Either a typed failure channel exists and GraphViewController branches meaningfully on it, OR the ticket is closed with a written rationale for keeping the untyped channel.


## Notes

**2026-07-26T15:30:39Z**

[decide] The ticket itself lists three materially different outcomes — discriminated RoutingFailure result type, thrown error subclasses, or close as WONTFIX (explicitly acceptable). Human must pick. Verified still open: src/view/edgeRouting.ts:65 returns Promise<EdgeRouteMap>; GraphViewController.resolveRoutes (src/view/GraphViewController.ts:256-281) uses a plain try/catch + warn-once latch.
