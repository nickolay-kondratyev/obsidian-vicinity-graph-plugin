# DETAILED PLAN — `node-content-preference`

3-way **Preview** setting (`Auto` / `Outline` / `Image`) deciding what a node's
preview slot shows, exposed in the settings tab AND the in-graph controls panel,
**global scope only**, **default `Auto`** (= today's document-position rule,
preserved exactly).

> **Reviewed 2026-07-25 (DETAILED_PLAN_REVIEW).** Verdict
> APPROVED-WITH-INLINE-FIXES; no blocking issues. Seven minor corrections are
> applied inline below, each marked **[PLAN_REVIEW inline fix]** — the acceptance
> set is now 57 cases (was 55). See `DETAILED_PLAN_REVIEW__PUBLIC.md`; no
> PLAN_ITERATION pass is required.

Binding inputs: `CLARIFICATION__PUBLIC.md` (human-approved),
`EXPLORATION__CONTENT_RULES__PUBLIC.md`, `EXPLORATION__SETTINGS_CONTROLS__PUBLIC.md`.
Every `file:line` below was re-read against the working tree on this branch
(`node-content-preference`); the exploration's claims all held.

---

## 1. Problem understanding

**Goal.** Let the user say "prefer the outline" / "prefer the image" / "let the
note decide", without ever making a node emptier than it is today.

**The load-bearing constraint.** Today the *adapter deletes* the losing side:
`ObsidianLinkProvider.outlineOf()` returns `[]` to MEAN "the image won"
(`src/adapters/ObsidianLinkProvider.ts:159-163`, anchor comment
`// The image wins.` at `:162`). The heading text/levels are never materialized,
so the view cannot change its mind. With `Auto` as one branch of three, the
adapter must become a **fact reporter**: always extract the outline, and carry
the *document-position fact* downstream as data. The **decision** moves to one
pure view-layer function.

**Assumptions (all verified, not guessed).**
- `firstImagePath` is already unconditional (`VicinityTraversal.ts:155,168`), so
  the image side already has its data at the view layer.
- "Fits" stays the 104px container query (`graph-view.css:237-256`). No JS
  measurement is introduced.
- `decideLayout()` (`GraphStructureDiff.ts:23-45`) is content-blind, and
  `vicinityGraphToFlow()` runs on BOTH branches of `runRebuild()`
  (`GraphViewController.ts:200`, before the reuse/relayout split) ⇒ a preference
  flip is a genuine data-only refresh that *does* reach the DOM.
- `ControlsActions.executeSettings` already handles `global-view`
  (`ControlsActions.ts:~84`) and so does `VicinityGraphSettingTab.persist`
  (`:489-491`) ⇒ **no executor changes at all.**

---

## 2. Chosen architecture

```
ObsidianLinkProvider            FileMetadata.imagePrecedesOutline   (FACT)
  ├─ outlineOf()      → always the real headings
  └─ outlineFactsOf() → { outline, imagePrecedesOutline }
        │
VicinityTraversal.assemble  →  TraversedNode.imagePrecedesOutline   (echo)
        │
VicinityEngine (spread :83) →  GraphNode.imagePrecedesOutline       (echo)
        │
flowMapping.toFlowNodeData  ─── applies ViewSettings ───┐
        │                                              │
        │   nodePreviewChoice.nodePreviewKind({preference, outlineEntryCount,
        │                                      hasImage, imagePrecedesOutline})
        │                        ▲ THE ONE PLACE the precedence rule lives
        ▼                        │
FlowNodeData.preview: NodePreviewKind   (DECISION)
        │
NoteNode.tsx → data-preview={data.preview}   (renders, decides nothing)
```

### 2.1 New / changed types (exact names)

| Where | Member | Type | Notes |
|---|---|---|---|
| `src/engine/types.ts` | `NodePreviewPreference` | `"auto" \| "outline" \| "image"` | Doc-comment per member (the three branches need WHY). Sits next to `EdgeVisibilityMode` (`:140-149`). |
| `src/engine/types.ts` | `NODE_PREVIEW_PREFERENCES` | `["auto", "outline", "image"] as const satisfies readonly NodePreviewPreference[]` | **Ordered** = the pill's left-to-right order. THE single value list: the persistence parser's `find` and the UI's option order both read it. Precedent for a const in `types.ts`: `DIRECTION_DEPTH_FIELD` (`:187-190`). **[PLAN_REVIEW inline fix]** it MUST be `as const satisfies …` (the `SECTION_RESET_SCOPES` idiom, `settingsResetPlan.ts:167-174`), NOT annotated `readonly NodePreviewPreference[]` — with the wide annotation `(typeof NODE_PREVIEW_PREFERENCES)[number]` widens back to the full union and the completeness assert below becomes vacuously true. |
| `src/engine/types.ts` | `_assertEveryNodePreviewPreferenceListed` | type-guard const | Repo idiom (`settingsResetPlan.ts:183-185`, `forceLayoutFieldMeta.ts:65-67`): a value missing from the array is a compile error, not a silently unrenderable option. Shape: `type UnlistedPreference = Exclude<NodePreviewPreference, (typeof NODE_PREVIEW_PREFERENCES)[number]>` — only sound with the `as const satisfies` form above. |
| `src/engine/types.ts` `ViewSettings` (`:245-258`) | `nodePreviewPreference` | `NodePreviewPreference` | Insert **directly after `outlineMaxDepth`** (both are "node contents" knobs; keeps the spec/defaults/resolver orders aligned). |
| `src/engine/LinkProvider.ts` `FileMetadata` (`:9-39`) | `imagePrecedesOutline` | `boolean` (**required**) | "A RESOLVED image reference sits above this note's FIRST HEADING." **`false` when the note has no first heading** (nothing to precede) or is not outline-bearing. |
| `src/engine/VicinityTraversal.ts` `TraversedNode` (`:25-40`) | `imagePrecedesOutline` | `boolean` | Echo, next to `outline`/`firstImagePath`. |
| `src/engine/types.ts` `GraphNode` (`:91-116`) | `imagePrecedesOutline` | `boolean` | Echo, next to `firstImagePath` (`:110-111`). Arrives free via `VicinityEngine.ts:83`'s `...node`. |
| `src/view/flowMapping.ts` `FlowNodeData` (`:38-68`) | `preview` | `NodePreviewKind` | **The decision, not the fact** — see §3.1. |
| `src/view/nodePreviewChoice.ts` `NodePreviewInput` | `preference`, `imagePrecedesOutline` | added | `NodePreviewKind` (`:7`) unchanged. |
| `src/engine/FakeLinkProvider.ts` `FakeFileSpec` (`:8-24`) | `imagePrecedesOutline?` | `boolean` (default `false`) | Fixture input stays OPTIONAL, exactly like `outline?` (`:18-23`). |

**Why `imagePrecedesOutline` is REQUIRED on the three production shapes:** a
boolean fact has no meaningful "absent"; optional would duplicate the `?? false`
default at four layers, and `tsc --strict` naming every construction site is the
cheapest possible completeness guard. Only two full-literal fixture sites exist
(`src/view/testFixtures/graphFixtures.ts` `makeNode`, `FakeLinkProvider.ts:100-107`).

**Invariant worth a test:** `imagePrecedesOutline === true` ⇒ `outline.length > 0`
**and** `firstImagePath !== undefined` (an image above the first heading is
necessarily the first image, and there must be a heading for it to precede).

### 2.2 The one pure function (`src/view/nodePreviewChoice.ts`)

```ts
export function nodePreviewKind({
    preference, outlineEntryCount, hasImage, imagePrecedesOutline,
}: NodePreviewInput): NodePreviewKind {
    // A preference is a PREFERENCE, never a blank node: when only one side
    // exists it wins outright, so the branches below never have to re-state
    // the fallback (binding requirement 1).
    if (outlineEntryCount === 0) {
        return hasImage ? "thumbnail" : "none";
    }
    if (!hasImage) {
        return "outline";
    }
    switch (preference) {
        case "outline":
            return "outline";
        case "image":
            return "thumbnail";
        case "auto":
            // The documented escape hatch, unchanged: the image wins iff it
            // sits above the first heading (the adapter reports that fact).
            return imagePrecedesOutline ? "thumbnail" : "outline";
    }
}
```

Two guard clauses express the fallback rule ONCE; the exhaustive `switch`
satisfies `noImplicitReturns` without a `default` (same style as
`planSettingsWrite`). SRP intact: one question, one answer.

### 2.3 `sizePx` independence (binding requirement 3)

Nothing in this plan touches `NodeSizer`, `graphIdentity.nodeDimensionsPx`, or
`GraphStructureDiff`. The preference reaches the pipeline only inside
`toFlowNodeData`, downstream of sizing. Pinned by a new `decideLayout` test
(§6.J) so a future refactor cannot quietly make a toggle relayout the graph.

---

## 3. Alternatives considered

### 3.1 Adapter → view seam: where is the decision made?

| Option | PROs | CONs | Verdict |
|---|---|---|---|
| **A (CHOSEN): fact on `GraphNode`, decision computed in `toFlowNodeData`, `FlowNodeData.preview`** | `flowMapping` already owns "apply `ViewSettings` to node data" (`outlineMaxDepth`, `:303-305`) — same responsibility, no new one; `NoteNode` loses all logic; the whole feature becomes testable in `flowMapping.test.ts` + `nodePreviewChoice.test.ts` with **zero React tests** (the repo has none for `NoteNode`); the preference is not copied onto 100 node payloads. | `FlowNodeData` grows a derived field. | **Chosen.** |
| B: fact + `preference` on every `FlowNodeData`, decision in `NoteNode` | Keeps `flowMapping` untouched. | The precedence rule then lives in an untested React component; a global value is duplicated per node; `NoteNode` keeps a `useMemo`-free recompute. | Rejected. |
| C: preference via a new React context, decision in `NoteNode` | No payload growth. | New context plumbing (`GraphUiContext`/`NoteOpenContext` precedent shows the cost) for a value already flowing in `graph.viewSettings`; still untestable without React tests. | Rejected. |
| D: decide in the **engine**, emit `GraphNode.preview` | One field, engine-tested. | The engine would have to apply `outlineMaxDepth` too (else the count is wrong — see the trap in §7), which is explicitly a *view-layer* knob (`types.ts:248-253`); and CLARIFICATION #4 binds the logic to `src/view/nodePreviewChoice.ts`. | Rejected. |
| E: carry raw offsets (`firstHeadingOffset`, `firstImageOffset`) instead of a boolean | Maximum downstream freedom. | Leaks document-parsing detail through three layers for one boolean question; invites re-deriving the rule downstream (DRY hazard). | Rejected. |

> **Note vs. the task brief:** the brief suggested a field on `FlowNodeData` for
> the *fact*. Option A deliberately puts the **decision** there instead — the
> fact is consumed one layer earlier, in the pure mapping that already applies
> the view settings. This is a seam improvement, not a CLARIFICATION deviation
> (the fact still travels `FileMetadata → TraversedNode → GraphNode` as required,
> and the view still decides).

### 3.2 The pill control itself

| Option | PROs | CONs | Verdict |
|---|---|---|---|
| **A (CHOSEN): native `<input type="radio">` per segment inside a `role="radiogroup"` wrapper, styled as a segmented control; markup duplicated per surface, copy shared** | Real radiogroup semantics + arrow-key cycling + one tab stop **for free** (zero keyboard JS); mirrors the `ToggleSwitch.tsx` philosophy (native input, themed chrome); reads as a pill in both themes with ~30 lines of variable-driven CSS. | Needs new CSS (no segmented pattern exists in the repo). | **Chosen.** |
| B: `Setting.addDropdown()` on the tab, hand-rolled pill in the panel | Zero CSS on the tab. | Two *different* controls for one setting across surfaces (POLS violation) and the human asked for a PILL. | Rejected. |
| C: `<button role="radio">` trio with manual `keydown`/`tabindex` roving | Full styling control. | Hand-written keyboard semantics = the accessibility bug factory the brief warns about ("a real radiogroup, not divs"). | Rejected. |
| D: three-state `ToggleSwitch`-style custom widget | Reuses existing classes. | Obsidian has no 3-state native control to borrow; would be divs pretending to be radios. | Rejected. |

**Class names (no collision with the exclusion count chip — which is
`vicinity-graph-exclusion__count`, so nothing is actually *named* "pill" today,
and we keep it that way):**

- block `vicinity-graph-segmented`
- `vicinity-graph-segmented__option` (the `<label>`)
- `vicinity-graph-segmented__text` (the visible segment label)
- the radio input itself needs no class (selected via `> input`)

**CSS home:** one new file **`src/view/segmented-control.css`**, appended to
`AUTHORED_CSS_FILES` in `esbuild.config.mjs:47-51`. WHY a 4th file: the control
is shared by the settings tab and the graph panel, so it belongs to neither
`settings-tab.css` nor `graph-view.css`; duplicating the rules into both would be
knowledge duplication. Precedent: `node-outline.css` exists for one component.
Order-insensitive (all-new selectors) ⇒ append LAST, with a comment saying so
(the `graph-view.css:220-231` concatenation-order incident is why that matters).

Sketch (non-obvious parts only — the focusable-but-invisible input and the
sibling selectors; do NOT reach for `:has()`):

```css
.vicinity-graph-segmented { display: inline-flex; border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m); overflow: hidden; background: var(--background-primary); }
.vicinity-graph-segmented__option { position: relative; display: flex; align-items: center;
    padding: var(--size-2-1) var(--size-4-2); font-size: var(--font-ui-small);
    color: var(--text-muted); cursor: pointer; }
.vicinity-graph-segmented__option + .vicinity-graph-segmented__option {
    border-left: 1px solid var(--background-modifier-border); }
/* Kept in the a11y tree AND focusable: stretched + transparent, never display:none. */
.vicinity-graph-segmented__option > input { position: absolute; inset: 0; margin: 0;
    appearance: none; opacity: 0; cursor: pointer; }
.vicinity-graph-segmented__option > input:checked + .vicinity-graph-segmented__text {
    color: var(--text-on-accent); }
.vicinity-graph-segmented__option:has(> input:checked) { background: var(--interactive-accent); }
.vicinity-graph-segmented__option > input:focus-visible + .vicinity-graph-segmented__text {
    outline: 2px solid var(--background-modifier-border-focus); outline-offset: 2px; }
```
**[PLAN_REVIEW inline fix — decision made, ambiguity removed]** Keep the `:has()`
rule above; do NOT restructure so the span carries the box. `:has()` is supported
by the Chromium behind `minAppVersion` 1.12.4, and the label-carries-the-box form
keeps padding/border in one place. (This is the repo's first `:has()` — grep
confirms none today — so it is worth one line of WHY in the CSS.)
Two variables in the sketch (`--text-on-accent`,
`--background-modifier-border-focus`) are Obsidian-provided but used **nowhere
else in this repo** — eyeball them in light AND dark during Phase 3 rather than
assuming, and fall back (`var(--text-on-accent, var(--text-normal))`) only if a
theme actually leaves one unset.

**Shared copy module: `src/view/nodePreviewPreferenceMeta.ts`** (sibling of
`forceLayoutFieldMeta.ts`, the established "share DATA, duplicate MARKUP"
contract):

```ts
export const NODE_PREVIEW_ROW_LABEL = "Preview";
export const NODE_PREVIEW_ROW_DESCRIPTION =
    "Which preview a node shows when it has both a heading outline and an image. " +
    "A note that only has one of the two always shows that one.";
export interface NodePreviewOptionMeta { readonly label: string; readonly description: string; }
export const NODE_PREVIEW_OPTION_META: Readonly<Record<NodePreviewPreference, NodePreviewOptionMeta>> = {
    auto:    { label: "Auto",    description: "Let the note decide: the image wins only when it sits before the first heading." },
    outline: { label: "Outline", description: "Prefer the heading outline. Notes without headings still show their image." },
    image:   { label: "Image",   description: "Prefer the first image. Notes without an image still show their outline." },
};
```
`Record<NodePreviewPreference, …>` is compile-time exhaustive; the **order** comes
from `NODE_PREVIEW_PREFERENCES`, never from `Object.keys` (implicit insertion
order is not a contract).

**Radio `name` — the trap that will otherwise ship a bug.** Radio grouping is
DOCUMENT-scoped for inputs outside a `<form>`. If the settings modal and the
graph panel are both mounted, two groups sharing a `name` become ONE group and
un-check each other. ⇒ the meta module deliberately does **not** own the name:
the tab uses a module constant (`"vicinity-graph-node-preview-settings"`), the
panel uses React's `useId()`.

### 3.3 Restore-defaults scope: **reuse `"node-contents"`** (not a new scope)

Justified, not merely cheaper:
- `settingsResetPlan.ts:16-18` states the contract — "Scope granularity mirrors
  the settings tab's six cards"; the pill lives INSIDE the Node contents card, so
  a second scope would put two reset rows in one card and break
  "each card ends with exactly one of these" (`:162-166`).
- Registration points touched shrink from four to **one**: the `node-contents`
  `plan` + `description` (`:93-102`). `SettingsResetScope` (`:22-29`),
  `SECTION_RESET_SCOPES` (`:167-174`) and `ALL_SCOPE_DESCRIPTION` (`:68-69`) are
  **unchanged** — the label "Restore node contents defaults" already supplies the
  noun the enumeration test derives.
- Section count stays **6** ⇒ the `toHaveCount(6)` in all three e2e files and
  both exact reset-button name lists stay **untouched**.
- `"all"` already writes `EngineDefaults.viewSettings()` wholesale (`:147-151`)
  ⇒ it covers the new field automatically once `EngineDefaults` projects it.

### 3.4 Controls-panel placement: a NEW `"Node contents"` disclosure

`GraphToolbar.tsx:42-54` sections are Depth / Pinned centrals / Node exclusion /
Node sizing / Force layout. The pill is neither sizing nor force layout, and the
panel's own rule is "EVERY section sits behind its own `Disclosure`"
(`GraphToolbar.tsx:13-16`) ⇒ new `<Disclosure summary="Node contents">` in a new
`src/view/NodeContentsSection.tsx`, placed **after `SizingSection`** so the panel
order mirrors the tab's card order (sizing → contents, per
`VicinityGraphSettingTab.ts:84`'s "Node CONTENTS follow node SIZE" note).

**Deliberately NOT in scope:** mirroring the *Outline depth* slider into the
panel. It is a pre-existing parity gap, unrelated to this feature's requirement,
and adding it grows the diff and the e2e surface for no clarified need →
follow-up ticket (§8).

### 3.5 `PERSISTED_SHAPE_VERSION` stays **2**

`persistedShapes.ts:33`. An additive field with a spec default needs no bump:
`parsePluginData` merges `{ ...defaults.globalView, ...parseViewOverride(raw) }`
(`:95`), so a v2 file written before this change simply has no key and resolves
to `auto` = today's behavior. Bumping would make every existing `data.json`
version-mismatch and **discard all of the user's globals** (`:89-91`) — a
regression for zero benefit. Precedent: `outlineMaxDepth` shipped the same way.

---

## 4. Ordered work plan (each phase independently committable + testable)

### Phase 1 — Move the decision downstream (ZERO behavior change)

No setting, no UI. `Auto` is hard-wired, and the shipped behavior must be
bit-identical afterwards. This is the review boundary that matters.

1. `src/engine/LinkProvider.ts:9-39` — add `imagePrecedesOutline: boolean` to
   `FileMetadata`; rewrite the `outline` doc (`:29-38`) so it no longer claims the
   image case empties it; document the new fact (incl. the "no first heading ⇒
   false" edge).
2. `src/adapters/ObsidianLinkProvider.ts` — replace `outlineOf` (`:138-166`) with
   one cohesive `outlineFactsOf(file, cache, references): NoteOutlineFacts`
   returning a descriptive adapter-local interface
   `{ outline: readonly OutlineEntry[]; imagePrecedesOutline: boolean }`
   (no `Pair`/tuple, per CLAUDE.md). WHY one method, not two: the
   `isOutlineBearingPath`/`cache === null`/`headings[0]` guards are shared, and
   two methods could drift into "non-empty outline computed under a different
   guard than the fact". `referencesImageAbove` (`:168-190`) is unchanged,
   including its resolved-only rationale. `getFileMetadata` (`:117-136`) spreads
   the two fields. Delete the `// The image wins.` line — the rule now lives in
   `nodePreviewChoice`.
3. `src/engine/FakeLinkProvider.ts` — `FakeFileSpec.imagePrecedesOutline?`
   (default `false`, documented like `outline?` at `:18-23`); set it in
   `declareFile` (`:100-107`).
4. `src/engine/VicinityTraversal.ts` — `TraversedNode.imagePrecedesOutline`
   (`:25-40`) + echo in `assemble` (`:156-169`).
5. `src/engine/types.ts` — `GraphNode.imagePrecedesOutline` (`:91-116`).
   `VicinityEngine.ts:83` needs no edit (`...node`).
6. `src/view/nodePreviewChoice.ts` — `NodePreviewInput.imagePrecedesOutline`; the
   `auto` rule inlined (no `preference` param yet); rewrite the doc-comment
   (`:14-19`) — the adapter no longer pre-decides.
7. `src/view/flowMapping.ts` — change `toFlowNodeData(node, mainPinned, view: ViewSettings)`
   (was `outlineMaxDepth: number`, `:289-290`; call site `:187`) — passing the
   settings object stops the param list growing per knob. Compute the filtered
   outline FIRST, then `preview: nodePreviewKind({...})` from `outline.length`.
   Add `preview` to `FlowNodeData` and fix the `outline` doc (`:54-61`).
8. `src/view/NoteNode.tsx` — delete the `nodePreviewKind` call (`:36-39`) and its
   import (`:13`); use `data.preview` at `:88`, `:99`, `:112`.
9. `src/view/testFixtures/graphFixtures.ts` — `makeNode` gains
   `imagePrecedesOutline: false`.
10. Tests: §6.A (auto rows only), §6.B, §6.C, §6.D (auto rows + the depth-filter
    cases). Update the two `ObsidianLinkProvider.test.ts` "outline is empty"
    cases per §6.B.

**Verification:** `npm test` green except the known-RED `linkStrengthFactor.max`;
`npm run check`; `npm run dev` + dev-vault eyeball: `outline-cover.md` still
shows its image, `outline-note.md` still shows its outline.

### Phase 2 — The setting, end to end, no UI (still zero behavior change)

1. `src/engine/types.ts` — `NodePreviewPreference`, `NODE_PREVIEW_PREFERENCES`,
   the listing assert, `ViewSettings.nodePreviewPreference` (after
   `outlineMaxDepth`).
2. `src/engine/index.ts` — export the type (`:33-57`) and the const + assert
   (`:58`).
3. `src/engine/SettingsSpec.ts` — `ViewSpec.nodePreviewPreference: DefaultSpec<NodePreviewPreference>`
   (`:67-74`, after `outlineMaxDepth`) and the spec entry with its WHY
   ("`auto` preserves the documented document-position rule; users opt in")
   in `globalView` (`:118-133`, modelled on `edgeVisibility` `:128-133`).
4. `src/engine/constants.ts` — `EngineDefaults.viewSettings()` (`:160-170`)
   projects the field. Optional alias `DEFAULT_NODE_PREVIEW_PREFERENCE` only if a
   second consumer appears — don't add an unused constant.
5. `src/engine/ViewSettingsResolver.ts:46-53` — add `nodePreviewPreference: field("nodePreviewPreference")`
   (mandatory: an unlisted key resolves `undefined`).
6. `src/persistence/persistedShapes.ts` — `parseViewOverride` (`:131-157`) gains
   the `edgeVisibility` enum idiom:
   `...definedOnly("nodePreviewPreference", NODE_PREVIEW_PREFERENCES.find((p) => p === raw["nodePreviewPreference"]))`.
   Import the const from `../engine`; **delete nothing**, and do NOT add a second
   local values array beside `EDGE_VISIBILITY_MODES` (`:66`).
   `PERSISTED_SHAPE_VERSION` untouched — add a one-line WHY-NOT comment? No: the
   rationale is already generic at `:22-32`; record it in the CHANGELOG instead.
7. `src/view/settingsWritePlan.ts` — `SettingsInteraction` variant
   `{ kind: "global-node-preview"; value: NodePreviewPreference }` (`:25-46`,
   after `global-outline-depth`) + the `planSettingsWrite` case (`:73-104`)
   returning `{ kind: "global-view", view: { ...ctx.globalView, nodePreviewPreference: interaction.value } }`.
8. `src/view/settingsResetPlan.ts` — `node-contents` (`:93-102`): the `plan`
   resets BOTH fields in one `global-view` command; `description` becomes e.g.
   ``Resets the outline depth to ${…outlineMaxDepth.default} heading levels and the node preview to ${NODE_PREVIEW_OPTION_META[SETTINGS_SPEC.globalView.nodePreviewPreference.default].label}.``
   (label read from the shared meta — never a re-typed "Auto").
9. `src/view/testFixtures/graphFixtures.ts` — `makeViewSettings` gains
   `nodePreviewPreference: "auto"`.
10. Tests: §6.E, §6.F, §6.G, §6.H, §6.I, §6.J. Update
    `SettingsSpec.test.ts` (both literals), `settingsResetPlan.test.ts`
    (`TUNED_VIEW` **and** the `:93` "everything else survives" expectation).

**Verification:** `npm test`, `npm run check`. Flip the value by hand
(`store.saveGlobalView`) in the dev vault and confirm both fixtures respond with
no relayout (the `structural diff skipped elk layout` debug line appears).

### Phase 3 — Settings-tab row + shared copy + CSS

1. New `src/view/nodePreviewPreferenceMeta.ts` (§3.2).
2. New `src/view/segmented-control.css` (§3.2) + register in
   `esbuild.config.mjs:47-51`.
3. `src/view/VicinityGraphSettingTab.ts`:
   - `renderNodeContents()` (`:321-342`): add the Preview row **above** "Outline
     depth" (general → specific; the depth slider only refines the outline).
     Build it with `new Setting(section).setName(NODE_PREVIEW_ROW_LABEL).setDesc(NODE_PREVIEW_ROW_DESCRIPTION).then((s) => this.addNodePreviewSegmented(s.controlEl))`
     — `.then()` is already used at `:119`, `controlEl` is public API.
   - New private `addNodePreviewSegmented(controlEl)`: `role="radiogroup"` +
     `aria-label`, one `<label>` per `NODE_PREVIEW_PREFERENCES` entry carrying a
     native radio (`name` = the tab-local constant), `title` = the option
     description, `checked` from `this.store.globalView().nodePreviewPreference`,
     `change` → `this.applyInteraction({ kind: "global-node-preview", value })`.
   - Rewrite the docblock at `:312-320` — the "No enable/disable toggle by design
     (CLARIFICATION Q2)" sentence is **superseded**: document position still
     decides, under `Auto`.
   - No change to `applyInteraction` (`:449-452`) or `persist` (`:484-499`).

**Verification:** dev-vault settings tab in light AND dark; keyboard: Tab lands
on the group once, ←/→ move and apply, screen-reader announces
"Preview, radio group, Auto selected, 1 of 3".

### Phase 4 — Controls-panel section

1. New `src/view/NodeContentsSection.tsx` — `<Disclosure summary="Node contents" className="vicinity-graph-nodecontents">`
   containing the same segmented markup as JSX (labels/descriptions from the
   shared meta, `name` from `useId()`). **[PLAN_REVIEW inline fix]** render
   `NODE_PREVIEW_ROW_LABEL` as a VISIBLE row label next to the control (the
   panel's own idiom — every `ForceLayoutSlider`/sizing row is labelled) and put
   the same string on the radiogroup's `aria-label`; a bare Auto/Outline/Image
   trio inside a "Node contents" disclosure does not say what it switches.
   Writes through
   `useControlsActions().applySettings(planSettingsWrite({ kind: "global-node-preview", value }, ctx))`
   — the identical command the tab emits. Fully controlled off
   `view.nodePreviewPreference` (no local state), exactly like
   `SizingSection`/`ForceLayoutSection`.
2. `src/view/GraphToolbar.tsx` — render it after `<SizingSection …>` (`:53`),
   passing `view={controls.globalView}` and `ctx`.
3. Optional panel-only spacing rule in `graph-view.css` next to the other panel
   blocks (`:640-760`) **only if** the 260px panel needs it; the shared file owns
   the control's look.

**Verification:** flip in the panel → node contents change live, positions
unchanged; flip in the tab → the panel's pill reflects it after the rebuild.

### Phase 5 — Docs, e2e, tickets

1. `README.md:59-66` (global-defaults list: add **Preview**; keep the "no on/off
   switch" sentence attached to *Outline depth* only, where it is still true) and
   `:137-146` (Node contents: three values, `Auto` = document position with the
   escape hatch, and the never-empties-a-node fallback).
2. `docs-internal/plan/high-level-plan.md:93` — "decided by document position"
   → decided by the global **Preview** setting (`Auto` default = document
   position, the documented escape hatch); add that the adapter now reports
   `imagePrecedesOutline` and the precedence lives in `nodePreviewChoice`.
3. Superseded code comments: `src/engine/SettingsSpec.ts:118-124`
   (outlineMaxDepth's "no on/off switch (CLARIFICATION Q2)" — still true for
   depth, but the outline-vs-image choice is now the pill) and
   `VicinityGraphSettingTab.ts:312-320` (done in Phase 3).
4. `docs-internal/architecture-map.md` "Key seams" — one line: the adapter
   reports the document-position FACT; `view/nodePreviewChoice.ts` owns the
   outline-vs-image precedence.
5. `docs-internal/CHANGELOG.md` — entry incl. "no `PERSISTED_SHAPE_VERSION` bump
   (additive field with a spec default)".
6. `scripts/setup-dev-vault.sh:359-368` — qualify the manual check
   ("outline-cover's MAIN node shows the image **at the default Auto preview**").
7. e2e updates §6.L.
8. Tickets §8.

---

## 5. Files touched (checklist)

**Engine** `types.ts` · `LinkProvider.ts` · `SettingsSpec.ts` · `constants.ts` ·
`ViewSettingsResolver.ts` · `VicinityTraversal.ts` · `FakeLinkProvider.ts` ·
`index.ts`
**Adapters** `ObsidianLinkProvider.ts`
**Persistence** `persistedShapes.ts`
**View** `nodePreviewChoice.ts` · `flowMapping.ts` · `NoteNode.tsx` ·
`settingsWritePlan.ts` · `settingsResetPlan.ts` · `VicinityGraphSettingTab.ts` ·
`GraphToolbar.tsx` · **new** `NodeContentsSection.tsx` · **new**
`nodePreviewPreferenceMeta.ts` · **new** `segmented-control.css` ·
`testFixtures/graphFixtures.ts`
**Build** `esbuild.config.mjs`
**Tests** `ObsidianLinkProvider.test.ts` · `VicinityTraversal.test.ts` ·
`VicinityEngine.test.ts` · `SettingsSpec.test.ts` · `settingsResolvers.test.ts` ·
`persistedShapes.test.ts` · `nodePreviewChoice.test.ts` · `flowMapping.test.ts` ·
`settingsWritePlan.test.ts` · `settingsResetPlan.test.ts` ·
`GraphStructureDiff.test.ts`
**e2e** `settingsResetReview.e2e.ts` · `nodeOutline.e2e.ts` ·
`settingsUxVisual.e2e.ts`
**Docs** `README.md` · `docs-internal/plan/high-level-plan.md` ·
`docs-internal/architecture-map.md` · `docs-internal/CHANGELOG.md` ·
`scripts/setup-dev-vault.sh`
**NOT touched (by design):** `NodeSizer.ts` · `GraphStructureDiff.ts` (prod code)
· `NodeOutline.tsx` · `graph-view.css` density ladder · `ControlsActions.ts` ·
`ControlsModel.ts` · `main.ts` · `settingsResetVerify.e2e.ts`

---

## 6. Acceptance criteria — BDD cases (one behavior each, colocated)

Use a per-file `given`-style helper so a new option/axis cannot silently skip a
row (`WHEN … THEN …`, one assert).

### A. `src/view/nodePreviewChoice.test.ts` — the precedence rule (3 × 4 matrix)
`auto`:
1. WHEN the preference is Auto AND the note has both AND the image precedes the outline THEN the thumbnail claims the slot
2. WHEN the preference is Auto AND the note has both AND the image does not precede the outline THEN the outline claims the slot
3. WHEN the preference is Auto AND the note has an outline only THEN the outline claims the slot
4. WHEN the preference is Auto AND the note has an image only THEN the thumbnail claims the slot
5. WHEN the preference is Auto AND the note has neither THEN no preview region is claimed

`outline`:
6. WHEN the preference is Outline AND the note has both AND the image precedes the outline THEN the outline claims the slot (the preference overrides document position)
7. WHEN the preference is Outline AND the note has both AND the image does not precede THEN the outline claims the slot
8. WHEN the preference is Outline AND the note has an image only THEN the thumbnail claims the slot (a preference never empties a node)
9. WHEN the preference is Outline AND the note has an outline only THEN the outline claims the slot
10. WHEN the preference is Outline AND the note has neither THEN no preview region is claimed

`image`:
11. WHEN the preference is Image AND the note has both AND the image does not precede the outline THEN the thumbnail claims the slot (overrides document position)
12. WHEN the preference is Image AND the note has both AND the image precedes THEN the thumbnail claims the slot
13. WHEN the preference is Image AND the note has an outline only THEN the outline claims the slot (a preference never empties a node)
14. WHEN the preference is Image AND the note has an image only THEN the thumbnail claims the slot
15. WHEN the preference is Image AND the note has neither THEN no preview region is claimed

### B. `src/adapters/ObsidianLinkProvider.test.ts` — facts, not decisions
**UPDATED (assertions inverted on purpose, substance relocated to A.1/A.6):**
16. (was `:354` "…THEN the outline is empty (the image wins)") WHEN the note's first image is embedded BEFORE the first heading THEN the outline still carries the headings
17. (was `:382`) WHEN the note's image is linked from FRONTMATTER THEN the outline still carries the headings

**NEW `describe("ObsidianLinkProvider imagePrecedesOutline")`:**
18. WHEN an image is embedded before the first heading THEN imagePrecedesOutline is true
19. WHEN the image sits after the first heading THEN imagePrecedesOutline is false
20. WHEN the image is linked from frontmatter THEN imagePrecedesOutline is true
21. WHEN a NON-image attachment precedes the first heading and the first image follows it THEN imagePrecedesOutline is false
22. WHEN the note has an image but NO headings THEN imagePrecedesOutline is false (nothing to precede)
23. WHEN the reference above the first heading does not resolve THEN imagePrecedesOutline is false (an unresolvable embed cannot suppress the outline)
24. WHEN the file is not outline-bearing (canvas / `*.excalidraw.md`) THEN imagePrecedesOutline is false
25. WHEN the metadata cache cannot order the file's references THEN imagePrecedesOutline is false

**Must keep passing unchanged:** `:286,308,312,323,328,336,340,368,396,408,426`
(outline extraction for canvas/excalidraw/no-cache/no-headings, attachment
ordering, image-after-heading, image-with-no-headings, non-image-precedes).

### C. Engine pass-through
26. `VicinityTraversal.test.ts` (extend the `outline echo` describe at `:368-383`): WHEN the provider reports imagePrecedesOutline THEN the traversed node echoes it
27. `VicinityTraversal.test.ts`: WHEN the provider does not report it THEN the traversed node carries false
28. `VicinityEngine.test.ts` (extend `:296-311`): WHEN a traversed node carries imagePrecedesOutline THEN the GraphNode carries it (the spread-through guard)

### D. `src/view/flowMapping.test.ts` — the decision as mapped data
29. WHEN the preference is Auto AND a node's image precedes its outline THEN the mapped node's preview is "thumbnail"
30. WHEN the preference is Outline AND a node's image precedes its outline THEN the mapped node's preview is "outline"
31. WHEN the preference is Image AND a node has both THEN the mapped node's preview is "thumbnail"
32. WHEN outlineMaxDepth drops every heading AND the node has an image THEN the preview is "thumbnail" (**the post-filter count is what decides**)
33. WHEN outlineMaxDepth drops every heading AND the node has no image THEN the preview is "none"
34. WHEN the preference is Image THEN the node's outline entries are still mapped (the decision never deletes data)
**Must keep passing:** `:474-506` (depth filter, render limit, filter-then-slice,
empty pass-through) and `:509-520` (both outline and image ⇒ firstImagePath still mapped).

### E. `src/engine/SettingsSpec.test.ts`
35. WHEN the spec is read THEN the shipped node-preview default is "auto"
36. **UPDATE** `:28-79` "exact shipped baseline" — add `nodePreviewPreference` to the actual AND expected literals (do **not** copy the existing `outlineMaxDepth` omission)
37. **UPDATE** `:111-120` "EngineDefaults.viewSettings projects the spec defaults" — add the field
> **Known-RED, pre-existing:** `linkStrengthFactor.max` (`:101` expects 2, spec
> says 4) per `ticket-settings-baseline-tests-stale-after-spacing-change.md`.
> **Do not fix, do not attribute to this work.**

### F. `src/persistence/persistedShapes.test.ts`
38. WHEN globalView carries a valid nodePreviewPreference THEN it round-trips
39. WHEN nodePreviewPreference is absent THEN the spec default applies
40. WHEN nodePreviewPreference is an unrecognized string THEN the spec default applies (mirrors the `edgeVisibility: "rainbow"` case at `:41`)
41. WHEN nodePreviewPreference is not a string THEN the spec default applies

### G. `src/engine/settingsResolvers.test.ts`
42. WHEN MAIN pins nodePreviewPreference THEN the resolved value is MAIN's
43. WHEN nobody pins nodePreviewPreference THEN the resolved value is the global one

### H. `src/view/settingsWritePlan.test.ts`
44. WHEN a global-node-preview interaction is planned THEN it merges the preference into the whole globalView object

### I. `src/view/settingsResetPlan.test.ts`
45. **UPDATE** `TUNED_VIEW` (`:16-33`) — add `nodePreviewPreference: "image"` (a NON-default value, or 46/47 pass vacuously)
46. WHEN the node contents section is reset THEN the node preview returns to its spec default
47. **UPDATE** `:93` — the "every other view field survives" expectation must now also carry `nodePreviewPreference: TUNED_VIEW.nodePreviewPreference` (it fails otherwise, correctly)
48. WHEN the tab-wide scope is reset THEN the node preview returns to its spec default (mirrors `:153-158`)

### J. `src/view/GraphStructureDiff.test.ts` — the no-relayout guarantee
49. WHEN two consecutive builds differ ONLY in nodePreviewPreference THEN the layout decision is reuse-layout

### K. Invariant guard (place with B)
50. WHEN imagePrecedesOutline is true THEN the same metadata also carries a non-empty outline and a first image
> **[PLAN_REVIEW inline fix]** one assert per test: split into
> 50a "…THEN the outline is non-empty" and 50b "…THEN a first image is present",
> or drop 50 entirely — cases 18 and 21 already pin the fact's inputs, and this
> is the lowest-value case in the set (see the review's PARETO note).

### L. e2e (release gate — `npm run test:e2e`, not `npm test`)
- **`e2e/settingsResetReview.e2e.ts`**: add `nodePreviewPreference` to the
  `Globals.view` type (`:32-43`); set it to a non-default in
  `dirtyEverySection()` (`:53-69`); assert Node contents' reset returns it to
  `"auto"` (`:130-139`) and that the OTHER five section resets leave it dirty.
- **`e2e/nodeOutline.e2e.ts`** (the highest-value new e2e; the dev vault already
  ships both fixtures — `outline-note.md` image-after-heading, `outline-cover.md`
  image-before-heading, `scripts/setup-dev-vault.sh:248-310`):
  51. WHEN the preview preference is Outline THEN outline-cover's node shows its heading outline instead of its image
  52. WHEN the preview preference is Image THEN outline-note's node shows its thumbnail instead of its outline
  53. WHEN the preference returns to Auto THEN both nodes show what document position says
  (assert on `[data-preview]` + `.vicinity-graph-outline` visibility; restore the
  default in `afterAll` so later files are unaffected.)
  **[PLAN_REVIEW inline fix]** the file is `test.describe.configure({ mode: "serial" })`
  and every pre-existing case assumes the default Auto, so append 51–53 as the
  LAST cases in the file and have 53 (the restore-to-Auto case) be the one that
  leaves the store clean — `afterAll` restoration alone would still let a flaky
  mid-file failure poison the remaining cases.
- **`e2e/settingsUxVisual.e2e.ts`**: 54. the Node contents card exposes a
  3-radio group whose selected option is Auto, and clicking "Outline" persists
  `nodePreviewPreference` (`getByRole("radio", { name: "Outline" })`);
  55. a computed-style assertion proving `segmented-control.css` reached the
  settings DOM (mirrors the `borderTopStyle` idiom at `:129-131`) — `npm test`
  cannot catch a missing `AUTHORED_CSS_FILES` entry; plus light+dark screenshots
  into `.out/`.
  **[PLAN_REVIEW inline fix — two additions, this is the ONE registration point
  the plan missed]**
  56. extend the existing `"panel defaults: every section is a disclosure, only
  Depth starts open"` test (`e2e/settingsUxVisual.e2e.ts:53-59`) with
  `await expect(disclosure("Node contents")).not.toHaveAttribute("open", "")` —
  that test hand-enumerates the panel's disclosures, so a new section that is not
  added there silently under-asserts (same failure class as the settings-tab
  enumerations this plan is careful about).
  57. one assertion that the PANEL pill actually writes: open the Node contents
  disclosure, click its "Image" radio, and read `pluginDataStore.globalView()
  .nodePreviewPreference` (the idiom the force-layout test already uses at
  `:110-115`). Without it the controls-panel half of the binding "exposed in BOTH
  surfaces" requirement has zero automated coverage at any level.
- **Section counts DO NOT CHANGE:** `.vicinity-graph-settings-section`
  `toHaveCount(6)` stays in `settingsResetReview.e2e.ts:77`,
  `settingsResetVerify.e2e.ts:59`, `settingsUxVisual.e2e.ts:128`; the
  `.vicinity-graph-settings-reset` count (`:159`) and both exact reset-button
  name lists (`:161-168`) stay **byte-identical**. `settingsResetVerify.e2e.ts`
  needs no edit at all.

---

## 7. Risks / traps

1. **Deciding from the UNFILTERED outline.** `preview` MUST be computed from the
   depth-filtered, budget-capped array, or a note whose only headings are deeper
   than `outlineMaxDepth` renders `data-preview="outline"` with an empty box —
   precisely the bug class `NodePreviewKind`'s doc-comment (`:1-6`) was written
   to prevent. Pinned by tests 32/33.
2. **Radio `name` collision** across the two surfaces (§3.2) — silent, and only
   reproducible with the settings modal open over a graph view.
3. **`display: none` on the radio input** would kill keyboard/AT access. Use the
   stretched-transparent-input technique.
4. **Forgetting `esbuild.config.mjs:47-51`** ships an unstyled control that every
   unit test still passes. Test 55 is the guard.
5. **`ViewSettingsResolver.ts:46-53`** — an unlisted key resolves `undefined`,
   which typechecks and then poisons `switch (preference)` at runtime.
6. **`settingsResetPlan.test.ts:93`** fails as soon as `node-contents` resets two
   fields — that failure is CORRECT; patch the expectation (item 47), do not
   weaken the test.
7. **Known-RED `linkStrengthFactor.max`** — expect exactly one pre-existing
   failure in `SettingsSpec.test.ts`; do not fix, do not attribute.
8. **`SettingsSpec.test.ts:28-79` already omits `outlineMaxDepth`** — a live
   enumeration gap. Add the NEW field correctly; leave the old omission to a
   ticket (§8) so this branch's diff stays attributable.
9. **Per-doc pinning is structurally reachable** (hand-edited `doc-data/*.json`),
   because `parseViewOverride` serves both `globalView` and per-doc `view`. That
   is the same situation as `nodeCap` (global-only in the UI per CLARIFICATION
   Q4) ⇒ consistent, no special-casing, no UI. Do NOT add a per-doc control.
10. **Don't touch `NodeSizer`/`sizePx`.** Test 49 is the tripwire.
11. **Docs are superseded, not contradicted** — every doc edit must keep saying
    that document position still decides, *under `Auto`*.
12. **`FakeLinkProvider`'s doc-comment** (`:18-23`) currently says fixtures stand
    in for the adapter's already-made decision; it must now say the fixture
    supplies the FACT and nothing re-derives the rule.

---

## 8. Follow-up tickets (file, do not fix in passing)

1. `ticket-settings-spec-baseline-omits-outline-depth.md` — the "exact shipped
   baseline" `toEqual` in `SettingsSpec.test.ts:28-79` never asserted
   `outlineMaxDepth`; the test shape is easy to under-populate.
2. `ticket-controls-panel-outline-depth-parity.md` — *Outline depth* still has no
   controls-panel counterpart; the new Node contents disclosure is the obvious
   home.
3. (Already ticketed elsewhere — do not duplicate) the `toHaveCount(6)`
   triplication across three e2e files with no shared constant.
4. **[PLAN_REVIEW inline addition]** `ticket-edge-visibility-modes-belongs-in-engine-types.md`
   — `EDGE_VISIBILITY_MODES` (`persistedShapes.ts:66`) re-lists a union's values
   inside persistence with no compile-time completeness guard, while this feature
   introduces the better idiom (`NODE_PREVIEW_PREFERENCES` in `engine/types.ts`
   + listing assert). Migrating it is a clean break, out of scope here, and
   leaving two idioms side by side is the kind of drift worth a ticket.

---

## 9. Open (non-blocking; recommended defaults chosen)

- **Row label copy**: "Preview" (chosen) vs "Outline or image" / "Node preview".
- **Row order inside the Node contents card**: Preview above Outline depth
  (chosen: general → specific) vs. appended below the existing slider.
- Both are pure copy/layout calls the UX review pass can flip cheaply; nothing
  else in the plan depends on them.

**No `#QUESTION_FOR_HUMAN:` — nothing here deviates from the approved
CLARIFICATION, and nothing forces a hack.**
