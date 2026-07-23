# IMPLEMENTATION_REVIEWER — PRIVATE (rehydration memory)

Ticket: `_tickets/collapsed-group-arrows-must-terminate-at-the-group-boundary-clip-routed-edges-to-endpoint-rects.md`
Branch `collapsed-group-arrows-boundary-clip`, HEAD `1a48aa9`.

## Verdict: APPROVE-WITH-MINOR. 0 BLOCKING, 0 MAJOR.

## What I verified
- `npm test` → 657 pass / 54 files. `npm run check` (tsc) → clean. Both green at review time.
- Clip math (`src/view/edgeGeometry.ts:171-284`) is correct:
  - `isStrictlyInsideRect` uses strict `<`/`>` → border points kept (already-boundary terminus untouched).
  - `clipTrailingInsideRect` walks from end, finds `lastOutside`; `-1` (all inside) → null → chord fallback; terminus already outside → unchanged copy; else Liang–Barsky crossing of the outside→inside segment.
  - `segmentRectEntryPoint` = textbook Liang–Barsky. p=[-dx,dx,-dy,dy], q=[x0-xmin,xmax-x0,y0-ymin,ymax-y0]. from-outside/to-inside ⇒ enter∈(0,1]; parallel-and-outside → null; enter>leave → null. No NaN path.
  - Source mirror via reverse→clip→reverse; reversed array is a fresh `.map` copy so in-place `.reverse()` is safe. `chordFallback` uses first/last ORIGINAL points.
  - Hand-verified corner test (100,-100)->(250,50) into [200..300]x[0..100] → enter=0.667 → (200,0). Matches test.
- Wiring (`GraphViewController.ts:274-280`, `clipRoutesToObstacles` 373-403): clips right after `route()`, before cache write; cache stores CLIPPED map so reuse-layout (line 257-259) serves clipped. Missing obstacle → route left unclipped (no drop/crash). `obstacleById` built from `input.obstacles` which includes folder-group rects (`edgeRouting.ts:122-127`, id==node.id) → folder-group endpoints resolve to the GROUP rect correctly.
- Arrowhead inset §2: no constant change is correct. Clipped terminus on boundary; `arrowFromApproach` insets tip 14–48px BACK along approach = tip sits just OUTSIDE boundary pointing in — SAME as existing straight `edgePathFor` behavior (RF handle coords are on boundary, tip inset into the gap). So routed now CONSISTENT with straight; the "notes head moved from ~inside to ~outside" callout is honest and an improvement, not a regression.

## Findings
- MINOR-1: No automated test exercises the actual GROUP-rect clip. Controller test (`GraphViewController.test.ts:465`) covers note→note (100px squares) only; the folder-group→groupDimensions obstacle path is covered only by generic wiring + pure-math unit tests (arbitrary rects) + downgraded e2e screenshot. Ticket §4 explicitly asked for group-rect coverage. Low risk (wiring is rect-agnostic, group-obstacle extraction tested in edgeRouting), but the headline bug scenario has no direct regression gate.
- MINOR-2 (NIT): `isStrictlyInside` duplicated in edgeGeometry.test.ts vs production `isStrictlyInsideRect` and edgeRouting.test.ts. Test-local, acceptable.
- E2E downgrade: ticket §4 explicitly permits; documented in PUBLIC CALLOUT 2. Acceptable.

## Acceptance criteria: all met except group-case direct test (MINOR-1). Spec §5 bullet added and accurate.
