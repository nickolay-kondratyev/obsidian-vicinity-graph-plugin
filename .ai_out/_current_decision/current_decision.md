# Decision: edge-routing wrong-side wrap ticket (nid_izwyr4brgokbnw6equmyfe5xv_e)

## TL;DR
The ticket's acceptance test passes now — but for a reason the ticket didn't
anticipate, and the routing defect it's named after is **still unfixed**. I need
you to pick how to close it. I've set it to `punted` and folded it into the parked
research doc; that's reversible.

## What I did (safe, suite green)
- Stripped `facing-near*` fixture bodies back to one line in
  `scripts/setup-dev-vault.sh`, rebuilt `.dev-vault`.
- `e2e/edgeRouting.e2e.ts` "crowded from one side" **passes** (terminals=12, zero
  wrong-side), plus `npm run check` and the `edgeRouting.test.ts` unit suite green.
- Removed the now-redundant heading padding; corrected the fixture comment.
- Added a "concrete instance folded in" section to
  `docs-internal/research/facing-side-edge-attachment.md`.

## The catch (why this is a judgment call, not a clean win)
1. **The acceptance premise is stale.** A one-line note no longer renders at
   ~40px. Sizing refinement `b191c1d` (floor/fit against the node's own chrome),
   landed *after* this ticket was filed, floors a title-only note to **~89x34** —
   basically the ~93px the artificial padding used to force. So stripping the
   padding keeps the guard at its tuned crowd geometry and it stays green **with
   no routing change**. The test does NOT run at 40px.
2. **The underlying wrap is still real at genuinely tiny (~40px) nodes.** A
   real-wasm probe (one-sided 40px-square crowd above a 200×240 group box, shipped
   clearance 11) reproduced a right-border terminal on a node whose centre is
   above the box.
3. **Cost tweaks can't fix it** — already measured (research §1: 0/818 moved at
   cost 100 000). The only known robust fix is the **parked two-pass per-side-class
   design** (research §2), gated behind revisit triggers and flagged as needing
   full re-measurement before anyone builds it. Building it now is a large,
   uncertain-ROI effort — not an 80/20 move, and against the documented park.

## Pick one
- **A (recommended): keep `punted`.** Acceptance is met, padding removed, deeper
  wrap folded into the parked research with a clear reopen trigger ("~40px wrap
  becomes a real user-facing complaint"). No new routing risk.
- **B: `closed`.** Same as A but call it done — treat the sizing-floor change as
  having resolved the reproducible case. (I avoided this unilaterally because the
  title's defect isn't fixed.)
- **C: invest now in the two-pass fix.** I'd first re-run the research sweep in
  the shipped config (clearance 11, `setExclusive(false)`, total facing rule),
  build two routers + per-side pin classes + keep-the-better (≤1.30×), and add a
  grouped-dense perf fixture. Multi-session; needs your go-ahead.

Reply with A / B / C (or adjust).
