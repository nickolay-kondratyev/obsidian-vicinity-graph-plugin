---
closed_iso: 2026-08-10T22:39:19Z
id: nid_58tc5g45zwktin78593bi9jkr_e
title: Pin chip aria-label flips with state despite aria-pressed (toggle naming, decide)
status: closed
deps: []
links: [nid_s88z29iparzxrtxhh6ooqfvrz_e]
created_iso: '2026-08-10T20:24:41Z'
status_updated_iso: 2026-08-10T22:39:19Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [ui, a11y, decide]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
The pin chips became aria-pressed TOGGLES (ticket nid_s88z29iparzxrtxhh6ooqfvrz_e), but their accessible name still flips with state ("Pin to graph" <-> "Unpin from graph", src/view/nodePinAction.ts title -> PinButton aria-label in src/view/NoteNode.tsx). WAI-ARIA APG says a toggle using aria-pressed should keep a CONSTANT name — a pinned chip currently announces "Unpin from graph, pressed", which reads as the UNPIN action being engaged.

DECIDE: keep action-copy names (drop aria-pressed semantics claim) OR give NodePinAction a constant chipLabel ("Pin to graph"/"Pin for this note") used for aria-label while title keeps the action tooltip copy.

BLOCKED on human alignment because the flipping labels are pinned by behavior-capturing tests: src/view/NoteNode.component.test.tsx (aria-label assertions) and e2e/pinnedCentralScenario.e2e.ts / e2e/localPinScenario.e2e.ts.

--------------------------------------------------------------------------------
HUMAN: help me understand why would we NOT want the hover to change, if the changing hover gives more info to the user?

--------------------------------------------------------------------------------
RESOLUTION (chose OPTION 2 — constant chipLabel for aria-label, flipping title kept):

Answer to the HUMAN's question — we DON'T stop the hover from changing. The premise
that "aria-label" and the hover tooltip are the same thing is the crux: they are two
SEPARATE attributes.
  - `title` = the VISIBLE hover tooltip. It STILL flips ("Pin to graph" <-> "Unpin
    from graph"). Sighted users keep the richer, click-predicting hint — exactly the
    "more info" the human wanted to preserve. Nothing here regresses.
  - `aria-label` = the INVISIBLE accessible NAME a screen reader announces alongside
    the pressed state. THAT is the only thing that was wrong: a pinned chip named
    "Unpin from graph" announces "Unpin from graph, pressed", which reads as the UNPIN
    action being engaged. Per WAI-ARIA APG, an aria-pressed toggle keeps a CONSTANT
    name; the state belongs in aria-pressed. Now a pinned chip announces "Pin to
    graph, pressed" = it IS pinned.

Option 1 (drop aria-pressed) was rejected: it would throw away the pressed-in visual
toggle built by ticket nid_s88z29iparzxrtxhh6ooqfvrz_e (CSS + tests depend on it) for
no gain, since Option 2 fixes the bug WITHOUT touching the visible hover.

Implementation:
  - src/view/nodePinAction.ts — added a constant `chipLabel` to `NodePinAction` /
    `NodeLocalPinAction` ("Pin to graph" / "Pin for this note"), same for both states;
    `title` still flips. Same title-vs-chipLabel split as the existing
    iconId-vs-chipIconId (menu ACTION vs chip TOGGLE) split.
  - src/view/NoteNode.tsx — PinButton's `aria-label` now reads `action.chipLabel`;
    `title` still reads `action.title`. The context MENU (an action list) still uses
    `title`.

Tests updated to lock BOTH halves in (name constant, tooltip flips):
  - src/view/nodePinAction.test.ts (chipLabel presence + "name does not flip" guards)
  - src/view/NoteNode.component.test.tsx (aria-label constant, new title-flips tests)
  - e2e/pinnedCentralScenario.e2e.ts, e2e/localPinScenario.e2e.ts (aria-pressed is now
    the toggle-state proof; title asserted as the flipping hover hint)

Verified: npm run check (green), npm test (1849 passed), npm run test:e2e for both
touched specs (5 passed).
