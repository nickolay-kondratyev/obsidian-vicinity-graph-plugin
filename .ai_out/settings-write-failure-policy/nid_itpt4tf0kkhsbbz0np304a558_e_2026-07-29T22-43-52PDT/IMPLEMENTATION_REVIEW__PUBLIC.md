# Review — settings writes: ONE user-visible failure policy (`de425b6`)

## Summary

A rejected `data.json` persist now produces exactly one `Notice` naming the setting, raised from
`SettingsWritePipeline.write()` — the one body every settings write already flowed through. The notice
surface is behind a new `UserNoticePort` (`src/view/viewPorts.ts`), implemented once in `src/main.ts`,
faked by `src/view/FakeUserNotices.ts`; the copy lives in a new pure
`src/view/settingsWriteFailureNotice.ts` that reads the row's / reset scope's DECLARED label.

**Verified myself (not taken on trust):**

- `npm test` → **94 files, 1241 tests, all passed**, exit 0.
- `npm run check` → `tsc -noEmit` for `src/` and `e2e/`, exit 0.
- Acceptance criterion **met**: `settingsWritePipeline.test.ts` asserts `notices.messages` as an EXACT
  one-element array, through the real pipeline seam over a `RejectingPluginDataPort`. I traced each of the
  six new tests against a hypothetical removal of the `catch` body and all six genuinely flip (empty
  notices / rejected caller / `saveAttempts` 1 instead of 2 in the debounce drain / no fan-out). The suite
  is load-bearing, not decorative. (I did not mutate source to reproduce the implementer's "6 failed" run —
  read-only — but the reasoning is mechanical.)
- **ONE place holds:** every settings write path reaches `write()` — settings-tab `apply`
  (`VicinityGraphSettingTab.ts:444,520,630,687`), the debounced thunks (`:480,538,590,652` →
  `runSerialised` → `writer.apply`), the tab's `writeDefaults` (`:98`), and the panel's
  `ControlsActions.applySettings/restoreDefaults`. No `try/catch` was ADDED at any call site.
- **Layering clean:** the only new `obsidian` import is `Notice` in `src/main.ts`; the port + Fake mirror
  the existing `ViewsRefreshPort` / `FakeViewsRefresh` pattern exactly, and the copy module is pure.
- **Chain integrity holds:** `SerialPromiseChain` (line 29) already isolates the tail, and the catch means
  the debounce drain loop no longer abandons the rest of a settle window — covered by two tests.
- **No hand-typed copy in a presenter**, and no tripwire suite was weakened or removed. Tests are BDD
  `WHEN … THEN …`, one behavior each, no mirrored defaults.
- The two follow-up tickets filed are honest and accurate — notably
  `nid_biwdtykvazsk3ejcqqli8o9j7_e`, which correctly names the in-memory-vs-disk contradiction.

Judgement on the three deliberate decisions: **(a) catch-and-not-re-throw is right** (every call site
`void`s the promise; a throw strands the rest of a debounce window) and the "resolved ≠ stored" consequence
is stated in the class doc, `CLAUDE.md` and the architecture map — that is documented where a maintainer
will see it. **(b) fan-out on failure is right** (views must repaint from the store), though the *reason
given for it* is wrong — finding 1. **(c) notice text as a `write()` parameter is right**: only the caller
knows whether one row or one whole reset scope failed, and it is what keeps a partially-landed multi-command
reset at ONE notice. No POLS violation in any of the three.

Nothing blocking. Four things I would fix before calling this done.

## Findings

1. **[SHOULD_FIX] The pipeline docs claim a snap-back that cannot happen — the change ships a comment that
   is false.** `src/view/settingsWritePipeline.ts:137-139` ("on failure the views must repaint from what IS
   stored, which is what makes an optimistic control snap back to the value the user actually still has")
   and rule 5 at `:31-33` ("the optimistic control releases its override and the old value comes back");
   same claim in `docs-internal/architecture-map.md:50-52`. But `PluginDataStore.persist()`
   (`src/persistence/PluginDataStore.ts:71-74`) sets `this.data = updated` **before** `saveData`, so after a
   rejected persist the store holds the NEW value, the fan-out repaints the NEW value, and
   `PendingEdits.reconciled(stored)` releases the override onto the NEW value. There is no snap-back and no
   "old value". The implementer's own ticket `nid_biwdtykvazsk3ejcqqli8o9j7_e` says exactly this — so the
   tickets are honest while the in-code comments are not, which is the worse of the two places to be wrong.
   *Fix:* reword both to "the fan-out repaints from the store, which after a rejected persist still holds
   the value that did not reach disk (ticket `nid_biwdtykvazsk3ejcqqli8o9j7_e`)" — keep the fan-out, drop
   the snap-back claim. One-line doc edit, no behavior change.

2. **[SHOULD_FIX] Three pre-existing call-site catches are now unreachable, so the failure policy appears to
   live in four places.** Because `write()` never rejects:
   - `src/view/useOptimisticValue.ts:43-46` — `void commit(value).catch(...)` can no longer fire, so
     `PendingEdits.abandoned()` (`src/view/optimisticValue.ts:117`) is now production-dead (only its own
     unit test reaches it). The module doc at `:18-19` ("Releasing the override when the write is ABANDONED
     … The rejection is logged here") now describes something that cannot occur, and its `console.error`
     duplicates the pipeline's.
   - `src/view/VicinityGraphSettingTab.ts:308-314` (`settlePendingWrites`) — dead; its comment still says it
     replaces "the unhandled rejection".
   - `src/view/settingsResetSequence.ts:69-75` (`tolerating`) — dead for all three steps (`drainWrites`
     cannot reject either: `SerialPromiseChain:29`).
   The ticket asked for the policy in one place; leaving three unreachable handlers is the same
   duplicated-knowledge problem from the other direction. *Fix:* drop the `.catch` in `useOptimisticValue`
   (and `PendingEdits.abandoned()` with it, or keep `abandoned()` if the reconcile path needs it) and the
   `try/catch` in `settlePendingWrites`; for `SettingsResetSequence.tolerating`, either drop it or change
   its comment to say plainly that it is seam-level defense because `SettingsResetTarget` is an interface
   whose implementations are not required to resolve-either-way. Whichever you pick, no comment should keep
   claiming it handles a rejection the pipeline now swallows.

3. **[SHOULD_FIX] No tripwire that an interaction resolves to a DECLARED label — the fallback ships a raw
   control kind as user copy.** `src/view/settingsWriteFailureNotice.ts:263-265` falls back to
   `control.kind`, so a miss renders `Vicinity graph couldn't save "force-layout".` to the user. Today the
   fallback is unreachable, but `settingsRowSpecCoverage.test.ts` explicitly sanctions an ALLOWLISTED spec
   leaf with no row — the moment one exists, the fallback goes live silently. The new suite
   (`settingsWriteFailureNotice.test.ts`) only spot-checks 3 of 9 interaction kinds. *Fix:* one walk, in the
   spirit of the repo's other tripwires — for every `EVERY_SETTINGS_ROW` row, build its interaction via the
   accessor (the `probesFor` shape in `settingsRowAccessors.test.ts:158` already does this) and assert
   `SettingsWriteFailureNotice.forInteraction(interaction)` contains `row.label`. That pins `controlFor` and
   `controlKey` against each other for every kind AND makes the fallback observable.

4. **[SHOULD_FIX] DRY: a second exhaustive control-identity switch, and the label map silently collapses
   collisions.** `controlKey` (`settingsWriteFailureNotice.ts:305-324`) encodes the same "which control
   kinds need a field to be unique" knowledge as `specLeafIdFor`
   (`src/view/settingsRowSpecCoverage.test.ts:38-61`). The test-side one carries a "no two rows edit the
   same field" guard; the new production `ROW_LABELS` Map has none, so two rows keying alike would silently
   label one of them with the other's copy. *Fix:* promote ONE control-identity function into
   `src/view/settingsRows.ts` (prod) and have both the notice map and the coverage test derive from it —
   or, minimum, add `expect(ROW_LABELS.size).toBe(EVERY_SETTINGS_ROW.length)` behind an exported seam.

5. **[NIT] The pin write path bypasses the policy, and no ticket covers it.**
   `src/view/ControlsActions.ts:57-77` runs `pinDoc`/`unpinDoc` through `runSerialised` with a non-writer
   body, so a rejected pin persist escapes the pipeline into a `void`ed React handler: unhandled rejection,
   no notice, no log. Pre-existing and out of this ticket's scope — but
   `nid_t25rc8sd9nmlbmrn69k4zsaes_e` only covers routing the *refusal* copy through the port, not a *failed*
   pin persist. *Fix:* broaden that ticket (or file one) so the pin path gets the same policy.

6. **[NIT] `failureNotice` is computed eagerly on every write, including the 99.99% that succeed**
   (`settingsWritePipeline.ts:77,95`). A map lookup plus a template string — negligible, but a
   `() => string` thunk would read as "only on failure" and cost nothing.

7. **[NIT] No dedupe, worth an owner note rather than a change.** A reset with a pending typed edit
   produces two notices (the field, then the scope), and a persistently unwritable `data.json` produces one
   per edit. Both are arguably the honest behavior; just don't let a later ticket "fix" it into swallowing
   the second one silently.

## Documentation Updates Needed

- Finding 1's reword in `src/view/settingsWritePipeline.ts` (rule 5 + the `write()` docstring) and
  `docs-internal/architecture-map.md`. The `CLAUDE.md` bullet is accurate as written and needs no change.
- Finding 2's stale comments in `useOptimisticValue.ts`, `VicinityGraphSettingTab.settlePendingWrites` and
  `SettingsResetSequence.tolerating`.

## Verdict

**READY** — merge-quality: acceptance met, layering clean, one genuine place, tests that actually
discriminate, `npm test` and `npm run check` green. None of the findings is blocking. Finding 1 (a comment
that states something the code cannot do) and finding 2 (three unreachable handlers left behind by the
"one place" consolidation) are worth folding in now while the context is hot; findings 3–4 are cheap
tripwire/DRY work that fits the repo's own conventions.
