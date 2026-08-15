---
closed_iso: 2026-08-15T00:14:28Z
session_ids: [{"a": "claude", "type": "decision", "id": "c1d4e7bf-953b-43e5-991d-b47f862b9a45"}]
id: nid_my99vi73iouq1y9hkomoedqgd_e
title: "Consider layout awareness of piercing edges (pull linked inner nodes together)"
status: closed
deps: [nid_dwoixmdm1h59cw3bc2f6noejv_e]
links: []
created_iso: 2026-08-14T23:39:17Z
status_updated_iso: 2026-08-15T00:14:28Z
type: task
priority: 4
assignee: nickolaykondratyev
tags: []
---

Future consideration recorded per human decision D2 on plan ticket nid_6fkhyw97hjs84xb62z6tommhi_e ("Edge depth into groups" / piercing edges): the feature is RENDER-ONLY - elk/d3 layout keeps consuming the depth-0 collapsed edge projection (src/view/elkMapping.ts attachEdgesToContainers), so two cross-group linked INNER notes are not pulled closer together by their piercing edge.

DECIDE (human): is the layout pull-in worth the complexity? Doing it likely means elk hierarchical edge handling (INCLUDE_CHILDREN) or a d3 force term fed by deep edges - both materially more complex than the render-only path, which is why it was deferred (80/20).

Prereq context: plan ticket nid_6fkhyw97hjs84xb62z6tommhi_e and the two implementation tickets it names must be done first.

## DECISION (2026-08-14, decision session): NOT worth it — WONTFIX, closed

**Layout stays on the depth-0 collapsed projection. No elk INCLUDE_CHILDREN, no deep-edge d3 force term.** Rationale, in order of weight:

1. **The benefit is already mostly delivered by today's layout.** Layout consumes the collapsed group-to-group edge (src/view/elkMapping.ts attachEdgesToContainers), so the two GROUPS containing cross-linked inner notes are already pulled together at the root level. The only increment this ticket could add is biasing WHERE inside its box each inner note sits (toward the linked neighbor group).
2. **That increment is unreachable under the shipped interior algorithm — by explicit owner decision.** Group interiors are elk rectpacking, which is edge-blind. Closed ticket nid_7abfje1vus15rx9hzmpel9jin_e (same day, 2026-08-14) built, measured and screenshot a fully working edge-aware force interior (−76% crossings, −39% edge length, +9.4% area, time in budget) and the owner tried it on a real vault and REJECTED it on looks; rectpacking stays (`GROUP_INTERIOR_LAYOUT` in src/view/constants.ts carries the record). Feeding deep edges into layout cannot pull inner nodes anywhere while the interior placer ignores edges — so this ticket's payoff is gated on reversing a decision the owner made with full evidence in hand. Deciding "yes" here would contradict that pick.
3. **The cost side was already judged once.** Human-signed D2 on the plan ticket (nid_6fkhyw97hjs84xb62z6tommhi_e) chose RENDER-ONLY precisely because both mechanisms are materially more complex than the render path, and it survives the piercing-edge feature unchanged: the render/layout split (flowMapping deep, elkMapping depth-0) is a clean seam worth keeping.

**Re-open trigger (recorded so nothing is lost):** if the owner ever flips `GROUP_INTERIOR_LAYOUT` to `"force"` (a one-constant flip — the machinery stays built per nid_7abfje1vus15rx9hzmpel9jin_e), feeding deep edges into the per-container d3 refinement becomes a natural small follow-up; file a NEW ticket then, ideally with a real-vault screenshot showing linked inner notes stranded on far sides of their groups at N>0. Until both that flip AND that visual evidence exist, there is nothing actionable here.

**Rejected options:**
- *Decide YES (implement pull-in)* — contradicts the owner's same-day rectpacking pick (point 2); pays the INCLUDE_CHILDREN/force-term complexity for an effect the interior placer would discard.
- *Keep open, revisit after the piercing feature ships* — parks an un-runnable ticket on a hypothetical; the re-open trigger above is cheaper and loses nothing.
- *Escalate to the human* — unnecessary: the owner's two 2026-08-14 decisions (D2 render-only; rectpacking over measured edge-aware interiors) jointly determine the answer.

