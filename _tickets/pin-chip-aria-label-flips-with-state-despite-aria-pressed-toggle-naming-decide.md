---
id: nid_58tc5g45zwktin78593bi9jkr_e
title: "Pin chip aria-label flips with state despite aria-pressed (toggle naming, decide)"
status: open
deps: []
links: [nid_s88z29iparzxrtxhh6ooqfvrz_e]
created_iso: 2026-08-10T20:24:41Z
status_updated_iso: 2026-08-10T20:24:41Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [ui, a11y, decide]
---

The pin chips became aria-pressed TOGGLES (ticket nid_s88z29iparzxrtxhh6ooqfvrz_e), but their accessible name still flips with state ("Pin to graph" <-> "Unpin from graph", src/view/nodePinAction.ts title -> PinButton aria-label in src/view/NoteNode.tsx). WAI-ARIA APG says a toggle using aria-pressed should keep a CONSTANT name — a pinned chip currently announces "Unpin from graph, pressed", which reads as the UNPIN action being engaged.

DECIDE: keep action-copy names (drop aria-pressed semantics claim) OR give NodePinAction a constant chipLabel ("Pin to graph"/"Pin for this note") used for aria-label while title keeps the action tooltip copy.

BLOCKED on human alignment because the flipping labels are pinned by behavior-capturing tests: src/view/NoteNode.component.test.tsx (aria-label assertions) and e2e/pinnedCentralScenario.e2e.ts / e2e/localPinScenario.e2e.ts.

--------------------------------------------------------------------------------
HUMAN: help me understand why would we NOT want the hover to change, if the changing hover gives more info to the user?