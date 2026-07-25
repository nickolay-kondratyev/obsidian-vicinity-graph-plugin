# EXPLORATION_PUBLIC — edge-routing__09-warn-latch

Ticket: `nid_eim1ftv60ybxzcucgf7rf4gk8_e`. Produced by a read-only Explore agent
(no Write tool), persisted here by TOP_LEVEL_AGENT. Line numbers are from the
tree at branch point `main @ e2bcaf2` — **re-verify before editing**.

## 1. The latch — every occurrence

`grep -rn "routingFailureWarned" src` yields exactly three hits, all in
`src/view/GraphViewController.ts`:

- **:100-101** declaration + its intent comment:
  ```ts
  /** The pass-level routing failure is logged at most once per controller — no per-rebuild spam. */
  private routingFailureWarned = false;
  ```
- **:301** read — `if (!this.routingFailureWarned) {`
- **:302** write — `this.routingFailureWarned = true;`

**There is no reset.** Once true it stays true for the controller's whole
lifetime. Note `this.routeCache = null` on failure (:305) — the *cache* already
self-heals per pass; only the *warning* does not.

`resolveRoutes()` spans **:239-308** (doc :239-246, signature :247-253, `try`
opens :265, `catch (error: unknown)` at :300). Relevant tail:

```ts
} catch (error: unknown) {
    if (!this.routingFailureWarned) {
        this.routingFailureWarned = true;
        console.warn("vicinity-graph: edge routing failed; rendering straight edges", error);
    }
    this.routeCache = null;
    return EMPTY_ROUTES;
}
```

The doc comment at :244-245 ("warn ONCE") and the field comment at :100 both
assert the old contract — **both must be updated by the fix.**

Values already in scope at the catch and usable as dedup material: `error`,
`signature` (computed :261), `token` (param).

## 2. What can reach that catch

`EdgeRouter` (`src/view/edgeRouting.ts:63-66`) is `route(input): Promise<EdgeRouteMap>` —
**no typed error channel**, so the catch sees `unknown`. Production impl is
`LibavoidEdgeRouter` (`edgeRouting.ts:451-497`). Structurally distinct causes:

1. **wasm-init failure** — `loadAvoid()` (`src/view/libavoidLoader.ts:128-156`),
   `AvoidLib.load(WASM_DATA_URL)` at :152. Critically, `libavoidLoader.ts:136-140`
   **clears the cache on failure**, so init is explicitly retryable and a *later,
   different* init error is anticipated by design. This is the sharpest argument
   that the boolean latch is wrong.
2. **Contract violation** — explicit `throw new Error(\`edge ${edge.id} references an
   obstacle with no registered shape\`)` at `edgeRouting.ts:474-481`. Currently
   unreachable from real input (extraction is total) but exercised by tests.
3. **Native wasm abort surfacing as JS error** — e.g. `RangeError` from libavoid
   assertions (`visGraph.size() == 0`, `ang >= 0`).
4. **Non-finite geometry** — now filtered upstream by `hasFiniteGeometry()`
   (`edgeRouting.ts:187-194`, wired at :154) per ticket __08.
5. **Teardown flush throw** — `AvoidArena.dispose()`'s unconditional
   `processTransaction()` (`edgeRouting.ts:419`, added by ticket __07).

So: at least three structurally different causes, each currently collapsed into
one lifetime-scoped warning.

## 3. Test file — `src/view/GraphViewController.test.ts` (774 lines)

- **`FakeEdgeRouter`** at **:110-132**: `constructor(private response: EdgeRouteMap | Error = new Map())`,
  has **`setResponse(response)`** — so one instance can throw error A, then error B
  on a later rebuild. Also tracks `callCount` / `lastInput`. No new test
  infrastructure is needed.
- **`setup(router = new FakeEdgeRouter())`** at **:149-164** builds the controller
  with `FakeGraphSource` / `FakeLayout` / `FakeNavigator`, exposes `snapshot()`.
- **warn-spy pattern** (used verbatim in both existing warn tests, local to each
  `it`, no shared hook):
  ```ts
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  ...
  warn.mockRestore();
  ```
- **Existing routing-failure tests** live in `describe("GraphViewController edge-routing pass", ...)`
  at **:504-690**:
  - **:598-607** — `"WHEN the router throws THEN edges publish without routedPoints (straight-edge fallback)"`
  - **:609-622** — `"WHEN the router throws on repeated rebuilds THEN it warns exactly once"`.
    Drives a second rebuild via `h.controller.handleActiveFileChanged("d.md")` +
    `h.source.resolveBuild(1, ...)`, then asserts `expect(warn).toHaveBeenCalledTimes(1)`.

  ⚠ The Explore agent asserted this test "will need to change". **Challenge that.**
  It throws the *same* `Error` instance both times, so under a signature-keyed
  latch (name + message) it should still warn exactly once — i.e. it is precisely
  the "repeated identical failure" acceptance criterion and should stay green
  **unchanged**. Verify by running it; only change it if it genuinely fails, and
  say so explicitly if you do.
- **BDD convention**: every title is `"WHEN <condition> THEN <outcome>"`;
  `describe` blocks are `"GraphViewController <topic>"`.

## 4. No existing dedup utility

`grep` over non-test `src/` finds no `warnOnce` / `Logger` / `logging.ts`. All
other logging is unconditional: `CanvasFallbackParser.ts:22`, `main.ts:161`
(`console.error`); `GraphViewController.ts:205`, `:214`, `:288` (`console.debug`).
The `routingFailureWarned` boolean is the **only** latched log in `src/`. A fix
introduces a new (small) pattern rather than reusing one — keep it local and
minimal unless there's a clear second caller.

## 5. Docs

- `docs-internal/tickets/` uses `ticket-<slug>.md` naming and has **no**
  edge-routing__NN entries; those workflows live under `.ai_out/edge-routing__07-wasm-abort/`
  and `.ai_out/edge-routing__08-nonfinite-geometry/` (both fixes already merged
  and present in the current tree).
- `architecture-map.md` / `high-level-plan.md` say nothing about routing-failure
  **observability** — no constraint on this fix beyond the ticket's own design note.

## Implications for the fix

- Ticket's preferred design: latch **per distinct failure signature** (error name +
  message) instead of a single boolean, so a NEW kind of failure still warns once
  and a repeat stays silent.
- Non-`Error` throwables must be handled (catch is `unknown`) — derive a
  signature defensively, don't assume `.name`/`.message` exist.
- Unbounded signature growth is a theoretical concern; a hostile/varying message
  (e.g. one embedding an edge id) could accumulate entries. Weigh a simple cap
  against the 80/20 — call out whichever way you go.
- Update the stale "warn ONCE" wording at `GraphViewController.ts:100` and :244-245.
