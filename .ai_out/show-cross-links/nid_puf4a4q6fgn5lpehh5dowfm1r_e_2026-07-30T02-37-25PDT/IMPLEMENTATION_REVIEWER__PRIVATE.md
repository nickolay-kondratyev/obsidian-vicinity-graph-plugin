# IMPLEMENTATION_REVIEWER — private memory (ticket `nid_puf4a4q6fgn5lpehh5dowfm1r_e`)

Review completed 2026-07-30. Public output:
`IMPLEMENTATION_REVIEW__PUBLIC.md` in this same FEATURE_DIR.
Verdict: **APPROVE WITH CHANGES** — 0 blocking, 2 should-fix, 3 nice-to-have.

## Environment facts (save time on rehydrate)

- Repo has **no `sanity_check.sh`**. Gates are `npm test` and `npm run check` only.
- Verified myself, both green: `npm test` = 97 files / **1304 tests**, all pass;
  `npm run check` = `tsc -noEmit` for `src/` then `e2e/`, clean. Logs at
  `.tmp/rev-test.log` and `.tmp/rev-check.log`. Implementer's claimed numbers were exact.
- Every bash call is wrapped by a noisy env preamble — ignore the first ~20 lines of output.
- `styles.css` and `main.js` are **gitignored** (`.gitignore:5,9`) — a commit that changes
  `src/view/*.css` without regenerating `styles.css` is NOT a finding.
- Whole change is one commit: `c388a7c`, 35 files.

## What I actually traced (so a clone need not redo it)

Correctness chain: `VicinityEngine.build` → `VicinityTraversal.traverse` →
`NodeSizer` → `GraphTruncator.truncate` → **new** `VicinityEngine.visibleEdges()` (the ONE
toggle branch, `src/engine/VicinityEngine.ts:103`) → `EdgeCounts.attach`.

- Sweep runs post-truncation and post-sizing ⇒ node selection is untouched **structurally**,
  not just by test. `NodeSizer` reads the provider directly, never the edge list. So the
  ticket's headline requirement is safe by construction.
- Attachments can't leak in: `visiblePaths` only ever contains node-bearing paths
  (`NodeEligibility` gate in `VicinityTraversal.bfs`).
- Excluded neighbours can't leak in: exclusion rejects before a node is ever collected,
  so excluded paths are absent from `visiblePaths`. (Untested though — finding 2b.)
- Self-links: traversal already records `a→a` when a note links itself, so the sweep
  emitting one is consistent with today. **Not a finding.**
- `EdgeAccumulator` dedupes on `source\0target`, first-insertion order. Count-free.

## The one real finding, in full (finding 1)

**ON is not guaranteed ⊇ OFF.** The sweep REPLACES the walked set and reads
`provider.getOutgoingLinks` (`CrossLinkSweep.ts:36`), while walked edges from the `incoming`
channel came from `provider.getIncomingLinks` (`VicinityTraversal.ts:163`). In
`ObsidianLinkProvider` these are **two independent authorities**:

- `getIncomingLinks` (`ObsidianLinkProvider.ts:133`) = `getBacklinksForFile` (or a
  `resolvedLinks` inversion fallback) **merged with parsed canvas incoming**.
- `getOutgoingLinks` (`:129`) = `getFileCache` ordering + `getFirstLinkpathDest`
  resolution, with a **documented boot-window degradation** at `:277-297` when the file is
  not yet cached.

So they can disagree, and when they do, flipping the toggle ON *removes* an edge — the
opposite of the contract stated in the commit message, the class doc, `high-level-plan.md`
and the README. The class doc asserts the invariant ("every real link is some source's
outgoing link") but it is an assumption about an ADAPTER written in the PURE ENGINE, i.e.
unverifiable from where it lives.

Remedy I gave: add `walkedVisibleEdges` to `CrossLinkSweepInput`, seed the accumulator with
it before sweeping ⇒ `walked ∪ induced`, dedupe already free, ordering becomes walked-first.
Plus a `linkDepthIn: 1` engine test.

If the implementer pushes back with "the interface contract says they're symmetric" — the
contract is aspirational, the boot-window comment in the adapter proves the two paths can
disagree in practice, and the union costs ~6 lines. Hold the line at SHOULD-FIX (not
blocking: the failure window is transient and self-heals on the next metadataCache event).

## Finding 2 detail (test gap) — where the weak tests are

- `src/engine/VicinityEngine.test.ts:224-227` "node set identical to OFF" is on a 3-node
  fixture with **no cap reached** ⇒ cannot fail. Needs a truncating `nodeCap`.
- All ON tests use `linkDepthIn: 0` ⇒ incoming channel never exercised.
- Exclusion + sweep never combined.
- `src/engine/CrossLinkSweep.test.ts:59-62` determinism test is **vacuous**: both sides call
  the same helper which rebuilds inputs AND `.sort()`s the output.

## UX call on the new "Edges" section — I endorsed keeping it

Sections now: `depth-defaults, edges, node-sizing, node-contents, force-layout, exclusion,
performance` (`settingsSectionFields.ts:24-30`). Panel renders every section generically
(`GraphToolbar.tsx:46`), so both surfaces got it free. One-row sections are precedented
(`performance`). Depth/Node-contents headings would both misname a between-nodes setting.
Watch item only: 7 sections with 2 one-row cards is near the fragmentation edge.

## Compliance items I confirmed clean (don't re-audit)

Engine purity; single multiplicity authority (`EdgeCounts`); one write pipeline with `void`
+ no call-site try/catch in `addToggleRow`; no hand-typed labels/orders/names in presenters;
defaults literal only in `settingsProductDefaults.test.ts`; branded types; no migration (correct
pre-release clean break); boolean parse refuses truthiness coercion; no anchor point or
behavior-capturing test removed (the `walkedVisibleEdges` → `visibleEdges` edits in
`EdgeCounts.test.ts` are a param rename, assertions intact); `ToggleRow` extraction is a real
DRY win done as a clean break; ticket closed with an accurate deviation note.

## If asked to re-review after fixes

Re-run both gates, then check exactly: (a) `CrossLinkSweepInput` seeds walked edges and the
class doc now states the superset as a FACT; (b) the three new engine tests exist and are
non-vacuous (make the cap actually truncate); (c) nothing else in the commit moved.
