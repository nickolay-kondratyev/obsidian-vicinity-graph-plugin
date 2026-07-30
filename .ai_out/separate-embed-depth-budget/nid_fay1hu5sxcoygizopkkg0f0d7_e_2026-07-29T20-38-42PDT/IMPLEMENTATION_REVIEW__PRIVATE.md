# IMPLEMENTATION_REVIEWER — private rehydration memory (Stage 1)

Round 1 complete, review written to `IMPLEMENTATION_REVIEW__PUBLIC.md`.

## State
- Diff base: `e387f5a` (merge commit). Branch commits: `d48d914`, `5022a72`, `5c13f8f`, `05658ea`.
- Ran myself: `npm test` 1199/1199 pass; `npm run check` exit 0. Logs `.tmp/rev_test.log`, `.tmp/rev_check.log`.
- No `sanity_check.sh` exists. `npm run check` = tsc only, NO linter/formatter (so formatting nits are uncaught).

## Verdict issued: YES (ready for Stage 3). 0 BLOCKING, 4 SHOULD-FIX.

S1 canvas `getLinkCount` source switched core→our parse for core-indexed canvases (ObsidianLinkProvider.ts:135-152 → EdgeCounts.ts:32 badge); undisclosed; only trivially-agreeing count test exists (test:181). Ask: disclose + one multiplicity test.
S2 ReferenceOrder.test "provenance agrees with Reference.original" is circular (fixture routed BY the `!` rule, asserted against the `!` rule; `original` never reaches production). Ask: delete or de-overclaim the doc comment.
S3 stale docs: high-level-plan "Canvas support" two bullets (adaptive design correct either way / fixtures exercise detection); main.ts:215-231 doc + `fallbackOnly` local.
S4 uncached-markdown degrades to kind "link" → Stage 3 trap (embedDepthOut=0 leaks during boot window). Ask: record as Stage 3 acceptance item.

NITs: stray blank line ObsidianLinkProvider.ts:407-408; stale "fallback regime" comment :330; ":275 canvases never land here" slight overclaim (canvas created post-build); `LINK_KINDS` used only by own test; `create()` no try/catch around per-canvas `cachedRead`, exposure widened by 3a.

## Verified independently (don't redo)
- `getLinkCount` engine callers = `EdgeCounts.attach` only; `VicinityTraversal` never counts ⇒ deviation (b) safe for Stage 3.
- `getOutgoingLinks` consumers unchanged: `NodeSizer.ts:140`, `VicinityTraversal.ts:138`.
- CanvasCapability grep across src/ e2e/ docs-internal/: only historical refs + explicit "Superseded" note ⇒ genuinely dead.
- The 4 retitled canvas parity suites: assertions unchanged (diff-checked). Only one case inverted, disclosed.
- `CanvasParseCache` is long-lived (owned by main.ts:44), mtime-keyed ⇒ always-parse cost is bounded.
- Ticket confirms 3a + incoming scope cut are OWNER-SETTLED; do not re-litigate.
- FakeLinkProvider "links then embeds" order divergence is harmless for kind-pure channels.

## If asked for round 2
Check only: S1 disclosure + multiplicity test; S2 resolution; S3 doc edits; S4 ticket line. Everything else was accepted.
