# TOP_LEVEL_AGENT — 03 force placement quality

Feature: `03-force-placement-quality` · Branch: `main`
Ticket: `_tickets/03-force-placement-quality-linked-nodes-stranded-far-from-neighbors.md`

## Task
Fix force-layout quality: linked nodes stranded far from neighbors (long crossing edges).
Root-cause hypotheses: (1) forceLink.strength unset → weak links at hub; (2) static run from
elk seed stuck in local minimum; (3) elk force seed untuned. Fix DEFAULTS, not user settings.
Bring repro data into dev-vault / unit fixture (public vault not source-controlled).

## Phase tracking
- [x] EXPLORATION — pipeline + vault reports written; consolidated in EXPLORATION_PUBLIC.md
- [x] CLARIFICATION — SKIPPED: requirements unambiguous (fix defaults, failing-test-first, deterministic, mirror data to dev-vault)
- [x] DETAILED_PLANNING (Think Hard) — plan written. Key: Enchiridion is degree-1 so weak-link-strength is NOT its cause (Mechanism B: charge + local minimum off large container). Fix = pin forceLink.strength~1 (Lever 1) + moderate charge reduction (Lever 2); reserve re-heat. Metric = per-edge stretch ratio. Automated test = self-contained makeGraph fixture; dev-vault notes for manual visual check.
  - Q_FOR_HUMAN resolved by ticket text (ticket explicitly directs mirroring repro into dev-vault). Not a blocker.
- [x] DETAILED_PLAN_REVIEW — VERDICT MINOR (inline edits). Approved. Sharpened: hub-spoke fixtures don't exercise Lever 1 (all degree-1) → metric is a charge/Lever-2 test; Lever 1 must be honestly covered or marked untested. No blockers.
- [x] PLAN_ITERATION — SKIPPED (reviewer empowered minor inline edits)
- [~] IMPLEMENTATION — **BLOCKED / escalated**. Failing-first empirical work INVALIDATED the plan's root cause. Charge sweep (−300→−30) leaves max edge-stretch bit-identical → Lever 2 inert; Lever 1 no-op on degree-1 leaf. REAL cause: circular `forceCollide` uses folder-group container's circumscribed-circle radius (~238px for 192×392 container) → flings external neighbors far/uneven. Fix is ARCHITECTURAL (AABB collision, or attract edge to member note), exceeds "fix defaults" scope. No production change shipped; tree pristine. → STOP + ask human for direction.
- [—] IMPLEMENTATION_REVIEW / ITERATION / PARETO — N/A this pass (no fix shipped)

## OUTCOME (this pass): HALTED at IMPLEMENTATION — re-plan required
Human decision: fold findings into the SAME ticket; next step = re-plan with a STRONGER
model; planning exit criteria must include sandboxing/prototyping (throwaway prototype
run through the real pipeline proving red→green before plan acceptance).
- Ticket updated with invalidated hypotheses + true root cause + candidate directions +
  re-plan directive: `_tickets/03-force-placement-quality-...md`.
- No production/source change shipped (tree pristine); all evidence in `.ai_out/.../*`.

## Notes
- Commit between phases; keep git clean.
- Think Hard during planning (per human instruction).
