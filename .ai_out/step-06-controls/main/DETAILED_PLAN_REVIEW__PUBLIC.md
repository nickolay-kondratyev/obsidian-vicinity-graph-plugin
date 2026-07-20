# Detailed Plan Review — step-06-controls

**Verdict: APPROVE-WITH-MINOR-INLINE-DONE**
**Skip PLAN_ITERATION? YES** — provided the implementer honors the two Important recommendations
below (both are localized to Phase B and already written into the plan inline as guidance). No
blockers, no architecture rework, no new human decision required.

## Executive summary
The plan is unusually well-grounded: I spot-checked every load-bearing claim against the real code
(`NeighborhoodGraphBuilder`, `GraphRequestAssembler`, `GraphViewController`, `PersistenceServices`,
`DocDataMutations`, `TraversalSettingsResolver`, `PluginDataStore`) and the core moves are feasible as
described. The pure-vs-glue split mirrors the existing `attachmentMenu`/`ObsidianGraphUi` pattern, the
presence-based inherited-vs-pinned derivation is correct, and the headline scenario test is targeted at
the right two levels. Two substantive refinements (a DRY-of-business-rule on the resolved depth value,
and a missing wiring detail for the executor's MAIN path) plus a couple of compile-ripple/edge gaps —
all handled inline. Verified: the `GraphBuildResult{graph,controls}` change, the rebuild wiring, and
`setCentralDepthField`/`centralDepths` semantics all hold up.

## Critical issues (BLOCKERS)
None.

## Important (address during implementation — inlined as guidance, no re-plan needed)

### Important-1 — DRY the resolved depth VALUE, not just the pin list (SRP/DRY of a business rule)
`ControlsModelBuilder`'s `value = centralDepths[X]?.[field] ?? xOwn.depths?.[field] ?? global[field]`
independently re-states TWO rules that already live elsewhere: the assembler's per-pin merge
(`GraphRequestAssembler.depthOverrides`: `{...ownDepths, ...mainAdjusted}`) and the resolver's
fallback (`TraversalSettingsResolver.resolveForRoot`: `override ?? global`). Two parallel `?? ?? `
chains can silently drift, and the failure mode is exactly the one the step spec warns against — the
toolbar showing a value the graph did not use. The plan already extracts `resolvePinnedDescriptors`
for the pin list; extend that same shared surface to also produce the per-root **merged
`DepthOverride`**, then derive `value` via `TraversalSettingsResolver.resolveForRoot(global, merged)`.
`pinned` stays a separate presence check on the owned layer (the resolver can't express presence).
This makes "value shown == value used" structural rather than test-enforced. The §11.5 dual test
mitigates but does not eliminate the drift. **Inlined into §5.**

### Important-2 — Executor's source of the current MAIN path is unspecified
`central-depth-field` and `main-depth` writes both target the MAIN file
(`setDocDepthField(mainFile,…)` / `setCentralDepthField(mainFile,…)`), but the current main path lives
in `GraphViewController.mainPath` (private) and is not on the `SettingsInteraction` nor the
`ControlsModel`. `apply(command, mainPath)` takes it as a param, but nothing in the plan says who
supplies it. Recommended (and inlined into §4): expose a pure `GraphViewController.currentMainPath():
string | null` (plain string getter, keeps the controller obsidian-free per §6) that `ControlsActions`
reads inside `apply`; `null` → no-op. Implementer would hit this immediately; naming it now avoids a
wrong turn (e.g. threading mainPath through React).

## Minor (inlined)
- **`main.ts logNeighborhoodGraph` compile ripple:** the debug command reads `graph.nodes/edges/…`
  off `graphBuilder.build(...)` directly; the `GraphBuildResult` return-type change breaks it. Added
  to the Phase-B step-6 edit set (plan previously listed only the controller test fakes). Also
  `resolveBuild(index, graph)` in `GraphViewController.test.ts` needs the wrapped shape.
- **`persistable` derivation:** `mainDocId !== null` is looser than the builder's actual load gate
  (`… && DocPersistEligibility.isFilenameSafeDocId`). An unsafe-foreign-docid MAIN would render enabled
  steppers that then Notice-refuse on write. Derive `persistable` from the same eligibility verdict.
  **Inlined into §5.**

## Assessment against the review focus areas
1. **Correctness/feasibility** — `GraphBuildResult{graph,controls}`: feasible; ripple correctly
   identified (plus the two gaps above). Rebuild wiring (`handleSettingsChanged` → immediate
   `runRebuild`): sound — `rebuildToken` latest-wins + awaited writes make debounce genuinely
   unnecessary (correct PARETO call). `setCentralDepthField`/`centralDepths`: verified byte-for-byte
   against `DocDataMutations` + assembler; the scenario round-trip expectations are exactly right.
   Presence-based inherited-vs-pinned: correct, and rightly rejects value-diffing (§5 approach 2).
2. **SRP/DRY/DIP** — Clean pure/glue split; controller stays obsidian-free; ports for DIP. One real
   DRY gap (Important-1). No obsidian leaks into pure modules. `ControlsActions` correctly isolates the
   only obsidian write surface.
3. **PARETO/KISS** — The 4-pure-module decomposition is justified (each is independently the correct
   test seam); `settingsWritePlan` + `ControlsModel` carry genuinely contract-heavy logic. Nothing
   over-engineered. Global-only sizing/cap keeps V1 tight. `SettingsInteraction`/`SettingsCommand`
   two-union indirection earns its keep as the tested contract layer.
4. **Test adequacy** — Acceptance criteria are concrete. The headline scenario is correctly split into
   (a) assembler/persistence round-trip AND (b) engine end-to-end — good, because (a) alone wouldn't
   prove the BFS re-explores. Pin-on-toggle-when-equal-to-global has an EXPLICIT assertion at BOTH
   layers (§11.1 "value EQUALS global → write STILL emitted"; §11.2 "MAIN depth=1 while global=1 →
   pinned:true"). Reset(=undefined) writes tested at both layers. Adequate. (Nudge for the
   implementer: give the (b) vault few enough nodes that `nodeCap` truncation can't mask the depth-3
   frontier.)
5. **Sequencing** — Phases are genuinely pure-first and independently committable; Phase A carries the
   contract tests that de-risk everything after. `FlowNodeData.docid` (step 7, Phase B) correctly
   precedes pin UI (step 11, Phase C) — no hidden hazard. Only ordering note: step 6's return-type
   change must land `main.ts` + the test fakes in the SAME commit to stay green (now inlined).
6. **Gaps vs step spec** — "No orphaned UI": satisfied — every control maps to a tested pure planner
   or an existing tested persistence primitive, with §11.6 explicitly scoping the untested glue.
   Restart round-trip, not-persistable Notice, and visual inherited-vs-pinned distinction are all
   covered (§13 QA #1–#14, §7, §9). Nothing material missing.
7. **Open questions** — Q-A (pinned-central-with-own-override badge/reset): the recommended default
   (pin badge + reset scoped to the layer THIS control writes, `Y.centralDepths[X]`) is the correct,
   consistent choice — reset should visibly remove exactly this control's contribution, and it matches
   the scenario test's "X's own settings untouched" invariant. Ship it; the "central pinned only via
   its own depths reads as inherited at Y" consequence is acceptable and self-consistent. Q-B (full
   sizing parity in the disclosure): sound — CLARIFICATION Q5 literally says "mirror of the settings-tab
   sizing controls"; a reduced subset would be a surprise. Q-C (settings-tab writes refresh open views
   via `getLeavesOfType → view.refresh()`): sound and idiomatic; no bespoke emitter. All three defaults
   are safe to proceed on — none needs to block implementation.

## Strengths (specific)
- Rejected-alternatives table in §5 is exactly the reasoning a reviewer wants: it explicitly kills the
  "thread override-presence through the engine" (SRP pollution) and "value-diff for presence" (a lie
  about pin state) options, landing on presence-over-already-loaded-inputs. Correct.
- Reuse of proven patterns: `<Panel>`, `AttachmentChip` hover escape-hatch, `showAttachmentMenu` native
  `Menu`, `nodrag nopan` — no new UI primitives invented.
- The immediate-not-debounced rebuild justification is rigorous (latest-wins token + serialized writes
  + tiny click burst) and names the reusable knob for the future instead of building it.
- Pin decision (`planNodePinAction`) shared across hover button and context menu — one source of truth
  for a rule that's easy to duplicate.
