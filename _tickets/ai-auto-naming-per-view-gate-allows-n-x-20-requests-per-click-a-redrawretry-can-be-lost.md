---
id: nid_6w93jkqxh05riprpeqa8m73fu_e
title: "AI auto-naming: per-view gate allows N x 20 requests per click; a Redraw/Retry can be lost"
status: open
deps: []
links: []
created_iso: 2026-10-07T01:58:31Z
status_updated_iso: 2026-10-07T01:58:31Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
parent: nid_fc47gtxej6z7fqc53bflme8p5_e
tags: []
---

Follow-up from Relationships 4/4 (nid_80xc6z8umlpo1x6u4p1v7eb22_e) review. Known ceilings of the auto-naming gate (`src/view/AiAutoNamingGate.ts`, wired in `src/view/GraphViewController.ts`); both accepted for now.

1. Cost with several views: the gate is per view. One user action that rebuilds N open graph views (e.g. every view follows the active note on a click, or auto mode is turned ON) can start up to N x AI_MAX_REQUESTS_PER_BUILD (20) requests. The queue's latest-wins and dedupe usually cut this down, but it depends on timing. It is bounded, not a chain. Fix if it matters: make the shown-set plugin-lived (one gate shared by all views).
2. A lost user request: if a data-change refresh (e.g. an AI answer landing) supersedes a user-request build before it is offered, that build's user trigger is lost, so a Redraw/Retry pressed while answers arrive may do nothing. It only loses work, never adds cost. Fix: carry a pending user-request flag to the next offer.

Also accepted, no action needed: opening a view lifts a fatal stop once (one cheap retry per opened view).

