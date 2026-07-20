# TOP_LEVEL_AGENT — step-06-controls orchestration log

Branch: main. Feature dir: `.ai_out/step-06-controls/main/`.

## Phase status
- [x] EXPLORATION — 3 Explore agents → EXPLORATION_{VIEW,PERSISTENCE,ENGINE_PLAN}.md + PUBLIC index. Committed.
- [x] CLARIFICATION — Q1-Q5 + round-2 Q-A/B/C aligned with human. Committed.
- [x] DETAILED_PLANNING — PLANNER → DETAILED_PLANNING__PUBLIC.md. Committed.
- [x] DETAILED_PLAN_REVIEW — PLAN_REVIEWER: APPROVE-WITH-MINOR-INLINE-DONE, iteration skipped. 4 inline edits.
- [~] IMPLEMENTATION — driven phase-by-phase (A→E) to avoid compaction:
  - [ ] Phase A: pure planners + tests (constants/clamp, settingsWritePlan, nodePinAction, ControlsModel+resolvePinnedDescriptors, scenario tests 11.5 a+b)
  - [ ] Phase B: builder GraphBuildResult, controller handleSettingsChanged, FlowNodeData.docid, ControlsActions, plumbing
  - [ ] Phase C: in-view UI + CSS
  - [ ] Phase D: settings tab
  - [ ] Phase E: manual QA
- [ ] IMPLEMENTATION_REVIEW + ITERATION
- [ ] PARETO_COMPLEXITY_ANALYSIS
- [ ] Closeout: changelog entry, tickets, final human summary.

## Key binding decisions
See CLARIFICATION__PUBLIC.md. Depth steppers = only per-doc/central write surface; sizing+cap global-only V1. Q-A: stepper edits MAIN.centralDepths[X] layer only.
