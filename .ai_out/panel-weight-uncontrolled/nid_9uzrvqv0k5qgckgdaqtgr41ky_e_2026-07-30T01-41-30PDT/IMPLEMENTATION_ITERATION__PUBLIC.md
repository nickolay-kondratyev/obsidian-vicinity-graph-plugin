# Implementation iteration 1 — response to IMPLEMENTATION_REVIEW (commit 1875811)

Verdict addressed: CHANGES_REQUESTED (3 SHOULD-FIX + 5 nice-to-have/observations).
All three SHOULD-FIX findings are **INCORPORATED**. Two nice-to-haves incorporated, one
rejected with rationale, two turned into tracked follow-ups.

## Per finding

### 1. SHOULD-FIX — a refusal survived a store move → **INCORPORATED**

The reviewer is right and the repro is real: refusal state moved into the never-remounted
row, so after `refuse maxPx → Restore defaults` the field reseeded to the stored 160 while
the red message and `aria-invalid=true` stayed on it.

Fixed by binding a refusal to the stored value it was judged against — the reviewer's
remedy, but **encapsulated in a pure, unit-tested seam** rather than as two loose lines in
the component, because `npm test` renders no React and a rule living in `useState` is a
rule nothing can test:

- new `NumberFieldRefusal` in `src/view/numberRowCommit.ts` —
  `fromCommit(commit, storedWhenJudged)` / `messageWhileStoredIs(stored)`.
- `useNumberFieldCommit` holds a `NumberFieldRefusal | undefined` and derives
  `shownRefusal`, which drives BOTH the rendered element and `aria-invalid` /
  `aria-describedby` — so the message and the invalid marking can no longer disagree.

**Started from a failing test**, as required: 3 new BDD cases in
`src/view/numberRowCommit.test.ts` (`NumberFieldRefusal: how long a refusal stays under the
field`), the middle one being the regression itself ("WHEN the store MOVES under the refused
field THEN the reason is gone"). Verified red first — `TypeError: Cannot read properties of
undefined (reading 'fromCommit')`, 3 failed / 25 passed — then green.

What is still NOT pinned by `npm test`: that the component actually renders `shownRefusal`
(wiring, not rule). Stated in the scan's doc and recorded on the component-test ticket
`nid_7qot0m6nuxxmd5z0yb9jylsd6_e` — not faked with a render harness.

KNOWN EDGE, documented on the class rather than hidden: the binding is by VALUE, so a store
that moves away and back to the same number while the field is untouched shows the refusal
again. Committing the field clears it. Accepted (80/20) — the value-free alternative is
render-time state adjustment, which is exactly the untestable-here shape this fix avoids.

### 2. SHOULD-FIX — the tripwire scanned one module → **INCORPORATED**

The scan now walks `EVERY_ROW_RENDERING_MODULE` and names the offending module in the
failure. File renamed `panelTypedNumberFields.test.ts` → **`src/view/typedNumberFields.test.ts`**
(it is no longer panel-only; a name that lies is worse than the narrow scan). The settings
tab is in the list and contributes nothing — it builds rows through Obsidian's `Setting` API,
not JSX — so no subset list has to be maintained.

Empirically re-verified, not assumed: temporarily adding `<input type="number" value={probe}
onChange={…} />` to `DepthStepper.tsx` fails BOTH assertions with
`DepthStepper.tsx: a typed number field is not wired to the shared blur-commit hook` /
`… is controlled, so it writes per keystroke`. Mutation reverted (`git checkout`); working
tree contains no probe.

### 3. SHOULD-FIX (DRY) — duplicated source-scan helper → **INCORPORATED**

New test-support module **`src/view/rowRenderingSource.ts`** owns the module tables
(`ROW_PRESENTERS`, `ROW_SECTION_WALKERS`, `ROW_CONTROL_COMPONENTS`,
`EVERY_ROW_RENDERING_MODULE`) and `readRowSourceWithoutComments()`. Both suites import it;
`settingsRowParity.test.ts` lost ~50 lines and keeps every assertion it had. The LIST moved
too, not just the helper — the list is what decides each guard's coverage, and that was the
knowledge finding 2 showed had already drifted.

### NICE-TO-HAVE — stale `key={shown}` doc at `numberRowCommit.ts:80` → **INCORPORATED**
Now describes the actual key (`useNumberFieldCommit`'s `${stored}:${reseeds}`).

### NICE-TO-HAVE — `disabled` written before the spread → **INCORPORATED**
Spread first, `disabled={!enabled}` after, with a WHY comment. The row's own disabled state
now wins over anything the shared protocol grows later.

### NICE-TO-HAVE — pin "weight stays disabled while its metric is off" via the scan → **REJECTED**

Technical rationale: a source scan can only assert that the TEXT `disabled={` appears. It
would pass unchanged on `disabled={enabled}` — i.e. it does not test the criterion, it tests
that a token is present — and to reach only the weight it would have to hard-code one
field's identity into a guard whose whole value is being structural over ALL fields. That
trades a real property for a false sense of one.

Instead the gap is recorded where it can actually be closed: a note on
`nid_7qot0m6nuxxmd5z0yb9jylsd6_e` (which already scopes rendered `disabledWhen` verdicts on
both surfaces), naming this field and the refusal-rendering gap from finding 1.

### OBSERVATION — focus-and-leave commits an unchanged value → **TICKETED, not patched**

Pre-existing and out of scope, as the reviewer says. Filed
`nid_bbe962ojwwkhzn3uq27zw5w6l_e` ("Panel typed fields commit on focus-out even when nothing
was typed") with the proposed seam-level fix (`NumberRowCommitPolicy` handed the seeded
value) and acceptance criteria.

### OBSERVATION — `weightField.refusal` is always null today → no action
Agreed with the reviewer's own reading: it is the price of one shared protocol, one div.

### OBSERVATION — new e2e helper would no-op on a DISABLED input → no action
True and worth remembering; no current spec drives a disabled metric, and forcing a synthetic
`input` dispatch back in would re-introduce a commit path the real UI does not have.

## Documentation

- `CLAUDE.md` typed-fields bullet: updated for the renamed + widened scan. No "a refusal
  outlives a store move" caveat is needed, because finding 1 was fixed rather than kept.
- `SettingsRowView.tsx` hook doc now states both directions of staleness (sibling repair does
  NOT clear; this row's store move DOES).

## Files touched this round

- `src/view/numberRowCommit.ts` — new `NumberFieldRefusal`; stale key doc fixed.
- `src/view/numberRowCommit.test.ts` — 3 new BDD cases (written failing first).
- `src/view/SettingsRowView.tsx` — refusal bound to the stored value; spread/`disabled` order; docs.
- `src/view/rowRenderingSource.ts` — NEW shared test-support scan module.
- `src/view/settingsRowParity.test.ts` — imports the shared module.
- `src/view/panelTypedNumberFields.test.ts` → `src/view/typedNumberFields.test.ts` — scans every row-rendering module, names the module.
- `CLAUDE.md` — scan name/scope.
- `_tickets/panel-typed-fields-commit-on-focus-out-even-when-nothing-was-typed.md` — NEW.
- `_tickets/test-infra-react-component-tests-…md` — note appended.

## Verification (run by me, verbatim)

```
npm run check  → check exit=0      (tsc -noEmit for src/, then e2e/tsconfig.json)
npm test       → test exit=0
                 Test Files  96 passed (96)
                 Tests  1283 passed (1283)      [was 1280 — +3 refusal-lifetime tests]
```

Logs: `.tmp/check.txt`, `.tmp/test.txt` (red-first run: `.tmp/fail1.txt`).
`npm run test:e2e` NOT run — needs a real Obsidian; unchanged since last round, where the
`e2e/controlsRestart.e2e.ts` helper edit was made and the reviewer checked it by reading.

## Readiness

**READY FOR RE-REVIEW** — all three SHOULD-FIX findings incorporated, one nice-to-have
explicitly rejected with rationale, nothing committed, no change_log written, ticket left
open for TOP_LEVEL_AGENT.
