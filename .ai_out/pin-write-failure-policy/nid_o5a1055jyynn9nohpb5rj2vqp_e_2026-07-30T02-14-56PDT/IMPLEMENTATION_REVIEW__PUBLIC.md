# IMPLEMENTATION REVIEW — round 2 — `a2eae3d` on top of `b3a7220`

(Round 1 reviewed `b3a7220` and returned CHANGES_REQUESTED for one MAJOR item. This file
replaces that review; the round-1 findings are summarised below only where their disposition
matters.)

## Summary

The feature puts `data.json` writes that the settings pipeline does not itself plan (today:
the pinned set) under the pipeline's ONE failure policy. Round 2 closes the MAJOR item by
taking my option (a) and implementing it in the DRY way I hoped for but did not spell out:
rather than teaching `ControlsActions` when to repaint after a rejection, the *outcome* type
moved into the pipeline and `guarded()` now owns **both** the catch and the fan-out.

- `GuardedWriteOutcome = "store-changed" | "store-unchanged"` — exported, documented as a
  question about the **store**, not the disk.
- `guarded(failureNotice, body)` catches, notices once, and then fans out iff the outcome is
  `store-changed`; a **thrown** body falls through to `store-changed`.
- `write()` (settings) returns `"store-changed"` unconditionally, which is exactly what its
  previous unconditional post-`guarded()` `refreshAllViews()` meant.
- `ControlsActions` lost `viewsRefresh`, `refreshEveryView()` and its local `WriteOutcome`;
  ctor is 4 args. Its class doc now separates REFUSED from REJECTED and links the open
  in-memory-rollback ticket `nid_biwdtykvazsk3ejcqqli8o9j7_e`.

Verified myself (logs in `.tmp/review2-test.log`, `.tmp/review2-check.log`):

- `npm test` → 96 files / **1294 passed**, exit 0 (was 1290; +4).
- `npm run check` → exit 0.
- No `sanity_check.sh` in the repo.

### The three behaviours I was asked to confirm

1. **Settings fan-out UNCHANGED.** `write()` → `guarded(..., body returning "store-changed")`
   → fan-out. Before: `await guarded(...)` then `refreshAllViews()`. Same call, same slot
   (both inside `chain.run`), same ordering relative to the notice (notice in `catch`, then
   refresh). `settingsWritePipeline.test.ts` "WHEN a persist rejects THEN every open view is
   refreshed anyway" is unchanged and green, as are the landed-write fan-out tests.
2. **Refused pin still rebuilds nothing.** Both pre-existing tests survive verbatim —
   `ControlsActions.test.ts:120` (path resolves to no file) and `:126` (not-persistable) —
   and are joined by the pipeline-level `WHEN a GUARDED task reports it changed nothing THEN
   no view is refreshed`.
3. **Rejected pin now repaints.** New, real tests at both levels:
   `ControlsActions.test.ts:173` (real `PersistenceServices` + real pipeline over
   `RejectingPluginDataPort`, asserting both view ids) and
   `settingsWritePipeline.test.ts` `WHEN a GUARDED task rejects THEN every open view is
   refreshed anyway`. These are new assertions on previously-unasserted behaviour, not
   tuned ones — the implementer records the RED run in `.tmp/red.log`, and the shape is
   independently checkable: flipping the initialiser or dropping the tail fan-out fails them.

### Structural win worth naming

There is now **exactly one** `refreshAllViews()` call in production code
(`src/view/settingsWritePipeline.ts:255`); before this feature there were two (pipeline and
`ControlsActions.refreshEveryView`). CLAUDE.md's "never add a second fan-out" is now literally
enforceable by grep. That is a net simplification, not just a bug fix.

### Loss-of-functionality audit (BOTH commits)

`git diff HEAD~2 -- src/ e2e/ | grep -E '^-\s*(it|test|describe)\('` → **zero matches**. No
test declaration was deleted or renamed across the whole feature; every change to an existing
suite is an added case, a shared-fixture extraction, or the ctor-arity update. No `ap_XXX_E`
anchor touched. The only class deletion remains the round-1 move of `RejectingPluginDataPort`
into `src/persistence/`.

## 🚨 CRITICAL Issues

None.

## ⚠️ IMPORTANT Issues

None. The round-1 MAJOR is genuinely fixed, and fixed at the right altitude: the fan-out
decision is data returned by the body rather than a branch duplicated per caller, so the two
halves of the policy cannot drift.

## 💡 Suggestions

### The `let outcome = "store-changed"` initialiser — verdict: honest, but I'd move the decision into the `catch`

`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/view/settingsWritePipeline.ts:241-257`

Scrutinised as asked. It is **not** a trap in the ways that would matter:

- It is protected by a test. Flipping it to `"store-unchanged"` fails
  `WHEN a GUARDED task rejects THEN every open view is refreshed anyway` at the pipeline level
  AND `WHEN a pin's persist rejects THEN EVERY open view is refreshed anyway` at the
  `ControlsActions` level. Moving the declaration inside the `try` does not compile (the tail
  block loses the binding). So the load-bearing value is pinned from two directions.
- The comment sitting on it says precisely why it is not `"store-unchanged"`, and names the
  `PluginDataStore.persist()` ordering that makes it true.

The residual smell is one of locality, not correctness: the "a throw counts as `store-changed`"
decision is written above the `try`, several lines from the `catch` that actually realises it,
and the shape is "initialise, maybe overwrite, act in a tail block" — which quietly assumes
nobody ever adds an early `return` inside the `try`. The equivalent, slightly more explicit
form puts the decision where the throw is handled and lets TS definite-assignment keep it safe:

```ts
let outcome: GuardedWriteOutcome;
try {
    outcome = await body();
} catch (error) {
    console.error(`vicinity-graph: data.json write failed notice=[${failureNotice}]`, error);
    this.notices.show(failureNotice);
    // `PluginDataStore.persist()` moved in-memory state before the save rejected, so the
    // store — not the screen — is what the views must now be repainted from.
    outcome = "store-changed";
}
```

Optional. I would take it, but I am not gating on it, and I do not consider the current form
dishonest.

## Round-1 items — dispositions

| Item | Disposition | My call |
| --- | --- | --- |
| MAJOR — WHY-NOT-fan-out conflates REFUSED with REJECTED, untested | INCORPORATED (option a) | **Accepted.** Fixed, and better than either option I offered. |
| MINOR — `runGuarded` reports ANY throw as a save failure | INCORPORATED (documented) | **Accepted.** The doc's closing paragraph says exactly the right thing, and the rejected alternative (re-throwing non-save errors) really would reintroduce the unhandled rejection this ticket removed. |
| MINOR — failure literal in two places | INCORPORATED | **Accepted.** `RejectingPluginDataPort.SAVE_FAILURE` is now the one object both the port and the suite use. |
| NIT — `SerialSettingsWrites` does not carry `runGuarded` | **REJECTED** | **Rejection accepted — I stand down.** The ISP argument is correct and I verified the premise: `SerialSettingsWrites` has one consumer (`DebouncedSettingsWrites`, draining through `runSerialised`), and `ControlsActions`' dependency on the concrete `SettingsWritePipeline` **pre-dates** this feature (`git show HEAD~2:src/view/ControlsActions.ts` — same concrete type). Adding a method no consumer of the interface calls would only force `settingsDebounce.test.ts`'s fake to stub it. If `ControlsActions` ever needs a seam, a narrow `GuardedWrites` is the right shape, as the implementer says. |
| NIT — CLAUDE.md sentence hard to parse | INCORPORATED | **Accepted.** |

## Documentation Updates Needed

None outstanding. I re-read the rewritten CLAUDE.md "Settings writes" bullet against the code
and every clause is accurate:

- "caught in the pipeline's ONE `guarded()`" — one `try` in `src/view/`'s non-test code for
  this policy; the three pre-existing catches named in the same bullet are still the only
  others and still guard their own injected seams.
- "`runGuarded(subject, task)` lends that same `guarded()` — catch AND fan-out" — true.
- "only a body that wrote NOTHING (a refused pin) skips the rebuild" — true; the only
  `store-unchanged` producers are the two refusal branches in `ControlsActions`.
- "A REJECTED save never skips it: `PluginDataStore.persist()` moved memory before the disk
  write, so the screen — not the store — is the stale copy" — true, and it is the sentence a
  future maintainer needs to not "fix" the initialiser.

The seam docs (`runGuarded`, `guarded`, `GuardedWriteOutcome`, `ControlsActions`' class doc)
now describe the case they actually own, which was the substance of the round-1 MAJOR.

## Verdict

**APPROVED.**

The MAJOR item is fixed, and fixed by removing a decision rather than duplicating one. The
settings half's behaviour is byte-for-byte what it was, the refused-pin path still rebuilds
nothing, the rejected-pin path now repaints, and all three are held by real tests. No
behaviour-capturing test was removed or weakened across either commit, `npm test` and
`npm run check` pass, and CLAUDE.md matches the code. The one remaining suggestion (moving
the outcome default into the `catch`) is optional and does not gate the merge.
