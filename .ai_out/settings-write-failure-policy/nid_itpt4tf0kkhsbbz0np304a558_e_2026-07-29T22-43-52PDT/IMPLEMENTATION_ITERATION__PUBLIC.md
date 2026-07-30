# Iteration on the review of `de425b6` — settings writes: ONE user-visible failure policy

Reviewer verdict was **READY** (0 BLOCKING, 4 SHOULD_FIX, 3 NIT). Every finding is dispositioned below.
Two are rejected with rationale; one NIT became a ticket. **No production behavior changed in this
iteration** — the only executable change is a new test.

## Per finding

### 1. [SHOULD_FIX] Docs claim a snap-back the code cannot do — **INCORPORATED**

The reviewer is right, and it was worse than reported: the false claim was in **four** places, not three.
`PluginDataStore.persist()` (`src/persistence/PluginDataStore.ts:71-74`) assigns `this.data = updated`
**before** `saveData`, so after a rejected persist the store holds the NEW value, the fan-out repaints the
NEW value, and `PendingEdits.reconciled(stored)` releases the override ONTO it. There is no snap-back and no
"old value".

Reworded to state what actually happens (and to point at the open owner decision
`nid_biwdtykvazsk3ejcqqli8o9j7_e` instead of implying an answer):

- `src/view/settingsWritePipeline.ts` rule 5 — the escaped-rejection hazard is now "an invisible loss": the
  control still shows the value, the session still uses it, only `data.json` is missing it, so the setting is
  gone at the next restart and nothing on screen says so.
- `src/view/settingsWritePipeline.ts` `write()` docstring — now says explicitly "this is NOT a snap-back",
  names the in-memory-before-disk ordering as the reason, notes that an optimistic control releases its
  override onto that same value, and cites the ticket.
- `src/view/settingsWriteFailureNotice.ts` module doc — same correction (this one the reviewer did not list).
- `src/view/settingsWritePipeline.test.ts` suite doc — carried the same false claim (also not listed).
- `docs-internal/architecture-map.md` — the fan-out sentence now says what the store holds after a rejected
  persist, and that the absence of a snap-back is exactly why the notice is the only signal.

Persistence semantics deliberately untouched: that is the `decide` ticket's call, not this change's.

### 2. [SHOULD_FIX] Three now-unreachable call-site catches — **PART-INCORPORATED; removal REJECTED**

The stale COMMENTS were the real defect and are fixed. The CODE stays, because all three guard an **injected
seam**, not a concrete class — they are not statically unreachable, only unreachable given today's wiring:

- `src/view/useOptimisticValue.ts` — `commit` is a `(value) => Promise<void>` **prop**. The hook knows nothing
  about the pipeline; dropping the `.catch` would leave a control stuck on an override forever the first time
  any injected `commit` rejects. Removing `PendingEdits.abandoned()` with it would also delete a
  behavior-capturing test (`optimisticValue.test.ts:94`).
- `src/view/VicinityGraphSettingTab.ts` `settlePendingWrites` — `flush()` runs **caller-supplied thunks**
  through the `SerialSettingsWrites` **interface**; a rejection there must not abort the reset or the
  re-render this is awaited before, in a blur handler with nowhere to put it.
- `src/view/settingsResetSequence.ts` `tolerating` — drives the `SettingsResetTarget` **interface**, and
  `settingsResetSequence.test.ts` has **three** tests (lines 82, 94, 105) pinning "a rejecting step still
  reaches the drain and the redisplay". Removing it deletes tested behavior; CLAUDE.md forbids that without
  explicit alignment. (This is the reviewer's own offered alternative.)

Each comment now states plainly: (a) a rejected `data.json` write is caught, reported and **resolved** inside
`SettingsWritePipeline`, so it does not reach here; (b) what this catch actually guards; (c) that it raises
**no** notice, because one failure gets one message and the pipeline owns it. `useOptimisticValue`'s log
message was changed from the pipeline's wording to `"an optimistic commit rejected"` so the two can never be
confused in a console. `CLAUDE.md` and the architecture map now name the three seam catches, so "no try/catch
at a call site" reads as the rule it is rather than as a claim the tree contradicts.

### 3. [SHOULD_FIX] No tripwire that an interaction resolves to a DECLARED label — **INCORPORATED**

New suite in `src/view/settingsWriteFailureNotice.test.ts`: for **every** declared row, build **every**
interaction its controls can emit **via the accessors**, and assert the notice contains `“<row.label>”`.

- Accessor-driven on purpose: `src/view/settingsRowAccessors.ts` is the ONLY producer of a
  `SettingsInteraction` in the codebase (verified by grep), so the walk covers every interaction any surface
  can emit and no hand-written fixture can drift from them.
- Matched **with the copy's quotes**, so a row whose label merely contains another's cannot pass on it.
- A second assertion keeps it non-vacuous (more interactions than rows — the metric rows emit two).
- Its own `switch` closed by `unhandledRowControl`, so a new control kind cannot reach the file silently. It
  is deliberately not shared with `settingsRowAccessors.test.ts`'s `probesFor` (that one binds each accessor's
  value type `T` to build round-trip probes; this one needs only the emitted interaction) — noted in the doc.
- The fallback's doc comment now names this walk as what keeps `couldn't save “force-layout”` from shipping.

**Verified it discriminates** (not assumed): forcing `controlFor`'s force-layout arm to a fixed field made it
fail with 7 lines, each showing exactly the user copy the reviewer feared —
`Vicinity graph couldn't save “force-layout”. See the developer console for details.` Source restored; the
suite passes on the real code.

### 4. [SHOULD_FIX] DRY: a second control-identity switch; `ROW_LABELS` collapses collisions — **REJECTED (concern covered otherwise)**

- **The shared function is rejected.** `controlKey` (`depth:linkDepthIn`) and `specLeafIdFor`
  (`globalDepths.linkDepthIn`) answer different questions, and neither output is derivable from the other.
  Promoting one would mean either putting dotted `SETTINGS_SPEC` paths into the production copy path — i.e.
  duplicating the spec tree's SHAPE in a notice module to save a `switch` — or keying labels by spec path,
  which is the same thing. The shared knowledge is only "which kinds need a field to be unique", and that is
  already compile-enforced on both sides by the control types. A WHY-NOT is recorded at `controlKey` so this
  is a decision, not an oversight.
- **The collision risk is real and is now covered**, by finding 3's walk rather than by a size assertion: with
  two rows keying alike the Map keeps the LAST one, so the earlier row's interaction resolves to the other
  row's label and the walk fails — naming the row and the notice. Strictly stronger than
  `expect(ROW_LABELS.size).toBe(...)`, and it needs no new exported seam into a private static.

### 5. [NIT] The pin write path bypasses the policy — **INCORPORATED as a ticket**

Confirmed: `ControlsActions.pinNode/unpinNode` run a non-writer body through `runSerialised`, which does not
catch — so a rejected pinned-set persist is an unhandled rejection with no notice and no log, while the pin is
already in memory. Filed **`nid_o5a1055jyynn9nohpb5rj2vqp_e`** (type `bug`), depending on
`nid_t25rc8sd9nmlbmrn69k4zsaes_e` (the port migration is its prerequisite) and linked to this ticket. Kept as
a separate ticket rather than broadening the migration one: that one is behavior-neutral, this one changes
behavior. Explicitly warns the next agent not to add a second ad-hoc failure policy.

### 6. [NIT] `failureNotice` computed eagerly — **REJECTED**

One `Map.get` plus one template literal per settings write (human-paced, one per control interaction). A
`() => string` thunk buys no measurable work back and adds a closure plus one level of indirection at the seam
that most needs to read plainly. PARETO: not worth the churn on a just-reviewed signature.

### 7. [NIT] No dedupe — **INCORPORATED as the owner note the reviewer asked for**

Rule 5 in `settingsWritePipeline.ts` now says "exactly once" is PER FAILED WRITE, that the repetition (one per
edit on an unwritable `data.json`; field-then-scope on a reset with a pending typed edit) is the honest count,
and the WHY-NOT: a suppressed second notice is a setting the user is never told about, which is the failure
mode the rule exists to remove. So a later ticket cannot silently "fix" it.

## Test results (actual)

- `npm test` → **94 files, 1243 tests, all passed**, exit 0 (`.tmp/test_iter2.log`). Was 1241 before; +2 are
  the finding-3 walk.
- `npm run check` → **exit 0** (`tsc -noEmit` for `src/`, then `e2e/`) (`.tmp/check_iter2.log`).
- Discrimination check on the new suite (break `controlFor` → 1 failed with the 7 offending rows named,
  restore → 7 passed): `.tmp/notice_broken.log`, `.tmp/notice.log`.
- `npm run test:e2e` NOT run — real-Obsidian release gate, unchanged from the original implementation.

## Readiness

**READY to commit.** Nothing was left half-done and nothing was hacked. Not done by design, per instructions:
no commit, no branch switch, no `change_log` entry, main ticket left open.

Follow-ups outstanding: `nid_biwdtykvazsk3ejcqqli8o9j7_e` (`decide` — in-memory value on a rejected persist),
`nid_t25rc8sd9nmlbmrn69k4zsaes_e` (ControlsActions → `UserNoticePort`), `nid_o5a1055jyynn9nohpb5rj2vqp_e`
(pin persist under the policy).
