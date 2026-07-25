# IMPLEMENTATION_REVIEW_ROUND2__PUBLIC — controls-global-refresh-fanout

Scope: delta `caa4e34..e777ed4` only (round-1 iteration answering S1/S2/S3).
Round-1 verdict was READY / 0 blocking; nothing settled there is re-opened here.

## Gates — independently re-run by me

| gate | result | log |
|---|---|---|
| `npm test` | **938 passed / 938**, 70 files, exit 0 | `.tmp/test.log` |
| `npm run check` | clean, exit 0 | `.tmp/check.log` |
| `sanity_check.sh` | not present in this repo | — |

The implementer's reported numbers are honest (935 → 938 = exactly the 3 new tests).

## S1 — honest comments + follow-up ticket → **RESOLVED**

`settingsWriteScope.ts` now states the narrow per-doc branch as a **WHY-NOT scope
boundary**, explicitly says "Sibling views are NOT insulated … the non-writing one
DOES go stale", and points at the ticket. `OwningViewPort` says "kept narrow by
scope rather than by any insulation between views" and defers the rationale to
`settingsWriteScope.ts` (single place — DRY). The `ControlsActions.ts` header now
states behaviour only. All three are factually true against the code; the earlier
false invariant is gone.

`docs-internal/tickets/ticket-per-doc-write-leaves-sibling-views-stale.md`
faithfully carries my predecessor's evidence (`registerGraphEvents` wiring + no
per-view MAIN lock ⇒ shared MAIN is the *common* configuration), matches the
directory's convention (`# Ticket:` / `**Status:**` / `**Origin:**` / problem /
evidence / fix sketch / decide-first), offers the (a)/(b) decision instead of
pre-deciding, instructs FLIP-not-delete for the two per-doc tests, and links the
latency ticket for the cost interaction. Nothing to add.

## S2 — `WriteOutcome` behaviour change → **VERIFIED SAFE**

I treated this as the one real risk and checked it end-to-end.

1. **Does "not-persisted" ever mean "partially persisted"?** No.
   `PersistenceServices.withPersistableIdentity` (`src/persistence/PersistenceServices.ts:77-87`)
   classifies FIRST and calls `persist` only on a `persistable` verdict — a refused
   doc writes zero bytes and does not even touch `pathDocIdMap`. `mainFile() === null`
   never reaches storage at all. So `not-persisted` ⇔ no state changed. The type is
   an honest name for the condition it gates.
2. **Can it swallow a needed UI update?** No, and the reason is structural, not
   incidental: the in-view controls are **fully controlled off `snapshot.controls`**
   (independently corroborated by the pre-existing
   `docs-internal/tickets/ticket-controls-optimistic-input-latency.md`, whose entire
   complaint is that steppers wait for the write→rebuild round-trip). I grepped
   `DepthStepper.tsx`, `CentralDepthControls.tsx`, `SizingSection.tsx`,
   `NodeExclusionSection.tsx`, `NodeContentsSection.tsx`, `ForceLayoutSection.tsx`,
   `ToggleSwitch.tsx`, `GraphToolbar.tsx`: **zero `useState`/`useRef`** — there is no
   optimistic local value anywhere, so there is nothing that could be left visually
   ahead of storage and need the rebuild to snap it back. Additionally the only
   surfaces that can reach a `not-persisted` outcome are the per-doc depth steppers
   (button-driven, value rendered from props) and `pinNode`; every DOM `value=` /
   `checked=` input in the panel belongs to a **global** command kind, which always
   returns `"persisted"` and still fans out exactly as before.
3. **`unpinNode` fanning out unconditionally — correct?** Yes.
   `unpinDoc` → `PluginDataStore.removePins` filters and persists unconditionally
   (`PluginDataStore.ts:61-64`), returns `void`, has no verdict to consult; its only
   caller is `NoteNode.tsx:46`, reachable solely on a node already rendered as
   pinned, so the removal always changes state. The new one-line comment says
   exactly that and does not over-claim.
4. **Exhaustiveness preserved.** Every arm of `executeSettings` returns a
   `WriteOutcome`, so `noImplicitReturns` + the union now force a future command kind
   to declare its outcome as well as its scope. That is a net compile-time gain.

Behaviour delta vs. round 1 is exactly the 4 rows the implementer tabulated; I found
no fifth path.

## S3 — narrowed-port references → **RESOLVED** (one leftover, non-blocking)

`ControlsActions.ts` header now says "resolves the target file from a path via
{@link VaultPort}" and "{@link OwningViewPort.currentMainPath}". Correct.

## Tests

- All 3 new tests are **real guards**: I reverted `src/view/ControlsActions.ts` to
  `caa4e34`, re-ran the file, and got `3 failed | 8 passed (11)` — one failure per new
  test, no collateral. Working tree restored to `e777ed4`.
- **No test weakened, skipped, deleted or re-pointed.** `git diff caa4e34..e777ed4 --
  '*.test.ts'` removed lines are only comments and fixture generalisation
  (`getFileByPath`/`getFiles` widened to two paths, `actionsUnderTest` gained a
  defaulted `mainPath` param, `FakeDocIdPort` gained `markUnidentifiable` — a
  pre-existing fixture affordance). `it(` count 8 → 11. No anchor points touched.
- The fixture generalisation keeps the old call sites byte-compatible via the default
  argument, so the two per-doc behaviour tests still assert what they asserted.

## 🚨 CRITICAL Issues

None.

## ⚠️ IMPORTANT Issues

None.

## 💡 Suggestions (non-blocking, take or leave)

- `src/view/viewPorts.ts:30-44` (`ControlsActionsPort`) still carries the two phrasings
  S3 fixed one file over: "resolves the target `TFile`" (the port sees `VaultFilePort`,
  not `TFile`) and "then triggers an immediate rebuild" / "then rebuild" on all three
  methods, which now reads as unconditional. A qualifier such as "…then rebuild — the
  scoped set of views, and none at all if the write did not land" would close the last
  gap. Left out of the round-1 instruction's scope, so noted rather than demanded.

## Documentation Updates Needed

None. CLAUDE.md is unaffected; the follow-up defect is captured as a ticket, which is
the convention this repo asks for.

---

**VERDICT: READY — 0 blocking issues.** The delta is clean: S1/S2/S3 are all genuinely
resolved, the behaviour change in S2 is safe for a reason that holds structurally, the
new tests are real guards, nothing was removed or weakened, and both gates pass on my
own run (938/938, `tsc` clean).
