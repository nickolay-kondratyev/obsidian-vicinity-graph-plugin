# Implementation review — nid_9uzrvqv0k5qgckgdaqtgr41ky_e (commit 1875811)

## Verification (run by the reviewer, verbatim)

- `npm run check` → **exit 0** (`tsc -noEmit` for `src/`, then `e2e/tsconfig.json`). Log: `.tmp/review-check.txt`.
- `npm test` → **exit 0**, **Test Files 96 passed (96) / Tests 1280 passed (1280)**. Log: `.tmp/review-test.txt`.
- `npm run test:e2e` — not run (needs a real Obsidian), per instruction.

## Summary

The panel's per-metric **Weight** input is now uncontrolled + blur/Enter-committed, sharing the
commit protocol with `NumberRow` through a new hook `useNumberFieldCommit`
(`src/view/SettingsRowView.tsx:225`), while each field keeps its own markup. `NumberField` was
folded into `NumberRow`.

**The design call is right.** The hook shares 100% of the protocol (bounds → `min/max/step`,
`defaultValue`, the remount/reseed key, Enter-blurs-to-commit, `aria-invalid`/`aria-describedby`,
the refusal element) and 0% of layout — the two options the ticket offered would each have
duplicated real knowledge or smuggled a layout switch into a behavior component. No clamp is
re-derived, the value half still comes from `SettingsRowAccessors.metricWeight`, the decision
still from `NumberRowCommitPolicy`, `disabled={!enabled}` / `aria-label` / `title="Weight"` are
preserved, and the new `.vicinity-graph-number-row-block` wrapper is a no-op visually (the
parent `.vicinity-graph-sizing__metrics` gap applies to any child).

Acceptance criteria 1, 2, 3 and 4 are met. One behavior regression came along with the refactor
(below), plus two DRY/coverage items.

## 🚨 CRITICAL Issues

None. No security surface, no data-loss path, no removed behavior-capturing test, no anchor
point touched. The commit only ADDS tests.

## ⚠️ IMPORTANT Issues

### 1. SHOULD-FIX — a refusal now survives a store move, leaving a valid field marked invalid
`src/view/SettingsRowView.tsx:236` (state) + `:241` (key) + `:247`

Refusal state moved UP from the remounted `NumberField` into the hook, which now lives in the
never-remounted row component. Before, `<NumberField key={shown}>` remounted whenever the stored
value moved, which CLEARED the refusal. Now only the `<input>` remounts (`key =
`${stored}:${reseeds}``): the text is reseeded from the store, but `refusal` and
`aria-invalid={true}` persist.

Reachable path: store maxPx=100 → in the panel type maxPx=20 → refused (message shown, field
holds "20") → Restore defaults → maxPx stored 100→160 → the field reseeds to **160** while the
red refusal message and `aria-invalid=true` remain under/on it. That is a valid, stored number
presented as invalid to sighted users and to assistive tech, with a message about a value that
is no longer on screen. This behavior change is not mentioned in
`IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md`.

Remedy (≈3 lines, keeps the documented invariant): tie the refusal to the stored value it was
judged against —

```ts
const [refusal, setRefusal] = useState<{ forStored: number; message: string } | undefined>(undefined);
const shownRefusal = refusal?.forStored === stored ? refusal.message : undefined;
```

A REFUSED commit never moves `stored`, so "a refusal is never remounted away" still holds; only
a store move (reset, another surface) clears it — which is the pre-change behavior.

### 2. SHOULD-FIX — the new tripwire only scans one module
`src/view/panelTypedNumberFields.test.ts:34`

`PANEL_MODULE` is hard-coded to `SettingsRowView.tsx`, yet the test's stated purpose is "what
stops the NEXT one being added the old way". A typed number field added in `GraphToolbar.tsx`,
`DepthStepper.tsx` or a new panel row component escapes it entirely.
`settingsRowParity.test.ts:80` already computes `EVERY_ROW_RENDERING_MODULE` for exactly this
reason. Remedy: export that list (or a panel-only subset — the settings tab is legitimately
debounced and builds no JSX inputs) and scan every panel row-rendering module, failing with the
module name.

I did verify the scan's *strength* empirically against mutated copies of the source (no source
edits — `.tmp/scan-sim.mjs`):

| mutation | result |
|---|---|
| weight reverted to `value={weight}` + `onChange`, no spread | **fails** (1 unwired, 1 controlled) ✔ |
| spread kept, `value={weight}` added alongside | **fails** (1 controlled) ✔ |
| `<input …></input>` instead of `/>` (reformat) | still passes, no false alarm ✔ |
| a new controlled number field appended to the module | **fails** ✔ |

So it is a real tripwire, not fooled by trivial reformatting, and it is **not** redundant with
`settingsRowParity.test.ts` or `ACCESSOR_OWNED_SYMBOLS` — those assert "handles the kind" and
"does not re-derive the value half"; neither says anything about controlled-ness or wiring.

### 3. SHOULD-FIX (DRY) — the source-scan helper is now written twice
`src/view/panelTypedNumberFields.test.ts:36-42` vs `src/view/settingsRowParity.test.ts:93-101`

The comment-stripping `source()` / `panelSource()` (same regex, same line filter, same stated
WHY) is duplicated verbatim. That is knowledge duplication in the guard layer — the exact thing
CLAUDE.md calls vital to eliminate. Remedy: extract one `readSourceWithoutComments(module)`
helper (e.g. `src/view/sourceScan.ts`) and have both suites import it.

## 💡 Suggestions

- **NICE-TO-HAVE** `src/view/numberRowCommit.ts:80` — the doc still says "the echo replaces the
  whole field anyway (`NumberRow`'s `key={shown}`)". The key is now `${stored}:${reseeds}` on the
  `<input>`; update the sentence so the reasoning stays checkable.
- **NICE-TO-HAVE** `src/view/SettingsRowView.tsx:373-374` — `disabled={!enabled}` is written
  BEFORE `{...weightField.inputProps}`. Harmless today (the props object has no `disabled`), but
  a later addition to `CommittedNumberFieldProps` would silently override it. Put the spread
  first, or make `disabled` part of the props contract.
- **NICE-TO-HAVE** — acceptance criterion "stays disabled while its metric is off" has no test.
  Cheapest honest pin: extend the source scan to assert the weight field carries `disabled={`,
  or add it to the existing e2e sizing spec.
- **Observation, not a defect** — with `NO_CROSS_FIELD_RULE` the weight can never refuse, so
  `weightField.refusal` is always `null` and the wrapper is precautionary. Acceptable: it is the
  price of one shared protocol, and it costs one div.
- **Pre-existing, now also true of the weight** — focusing and leaving the field without editing
  still commits (a write + rebuild for an unchanged value). Same as every other panel typed
  field; out of scope here, but worth a ticket if the rebuild cost is ever noticed.

## e2e helper change — checked

`e2e/controlsRestart.e2e.ts:118` (`focus()` → set `.value` → `input` event → `blur()`) matches how
the field now commits: React maps `focusout` to `onBlur`, which reads `event.target.value`. The
metric it drives (`own-file-size`) ships **enabled** (`src/engine/settingsProductDefaults.test.ts:62`),
so the input is not `disabled` and the focus/blur pair is effective. `DISTINCTIVE_WEIGHT = 7` is
in range and differs from the default, so the reseed lands on 7 and the poll is honest.

No other test or e2e site drives a PANEL number input the old way — `settingsResetReview.e2e.ts`,
`settingsTabPage.ts` and `settingsUxVisual.e2e.ts` all target the debounced settings TAB, and
`harness.setGlobalNodeCap` writes programmatically. One thing to remember: the OLD helper's
synthetic `input` dispatch would have committed even on a *disabled* input; the new one will not
(focus/blur no-op there). Fine today; it would bite a future spec that drives a disabled metric.

## Documentation Updates Needed

- CLAUDE.md's typed-fields bullet was updated correctly (names the hook and the new scan). If
  finding 1 is fixed, no further CLAUDE.md change is needed; if it is knowingly kept, the bullet
  must say so — "a refusal outlives a store move" is exactly the kind of surprise that bullet
  exists to prevent.
- `src/view/numberRowCommit.ts:80` stale `key={shown}` reference (see Suggestions).

## Verdict

**CHANGES_REQUESTED** — finding 1 is a silent behavior/accessibility regression introduced by
the refactor and undisclosed; findings 2 and 3 are cheap and directly weaken/duplicate the guard
this commit adds. Everything else in the change is good work and the core design call is right.

---

# ROUND 2 — review of commit `7da47d3`

**VERDICT: APPROVED.** All three round-1 SHOULD-FIX findings are genuinely fixed, the
rejection is well-argued and accepted, and the diff introduces no regression. Two
doc-only nits below are non-blocking — fix opportunistically, do NOT open another round
for them.

## Verification (run by me, verbatim)

```
npm run check  → CHECK_EXIT=0                 (log: .tmp/review2-check.txt)
npm test       → TEST_EXIT=0
                 Test Files  96 passed (96)
                 Tests  1283 passed (1283)    (log: .tmp/review2-test.txt)
```
Matches the implementer's claim exactly (+3 vs round 1's 1280). `npm run test:e2e` NOT run
(needs a real Obsidian). Working tree clean at `7da47d3`.

## Finding 1 (stale refusal surviving a store move) — FIXED

Verified in the source, not taken on the claim:
- `NumberFieldRefusal` (`src/view/numberRowCommit.ts:105-124`) is a pure, private-ctor seam:
  `fromCommit(commit, storedWhenJudged)` / `messageWhileStoredIs(stored)`.
- `src/view/SettingsRowView.tsx:248` computes `shownRefusal` ONCE, and it is the sole input
  to `aria-invalid` (`:256`), `aria-describedby` (`:257`) and the rendered `role="alert"`
  element (`:277-282`). A grep of the module confirms the raw `refusal` state is used
  nowhere else — message and invalid marking structurally cannot disagree.
- The invariant I asked to preserve holds: a REFUSED commit writes nothing, so `stored`
  does not move and a refusal is never cancelled by the commit that earned it. My round-1
  repro (refuse `maxPx` → Restore defaults → stored 100→160) is closed and pinned by
  `src/view/numberRowCommit.test.ts:180-186`, written failing first.

**Documented residual — ACCEPTABLE, not blocking.** The binding is by VALUE, so a store
that moves away and back to the same number while the field is untouched re-shows the
message. Reaching it needs another surface writing twice with a live panel refusal; the
result is a non-destructive stale message that the next commit clears, and it is stated on
the class rather than hidden. The value-free alternative is render-time state adjustment —
exactly the untestable-under-`npm test` shape this fix removes. Correct 80/20 call.

## Findings 2 & 3 (scan breadth, DRY) — FIXED, nothing weakened

- The scan is now `src/view/typedNumberFields.test.ts` over `EVERY_ROW_RENDERING_MODULE`,
  naming the offending module in the failure. Still non-vacuous: `:86-89` asserts ≥2 fields
  were found, and the detection regexes are unchanged from the version I mutation-tested in
  round 1 (`SPREAD_COMMIT_PROPS`, `CONTROLLED_VALUE` with `defaultValue=` deliberately not
  matching). The rename is right — the old name would have lied.
- Parity suite checked MECHANICALLY, not by eye: comment/blank-stripped diff of
  `settingsRowParity.test.ts` before vs after shows the ONLY delta is the three `node:`
  imports removed, the `./rowRenderingSource` import added, and the moved tables + `source()`
  deleted. All 8 `it(...)` and all 11 `expect(...)` survive verbatim — including the
  `ACCESSOR_OWNED_SYMBOLS` list and the `EVERY_ROW_RENDERING_MODULE.length >
  Object.keys(PRESENTERS).length` vacuity guard. The moved code in
  `src/view/rowRenderingSource.ts` is byte-identical to what was removed. Nothing dropped.
- `rowRenderingSource.ts` is imported only by the two suites (grep over `src/`, `e2e/`), so
  its `node:fs` never reaches the bundle.

## The REJECTED nice-to-have (disabled-scan) — REJECTION ACCEPTED

Their reasoning is the correct one: a source scan can only assert the token `disabled={`
exists, so it would pass unchanged on the inverted `disabled={enabled}` — a false sense of
a property — and reaching only the weight would hard-code one field's identity into a guard
whose value is being structural over all fields. Recording the gap on
`nid_7qot0m6nuxxmd5z0yb9jylsd6_e`, where a render harness can actually close it, is the
right place. Closed; not to be re-raised.

## Regression check on the rest of the diff

None found. `disabled={!enabled}` now sits after the spread with a WHY comment
(`SettingsRowView.tsx:382-385`); the stale `key={shown}` doc at `numberRowCommit.ts:80` is
corrected; the CLAUDE.md edit is one bullet naming the renamed+widened scan and changes no
other rule; the two ticket files are additive (`nid_bbe962ojwwkhzn3uq27zw5w6l_e` new, with
acceptance criteria; a note appended to `nid_7qot0m6nuxxmd5z0yb9jylsd6_e`). No
behavior-capturing test, no `ap_XXX_E` anchor, and no use case was removed anywhere.

## 💡 Suggestions (non-blocking — no further review round)

1. `src/view/rowRenderingSource.ts:10` still names `panelTypedNumberFields.test.ts`, the
   file this same commit renamed. Remedy: say `typedNumberFields.test.ts`.
2. `src/view/numberRowCommit.test.ts:148` (comment) has the same stale name. Same remedy.
   CLAUDE.md itself was updated correctly.
3. `src/view/numberRowCommit.test.ts:185` hard-codes the whole refusal sentence — a 4th test
   copy of a string `src/view/settingsValidation.ts:80` owns — while this test's subject is
   presence-vs-absence. Matches the pre-existing pattern, so purely optional.
