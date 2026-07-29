# PHASE 1 REVIEW — per-doc removal (global-only settings)

Reviewed: `main...HEAD` (4 commits, 61 files, −2562/+669). Ticket `nid_ez38gf1mrdgh5kxedzrdicwzl_e`.

## Gates — verified by the reviewer (not taken on trust)

| gate | result |
|---|---|
| `npm test` | **PASS** — 82 files / 1085 tests passed, exit 0 (`.tmp/review-test.log`) |
| `npm run check` | **PASS** — exit 0 (`.tmp/review-check.log`) |
| `npm run test:e2e` | NOT run (real Obsidian; release gate). **One spec is provably red — see B1.** |

## Verdict

**APPROVE with one required fix (B1).** The removal is unusually clean: the per-doc layer is gone
end-to-end, no orphan types, no dead params, no unreachable arms, and the global depth genuinely
drives MAIN *and* every pinned root at runtime (not only in tests) —
`src/engine/VicinityEngine.ts:108-111` maps `[main, ...pinned]` onto the single `request.globalDepths`,
and `GlobalDepthControls → planSettingsWrite("global-depth") → saveGlobalDepths → refreshAllViews`
closes the loop. All three deviations beyond the ticket's literal wording are justified. Every
surviving behavior I checked still has a test pinning it.

---

## 🚨 BLOCKING

### B1. `e2e/settingsResetVerify.e2e.ts:128` asserts copy this change deleted → guaranteed red release gate

```ts
expect(text).toContain("Per-note depth overrides and pinned notes are kept.");
```

`src/view/settingsResetPlan.ts:73` now reads `"… Pinned notes are kept."` (the "Per-note depth
overrides and" clause was correctly removed). That spec will fail on `npm run test:e2e`, and the file
is **not** in the implementer's PHASE 2 handoff list — so nothing today would catch it.

Fix (one line, or move it to PHASE 2 explicitly):
```ts
expect(text).toContain("Pinned notes are kept.");
```
Best is to reference `SETTINGS_RESET_SCOPES.all.description` / a shared baseline constant so the copy
lives once — the same drift class `docs-internal/notes/settings.md` exists to kill. Grep confirms no
other e2e assertion targets changed reset copy.

---

## ⚠️ SHOULD-FIX

### S1. `GraphViewController.currentMainPath()` is now dead public API with a lying doc comment
`src/view/GraphViewController.ts:161-164`. Deleting `OwningViewPort` removed its only production
caller; the sole remaining references are `GraphViewController.test.ts:300,306`. Its comment still
says "the executor targets it" — false. Delete the method and those two assertions (the private
`this.mainPath` is still used at :138/:145/:188), or, if kept deliberately, fix the comment to say
what it is for. Leaving a public getter alive only for its own test is exactly the dead-code the rest
of this branch removed.

### S2. One ported engine test can pass vacuously
`src/engine/VicinityEngine.test.ts` — "WHEN MAIN changes THEN the pinned central's reach is unchanged":
```ts
expect(node(build("z.md", 3), "x3.md")?.depthTags).toEqual(node(build("y.md", 3), "x3.md")?.depthTags);
```
If the pinned root stopped being walked at all, both sides are `undefined` and the test stays green —
a silent-fallback assertion. Assert the concrete value on both sides instead, e.g.
`toEqual([{ rootPath: "x.md", direction: "outgoing", depth: 3 }])` for the `z.md` build (the `y.md`
case is already pinned by the test above it).

### S3. PHASE 2 handoff list is missing three items
The list in `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` is otherwise accurate and specific. Add:
1. **`e2e/settingsResetVerify.e2e.ts:128`** (B1) — if it is not fixed in PHASE 1.
2. **`docs-internal/notes/settings.md:34-36, 68, 76`** — these name `ViewSettingsResolver.resolve()`
   as the ViewSettings completeness guard *and* as the owner's ratified standing constraint for the
   whole settings-cleanup chain. The class no longer exists. PHASE 2 must restate the constraint over
   what now carries it: `ParsedViewFields` in `src/persistence/persistedShapes.ts:135` plus the new
   `NON_DEFAULT_VIEW` round-trip + fixture-differs-from-default pair in `persistedShapes.test.ts:257-277`.
   Also `settings.md:151-154` ("absent override means inherit") should be scoped to parse semantics.
3. **Stale `doc-data/` comments in the harness plumbing** the implementer did not list:
   `e2e/vaultTarget.ts:90, 120, 129` and `e2e/obsidianHarness.ts:495, 665`.

### S4. `PersistenceServices.unpinDoc` lost its doc comment entirely
`src/persistence/PersistenceServices.ts:30-32`. The old one described `centralDepths` self-healing
(correctly deleted), but the *interesting* fact survives and is now unstated: unpin lands
unconditionally and returns no verdict — which is precisely why `ControlsActions.unpinNode` skips the
`persistOutcome` gate. One line restores the WHY.

---

## 💡 Suggestions

- **UX / POLS (release-note-adjacent):** the panel's Depth disclosure is still summarised "Depth" with
  "Outgoing"/"Incoming" rows, but a bump there now changes **every** note's graph and fans out to
  every open view. The implementer flagged this for the release note; consider also making the surface
  honest — e.g. summary "Depth (all notes)" or a one-line hint — so the panel does not read as
  "this note's depth". Cheap, and it is the kind of thing "Do Not Make me Think" is about.
- `src/view/graph-view.css:499` — `.vicinity-graph-depth-controls` keeps `flex-direction: column` +
  padding + card background from the old per-central row. Now that there is exactly one such block
  inside a disclosure, the card chrome may be redundant nesting. Visual call, defer to PHASE 2 QA.

---

## Deviations from the ticket's literal wording — judged

| deviation | verdict |
|---|---|
| `TraversalSettingsResolver` + `ViewSettingsResolver` **deleted** instead of collapsed | **Justified.** Both became `return global`. Keeping a class named "Resolver" with nothing to resolve is a POLS violation. The completeness guarantee they carried is not lost: with `globalView` passing through verbatim there is no enumeration site to forget, and the persistence side is guarded by `ParsedViewFields` + the new all-fields-non-default round-trip test. Docs must catch up (S3.2). |
| `resolvePinnedDescriptors.ts` **inlined** into `GraphRequestAssembler` | **Justified.** The module existed to share the skip-rule between the assembler and the toolbar's central list; the central list is gone, so the shared seam had one consumer. `GraphRequestAssembler.pinnedDescriptors` (`:51-65`) preserves both judgments (unresolved pin skipped, main-as-pin skipped) verbatim, and all four pin tests survive. |
| `settingsWriteScope.ts` **deleted** (+ `OwningViewPort`) instead of reduced to `const "global"` | **Justified** — with the caveat in S1. Every command is global, so a scope table with one row is indirection; `ControlsActions` fanning out unconditionally is simpler *and* is what the pipeline ticket (3) wants. `GraphViewController.handleSettingsChanged` correctly survives (used by `VicinityGraphView.tsx:96`); only `currentMainPath()` was left orphaned. |

Layering and invariants hold: `src/engine/` imports nothing from `obsidian`/`react`/persistence
(importGuard test green); `storagePorts.ts` shrank to the one port that still has an implementation;
descriptor-model semantics (absent field ⇒ spec default at the merge site; `definedFieldsOnly<T>` /
`ParsedViewFields` completeness guards; `DIRECTION_DEPTH_FIELD` now `Record<Direction, keyof DepthSettings>`)
are intact and compile-forced.

## Nothing surviving was lost — checked individually

- **Global pins**: `PersistenceServices.pinDoc/unpinDoc` + 7 tests; hover-pin UI + `ControlsActions`
  pin/unpin/refused/no-file tests; `PathDocIdMap` write-path fill test; `DocPersistEligibility`
  refusal suite untouched, with an explicit WHY-NOT (`DocPersistEligibility.ts:7-12`) recording that
  the filename-shaped rule is deliberately kept as a pin-key rule.
- **OrphanSweeper**: stale-pin removal, warm-up map fill, read-only `getDocId`, chunk-yield (both
  scales), mid-sweep pin race, summary counts — all present.
- **Global settings round-trip**: the whole sizing / force-layout / clamping / presence-semantics
  suite moved from `parseDocData(...).view` onto `globalView` with assertions preserved, plus a NEW
  compile-forced complete-`ViewSettings` round-trip.
- **e2e**: the deleted `pinnedCentralScenario` spec covered deleted behavior (owner-aligned); the
  surviving pin-lifecycle spec was correctly made self-sufficient (it now pins `sc_x` itself) and its
  WHY comment updated. `controlsRestart` still proves depth+pin+cap+sizing survive a real restart.
  Only the deleted "Pinned centrals disclosure" tail assertion is gone — its replacement absence
  assertion already exists at `e2e/settingsUxVisual.e2e.ts:142`.
- **No `EMPTY_CONTROLS` write hazard**: I checked the implementer's claim that the toolbar can no
  longer render with engine-default controls. `VicinityGraphFlow.tsx:64` returns early on
  `status === "empty"`, and `GraphToolbar` is only mounted at `:120`. So dropping the `centrals[0]`
  null-return cannot let a stepper write engine defaults over the user's persisted globals. Correct.

## #QUESTION_FOR_HUMAN

`#QUESTION_FOR_HUMAN:` The chain's ratified acceptance bar (`docs-internal/notes/settings.md:73-78`)
is phrased as "do not weaken `ViewSettingsResolver.resolve()`'s return-type completeness". That class
is now deleted. My read: the guarantee is not weakened — there is no longer any site that enumerates
`ViewSettings` fields to forget, and persistence completeness is compile-forced by `ParsedViewFields`.
Please confirm you accept that restatement before PHASE 2 rewrites the standing-decision text, since
tickets 4/5/6 inherit the wording.
