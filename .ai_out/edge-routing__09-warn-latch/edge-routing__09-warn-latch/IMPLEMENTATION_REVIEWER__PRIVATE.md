# IMPLEMENTATION_REVIEWER__PRIVATE — edge-routing__09-warn-latch

## State: COMPLETE — CONVERGED (iteration 1 confirmation done)

Verdict issued: **READY**. 0 BLOCKING, 1 SHOULD-FIX, 2 MINOR. PUBLIC review written and
committed. `src/` untouched by me (read-only, honoured).

## What I actually verified myself (do not re-litigate)

- Ran `npm run check` → exit 0, `npm test` → exit 0, **68 files / 920 tests passed**.
  Logs at `.tmp/review-check.log`, `.tmp/review-test.log`. Matches implementer's report;
  their numbers were truthful. No `sanity_check.sh` in this repo.
- Read the full `git diff eb643f9..HEAD`. Source changes are confined to
  `src/view/GraphViewController.ts` and `src/view/GraphViewController.test.ts`.
- Confirmed the pre-existing test `"WHEN the router throws on repeated rebuilds THEN it
  warns exactly once"` (old `:609`, now `:622`) is **unmodified** — it appears only as
  unchanged diff context, and I read it in the live file. The Explore agent's claim that
  it "would need to change" was wrong; the implementer was right to challenge it.
- Counted the new tests: **4**, not the 5 the implementer's PUBLIC.md claims. Flagged as a
  report miscount only; code is fine.
- Reasoned (did not build a worktree) that the "DIFFERENT error" test discriminates against
  the old boolean latch: old code warns once → `toHaveBeenCalledTimes(2)` fails with 1.
  Certain enough that a scratch worktree was unnecessary.

## Robustness analysis I performed on `routingFailureSignature`

Enumerated throwables: Error subclasses, cross-realm Error, string/number/boolean,
`undefined`, `null`, `Symbol()`, `Object.create(null)`, hostile `toString`, huge message,
plain object. Only two soft spots found:
- plain objects all collapse to `"[object Object]"` (MINOR-1, not a regression);
- unbounded signature string length (MINOR-2).
Key nuance worth remembering: `String(symbol)` does **not** throw (spec special case),
unlike a template literal — so the implementer's use of `String()` over interpolation is
load-bearing and correct. The try/catch is genuinely needed for `Object.create(null)`.

## Positions I took (stand ground if challenged)

- **No cap on the signature Set: agreed, do NOT add one.** A cap is a latch with a bigger
  number — it silently swallows distinct causes past N, which is the exact bug the ticket
  fixes. Growth drivers are bounded in practice (EXPLORATION §2); scope is a view lifetime.
  Adding a cap costs an untested suppression branch and forces the doc comment to admit it
  lies again. This is my firmest position in the review.
- **Keep the `try { String(error) } catch` paranoia**, but test it (SHOULD-FIX-1). Without
  it, a throw escapes the catch block and turns a degraded render into a broken rebuild.
  Concrete 8-line test with `new NonErrorThrow(Object.create(null))` is spelled out in
  PUBLIC.md and can be pasted as-is.
- **No shared `warnOnce` utility**: agreed with implementer, single caller, YAGNI.

## If a second iteration is requested

Only SHOULD-FIX-1 is outstanding (the unstringifiable-branch test). If the implementer
adds it, re-run `npm test` and flip to READY with 0 open findings. Do not accept a cap
being added in response to this review — that would be a regression of intent; push back.
Nothing else in the diff needs re-review.

## Iteration 1 confirmation (commit `f680a7d`)

- **Converged. 0 open findings.** Do not reopen.
- Ran the mutation MYSELF in `.worktree/mut-check` (bare `return String(error);`):
  exactly the 2 new tests failed, 46 passed. The tests are discriminating, not incidental.
  Worktree removed, tree clean.
- Verified via `--stat` that this iteration touched ONLY the test file + md. Production
  `GraphViewController.ts` untouched since `8745644`.
- Re-ran gates: check exit 0, test exit 0, 68 files / **922** tests (920 → 922, +2).
- Accepted both MINOR rejections. One nuance I noted but did not press: the implementer's
  cycle-throw argument against `JSON.stringify` is wrong (the existing try would catch it);
  the conclusion (speculative, no producer) still stands, so it changes nothing.
- No cap was sneaked in — my firmest position held.
- Only process items remain, all TOP_LEVEL_AGENT's: ticket close, `change_log` entry,
  typed-error-channel follow-up ticket.
