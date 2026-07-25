# EXPLORATION_PUBLIC — edge-routing__06 (index)

Exploration was split by concern. Read the file that matches your phase; do not re-explore.

| File | Read it when you are working on |
|------|--------------------------------|
| `EXPLORATION_PUBLIC__routing.md` | item (a) `setExclusive(false)`, the libavoid loader type narrowing, the real-wasm test recipe, the `.tmp/probe*.mjs` measurement harness, and how a per-call buffer would flow into `LibavoidEdgeRouter` |
| `EXPLORATION_PUBLIC__e2e.md` | step 0 (repair `e2e/edgeRoutingEval.e2e.ts` + print detour ratios), running e2e headless here, and mechanics of the buffer sweep |
| `EXPLORATION_PUBLIC__settings.md` | item (b) end-to-end settings plumbing (spec → constants → persistence → tab → README) and which tests each touchpoint breaks |

Human decisions already taken: `CLARIFICATION__PUBLIC.md`.

## Cross-cutting facts every phase needs

- **Never** push a `ShapeConnectionPin` into `AvoidArena.owned` and never `destroy()` it — the Router owns and frees pins; freeing one ourselves double-frees and aborts wasm (`src/view/edgeRouting.ts:288-298`).
- The measured root cause of wrap-around routes is **visibility blocking** by the 17px `shapeBufferDistance`, not pin cost. Pin costs are a closed negative result (`edge-routing__05`) — do not retry them.
- `routingSignature` (`src/view/GraphViewController.ts:362-370`) hashes only obstacles+edges. Any dynamic routing parameter must enter it or cached routes will be served.
- "Non-facing attachment count" is produced ONLY by the untracked `.tmp/probe*.mjs` node probes (`node .tmp/probe11-reviewer.mjs`), not by e2e. e2e gives routing/layout ms, detour ratios and screenshots.
- Baselines of record (edge-routing__04): sparse 2.9ms routing / 34.4ms layout; medium 9.4 / 35.6, maxDetour 1.000; dense 137.2 / 1463.6, maxDetour 3.096, meanDetour 1.161.
- Known pre-existing RED test on clean `main`: `src/engine/SettingsSpec.test.ts` (`linkStrengthFactor.max`). Being fixed in its own commit per `CLARIFICATION__PUBLIC.md` D2.
