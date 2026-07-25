# STEP5B_SURFACE__PUBLIC — edge-routing__06 item (b), the SURFACE

"Edge clearance" is now honest on every surface, the seven-slider count is fixed everywhere (including
two places nobody listed), and the facing-side property has its **first automated gate**. Base commit
`fc94c33`; **not committed** (TOP_LEVEL_AGENT commits).

`npm run check` exit 0 · `npm test` **779 passed / 0 failed** · `npx tsc -p e2e/tsconfig.json --noEmit`
exit 0 · all three e2e specs green · PERF BUDGET holds.

---

## 0. The correction that mattered most: the row was already there

My brief's task 1 said to add the row to `VicinityGraphSettingTab.ts`. **I did not, and must not.**
Verified in code before touching anything:

- `VicinityGraphSettingTab.ts:158-170` *iterates* `FORCE_LAYOUT_ADVANCED_FIELDS`; `addForceLayoutSlider`
  (`:374-389`) is generic over the field key, taking bounds from `FORCE_LAYOUT_RANGES` and copy from
  `FORCE_LAYOUT_FIELD_META`.
- `forceLayoutFieldMeta.ts` already had both the copy entry and the `FORCE_LAYOUT_ADVANCED_FIELDS`
  membership (step 5a was forced into them by two compile-time asserts).

Hand-rolling a `new Setting(...)` for this one field would have **re-typed bounds in the UI layer** —
precisely the `obsidian-settings` anti-pattern "defaults re-typed in the UI layer → restore-defaults
drift". So task 1 reduced to *copy review* + *verification*, which is what I did.

**Verified, not assumed, that the in-graph panel picks it up:** `settingsUxVisual.e2e.ts:101`
(`getByLabel("Edge clearance")).toBeVisible()`) passes against the React `ForceLayoutSection`. The
settings **tab** was verified separately (§5) — it needed a different locator, see the a11y note there.

## 1. The row copy, and why

| | copy |
|---|---|
| label (binding, D4) | **Edge clearance** |
| desc **before** (5a placeholder) | "How far (px) a routed edge stays clear of the boxes it passes on its way." |
| desc **shipped** | **"Gap (px) a connecting line keeps from the boxes it bends around on its way."** |

Three reasons, all from the skill + its siblings:

1. **Sibling form.** Both neighbours in *Advanced spacing* open with a noun phrase — "Minimum gap (px)
   enforced between…", "Gap (px) between the notes…". The placeholder opened with an interrogative
   ("How far…"), which reads as a different *kind* of row sitting between two peers. Same altitude rule
   that governs layout governs copy.
2. **No implementation vocabulary.** "routed edge" is our word, not the user's — `README.md` says
   "routed" **zero** times. "a connecting line … bends around" describes what is literally on screen.
3. **Observable, not restated.** It says what changes visually (lines give boxes a wider berth), rather
   than paraphrasing the label back at the reader.

`(px)` retained deliberately: both siblings carry it, and the slider has no unit affordance of its own.

## 2. Every file:line touched

### The copy + the "six sliders" lies

| File:line | Change | Was it failing? |
|---|---|---|
| `src/view/forceLayoutFieldMeta.ts:43` | The description above. | — |
| `src/view/settingsResetPlan.ts:94-97` | "Resets all six … including the two under Advanced spacing" → **"Resets every force layout slider, including the ones under Advanced spacing."** + a WHY comment recording that this string silently lied because no test asserts it. | **silent** |
| `README.md:67-72` | Added **Edge clearance** to the *Advanced spacing* group with a short gloss; "resets all six" → "resets them all". Section's one-bullet-per-card format and verbatim bold UI labels preserved. | **silent** |
| `e2e/settingsUxVisual.e2e.ts:96` | `toHaveCount(6)` → `toHaveCount(7)`. | **loud** (left red for me by 5a) |
| `e2e/settingsUxVisual.e2e.ts:101` | **New** `getByLabel("Edge clearance")).toBeVisible()`, joining the two existing reachability assertions. | — |
| `e2e/settingsUxVisual.e2e.ts:87, :97` | Test name `6 sliders` → `7 sliders`; comment "the two advanced sliders" → "the advanced sliders". | cosmetic |

### Stale counts NOT on the handoff list (found by grep, both silent)

| File:line | Change |
|---|---|
| `src/view/ForceLayoutSection.tsx:15-16` | "the four native-parity sliders, **the two** 'Advanced spacing' knobs" → count-free. |
| `src/view/VicinityGraphSettingTab.ts:148,:150` | "The **four** primary sliders … **the two** spacing knobs" → count-free. |

**Method note:** I bumped six→seven only where a count is load-bearing (the e2e `toHaveCount`, which is
the assertion's whole point). Everywhere the count was *incidental prose* I **deleted it** rather than
incrementing it. A "seven" goes stale exactly the way "six" did; naming the groups does not. That is
why `settingsResetPlan.ts` reads "every … including the ones under Advanced spacing".

Grep sweep run for any other hardcoded count (`\b(two|three|four|five|six|seven)\b` near
slider/force-layout/advanced/spacing/knob across `src/`, `e2e/`, `README.md`, `docs-internal/`, plus
`toHaveCount|toHaveLength` near range/slider): **the two above were the only further hits.** One
remaining match is `docs-internal/CHANGELOG.md:72` "Six force-layout knobs are now user-tunable" — I
**deliberately did not touch it**: it is a dated historical entry for a shipped release, and rewriting
history in a changelog would be the lie, not the fix. §7 flags where the new entry belongs.

### The new gate

| File:line | Change |
|---|---|
| `e2e/edgeRouting.e2e.ts:30-33` | Header docblock extended to declare the second fixture and that it guards a different property. |
| `e2e/edgeRouting.e2e.ts:56-74` | `FACING_HUB_PATH` / `FACING_GROUP_FOLDER` / `FACING_NEIGHBOUR_PREFIX`, `BORDER_HIT_TOL_PX = 6`, `MIN_FACING_BOX_TERMINALS = 8` — each with its rationale. |
| `e2e/edgeRouting.e2e.ts:117-208` | `FacingAttachmentReport` + `readFacingAttachment()`. |
| `e2e/edgeRouting.e2e.ts:225-253` | The test, with the WHY block. |

## 3. The facing assertion — design, and proof it has teeth

**Home: `edgeRouting.e2e.ts`, not `edgeRoutingEval.e2e.ts`.** The eval file's own header says it is
"NOT a tight regression (that is `edgeRouting.e2e.ts`)" — putting a gate there would break its SRP. The
regression spec's harness already copies the whole `.dev-vault` and already sets `all-edges`, so the new
test costs one `openFile`, not a second Obsidian launch (it runs in **85ms**).

**The property:** all 12 `facing-nearN` neighbours sit off ONE side of the `facing/` group box, so every
edge must terminate on THAT border — none may wrap to the far or flanking sides.

Design decisions:

1. **The facing side is derived, never hardcoded.** Dominant axis of (neighbour centroid − box centre)
   → `top`/`bottom`/`left`/`right`. If the layout ever parks the blob elsewhere, the assertion follows
   it instead of going green against the wrong border. (It resolves to `top` today — printed in the
   failure message, so the derivation is visible when it matters.)
2. **Nearest-border classification, not a first-match ladder.** A corner point is within tolerance of
   two borders; a ladder would label it by rule order and could fail spuriously.
3. **No brittle pixel constants.** The only number is `BORDER_HIT_TOL_PX = 6`, a *tolerance* absorbing
   sub-pixel transform/rounding error (routed endpoints land on the border by construction). No box
   coordinates, sizes, or positions are encoded.
4. **A non-vacuity floor** (`MIN_FACING_BOX_TERMINALS = 8`). "No edge attaches off the facing side"
   passes trivially against zero terminals, so a broken selector would have shipped a green no-op. The
   floor is loose (not 12) so it catches a dead selector without failing on jitter.
5. **Readiness is polled; the property is asserted once.** Polling the property itself would convert a
   genuine violation into an unreadable timeout instead of naming the offending terminals.

### Teeth, proven by mutation

I temporarily reverted item (a) — `pin.setExclusive(false)` → `void pin;` at
`src/view/edgeRouting.ts:298` (the same counterfactual STEP4 used), rebuilt `.dev-vault`, and re-ran:

```
✘ 2 e2e/edgeRouting.e2e.ts:237:1 › WHEN a folder group is crowded from one side THEN no edge
    attaches on a border facing away from the neighbours (98ms)

  Error: edges wrapped past the facing side: facingSide=[top] terminals=[12]
  expect(received).toEqual(expected) // deep equality
  - Array []
  + Array [
  +   "left@855,679",
  +   "left@855,621",
  +   "left@855,564",
  +   "bottom@1138,736",
  + ]
```

That is the reported symptom caught red-handed: three edges wrapped to the **left** border and one all
the way round to the **bottom**, for neighbours that are all *above* the box. Note the message also
proves the two safety properties — `facingSide=[top]` (derivation worked) and `terminals=[12]` (not
vacuous). Source restored (`git diff src/view/edgeRouting.ts` → **empty**), vault rebuilt, re-run green.

Logs: `.tmp/s5b-facing-{green,mutated,green2}.log`.

## 4. AFTER measurement

### The trap I hit first — worth recording

`.dev-vault`'s **built** `main.js` was stale: `grep -c edgeRoutingClearancePx` returned **0**, i.e. it
was the pre-5a bundle still routing at the old hardcoded 17px. The e2e harness copies that built plugin,
so running the AFTER measurement at that point would have produced numbers identical to BEFORE and I
would have reported "the change does nothing" — a false negative. `npm run setup:dev-vault` first
(count → 2). **Anyone re-measuring after a `src/` change must rebuild the vault or they are measuring
the old code.**

### BEFORE (buffer 17) vs AFTER (clearance 11) — verbatim `[eval]`

```
AFTER (.tmp/s5b-eval-after.log, 5 passed (24.5s), exit 0)
[eval] force/sparse: routingMs=3.2999999970197678 layoutMs=32.900000005960464 obstacles=13 edges=10 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/medium: routingMs=13.100000008940697 layoutMs=38.099999994039536 obstacles=21 edges=20 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/dense: routingMs=139.20000000298023 layoutMs=1436.2999999970198 obstacles=101 edges=292 maxDetourRatio=1.244 meanDetourRatio=1.046
[eval] force/facing: routingMs=4.9000000059604645 layoutMs=52 obstacles=18 edges=27 maxDetourRatio=1.266 meanDetourRatio=1.047
[eval] PERF dense/force: routingMs=135.6000000089407 layoutMs=1436.9000000059605 obstacles=101 edges=292 maxDetourRatio=1.244 meanDetourRatio=1.046
```

| fixture | metric | BEFORE (17) | AFTER (11) | direction |
|---|---|---|---|---|
| **dense** | maxDetourRatio | 1.342 | **1.244** | ✅ −7.3% |
| **dense** | meanDetourRatio | 1.067 | **1.046** | ✅ −2.0% |
| **dense** | routingMs | 148.3 | 139.2 | ✅ (noise-level) |
| **dense** | layoutMs | 1382.9 | 1436.3 | ⚠️ +3.9% — **noise, not caused by this change** (layout is elk+d3; clearance never reaches it) |
| **facing** | maxDetourRatio | 1.310 | **1.266** | ✅ −3.4% |
| **facing** | meanDetourRatio | 1.061 | **1.047** | ✅ −1.3% |
| **facing** | routingMs | 3.70 | 4.90 | ⚠️ +1.2ms — sub-noise at this scale |
| **facing** | layoutMs | 46.3 | 52.0 | ⚠️ noise |
| sparse / medium | both ratios | 1.000 | 1.000 | flat (no headroom; sparse also has the known edge-count flake) |

**Honest read:** every route-quality number moved the right way, and the dense figures landed *exactly*
on `SWEEP__PUBLIC.md` §2.2's prediction (1.244 / 1.046) — an independent confirmation that the sweep
model was right, not a coincidence. The ms columns wobble in both directions; on single runs of 3-150ms
those are noise and I am **not** claiming the routing pass got faster.

**PERF BUDGET: passes.** `routingMs=135.6 < layoutMs=1436.9`, a ~10.6x margin (was ~9.3x). Assertions
untouched.

### Visual read of the pair — deliberately unexciting

`.out/epictetus-before.png` (17) vs `.out/epictetus-after.png` (11), both 476x716.

Node positions are identical (seeded layout). The difference is **real but small**: in AFTER the
vertical bundle of routes running down the middle hugs the intermediate neighbour boxes noticeably more
tightly, and the lateral bowing where routes squeeze between `facing-near12`/`facing-near11` and
`facing-near2`/`facing-near3` is reduced — the whole bundle is narrower. In BEFORE those same routes
splay wider to clear the 17px envelope.

**Plainly: a casual viewer flicking between the two would call them the same picture.** On *this*
fixture the win is measurable (1.310 → 1.266) but not dramatic. The dense fixture is where it shows;
`SWEEP__PUBLIC.md`'s crops `.out/crop-dense-b17.png` vs `.out/crop-dense-b05.png` remain the clearest
visual evidence, and I did not regenerate them.

The 11-of-12 "pencil tip" fan-in at the box's top border is **unchanged**, exactly as the sweep
predicted (fan-in is flat across buffer values). Item (b) was never going to fix it; ticket
`nid_g1zb4b06gew54gnwcn5hx237j_e` owns it.

## 5. Settings UI screenshot + altitude review

`.out/settings-row/force-layout-card-{light,dark}.png` (Force layout card, *Advanced spacing* expanded,
both themes). Captured via a throwaway probe that I **deleted** after use (`git status` clean of it).

Measured geometry of all 7 rows + the reset row, straight from the DOM:

| row | left | width | control right | in *Advanced spacing* |
|---|---|---|---|---|
| Center force / Repel force / Link force / Link distance | 406 | 706 | 1096 | no |
| Node spacing / Group member spacing | 406 | 706 | 1096 | **yes** |
| **Edge clearance** | **406** | **706** | **1096** | **yes** |

**Byte-identical box metrics to all six siblings** — no altitude or alignment deviation, control column
flush. Order is Node spacing → Group member spacing → Edge clearance, exactly D4. Reads as native in
both themes; theme variables only, nothing hardcoded (it inherits the shared slider path).

**Unplanned skill win:** *Advanced spacing* now holds **3** rows. The `obsidian-settings` skill requires
"**≥3 rows** to justify a disclosure — hiding one control is pure cost", and at two rows this disclosure
was mildly under that bar. Adding the seventh slider pushes it into compliance rather than straining it.

**Accessibility finding (pre-existing, not introduced here):** in the **settings tab**, Playwright's
`getByLabel("Edge clearance")` finds **nothing** — Obsidian's `Setting` renders the row name as a
`div.setting-item-name`, with no `<label for>` and no `aria-label` on the slider. Every tab slider is
affected, not just this one; the in-graph React panel *is* properly labelled (which is why the existing
`:99-101` assertions work there). See §7.

## 6. Verification (real output)

```
$ npm run check                                → CHECK_EXIT=0
$ npx tsc -p e2e/tsconfig.json --noEmit        → E2E_TSC_EXIT=0
$ npm test                                     → Test Files 63 passed (63)
                                                       Tests 779 passed (779)

$ npm run test:e2e -- edgeRoutingEval.e2e.ts   → 5 passed (24.5s), exit 0   [§4 lines]

$ npm run test:e2e -- edgeRouting.e2e.ts       → 2 passed (2.3s), exit 0
  ✓ 1 …:211 › WHEN routing runs THEN at least one edge bends around a node … (303ms)
  ✓ 2 …:237 › WHEN a folder group is crowded from one side THEN no edge attaches on a
              border facing away from the neighbours (85ms)

$ npm run test:e2e -- settingsUxVisual.e2e.ts  → 7 passed (2.7s), exit 0
  ✓ 3 …:87 › force layout: 7 sliders, live write, restore defaults (246ms)
```

779 unit tests — **unchanged from step 5a's count**, as expected: this step added no unit-testable
logic, only copy, an e2e count, and one e2e test. No test was weakened, skipped, or removed; the PERF
BUDGET assertions are byte-identical.

Logs: `.tmp/s5b-{check,unit,e2e-tsc,eval-after,facing-green,facing-mutated,facing-green2,settings-e2e,rowshot2,final-*}.log`.

## 7. `#QUESTION_FOR_HUMAN:` / follow-ups

1. **`#QUESTION_FOR_HUMAN:` `docs-internal/CHANGELOG.md` has no entry for this ticket and I did not add
   one.** `:72` still reads "Six force-layout knobs are now user-tunable" — correct *as history* for
   that release, so I left it. Item (b) needs its own new entry (user-visible: a 7th slider, and every
   existing user's routing clearance changes 17 → 11 on upgrade). I did not write it because the
   ticket's own close-out copy (D6.1's three disproved claims) is TOP_LEVEL_AGENT's, and the two should
   land together. Say the word and I will draft it.
2. **`#QUESTION_FOR_HUMAN:` settings-tab sliders have no accessible label** (§5) — pre-existing and
   plugin-wide, so I did not fix it under this ticket. The fix is one line in `addForceLayoutSlider`
   (`slider.sliderEl.setAttribute("aria-label", meta.label)`), would make every tab slider reachable by
   assistive tech *and* by `getByLabel` in e2e, and is a strict improvement with no visual change.
   Worth a ticket — shall I file it?
3. **Not re-litigated, carried forward:** step 5a's two open questions (the `min: 6` strict-vs-inclusive
   inequality, and the full elk+d3 relayout on a routing-only slider) are untouched by this step and
   still need your call.
