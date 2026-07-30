# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC

Ticket `nid_hatwq2jlkhno5t6awcz0q6t9q_e` — node sizing: `minPx > maxPx` inverts the size
ramp, and per-keystroke clamping snaps the field. **Implemented, not closed** (top-level
agent closes it and writes the change_log). Branch `nid_hatwq2jlkhno5t6awcz0q6t9q_e_2026-07-30T00-53-04PDT`,
3 commits, clean tree.

## What was delivered

### 1. Engine backstop — `maxPx` is RAISED to `minPx`
`clampSizingSettings` (`src/engine/constants.ts`) clamped `minPx` and `maxPx` into the
SAME range independently, so neither ever left its bounds and an inverted pair survived
every door. It now raises `maxPx` to the **clamped** `minPx` (raising to the typed one
would drag `maxPx` outside its own range — the thing the clamp exists to prevent). One
line, three doors: `NodeSizer.compute`, `parseSizing` on load, `planSettingsWrite`.

Per the owner's 2026-07-29 decision: raise, never swap, never reset.

### 2. Panel typed rows are uncontrolled and commit on BLUR
`src/view/SettingsRowView.tsx`'s `NumberRow` is split in two:
- `NumberRow` owns the optimistic stored value and remounts the field on a stored change
  (`key={shown}`) — reseeding an uncontrolled input IS a remount.
- `NumberField` owns the text and the refusal, which reset together. Commits on blur;
  Enter blurs into that same handler rather than repeating it.

`SizingNumberRow` hands it a `SizingRowWrite` — **the same object the settings tab
judges with** — so the panel refuses an inverted pair with the same
`describeSizingRejection` copy, plus `aria-invalid` and `aria-describedby`. `NodeCapRow`
hands it `NO_CROSS_FIELD_RULE` and is fixed by the identical change; the call-site
comment documenting the controlled-input limit is gone.

New pure seam `src/view/numberRowCommit.ts` + colocated BDD test: nothing under
`npm test` renders React, so the blur decision has to live outside the component.

### 3. Deliberate difference from the settings tab (call out in review)
The panel carries **refusals only** — not the tab's `"Stored as N — the allowed range is
…"` notice. The panel reseeds its field from the store on an accepted commit, so a
capped value is stated by the field itself; the tab keeps the typed text and therefore
needs the sentence. Documented on `NumberRowCommit.refusal`.

### 4. Behaviour-capturing test rewritten (explicit alignment on the ticket)
`src/engine/NodeSizer.test.ts` pinned the inverted ramp as ACCEPTED behaviour. It now
asserts the raise — the ramp flattens at `minPx` instead of reversing — and moved out of
the image-floor `describe` (which it no longer belongs to) into the hostile-settings one.
**This belongs in the release/PR note.**

### 5. Two spec-walking tripwires fired; both amended in the open, neither weakened
- `src/persistence/settingsSpecPersistence.test.ts`: sibling-independence now names the
  ONE declared cross-field repair (`minPx` moves `maxPx`) in a `CROSS_FIELD_REPAIRS`
  list. The rule itself is pinned at that door by two NEW `persistedShapes.test.ts`
  tests, so the exemption hides no behaviour.
- `src/view/settingsRowAccessors.test.ts`: the round-trip probe now writes at the range
  CEILING. `minPx`/`maxPx` share one range, so the old FLOOR probe wrote a pair both
  surfaces refuse — `settlesAt` is a per-field promise and was never meant to predict it.

## Files touched

| File | What |
|---|---|
| `src/engine/constants.ts` | the raise rule + its WHY |
| `src/engine/sizingSettings.test.ts` | 4 new BDD tests for the rule (started RED) |
| `src/engine/NodeSizer.test.ts` | inverted-ramp test rewritten + relocated |
| `src/persistence/persistedShapes.test.ts` | 2 new tests: the load door raises |
| `src/persistence/settingsSpecPersistence.test.ts` | declared cross-field exemption |
| `src/view/numberRowCommit.ts` | NEW — the pure blur decision |
| `src/view/numberRowCommit.test.ts` | NEW — 14 BDD tests |
| `src/view/SettingsRowView.tsx` | `NumberRow`/`NumberField`, blur-commit, refusal slot |
| `src/view/settingsRowAccessors.test.ts` | ceiling probe + its WHY |
| `src/view/graph-view.css` | `.vicinity-graph-number-row-block`, `__refusal` |
| `CLAUDE.md` | the commit-on-blur + cross-field invariants |
| `docs-internal/notes/settings.md` | chain note: ticket delivered |

## Tests

`npm run check` exit 0. `npm test` **95 files / 1265 tests, all green**. `npm run build`
exit 0. Working tree clean. `npm run test:e2e` (real Obsidian) NOT run — release gate,
not part of this task; no e2e spec touches the panel's number rows (only the settings
tab's, and the panel's metric WEIGHT input, which is unchanged).

## Rejected ideas, and why

- **Not enforcing the rule on the load path** (letting the UI refusal be the only guard):
  the owner's decision explicitly names `clampSizingSettings` as the single choke point.
- **Panel showing the tab's clamp notice**: it would be remounted away by the very
  reseed that makes it unnecessary. See §3.
- **Making `settlesAt` cross-field aware**: an accessor is handed one value and no state;
  it cannot see the sibling field. The UI refusal is where cross-field belongs.
- **Reusing `SizingRowWrite.interactionIfAccepted` in the panel**: it exists for the
  tab's DEBOUNCED path, where the verdict must be re-taken hundreds of ms later. The
  panel commits synchronously, and `request(value)` from `useOptimisticValue` is the same
  write while keeping the optimistic display coherent.
- **A React component-test harness** to test the blur logic in place: the repo forbids it
  under `npm test` (tracked separately as `nid_7qot0m6nuxxmd5z0yb9jylsd6_e`). Extracted a
  pure module instead, which is the pattern the repo already uses.

## Left behind

- Follow-up ticket **`nid_9uzrvqv0k5qgckgdaqtgr41ky_e`** (linked to this one): the
  per-metric WEIGHT input in `SizingMetricRow` has its own inline markup (sits beside the
  enable toggle, is `disabled`-aware), so it did not go through `NumberRow` and is still
  controlled / per-keystroke. Milder symptom, same cause. The settings TAB's weight input
  is already debounced and fine.

## Process note (transparency)

I ran `npx prettier --write` on four files mid-task. The repo has **no prettier config and
no prettier dependency** — it uses tabs — so that reformatted them wholesale and broke the
`settingsRowParity` source scan. I reverted the two tracked files with `git checkout` and
re-applied every edit by hand; the two new files were rewritten with tabs. Nothing was
committed in the reformatted state, and the final diffs contain no formatting churn.
