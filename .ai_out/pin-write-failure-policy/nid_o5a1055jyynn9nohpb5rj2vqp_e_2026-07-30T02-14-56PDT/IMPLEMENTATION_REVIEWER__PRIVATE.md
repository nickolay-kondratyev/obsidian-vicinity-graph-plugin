# Reviewer notes (private)

## Round 1 — `b3a7220` (kept for the trail)

- `npm test` → 96 files / 1290 passed, exit 0. `npm run check` → exit 0. No `sanity_check.sh`.
- Verdict CHANGES_REQUESTED on ONE major item: the failure-path fan-out asymmetry. `write()`
  fanned out even after `guarded()` caught (because `PluginDataStore.persist()` moves memory
  before the disk write), while the pin path skipped the fan-out on rejection, justified by a
  WHY-NOT comment written for the DIFFERENT `not-persistable` case, and untested either way.
- Deliberately not raised then: `runGuarded`'s string-union subject vs `runSerialised`'s
  callback shape; `RejectingPluginDataPort` shipping under `src/persistence/`; tests
  asserting through `SettingsWriteFailureNotice.forNonSettingsWrite(...)` rather than a
  literal (that is the repo's copy-lives-once convention, not assertion-tuning).

## Round 2 — `a2eae3d` → APPROVED

### What I ran
- `npm test > .tmp/review2-test.log` → 96 files / **1294 passed**, exit 0.
- `npm run check > .tmp/review2-check.log` → exit 0.

### Verification trail (round 2)
- Read the full current `settingsWritePipeline.ts` and `ControlsActions.test.ts`, plus the
  complete `a2eae3d` diff for `CLAUDE.md`, `ControlsActions.ts`, `VicinityGraphView.tsx`,
  `RejectingPluginDataPort.ts` and both suites.
- **Settings fan-out unchanged**: `write()` body returns `"store-changed"` unconditionally;
  `guarded()`'s tail block calls the same `refreshAllViews()`, still inside the same
  `chain.run` slot, still after the notice. Pure code motion for the settings half.
- **Refused-pin path**: `ControlsActions.test.ts:120` and `:126` untouched and green.
- **Rejected-pin path**: new tests at BOTH levels, and they are real — the pipeline-level one
  rejects the body directly, the `ControlsActions` one drives the real `PersistenceServices`
  over `RejectingPluginDataPort`.
- **Deletion audit across BOTH commits**:
  `git diff HEAD~2 -- src/ e2e/ | grep -E '^-\s*(it|test|describe)\('` → zero matches. No test
  declaration removed or renamed anywhere in the feature.
- **Second-fan-out check**: `grep -rn refreshAllViews src/ e2e/` minus tests → exactly one
  production call site (`settingsWritePipeline.ts:255`) plus the port decl and `main.ts`'s
  adapter. Strictly better than pre-feature (two call sites). CLAUDE.md's "never add a second
  fan-out" is now grep-enforceable.

### The `let outcome = "store-changed"` initialiser — my judgement
Honest, not a trap. Two tests fail if it is flipped to `"store-unchanged"`; moving the
declaration inside the `try` does not compile. The comment on it names the
`PluginDataStore.persist()` ordering. Residual smell is locality only (decision written above
the `try`, realised by the `catch`, acted on in a tail block that assumes no early `return`
appears inside the `try`). Offered the assign-in-`catch` variant as an optional suggestion;
explicitly did NOT gate on it.

### The REJECTED item — I stood down
`SerialSettingsWrites` not carrying `runGuarded`. Verified the premise rather than taking it
on trust: `git show HEAD~2:src/view/ControlsActions.ts` shows the concrete
`SettingsWritePipeline` dependency PRE-DATES this feature, and the interface's single consumer
is `DebouncedSettingsWrites` via `runSerialised`. Widening it would only force the debounce
fake to stub a method nobody calls. Rejection is correct; ISP beats the cosmetic DIP symmetry.

### CLAUDE.md
Re-read the rewritten bullet clause by clause against the code — all four load-bearing claims
check out. No doc follow-ups outstanding.

### Nothing new raised
Held to the instruction: no re-litigating settled minors, no invented nits. The only non-blocking
item is the initialiser locality suggestion, which the focus brief explicitly asked me to judge.
