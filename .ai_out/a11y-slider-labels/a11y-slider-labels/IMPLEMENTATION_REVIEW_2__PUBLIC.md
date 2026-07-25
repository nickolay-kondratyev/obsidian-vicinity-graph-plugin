# IMPLEMENTATION_REVIEW 2 — PUBLIC (a11y slider labels, iteration 2)

Confirmation pass over the delta `git diff f4a193b..HEAD -- e2e/ src/` (commits `b334209`,
`3b9403f`). Everything at or before `f4a193b` was reviewed and approved in
`IMPLEMENTATION_REVIEW__PUBLIC.md` and is NOT re-litigated here.

**Verdict: NOT-READY — 1 BLOCKING.** The e2e hardening (S1/S2/S3, N2) is genuinely fixed and I
independently reproduced the mutations that prove it. The single production-code change in this
delta — removing `setDynamicTooltip()` — is **not** behaviour-neutral on the Obsidian versions this
plugin supports, and I have DOM-level proof of the regression. It must be reverted.

---

## 🚨 BLOCKING

### B1. `setDynamicTooltip()` removal is a real functional regression on Obsidian 1.12.x
`src/view/VicinityGraphSettingTab.ts:461-464, :480`

The maker (and my own prior N1 nit) relied on the `@deprecated` note in `obsidian.d.ts`
("The value is now always shown inline next to the slider"). That d.ts is from
**`obsidian@1.13.1`** (`package.json` pins `"obsidian": "latest"`; `node_modules/obsidian` reports
`1.13.1`), and the sibling `setDisplayFormat` on the same interface is `@since 1.13.0` — i.e. the
inline-value behaviour the deprecation note describes **arrived in 1.13.0**.

This plugin's floor is `manifest.json` `minAppVersion: 1.12.4`, and the e2e gate pins
`scripts/setup-obsidian-bin.sh` `OBSIDIAN_VERSION="1.12.7"`. On that runtime the method is **not**
a no-op. From the shipped 1.12.7 bundle
(`.tmp/obsidian/obsidian-1.12.7/resources/obsidian.asar`, verbatim):

```js
e.prototype.setDynamicTooltip=function(){var a=this.sliderEl;
  return a.addEventListener("mouseenter",this.showTooltip.bind(this)),
         a.addEventListener("mouseleave",Ie),this.dynamicTooltip=!0,this},
e.prototype.showTooltip=function(){Oe(this.sliderEl,this.getValuePretty(),{placement:"top"})},
```

It registers real hover listeners that render the current value in a tooltip.

**DOM-level proof on the pinned runtime** (throwaway probe spec, run and deleted; tree clean):

```
PROBE ours tooltip=[[]]
PROBE our slider row html=[<div class="setting-item">…<div class="setting-item-control">
  <input class="slider" type="range" data-ignore-swipe="true" min="0" max="5" step="1"
         aria-label="Outgoing depth"></div></div>]

PROBE core tooltip=[["16"]]                     ← core Appearance ▸ Font size, which DOES call setDynamicTooltip()
PROBE core slider row html=[… <input class="slider" type="range" min="10" max="30" step="1"> …]
```

Control group and subject are the same Obsidian build, the same `<input class="slider">` markup.
Hovering the core slider produces a `.tooltip` reading `16`; hovering ours produces **nothing**, and
our row contains **no inline value element** of any kind (the `.vicinity-graph-forcelayout__field`
value readout in `graph-view.css` is the in-graph panel, not the settings tab).

Net effect for a user on 1.12.4–1.12.x: **all 10 settings-tab sliders lose their only value
readout** — outgoing/incoming/outline depth and the 7 force-layout sliders become unreadable
numbers. That is a loss of pre-existing functionality, not approved by a human engineer, and
entirely orthogonal to the a11y ticket.

**Fix:** restore `.setDynamicTooltip()` in `addLabeledSlider` and replace the WHY-NOT with a
factual note, e.g.:

```ts
// `setDynamicTooltip()` is @deprecated in the 1.13 typings ("value now shown inline"), but on our
// minAppVersion floor (1.12.x) it is the ONLY value readout a slider has — verified in 1.12.7.
// Drop it only when minAppVersion moves to >= 1.13.0.
```
If the team would rather drop it, that is a deliberate min-version bump decision for the human
engineer, plus a `docs-internal/tickets/` entry — not a drive-by nit fix.

---

## Per-finding confirmation

| # | Prior finding | Closed? | Evidence |
|---|---|---|---|
| S1 | textarea clause vacuous (0-of-0) | ✅ **CLOSED** | The test now enables `nodeExclusion` in the store and re-renders the tab before asserting, and adds `getByLabel("Exclusion patterns")` → count 1. My **M2** reproduction: stripping the textarea's `nameControl` call now turns the spec RED (it stayed GREEN under the old guard). |
| S2 | guard too narrow vs AC-2 (`type=text` / `<select>` leak) | ✅ **CLOSED** | Deny-list selector derived from one `NAMED_CONTROL_SELECTORS` array, so the "all" and "unlabeled" variants cannot drift. My **M3** reproduction: a new unlabeled `addText` row is caught (RED) where the old guard was blind (GREEN). Exemptions for radio/checkbox are commented and ticket-linked (`nid_d2z2jgt6v49ssej8hxmwd2xi6_e`). |
| S3 | no positive lower bound on number inputs | ✅ **CLOSED** | `getByLabel("Node cap")` → `type=number`, plus `MIN_NAMED_CONTROLS = 20` asserted with `toBeGreaterThanOrEqual`. Floor, not equality, so adding a row does not break the test. |
| N1 | doc oversells deprecated `setDynamicTooltip()` | ❌ **REGRESSED — see B1** | The comment is fixed; the accompanying code removal introduces a functional regression on the supported version floor. My original nit asked for "drop the call OR drop the clause" — dropping the clause alone was the correct half. My nit was under-researched (it trusted the 1.13 d.ts); that is on me, and it is still the maker's call to verify before deleting behaviour. |
| N2 | page-scoped `getByLabel("Node cap")` | ✅ **CLOSED** | `page.locator(".vicinity-graph-settings").getByLabel("Node cap")` with the WHY inline. |
| N3 | "what does core do" unrecorded | ✅ **CLOSED** | Recorded in `IMPLEMENTATION_ITERATION__PUBLIC.md`; my probe independently re-confirms core sets no `aria-label` and no `id`/`for` pairing on slider rows (the 1.12.7 `Font size` row HTML above has a bare `<input class="slider">`). |

---

## Answers to the four scoped questions

### Q1 — Is the guard non-vacuous under the ACTUAL serial order, and does its state leak?
**Non-vacuous: yes** — proven by M2, which is precisely the mutation the old guard survived.
**Leak: bounded and harmless.**
- Test 6 leaves `nodeExclusion.enabled = true`.
- Test 7 (`:226`, section restore) touches only `globalView.nodeCap` / `globalDepths` and clicks the
  **Performance** section's button; exclusion state is irrelevant to every assertion in it, and the
  extra exclusion rows do not affect the section-scoped locators (I re-ran the full file twice —
  green both times, plus 4 more full-file runs during mutation testing).
- Test 8 (`:246`) does a restore-all, which resets `nodeExclusion` to defaults, so the state the
  file leaves on disk for any later spec is unchanged from before this commit.
- No later test becomes vacuous: none of tests 7-14 asserts anything counted or gated on exclusion.

One residual, non-blocking: if test 6 fails mid-way, exclusion stays enabled for tests 7-8. Test 8
resets it anyway, so this cannot cascade beyond the file.

### Q2 — Is the deny-list right? Is `MIN_NAMED_CONTROLS = 20` robust?
**Selector: correct for every control the tab can render today or plausibly tomorrow.**
`addText` (`type=text`), `addSearch` (`type=search`), `addDropdown` (`<select>`), `addTextArea`,
`addColorPicker` (`type=color`), `addMomentFormat` (`type=text`) are all matched. Scope is
`.vicinity-graph-settings`, so core's own inputs never enter. Nothing the tab renders escapes.

Two things it deliberately does not cover, both fine:
- `<button>` / `.clickable-icon` — named by their visible text, and
  `settingsResetReview.e2e.ts:190-200` already asserts the exact ordered `Restore*` label list.
  No conflict: this delta introduces no new `Restore`-prefixed label (spec re-run green).
- `input[type=hidden]` would be *required* to carry an `aria-label` — a theoretical false positive,
  but Obsidian's `Setting` API never creates one. Not worth a clause.

**Floor: right tradeoff.** 20 is the measured truth (10 range + 9 number + 1 textarea; matches my
iteration-1 DOM dump of 19 range+number). `toBeGreaterThanOrEqual` means adding rows never breaks
it — only *removing* a section does, which is exactly the silently-empty-page case worth catching.
A legitimate future removal produces a loud, self-explaining failure with a one-line fix and a
docstring that says why the number exists. Accept.

### Q3 — Does the guard go RED on revert? (my own reproductions)
Driver: `.tmp/review2_mutate.py` (temp only). Each case patches
`src/view/VicinityGraphSettingTab.ts`, runs the spec against the **new** guard (HEAD) and against
the **old** guard (`git show f4a193b:e2e/settingsUxVisual.e2e.ts`), then `git checkout --` restores.

```
===== M2 + NEW guard (HEAD): exit=1 -> RED =====
  ✘   6 e2e/settingsUxVisual.e2e.ts:198:1 › settings tab: WHEN the tab renders THEN every input carries its row name as accessible name (15.0s)
    Error: expect(locator).toHaveCount(expected) failed
    Expected: 1
    Received: 0
  1 failed
  5 passed (17.4s)
===== M2 + OLD guard (f4a193b): exit=0 -> GREEN =====
  ✓   6 e2e/settingsUxVisual.e2e.ts:174:1 › settings tab: WHEN the tab renders THEN every input carries its row name as accessible name (21ms)
  14 passed (3.2s)
===== M3 + NEW guard (HEAD): exit=1 -> RED =====
  ✘   6 e2e/settingsUxVisual.e2e.ts:198:1 › settings tab: WHEN the tab renders THEN every input carries its row name as accessible name (15.0s)
    Error: expect(locator).toHaveCount(expected) failed
    Expected: 0
    Received: 1
  1 failed
  5 passed (17.4s)
===== M3 + OLD guard (f4a193b): exit=0 -> GREEN =====
  ✓   6 e2e/settingsUxVisual.e2e.ts:174:1 › settings tab: WHEN the tab renders THEN every input carries its row name as accessible name (20ms)
  14 passed (3.2s)
git status --porcelain after mutations:
(empty)
```

- **M2** (exclusion textarea's `nameControl` call deleted): unlabeled-textarea count **0 → 0** under
  the old guard (it never rendered) but the new guard fails on the positive
  `getByLabel("Exclusion patterns")` assertion, 1 expected → 0 received. The maker's claim holds.
- **M3** (an unlabeled `addText` row added to the exclusion section): unlabeled-control count
  **0 (old guard, blind) → 1 (new guard, red)**. The S2 leak is genuinely closed.

Both mutations are the two that matter, and both reproduce exactly as reported.

### Q4 — Any remaining test-honesty problem?
No. The new assertions are all capable of failing (demonstrated), none has a silent fallback, none
was weakened or removed, and the two `:not(...)` exemptions are documented with the ticket that
will delete them. The only non-retrying assertion
(`expect(await settings.locator(ANY_NAMED_CONTROL).count())`) runs after awaited web-first
assertions on a synchronously-rendered tab — not a flake risk.

---

## Verification run by this reviewer (verbatim)

`npm run check`:
```
> vicinity-graph@0.1.1 check
> tsc -noEmit

CHECK_EXIT=0
```

`npm test`:
```
 Test Files  70 passed (70)
      Tests  938 passed (938)
   Start at  17:30:22
   Duration  1.07s (transform 7.70s, setup 0ms, import 12.35s, tests 1.42s, environment 5ms)
TEST_EXIT=0
```

`npm run test:e2e -- settingsUxVisual.e2e.ts`:
```
Running 14 tests using 1 worker
  ✓   1 e2e/settingsUxVisual.e2e.ts:52:1 › panel defaults: every section is a disclosure, only Depth starts open (124ms)
  ✓   2 e2e/settingsUxVisual.e2e.ts:62:1 › exclusion toggle switches on, shows patterns state, and persists (328ms)
  ✓   3 e2e/settingsUxVisual.e2e.ts:88:1 › force layout: 7 sliders, live write, restore defaults (215ms)
  ✓   4 e2e/settingsUxVisual.e2e.ts:122:1 › settings tab renders six framed section cards with plugin CSS applied (268ms)
  ✓   5 e2e/settingsUxVisual.e2e.ts:158:1 › settings tab: every section card ends with its own scoped restore row (110ms)
  ✓   6 e2e/settingsUxVisual.e2e.ts:198:1 › settings tab: WHEN the tab renders THEN every input carries its row name as accessible name (41ms)
  ✓   7 e2e/settingsUxVisual.e2e.ts:226:1 › settings tab: a section restore resets ONLY that section (57ms)
  ✓   8 e2e/settingsUxVisual.e2e.ts:246:1 › settings tab: restore-all asks first, then resets every section (314ms)
  ✓   9 e2e/settingsUxVisual.e2e.ts:308:1 › settings tab: the Preview pill shows one segment per option and checks the stored one (51ms)
  ✓  10 e2e/settingsUxVisual.e2e.ts:320:1 › settings tab: clicking a Preview segment persists the new preference (52ms)
  ✓  11 e2e/settingsUxVisual.e2e.ts:329:1 › settings tab: the segmented-control stylesheet reaches the settings modal DOM (18ms)
  ✓  12 e2e/settingsUxVisual.e2e.ts:342:1 › settings tab: the selected Preview segment is filled distinctly from the trough (329ms)
  ✓  13 e2e/settingsUxVisual.e2e.ts:380:1 › controls panel: clicking its Preview segment writes the SAME global the tab writes (54ms)
  ✓  14 e2e/settingsUxVisual.e2e.ts:396:1 › controls panel: the pill re-checks itself from the rebuilt snapshot (10ms)
  14 passed (3.3s)
UX_EXIT=0
```

`npm run test:e2e -- settingsResetReview.e2e.ts`:
```
Running 11 tests using 1 worker
  ✓   1 e2e/settingsResetReview.e2e.ts:105:1 › REVIEW: isolation matrix — each section reset touches only its own keys (361ms)
  ✓   2 e2e/settingsResetReview.e2e.ts:190:1 › REVIEW: every reset control has a distinct accessible name (20ms)
  ✓   3 e2e/settingsResetReview.e2e.ts:208:1 › REVIEW: section reset re-renders the tab so displayed values actually move (69ms)
  ✓   4 e2e/settingsResetReview.e2e.ts:228:1 › REVIEW: exclusion reset shows the hidden patterns it is about to delete (199ms)
  ✓   5 e2e/settingsResetReview.e2e.ts:244:1 › REVIEW: cancelling the exclusion confirmation keeps every pattern (82ms)
  ✓   6 e2e/settingsResetReview.e2e.ts:252:1 › REVIEW: with no patterns stored, the exclusion reset applies without a dialog (48ms)
  ✓   7 e2e/settingsResetReview.e2e.ts:265:1 › REVIEW: confirm modal — Escape is non-destructive and Cancel holds initial focus (127ms)
  ✓   8 e2e/settingsResetReview.e2e.ts:279:1 › REVIEW: confirm modal — keyboard-only confirm restores everything (165ms)
  ✓   9 e2e/settingsResetReview.e2e.ts:302:1 › REVIEW: reset survives closing/reopening the tab AND a plugin reload (108ms)
  ✓  10 e2e/settingsResetReview.e2e.ts:326:1 › REVIEW: tab-wide reset sits further from the last card than cards sit apart (11ms)
  ✓  11 e2e/settingsResetReview.e2e.ts:340:1 › REVIEW: visual evidence — dark theme and a narrow settings pane (481ms)
  11 passed (2.7s)
RESET_EXIT=0
```

`sanity_check.sh`: not present in this repo.
Pre-existing unrelated failure `vicinityGraph.e2e.ts:160` (gamma breadcrumb): not run, per brief.

**Note on the green suite:** every spec above passes *with* B1 present. The suite has no assertion
covering slider value visibility, which is exactly why the regression slipped through — see the
suggestion below.

---

## Tree state
`git status --porcelain` is **empty**. The probe spec (`e2e/zzReview2Probe.e2e.ts`) was created,
run, and deleted in the same shell invocation; the mutation driver restored
`src/view/VicinityGraphSettingTab.ts` and `e2e/settingsUxVisual.e2e.ts` from git after every case,
and I verified emptiness afterwards. Only `.tmp/` (gitignored) and this `.ai_out/` file were
written.

---

## Acceptance criteria — final per-criterion verdict

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Every settings-tab slider programmatically associated with its visible name, verified from rendered DOM | ✅ PASS | Unchanged by this delta; re-confirmed in this pass — probe row HTML shows `aria-label="Outgoing depth"` on the live `<input class="slider">` |
| 2 | Association comes from the SHARED helper so a new field inherits it free | ✅ PASS (was PARTIAL) | `addLabeledSlider` is still the sole slider builder; the guard is now a deny-list, and **M3** proves an unrelated new control family is caught |
| 3 | In-graph `ForceLayoutSection` sliders get the same treatment | ✅ PASS | Untouched by this delta; verified in iteration 1 (`ForceLayoutSection.tsx:87`) |
| 4 | A test/e2e assertion covers ≥1 slider so the gap cannot silently return | ✅ PASS | 4 positive `getByLabel` assertions + deny-list count + floor of 20; **M2/M3** independently reproduced RED-on-revert |
| 5 | **No visual change**; existing e2e assertions stay green | ❌ **FAIL** | e2e green, but the `setDynamicTooltip()` removal **is** a user-visible change on 1.12.x: sliders lose their hover value tooltip and have no other readout. See **B1** |

---

## 💡 Suggestions (non-blocking, after B1 is reverted)

1. **Guard the value readout the way the label is now guarded.** B1 was invisible to a 14-test spec
   because nothing asserts a slider is *readable*. One test in `settingsUxVisual.e2e.ts` —
   hover a slider, expect `.tooltip` to have the slider's value — would make this class of
   regression impossible on the pinned runtime. Cheap, and it is the honest lesson from B1.
2. **Pin the `obsidian` devDependency.** `"obsidian": "latest"` in `package.json` means the typings
   silently drift ahead of `minAppVersion`, which is the root cause of B1: a `@deprecated` tag from
   1.13.1 was read as a statement about 1.12.4. Pin to the floor (or at least record the gap in
   `CLAUDE.md`) so "the d.ts says it's deprecated" can never again be mistaken for "it does nothing
   on the versions we support". Worth a `docs-internal/tickets/` entry either way.

## Documentation Updates Needed

If suggestion 2 is taken, one succinct `CLAUDE.md` line under **Guardrails** is warranted, e.g.
"`obsidian` typings track `latest`, not `minAppVersion` (1.12.4) — an `@deprecated` API may still be
live on the floor; verify against the pinned e2e build before deleting a call." That is stable
knowledge and directly prevents a repeat of B1. Nothing else.
