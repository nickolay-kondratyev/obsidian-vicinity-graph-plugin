# PLAN_REVIEWER — working state (step-06-controls)

## Verification done (against real code)
- `NeighborhoodGraphBuilder.build` returns `Promise<NeighborhoodGraph | null>`; `inputs` is a local
  passed to `GraphRequestAssembler.assemble`. Returning `{graph, controls}` = hoist `inputs`, call
  `ControlsModelBuilder.build(inputs)`. FEASIBLE.
- `GraphSourcePort.build` return-type change ripples: controller.runRebuild (`graph===null`,
  `graph.nodes.length`), FlowSnapshot/EMPTY_SNAPSHOT, test FakeGraphSource/graphOf/resolveBuild,
  AND `main.ts logNeighborhoodGraph` (NOT in plan — compile break). Flagged + inlined.
- `setCentralDepthField` / assembler merge (`{...own, ...centralDepths[X]}`) verified — scenario
  round-trip test §11.5(a) is correct against DocDataMutations + assembler.
- presence-based inherited-vs-pinned: ground truth in DocData.depths / centralDepths[X]. Correct.
- Resolver: `TraversalSettingsResolver.resolveForRoot(global, override)` = `override ?? global`.
  ControlsModel value chain re-derives merge+fallback → DRY concern (Important-1). Inlined note.
- PluginDataStore method names all confirmed (saveGlobalDepths/saveGlobalView/addPin/removePins/
  pins/globalDepths/globalView/hasPin).
- ControlsActions needs current MAIN path to target setDoc*/setCentral* — not sourced in plan
  (Important-2). Inlined: expose controller.currentMainPath().
- persistable = mainDocId!==null is looser than builder's isFilenameSafeDocId gate (Minor). Inlined.

## Verdict: APPROVE-WITH-MINOR-INLINE-DONE
Two Important recs documented (DRY value derivation; mainPath source) — both inlined as guidance,
localized to Phase B, do not require full PLAN_ITERATION. No blockers. No QUESTION_FOR_HUMAN beyond
the planner's own Q-A/B/C (defaults sound).

## Inline edits made
- §6 ripple: added main.ts logNeighborhoodGraph + resolveBuild to edit set.
- §5: DRY-value-via-resolver note; persistable-gate note.
- §4: currentMainPath() executor source.
