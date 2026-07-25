# IMPLEMENTATION_ITERATION__PUBLIC — round 1

Responds to `IMPLEMENTATION_REVIEW__PUBLIC.md` (READY, 0 blocking, 3 SHOULD-FIX).
Branch `controls-global-refresh-fanout`.

## S1 — false scope rationale in the per-doc comments → **ACCEPTED** (option a)

The reviewer is right: nothing insulates sibling views. Every view wires
`active-leaf-change` / `file-open` → `handleActiveFileChanged`
(`src/view/VicinityGraphView.tsx:119-124`) and `GraphViewController` has no
per-view MAIN lock, so two open views normally share a MAIN and the non-writing
one DOES go stale on a depth write.

Changed (comments only — **no behaviour change**, per ticket acceptance criterion 2):

- `src/view/settingsWriteScope.ts` — the doc comment now says per-doc stays
  narrow as a **scope boundary, not an invariant**, states the stale-sibling
  consequence explicitly as a WHY-NOT, and points at the new ticket.
- `src/view/viewPorts.ts` (`OwningViewPort`) — "kept narrow by scope rather than
  by any insulation between views", pointing to `settingsWriteScope.ts` so the
  rationale lives in exactly one place (DRY).
- `src/view/ControlsActions.ts` header — restated as behaviour ("a per-doc write
  rebuilds only the view that made it"), no rationale claim; the reader follows
  the `{@link settingsWriteScope}` reference for the WHY.

Ticket filed:
**`docs-internal/tickets/ticket-per-doc-write-leaves-sibling-views-stale.md`** —
carries the reviewer's evidence verbatim, a fix sketch with the (a)/(b) decision
(collapse the classifier vs. keep it for a future per-view MAIN lock), the
instruction to FLIP rather than delete the two per-doc tests, and the cost note
tying it to `ticket-controls-optimistic-input-latency.md`.

## S2 — refresh fired for writes that never landed → **ACCEPTED** (fixed + tested)

New private type in `ControlsActions.ts`:

```ts
type WriteOutcome = "persisted" | "not-persisted";
```

`noticeIfNotPersistable` → `persistOutcome(identity, message): WriteOutcome`
(notices AND reports), and `executeSettings` returns `WriteOutcome` instead of
`void`. Uniform rule now: **a write that did not land rebuilds nothing.**

| path | before | after |
|---|---|---|
| `pinNode` on a doc with no stable id | Notice **+ N rebuilds** | Notice, 0 rebuilds |
| `applySettings` per-doc with MAIN `null` | 1 rebuild | 0 rebuilds |
| `applySettings` per-doc, doc not persistable | Notice + 1 rebuild | Notice, 0 rebuilds |
| `unpinNode` | fan-out | fan-out (unchanged — `unpinDoc` returns `void` and removes unconditionally, so it always lands; now documented) |

Safe because the controls UI is not optimistic today: values are re-derived from
the rebuild, so with nothing written there is nothing new to display.
`executeSettings`' switch is still exhaustive with every arm returning, so
`noImplicitReturns` now also forces a future command kind to declare its outcome.

3 new tests (all failed before the fix — `.tmp/it1-fail.log`, 3 failed / 8 passed):
- `WHEN a pin is refused as not-persistable THEN nothing is refreshed`
- `WHEN a per-doc write has no MAIN to target THEN not even the originating view rebuilds`
- `WHEN a per-doc write is refused as not-persistable THEN not even the originating view rebuilds`

Test-fixture additions: an `ID_LESS_PATH` served by the fake `VaultPort` and
marked via `FakeDocIdPort.markUnidentifiable`, plus an optional `mainPath` arg on
`actionsUnderTest`. No existing test was changed or removed.

## S3 — stale header references → **ACCEPTED**

`ControlsActions.ts` header: "resolves the target `TFile` from a path" →
"resolves the target file from a path via {@link VaultPort}"; "reads the current
MAIN via `controller.currentMainPath()`" → "via
{@link OwningViewPort.currentMainPath}".

## NICE-TO-HAVE items — **not taken this round** (out of the given scope)

N1 (`OwningViewPort` rename), N2 (inline `refreshEveryView`), N3 (deferred-view
WHY-NOT in `main.ts`), N4/N5 (informational). N3 is the one worth a follow-up if
a human wants it; the instruction for this round was explicitly "do not expand
scope beyond these findings".

## Gates (real numbers)

| gate | result | log |
|---|---|---|
| `npm test` | **938 passed / 938**, 70 files, exit 0 | `.tmp/it1-tests.log` |
| `npm run check` | clean, exit 0 | `.tmp/it1-check.log` |

935 → 938 = the 3 new tests. No test was skipped, deleted, or re-pointed.
