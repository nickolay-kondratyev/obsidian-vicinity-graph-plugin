# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (rehydration state)

Ticket: `nid_abreq4lmpo8vnvf61y9k9yly0_e` — SettingsSpec baseline tests not exhaustive.
Branch: `settings-spec-baseline-exhaustive`.

## Status: DONE (committed, all verification green)

## Plan (executed)
1. RED proof BEFORE fix: temporarily add `fakeNewKnob` to `ViewSpec` + `SETTINGS_SPEC.globalView`,
   run file tests + `npm run check` → both green (bug demonstrated). Revert. DONE
2. Add `type EverySpecField<TSpec> = Record<keyof TSpec, unknown>` + `NO_SPEC_LIMITS` const to
   `src/engine/SettingsSpec.test.ts`. DONE
3. Defaults baseline test: extract `viewDefaults` literal `satisfies EverySpecField<ViewSpec>`,
   spread into the `expect(...)`; add `outlineMaxDepth: view.outlineMaxDepth.default` actual and
   `outlineMaxDepth: 2` expected. Also annotate the inline `globalDepths` / `nodeExclusion`
   literals with `EverySpecField<DepthSpec>` / `EverySpecField<NodeExclusionSpec>`. DONE
4. Limits baseline test: same treatment — `viewLimits` literal `satisfies EverySpecField<ViewSpec>`,
   default-only fields carry the `NO_SPEC_LIMITS` marker; `nodeCapMin: 1` became
   `nodeCap: { min: 1 }` (same assertion, new key shape); added `outlineMaxDepth` limits. DONE
5. RED proof AFTER fix: same `fakeNewKnob` probe → `npm run check` exits 2 with TS1360 naming the
   missing property at BOTH baseline literals. Revert probe. DONE
6. `npm test` (922 passed / 68 files) + `npm run check` clean. DONE

## Files touched
- `src/engine/SettingsSpec.test.ts` (only production-adjacent file changed; no src behavior change).

## Probe technique (for re-running)
```bash
python3 - <<'EOF'
p='src/engine/SettingsSpec.ts'
s=open(p).read()
s=s.replace("\treadonly outlineMaxDepth: BoundedNumberSpec;","\treadonly outlineMaxDepth: BoundedNumberSpec;\n\treadonly fakeNewKnob: DefaultSpec<number>;",1)
s=s.replace("\t\toutlineMaxDepth: { default: 2, min: 1, max: 6, step: 1 },","\t\toutlineMaxDepth: { default: 2, min: 1, max: 6, step: 1 },\n\t\tfakeNewKnob: { default: 7 },",1)
open(p,'w').write(s)
EOF
npm run check; git checkout src/engine/SettingsSpec.ts
```
Evidence files: `.tmp/red-proof-before.txt`, `.tmp/red-proof-before-check.txt`,
`.tmp/red-proof-after-check.txt`, `.tmp/impl-test.txt`, `.tmp/impl-check.txt` (untracked).

## Out of scope, untouched (as instructed)
- `linkStrengthFactor.max` baseline (`ticket-settings-baseline-tests-stale-after-spacing-change.md`).
  Confirmed NOT red on this checkout: test expects `max: 4`, spec has `max: 4`. That ticket looks
  already-resolved/stale — worth a human decision to close it, but I did not modify it.

## Next steps if resumed
None. Nothing incomplete.
