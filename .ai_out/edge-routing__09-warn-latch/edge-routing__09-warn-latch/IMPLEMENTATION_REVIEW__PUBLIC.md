# IMPLEMENTATION_REVIEW__PUBLIC — edge-routing__09-warn-latch

Ticket: `nid_eim1ftv60ybxzcucgf7rf4gk8_e`. Reviewed commit: `8745644` (diff `eb643f9..HEAD`).
Reviewer ran everything independently; nothing below is taken from the implementer's report.

## Verdict: **READY**

0 BLOCKING, 1 SHOULD-FIX (a 6-line test for an untested defensive branch — does not
gate merge on its own; call it a should-fix-before-close), 2 MINOR.

The change is small, honest, well-scoped, and does exactly what the ticket asked. The
docs now match behavior. No pre-existing test was weakened or removed. No layering,
security or resource issue.

## Real gate output (re-run by me, this tree, this commit)

```
npm run check > .tmp/review-check.log 2>&1   → CHECK_EXIT=0   (tsc -noEmit, no output)
npm test      > .tmp/review-test.log  2>&1   → TEST_EXIT=0
     Test Files  68 passed (68)
          Tests  920 passed (920)
```

No `sanity_check.sh` exists in this repo (checked).

## Per-acceptance-criterion assessment

| AC | Verdict | Evidence |
|---|---|---|
| A 2nd failure with a DIFFERENT error still produces exactly one warning | ✅ | `GraphViewController.test.ts:637-654` — two rebuilds, `Error("wasm boom")` then a contract-violation message, asserts `toHaveBeenCalledTimes(2)`. **Genuinely discriminating**: against the old boolean latch the 2nd `console.warn` is suppressed and the assertion reads 1 ≠ 2. The test also proves the 2nd rebuild really reaches the router (it passes today only because both failures fired). |
| A repeated identical failure still warns only once | ✅ | Pre-existing `":622 WHEN the router throws on repeated rebuilds THEN it warns exactly once"` is **byte-identical** to `main` (verified in the diff — the hunk's leading context is unchanged) and green. Plus new `:656` covers the harder case: equal-but-**distinct** `Error` instances → still 1 warn, i.e. dedup is by signature, not object identity. That second one is the meaningful new guard. |
| BDD test in `GraphViewController.test.ts` using `FakeEdgeRouter` | ✅ | All 4 new tests are `WHEN … THEN …`, one assertion each, reuse the existing `setup()` / `FakeEdgeRouter` / warn-spy patterns. `FakeEdgeRouter` extension (`NonErrorThrow` wrapper + `FakeRouterResponse` union) is purely additive — no existing call site changed. The wrapper is justified: a raw thrown value would be ambiguous against a route-map response. |
| `npm run check` and `npm test` green | ✅ | See above — independently re-run, both exit 0. |

Note: the implementer's PUBLIC.md lists "5 new tests"; the diff contains **4**. Harmless
miscount in the report, not in the code.

## Signature-derivation robustness (the thing I was asked to break)

`GraphViewController.routingFailureSignature` (`src/view/GraphViewController.ts:332-341`):

| Throwable | Signature | Assessment |
|---|---|---|
| `Error` / `RangeError` / `WebAssembly.RuntimeError` | `` `${name}: ${message}` `` | Correct. Distinct causes → distinct keys. |
| `undefined` / `null` | `"undefined"` / `"null"` | Fine, and covered by `:672`. |
| string, number, boolean | the value | Fine, covered by `:662`. |
| `Symbol()` | `"Symbol()"` | Fine — `String(sym)` is spec-special-cased and does **not** throw (a template literal would have). Using `String()` rather than interpolation here is the correct choice and is load-bearing. |
| `Object.create(null)` / hostile `toString` | `UNSTRINGIFIABLE_FAILURE_SIGNATURE` | Guard is real and correct (`String(Object.create(null))` genuinely throws `TypeError`). Without it the reporter would throw *out of the catch block* and fail the whole rebuild — i.e. an error handler that turns a degraded render into a broken one. **Keep it.** See SHOULD-FIX-1 for its one gap. |
| cross-realm `Error` (fails `instanceof`) | `"Error: msg"` via `String()` | Still message-distinct. No collapse. Good. |
| enormous `message` | full string retained in the `Set` | See MINOR-2. |

No crash path found. One genuine collapse case: see MINOR-1.

## The no-cap decision — my position: **agree, no cap. Do not add one.**

Asked for a stance, so here it is plainly. A cap is not just unnecessary here, it is
*actively wrong-shaped for this ticket*:

1. **It reintroduces the exact bug being fixed.** A cap means "after N distinct causes,
   silently swallow every further distinct cause" — a latch with a bigger number. The
   ticket's complaint is precisely that distinct signals get lost.
2. **The growth driver is bounded in practice.** Per EXPLORATION §2 the reachable causes
   are: wasm-init failures (fixed message set), a `RangeError` family from libavoid
   assertions (fixed set), and one contract-violation message embedding an edge id
   (`edgeRouting.ts:474-481`) which is currently unreachable from real input and which
   aborts the pass at the *first* bad edge. Reaching even tens of entries requires tens
   of rebuilds each failing on a different edge — a state in which every one of those
   warnings is a real, distinct thing the user must see.
3. **Scope is a view lifetime**, and entries are short strings. The memory is noise next
   to a single `FlowSnapshot`.

Adding a cap would buy nothing and cost a new untested suppression branch plus a doc
comment that has to admit "and after N we go back to lying". Correct call.

## Findings

### SHOULD-FIX-1 — the `UNSTRINGIFIABLE_FAILURE_SIGNATURE` branch has no test

`src/view/GraphViewController.ts:338-340` is currently unexercised by the suite. It is the
one branch whose failure mode is *catastrophic-in-context* (an uncaught throw escaping the
catch block, breaking the rebuild rather than degrading it), and it is the cheapest possible
test. Concrete addition next to the existing non-Error tests:

```ts
it("WHEN the router throws an unstringifiable value THEN the reporter still warns without throwing", async () => {
	const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
	const h = setup(new FakeEdgeRouter(new NonErrorThrow(Object.create(null))));
	h.controller.handleActiveFileChanged("c.md");
	h.source.resolveBuild(0, graphOf("c.md", "n1.md"));
	await flush();

	expect(warn).toHaveBeenCalledTimes(1);
	warn.mockRestore();
});
```

The implementer asked whether the 3 lines of paranoia are justified. **They are** — keep
the guard, test it. Untested defensive code in an error path is where silent breakage
hides, and the repo's own convention is that behavior is proven by a failing-first test.

### MINOR-1 — plain-object throwables all collapse to `"[object Object]"`

Two genuinely different `{ code: 1 }` / `{ code: 2 }` throwables share one signature, so
the second is swallowed. Not a regression (the old boolean swallowed *everything*), and no
known producer in the stack throws plain objects — Emscripten aborts surface as
`RuntimeError` or strings. Only worth acting on if a real producer appears; if so, the fix
is a `JSON.stringify` attempt before `String()`, inside the same try. Leaving it is fine.

### MINOR-2 — signature strings are unbounded in length

A pathological multi-KB `message` is retained verbatim as a `Set` key. Same 80/20 verdict
as the no-cap decision: no known producer, ignore. Mentioned only for completeness since
the brief asked about enormous messages.

## Honesty of docs vs behavior — checked, they match

- Field comment `src/view/GraphViewController.ts:103-109` now says "Signatures of the
  pass-level routing failures already warned about… deduping per signature rather than
  with a single latch" — accurate, and it states the *why* (rebuild-loop spam) as well as
  the *what*.
- `resolveRoutes()` jsdoc `:252-254`: "warn once per distinct failure" — accurate.
- Method name `warnRoutingFailureOncePerSignature` describes exactly what it does. No lie,
  no POLS violation.
- `UNSTRINGIFIABLE_FAILURE_SIGNATURE` is a named constant, not a magic string. Good.

## Conventions / architecture

- View layer only; no engine/adapter/persistence touched; no new imports. Layering clean.
- SRP: the catch block is now 3 lines with one job each — report / invalidate cache /
  return fallback. Signature derivation is a separate pure static. This is a genuine
  improvement in readability over the inline latch, not just a shuffle.
- DRY: no duplication introduced; correctly declined to build a speculative `warnOnce`
  utility for a single caller (grep confirms no second site). Agreed — promote on caller #2.
- Strict TS clean; `catch (error: unknown)` preserved; no `any`, no non-null assertions.
- No anchor points (`ap_XXX_E`) touched. No behavior-capturing test removed or weakened.
- Security: nothing user-controlled reaches a sink; the only sink is `console.warn`.

## Documentation Updates Needed

None in `CLAUDE.md` / `architecture-map.md` / `high-level-plan.md` — routing-failure
observability is not documented there and this change does not create a new cross-cutting
convention (single caller, local pattern).

Outstanding process items, correctly deferred to TOP_LEVEL_AGENT by the implementer:
close the ticket, add the `change_log` entry (matching how __07/__08 were closed).

The implementer's noted follow-up — `EdgeRouter.route()` having no typed error channel,
which is *why* the dedup key must be scraped from a string — is a legitimate, non-trivial
seam change and belongs in `docs-internal/tickets/`, not in this diff. Endorsed as a
follow-up ticket.
