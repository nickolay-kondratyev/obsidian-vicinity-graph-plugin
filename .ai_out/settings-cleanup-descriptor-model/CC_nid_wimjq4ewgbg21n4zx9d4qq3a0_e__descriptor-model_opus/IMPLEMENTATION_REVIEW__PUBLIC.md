# IMPLEMENTATION REVIEW — settings descriptor model (`nid_wimjq4ewgbg21n4zx9d4qq3a0_e`)

Reviewer: IMPLEMENTATION_REVIEWER. Branch `CC_nid_wimjq4ewgbg21n4zx9d4qq3a0_e__descriptor-model_opus`,
commits `17a162c`..`83e2a1d` over base `f4b4a7f`.

**Everything the implementation report claims, I reproduced independently.** No
claim in `IMPLEMENTATION__PUBLIC.md` was found to be false or embellished. The
findings below are all MINOR.

---

## Summary

Eight commits close five "silent hole" classes in the settings family by turning
each hand-maintained parallel list into a compile-checked one, and route the
in-graph panel's force-layout "Restore defaults" through the shared reset plan
instead of its own call to `EngineDefaults.forceLayoutSettings()`.

Net `+911 / −75` across 16 files. The actual new machinery is small — roughly 40
lines (`restoreFields`, `definedFieldsOnly`, `planSectionReset`,
`SECTION_SETTINGS_FIELDS`). The rest is guards, tests and WHY documentation.

Production changes:
- `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/engine/SettingsSpec.ts` — bidirectional spec-completeness guards
- `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/engine/constants.ts` — `SizingRangeField` derived from `SizingSpec`
- `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/engine/types.ts` — `DepthOverride` → `Partial<DepthSettings>`
- `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/persistence/persistedShapes.ts` — `ParsedViewFields` guard + `definedFieldsOnly`
- `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/view/settingsSectionFields.ts` (new) — section → field map + guard
- `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/view/settingsResetPlan.ts` — plans derived from the map
- `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/view/sizingMetrics.ts` — `as const satisfies` + guard
- `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/view/ForceLayoutSection.tsx` — the one runtime change

---

## Verification performed (not taken on trust)

### 1. The RED was real — CONFIRMED

Checked `17a162c` out into a throwaway worktree and ran it:

```
FAIL  src/view/engineDefaultsSingleSource.test.ts
AssertionError: expected [ 'ForceLayoutSection.tsx' ] to deeply equal []
  ❯ src/view/engineDefaultsSingleSource.test.ts:61:21
```

Byte-for-byte the failure claimed, for the stated reason. `784f8b1` checked out
in the same worktree: `Test Files 1 passed, Tests 3 passed`. Genuine
red→green, not a fabricated or trivially-true red.

### 2. All five compile guards fire and NAME the field — CONFIRMED, plus a sixth

I re-ran every probe myself against the repo's real `tsconfig.json` at HEAD.
Exact `tsc -noEmit` output:

| Probe | Guard output |
|---|---|
| new `ViewSettings` field | `SettingsSpec.ts(118,14): TS2322: Type 'true' is not assignable to type '"ghostViewField"'` |
| " (same probe) | `persistedShapes.ts(174,8): TS2741: Property 'ghostViewField' is missing … required in type 'ParsedViewFields'` |
| " (same probe) | `settingsSectionFields.ts(73,14): TS2322: Type 'true' is not assignable to type '"ghostViewField"'` |
| new `DepthSettings` field | `SettingsSpec.ts(118,14)` + `settingsSectionFields.ts(73,14)` naming `"ghostDepthField"`, **and** `persistedShapes.ts(153,42): TS2345` naming it in the parameter type |
| new `SizeMetricId` | `sizingMetrics.ts(40,14): TS2322: Type 'true' is not assignable to type '"ghost-metric"'` |
| new bounded `SizingSpec` field | `constants.ts(182,14): TS2741: Property 'ghostBoundedField' is missing … required in type 'Readonly<Record<SizingRangeField, SettingsRange>>'` |
| orphan `ViewSpec` entry | `SettingsSpec.ts(128,14): TS2322: … not assignable to type '"ghostOrphanSpec"'` |

Every guard fired; every one named the offending field. **No guard compiled clean
when it should have failed.** Tree confirmed clean after each probe.

Worth noting the `_assertEvery…` idiom's payoff is real: the error text carries
the *key name*, which a generic `assertTotal<A,B>()` helper would have hidden.
The WHY-NOT comment at `src/engine/SettingsSpec.ts` explaining that is accurate.

### 3. The inherit invariant survives — CONFIRMED by runtime probe

I wrote a throwaway probe (13 assertions, all passing) rather than reading:

- `parseDocData({view:{nodeCap:3}})` → `Object.getOwnPropertyNames(...view)` is
  exactly `["nodeCap"]`. Absent fields are **absent keys**, not
  present-with-`undefined`. This matters because `exactOptionalPropertyTypes` is
  **not** enabled in `tsconfig.json`, so the type system alone would not have
  caught a present-with-undefined regression.
- `{nodeCap: 0}` → `{nodeCap: 0}`. A pinned zero is a pin.
- A sizing metric pinned `enabled:false` survives as `false`.
- `{view:{bogus:1}}` → the parsed `DocData` has property names `["version"]`
  only; no empty `view` key is manufactured.
- `{depths:{outgoingDepth:0}}` → `{outgoingDepth:0}`.

`ViewSettingsOverride` is unchanged (`Partial<ViewSettings>`, `src/engine/types.ts:306`).
`DepthOverride` changed from a hand-written optional interface to
`Partial<DepthSettings>` — structurally identical field-for-field, and now
incapable of drifting. That is a net improvement, not a semantic change.

`definedFieldsOnly` implements the `!== undefined` rule **once**, replacing seven
independent `definedOnly(...)` spreads. This is the single best DRY move in the
change: the inherit rule is a business rule, and it now has one implementation
site instead of seven chances to get it wrong.

### 4. Zero blast radius is honest — CONFIRMED

- `git diff f4b4a7f..HEAD -- src/view/settingsResetPlan.test.ts` is **empty**.
- All test-file changes are `+219 / −0` across three files — **pure additions**,
  zero deletions, zero modified lines.
- No `.skip` / `.todo` / `it.fails` introduced. The three pre-existing skip-ish
  sites (`edgeRouting.test.ts:356` conditional wasm, `d3ForceStranding.test.ts:230`
  `it.fails`, `e2e/externalVault.e2e.ts:30` env-gated) are all untouched by this
  branch.
- No assertion anywhere was loosened or re-baselined.

### 5. `ViewSettingsResolver.resolve()` — UNCHANGED

The file does not appear in the diff at all. Its `ViewSettings` return type still
carries the completeness guarantee. CLARIFICATION constraint 5 is honoured — and
was in fact the *reason* the planner declined the one design that would have
violated it (see the deviation note below).

### 6. Scope discipline — CLEAN

- **D1 (no renderer-loop rewrite)**: `VicinityGraphSettingTab.display()` and
  `GraphToolbar` are not in the diff. `ForceLayoutSection.tsx`'s only change is
  the `onClick` handler; class, `title` and button text are untouched.
- **D2 (no depth rename)**: `outgoingDepth` / `incomingDepth` intact.
- **No user-facing copy change**: every `label` / `description` / `confirmation`
  string in `settingsResetPlan.ts` appears as an unchanged context line.
- **No CSS change**: no `.css` file in the diff.
- **No persisted-shape change**: `PERSISTED_SHAPE_VERSION` untouched.

### 7. The numbers — CONFIRMED

`npm test`: **86 files, 1144 passed | 1 expected fail (1145)**.
`npm run check`: **exit 0** (both `src/` and `e2e/`).

The one expected fail is `it.fails(...)` at
`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/view/d3ForceStranding.test.ts:230`.
`git diff f4b4a7f..HEAD -- src/view/d3ForceStranding.test.ts` is empty and the
file's last commit predates this branch (`0fb796f`). It corresponds to the
in-progress ticket `d3-forcelink-minhalfextent-is-direction-blind…`. **Genuinely
pre-existing, not caused by this branch.**

(No `./sanity_check.sh` exists in this repo.)

### 8. Behavioural equivalence — PROVEN by differential probe (beyond what was claimed)

The implementer's correctness argument rests on `settingsResetPlan.test.ts` being
unedited. I went further and transcribed the six **pre-branch hand-written plan
closures** from `f4b4a7f` into a probe, then asserted the new derived plans emit
`toEqual` output over a fully tuned context. **All six match.** I additionally
confirmed:

- `EngineDefaults.viewSettings()` constructs `sizing` / `forceLayout` by calling
  the leaf factories fresh (`src/engine/constants.ts`), so `restoreFields` hands
  out **fresh objects** — two successive `node-sizing` resets do not share a
  `sizing` reference. No aliasing hazard was introduced by moving from
  `EngineDefaults.sizingSettings()` to `EngineDefaults.viewSettings().sizing`.
- No section reset mutates the caller's `ctx` (JSON round-trip identical after
  running all six).

The panel change is exactly equivalent: `planSettingsWrite`'s
`global-force-layout` branch (`src/view/settingsWritePlan.ts:108-109`) produces
`{kind:"global-view", view:{...ctx.globalView, forceLayout}}`, and
`planSectionReset("force-layout", ctx)` produces the same single command.

### 9. New tests are non-vacuous — CONFIRMED

I removed `nodeCap` from its section in `SECTION_SETTINGS_FIELDS` and re-ran:
**4 tests fail** — two of the new ones *and two in the untouched
`settingsResetPlan.test.ts`*. That the pre-existing behaviour-capturing test also
catches the injected defect is the strongest evidence available that the refactor
is genuinely covered rather than merely accompanied by new green tests.

---

## 🚨 CRITICAL Issues

**None.**

## ⚠️ IMPORTANT Issues

**None blocking.** One item needs owner *visibility* before the ticket is closed:

### V1 — The ticket's literal "ONE declaration" acceptance clause is NOT met (documented decline, needs an explicit owner ack)

**Claim.** `_tickets/settings-cleanup-descriptor-model.md` ACCEPTANCE reads
*"adding a new field requires editing ONE declaration plus its UI copy;
compile-time completeness guards … make every remaining table exhaustive."* The
second clause is fully delivered. The first is not: a new `ViewSettings` field
still costs five edits.

**Evidence.** I measured it with probe 1 — adding `ghostViewField` produced errors
in `SettingsSpec.ts`, `persistedShapes.ts` and `settingsSectionFields.ts`, on top
of the `types.ts` declaration and `EngineDefaults.viewSettings()`. That is exactly
the five-step cost table the plan and
`docs-internal/notes/settings.md` now publish.

**Assessment — I agree with the decline.** The only route to the literal "one
declaration" is deriving the `ViewSettings` *type* from a runtime descriptor
array, which would weaken `ViewSettingsResolver.resolve()`'s return-type
guarantee — forbidden by the owner's own binding CLARIFICATION constraint 5. The
owner's constraint and the owner's acceptance clause are in direct tension, and
the planner resolved it the safe way. "Compile-forced N declarations" kills the
failure mode the ticket chain actually exists to kill: *silent* drift.

It is also recorded **durably**, not just in the ephemeral report —
`docs-internal/notes/settings.md` states plainly *"This is 'compile-forced N
declarations', NOT the ticket's literal 'ONE declaration'"* with the reason. That
is exactly the transparency standard I want.

**Recommended action.** Not a code change. TOP_LEVEL_AGENT should surface this
one sentence to the owner when closing the ticket, since the substitution was
approved by an agent plan-review, not demonstrably by the human. It is an
acceptance-criterion amendment, and the human should be the one to accept it.

---

## 💡 Suggestions (all MINOR)

### M1 — A now-false WHY comment and unreachable throw in the e2e harness, self-reported but not ticketed

**File.** `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/e2e/settingsDependentRows.e2e.ts:44-50`

`SIZING_METRICS` became an `as const` tuple, so `SIZING_METRICS[0]` is no longer
optional. The comment still asserts the opposite:

```ts
 * `noUncheckedIndexedAccess` makes `[0]` optional and an empty table is a bug, not a
 * reason to silently skip.
 */
const METRIC_UNDER_TEST = SIZING_METRICS[0];
if (METRIC_UNDER_TEST === undefined) {
	throw new Error("SIZING_METRICS is empty — …");
}
```

The branch is now dead and the comment is now **wrong** — a stale WHY is worse
than no WHY, because the next reader trusts it. Leaving the e2e file alone was
the right scope call (D1), but CLAUDE.md's rule is *"spot issues outside your
task → file a ticket"*. The implementer reported it in
`IMPLEMENTATION__PUBLIC.md §7` but **did not file a ticket**, so it will be lost.

**Fix.** File a `_tickets/` entry (deps → ticket 5, which already touches the e2e
baselines) to drop the dead branch and correct the comment. Do not fix it here.

### M2 — The source-scan guard's failure message does not explain the comment caveat

**File.** `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/view/engineDefaultsSingleSource.test.ts:33,70`

**Judging the deviation as asked:** the trade-off is **correct and I endorse it**.
The regex `/EngineDefaults\.[a-zA-Z]+Settings\s*\(/` matches raw source including
comments, so prose can trip it — and the implementer reworded its own comment
rather than teaching the scanner to strip comments. Stripping comments to satisfy
prose would introduce a false-*negative* risk (a real call trailing a string
containing `//`), and for a guard whose entire job is catching a real call, a
false negative is strictly worse than a false positive. A false positive costs a
one-word reword; a false negative costs the guard's reason to exist. The
conservative direction is the right one, and it is documented at `DEFAULTS_CALL`.

This is **not** a latent maintenance trap in the meaningful sense, because the
trap is *loud* (a red test) rather than silent, and self-explaining at the
definition site. But the trap-springing developer sees only:

```
expected [ 'SomeFile.tsx' ] to deeply equal []
```

which does not point at the `DEFAULTS_CALL` doc comment.

**Fix.** One-line improvement — put the hint in the assertion:

```ts
expect(offenders, "a match inside a COMMENT also counts: name the factory without its parentheses").toEqual([]);
```

### M3 — Allowlist keys are basenames; the scan yields recursive relative paths

**File.** `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/view/engineDefaultsSingleSource.test.ts:41-48,55-59`

`viewModulesUnderScan()` uses `{recursive: true}` and returns paths relative to
`src/view`, while `ALLOWED_MODULES` is keyed by bare filenames. `src/view` is flat
today so this is correct now. If a listed module ever moves into a subdirectory,
its exemption silently stops matching and the third test fails via a
`readFileSync` **ENOENT throw** rather than a clean assertion. Low likelihood,
cheap to pre-empt.

**Fix (optional).** Have the stale-exemption test resolve entries against the
scanned list instead of the filesystem:
`Object.keys(ALLOWED_MODULES).filter((m) => !viewModulesUnderScan().includes(m))`
would then report a *moved* module as a clear failure.

### M4 — Scan covers only `src/view`

Same file. `src/adapters/` is unguarded; a defaults factory call there would be
the same "second opinion on what a default is". Today the reset affordances all
live in `view`, so the coverage is adequate. Worth one line in the module doc
stating the boundary is deliberate, or a note on ticket 4.

### M5 — `_assertEveryResetScopePlaced` is now a no-op kept for the future

**File.** `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/view/settingsResetPlan.ts:246-248`

With `SettingsResetScope = SettingsSection | "all"` and
`SECTION_RESET_SCOPES = SETTINGS_SECTIONS`, `UnplacedScope` is structurally
`never` — the guard cannot fail. This is ~20 lines of justification protecting
~3 lines that do nothing; the `Readonly<Record<SettingsResetScope, …>>`
annotation on `SETTINGS_RESET_SCOPES` already carries a strictly stronger
guarantee. The plan ruled it stays and it is **honestly annotated as
tautological**, which is what matters (a guard that reads as protection while
being incapable of firing would be a POLS violation — the comment prevents that).

I would delete it, but this is a taste call on a plan-level ruling, not a defect.
Flagging so the next reader knows a reviewer looked and agreed it is harmless.

---

## Over-engineering assessment (asked explicitly)

**Verdict: not over-engineered. Complexity genuinely reduced, not merely moved.**

Concretely, before → after in *hand-maintained lists that can silently drift*:

| List | Before | After |
|---|---|---|
| `parseViewOverride` branches | silent | compile-forced (`ParsedViewFields`) |
| `parseDepthOverride` branches | silent | compile-forced (TS2345) |
| six section reset plans | six hand-written closures, each restating its own key set | one 8-line data table + one 20-line derivation |
| `SizingRangeField` | hand-typed union | derived (`Exclude<keyof SizingSpec,"metrics">`) |
| `SIZING_METRICS` | unguarded array | compile-forced |
| spec ↔ settings fields | unguarded both ways | compile-forced both ways |
| `DepthOverride` | parallel interface | `Partial<DepthSettings>` |
| the `!== undefined` inherit rule | 7 spread sites | 1 function |

Machinery added is ~40 lines. `restoreFields` and `definedFieldsOnly` are each
short, single-purpose, documented at the two casts, and safe by construction
(every write is `T[K] = T[K]`; every surviving key came out of a `T`-keyed
object) — I verified both empirically. The `+911` line count is dominated by
tests (219), WHY comments and durable notes, which is the right ratio for a
change whose entire deliverable is *future* safety.

**Is adding a field genuinely easier?** Not *fewer* edits — but every edit site
except the UI row is now named by the compiler. Before, four of those sites were
silent. That is the difference between "you will find out at review time, or
never" and "you will find out at `tsc`". For a repo with three symptom tickets
already caused by exactly this drift, that is the higher-value trade.

**The one place complexity moved rather than shrank** is the deliberate
`SETTINGS_SECTIONS` / `SECTION_RESET_SCOPES` double-naming — two exported names
for one tuple, two type names for one union. That is real debt, but it is
*transparently* taken, justified (collapsing it would require editing the e2e
harness and a behaviour-capturing test inside the very change that refactors what
they check), and **ticketed** (`nid_llfhrqo1ecg8tuxigo7bcrrrf_e`, deps → ticket 4).
Correct call.

---

## Judging the two declared deviations (asked explicitly)

### Deviation 1 — Test 11 in a new `settingsSectionFields.test.ts` rather than extending `settingsResetPlan.test.ts`

**Sound. Not dodging.** Three independent reasons:

1. **SRP is genuinely on its side.** The property under test is the *section
   map's* completeness; `planSettingsReset` is the observation mechanism, not the
   subject. It belongs with the map.
2. **The proof would have been weakened.** "This refactor changed no behaviour"
   is only checkable because `settingsResetPlan.test.ts` is byte-identical.
   Appending to it — however additive — makes a reader verify *which* lines are
   new before trusting the claim. Keeping it untouched keeps the proof a one-line
   `git diff`.
3. **It is more coverage, not less.** The plan called for one test; three landed
   (one per family), plus four map-level tests. And my injection probe showed the
   *untouched* `settingsResetPlan.test.ts` still catches a broken derivation on
   its own — so nothing was moved out from under it.

### Deviation 2 — Rewording the WHY comment instead of teaching the scanner to strip comments

**Acceptable, and the right direction.** Full reasoning in **M2** above. Summary:
false positive costs a reword and is loud; false negative silently defeats the
guard. Choosing the noisy failure mode for a safety guard is correct. Not a
latent trap, because it fails loudly and is self-documenting at the definition
site — but the assertion message should carry the hint (M2's one-line fix).

---

## Documentation Updates Needed

None required — documentation on this branch is a strength, not a gap.

`docs-internal/notes/settings.md` correctly strikes through the two closed holes,
adds the three newly-found ones, publishes the post-ticket field cost, records
D2's deferral, and states the "N declarations, not ONE" substitution in the
durable note rather than only in the ephemeral report. `CLAUDE.md` needs no
change (no layering rule, command or convention moved).

Two housekeeping items the implementer correctly deferred to TOP_LEVEL_AGENT:
- No `change_log` entry (sub-agents must not write one) — suggested params are in
  `IMPLEMENTATION__PUBLIC.md §6`.
- Main ticket and the moot sub-ticket `nid_3k0a4zl6in0mj8lcjibkjq2dx_e` still open.

Plus **M1**: file a ticket for the stale e2e comment.

---

## Verdict

**IMPLEMENTATION_APPROVED**

No blocking reasons. Every claim in the implementation report was independently
reproduced and held: the RED was real, all five compile guards fire and name the
offending field, the inherit invariant is intact at runtime (verified by probe,
not by reading), `settingsResetPlan.test.ts` is byte-identical, all test changes
are pure additions, the one expected failure is genuinely pre-existing, and the
six derived reset plans are byte-identical to the pre-branch hand-written ones
under a differential probe. Scope discipline is clean against D1, D2, copy, CSS
and persisted shape.

The five suggestions (M1–M5) are all MINOR and none need to land before merge.
**M1 should become a ticket** so the stale e2e comment is not lost. **V1 needs an
explicit owner acknowledgement** that "compile-forced N declarations" supersedes
the ticket's literal "ONE declaration" clause before the main ticket is closed —
the decline is well-reasoned and durably documented, but it amends a
human-written acceptance criterion and only the human can accept that.
