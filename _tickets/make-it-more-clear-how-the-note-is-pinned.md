---
id: nid_s88z29iparzxrtxhh6ooqfvrz_e
title: make it more clear how the note is pinned,
status: closed
deps: []
links: [nid_am38wsuka3mksh9atugg1e3x6_e, nid_58tc5g45zwktin78593bi9jkr_e]
created_iso: '2026-08-07T21:21:27Z'
status_updated_iso: '2026-08-10T19:10:31Z'
type: task
priority: 3
assignee: nickolaykondratyev
tags:
  - ui
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
TASK: lets discuss the depth idea and see if it aligns with UX principles and the overall design.

Think through how to visualize this (maybe try multiple different ways). Possible have the type of the pinned pin be visible even without hovering next to the note.

I am thinking about adding DEPTH to the icons in the nodes. By adding depth (See /Users/nkondrat/vintrin-env/config/claude/ai_input/deeper/ui/part_6_creating_depth.md as one of the resources). By adding depth to the design we will be able to show that the button is pressed in when we show the pinned icon. And the user would have the easy signifier of seeing what is pressed in on the note when they hover over the note.

---

## 2026-08-10 — Design discussion COMPLETE, awaiting human decision (`decide`)

The requested discussion/exploration was done; the ticket stays OPEN because the option
choice (and then implementation) needs the human. **Questions to answer are in
`.out/current_decision.md`** (regenerate the mock below if `.out/` was cleaned).

### Current-state findings (why the state is unclear today)

- Pin chips (`src/view/NoteNode.tsx` `PinButton`, styled in `src/view/graph-view.css`
  `.vicinity-graph-node-chip`) are **hover-only**; idle nodes show pin state only via the
  `data-tier="pinned-central"` dashed accent border — which does not distinguish
  global vs local pin, nor show both-pinned.
- The chip icon shows the **action** (`pin-off`/`map-pin-off` when pinned — see
  `src/view/nodePinAction.ts`), which at a glance reads as "not pinned": the icon
  communicates the opposite of the state.

### Depth-idea verdict: ALIGNED with UX principles, with two caveats

Pressed-in = active is the standard toggle idiom (Jakob's Law), and it is a shape/shadow
cue, not color-only (a11y). part_6 mapping: raised chip keeps its `--shadow-s` drop
shadow; pinned chip swaps it for `inset` top shadow + lighter bottom lip + darker face
+ accent icon, exposed as `aria-pressed`. Caveats: (1) at 20px/14px chip sizes depth
alone is too subtle — pair with accent color; (2) depth alone is invisible while idle,
so it cannot by itself satisfy "visible without hovering".

### Options explored (visual mock: `.out/pin-depth-mock/index.html` + `mock.png`, light+dark)

- **A — depth only**: pressed-in pinned chip on hover; constant glyph per control.
- **B — visibility only**: pinned chip never hides; idle form is a chrome-less accent
  icon badge (pin type readable at a glance); unpinned chips stay hover-only.
- **C — A+B (RECOMMENDED)**: idle accent badge + pressed-in chip among raised ones on
  hover. Both ticket asks, one mechanism; CSS-only plus small `PinButton` /
  `nodePinAction` change (`aria-pressed`, constant glyphs — `*-off` icons remain only
  in the context menu, where entries are actions).
- **D — encode pin type in border style**: REJECTED (unlearnable; both-pinned needs a
  third style; combinatorial).

### 2026-08-10 (later) — HUMAN INPUT: hover-to-discover is acceptable for now

Scope narrows to **Option A (depth only, on hover)**: pressed-in pinned chips with
constant glyphs, `aria-pressed`, action copy in the tooltip. The idle-visibility half
(Options B/C — pinned chip visible as an accent badge without hover) is DEFERRED to a
follow-up ticket (see links). Remaining confirmation before implementing, in
`.out/current_decision.md`: (1) Option A as scoped, (2) alignment to update the two
`NoteNode.component.test.tsx` expectations that assert the `*-off` chip icons.

### Implementation notes for whoever picks this up (after the decision)

- Constant-glyph change touches `nodePinAction.ts` icon fields and two
  `NoteNode.component.test.tsx` expectations — behavior-capturing tests, so the
  decision reply is the explicit alignment to change them.
- Idle badge = keep pinned chips at `opacity: 1` with chrome stripped via a
  `[aria-pressed="true"]` selector; hover restores chrome. Below the 18px withhold
  band badges disappear with the chips (consistent with today).
- e2e: view-layer CSS/DOM change ⇒ run `npm run test:e2e -- vicinityGraph.e2e.ts`.

## 2026-08-10 — RESOLVED: Option A implemented (pressed-in pin chips on hover)

Human confirmed (interactive session): hover-only is fine; the pressed-in/raised
treatment shows on hover only. Implemented:

- `src/view/nodePinAction.ts`: both action types gained `chipIconId` — the CHIP's
  constant toggle glyph (`pin` / `map-pin`) — while `iconId` remains the context
  MENU's action glyph (`pin-off` / `map-pin-off` when pinned). WHY documented at
  the type.
- `src/view/NoteNode.tsx` `PinButton`: now a toggle — renders `chipIconId` and
  `aria-pressed` (from `isGloballyPinned` / `isLocallyPinned`).
- `src/view/graph-view.css`: `.vicinity-graph-node-chip[aria-pressed="true"]` =
  press-into-the-page treatment per part_6 (inset top shadow + faint lighter bottom
  lip replacing the raised drop shadow) + accent icon + darker face (depth alone is
  too subtle at 20px/14px). rgba neutrals, not theme vars — themes are arbitrary.
- Tests (failing-first): `nodePinAction.test.ts` pins the constant-chip-glyph
  contract; `NoteNode.component.test.tsx` pins `aria-pressed` per pin kind, the
  rendered chip glyph staying `pin`/`map-pin` while pinned, and the menu keeping
  the `*-off` action icons.
- Gates: `npm run check` ✓, `npm test` (1830) ✓, e2e `vicinityGraph` +
  `localPinScenario` + `pinnedCentralScenario` (32) ✓.

Deferred idle-visibility half (visible without hover) tracked in linked ticket
`nid_am38wsuka3mksh9atugg1e3x6_e`.
