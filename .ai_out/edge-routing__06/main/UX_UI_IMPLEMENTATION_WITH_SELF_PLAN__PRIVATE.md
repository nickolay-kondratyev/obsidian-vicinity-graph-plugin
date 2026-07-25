# UX_UI_IMPLEMENTATION_WITH_SELF_PLAN__PRIVATE — edge-routing__06 step 5b (SURFACE)

## Design Plan

**Goal**: make the already-plumbed `edgeRoutingClearancePx` legible to a user in the settings surface,
make every "six sliders" claim honest, and give the facing-side property its first automated gate.

**Framing (step 1) — what I found before writing anything**

My brief's task 1 says "add the row to `VicinityGraphSettingTab.ts`". **That is already done and must
NOT be redone.** Verified in code, not assumed:

- `VicinityGraphSettingTab.ts:158-170` (`renderForceLayout`) *iterates* `FORCE_LAYOUT_MAIN_FIELDS` /
  `FORCE_LAYOUT_ADVANCED_FIELDS`; `addForceLayoutSlider` (`:374-389`) is fully generic over the field
  key, pulling bounds from `FORCE_LAYOUT_RANGES` and copy from `FORCE_LAYOUT_FIELD_META`.
- `forceLayoutFieldMeta.ts:41-44` already has the `edgeRoutingClearancePx` copy entry and `:64` already
  lists it in `FORCE_LAYOUT_ADVANCED_FIELDS`.
- `ForceLayoutSection.tsx:49-52` maps the same two tables.

So the row is *structurally* free on both surfaces (exactly the "one spec is the source of truth"
invariant the `obsidian-settings` skill demands). Writing a hand-rolled `new Setting(...)` for this one
field would be a **regression** — it would re-type bounds in the UI layer, the skill's
"defaults re-typed in the UI layer → restore-defaults drift" anti-pattern. **Decision: do not touch
`renderForceLayout`'s structure.** My real task 1 is (i) copy review, which step 5a explicitly deferred
to me, and (ii) VERIFY both surfaces render + write it.

**Design Direction**
- Tone: utilitarian, native-quiet. This is an Obsidian settings row; the win is that it looks like it
  was always there.
- Information density: one short sentence of `desc`, matching its two siblings' shape exactly.
- Key design thesis: **the row's craft is entirely in the copy and in sibling consistency.** There is no
  new visual component to design; the altitude is inherited. Every unit of effort goes to (a) a
  description a user can act on, and (b) removing the six/seven lies that would make the tab
  self-contradictory.

**Visual Hierarchy** (inherited, verified not invented)
1. Primary: the row name + slider control.
2. Secondary: the `desc` sentence (`--text-muted`, `--font-ui-small` via Obsidian's own `setDesc`).
3. Tertiary: the `Advanced spacing` disclosure that contains it.

**Copy decision (the one real design choice)**

Sibling descriptions in the same disclosure:
| field | desc |
|---|---|
| `collidePaddingPx` | "Minimum gap (px) enforced between any two boxes at the top level of the graph." |
| `elkNodeSpacingPx` | "Gap (px) between the notes inside a folder group (also spaces the initial layout pass)." |

Both open with a **noun phrase** ("Minimum gap (px)…", "Gap (px)…"). Step 5a's placeholder opened with
"How far (px) a routed edge stays clear of…" — an interrogative-shaped phrase that breaks the pattern,
and "routed" is implementation vocabulary that appears nowhere user-facing (README uses "edge" once and
"routed" never). Rewrite to the sibling form, in terms the user can *see* on screen (lines bending
around boxes), per the skill's "desc: one short sentence" + POLS.

**Component Plan** — no new components. Touched surfaces:
- `forceLayoutFieldMeta.ts` — copy only (both surfaces inherit).
- 4 stale-count comments/strings + 1 e2e count.
- 1 new e2e regression test.

**Implementation Steps**
1. Rewrite the `edgeRoutingClearancePx` description to sibling form.
2. Fix every stale "six/two" claim — including the two my brief did NOT list, found by grep.
3. Add the facing-side e2e assertion to `edgeRouting.e2e.ts` (the *regression* spec — NOT the eval
   harness, whose own docblock disclaims being a gate: SRP).
4. Rebuild `.dev-vault` (step 5a changed `src/`; the e2e harness copies the BUILT plugin, so without
   this the AFTER measurement would silently measure the OLD 17px buffer — the single biggest trap
   in this step).
5. Measure AFTER, screenshot, prove the new assertion has teeth by mutation.

**Files touched**: `src/view/forceLayoutFieldMeta.ts`, `src/view/settingsResetPlan.ts`,
`src/view/ForceLayoutSection.tsx`, `src/view/VicinityGraphSettingTab.ts`, `README.md`,
`e2e/settingsUxVisual.e2e.ts`, `e2e/edgeRouting.e2e.ts`.

---

## Facing-assertion design

Home: `e2e/edgeRouting.e2e.ts` (tight regression spec, per its own header) — NOT
`edgeRoutingEval.e2e.ts`, which states "NOT a tight regression". Its harness already copies the whole
`.dev-vault`, so `facing/` is present and `all-edges` is already set in `beforeAll`; the new test costs
one file-open, not a second Obsidian launch.

Derivation (no hardcoded "top", no pixel layout constants):
1. Group box rect ← `.vicinity-graph-group[data-folder="facing"]`.
2. Neighbour centroid ← rects of `.vicinity-graph-node[data-path^="facing-near"]`.
3. Facing side ← dominant axis of (centroid − box centre): `|dy|>|dx|` → TOP/BOTTOM else LEFT/RIGHT.
4. Each edge path's two endpoints → screen coords (`getPointAtLength` + `getScreenCTM`), classified to
   the **nearest** border (min distance, not first-match — a first-match ladder mis-labels corners).
5. Assert non-facing terminal count === 0, **plus a non-vacuity floor** so a broken selector cannot
   pass silently.

Only pixel constant: a border-hit tolerance. That is a *tolerance*, not a layout constant.

## Verify checklist
- [ ] `npm run check`
- [ ] `npm test` fully green
- [ ] `npx tsc -p e2e/tsconfig.json --noEmit`
- [ ] `npm run test:e2e -- edgeRoutingEval.e2e.ts` (AFTER numbers + PERF BUDGET)
- [ ] `npm run test:e2e -- edgeRouting.e2e.ts` (new assertion green)
- [ ] mutation proves the new assertion red
- [ ] `npm run test:e2e -- settingsUxVisual.e2e.ts`
- [ ] settings screenshot reviewed for altitude/alignment
