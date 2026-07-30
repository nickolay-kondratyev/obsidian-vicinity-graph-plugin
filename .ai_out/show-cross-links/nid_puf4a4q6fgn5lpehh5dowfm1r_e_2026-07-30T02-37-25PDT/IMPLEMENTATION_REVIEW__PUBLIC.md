# IMPLEMENTATION REVIEW — "Show cross links" (ticket `nid_puf4a4q6fgn5lpehh5dowfm1r_e`)

Commit reviewed: `c388a7c` (single commit, 35 files).
Reviewer: IMPLEMENTATION_REVIEWER, read-only.

## Verdict

**APPROVE WITH CHANGES.** No blocking defects. The feature is correct on the happy path,
lands cleanly on the declared-row / one-accessor / one-write-pipeline model, and does not
weaken or delete any behavior-capturing test. Two items should be fixed before this is
treated as done: one real cross-layer correctness assumption that is neither guaranteed nor
tested, and a test gap around the interactions (incoming channel, exclusion, node cap) the
sweep actually touches.

## Verified test results (run by me, not taken from the report)

| Command | Result |
|---|---|
| `npm test` | **PASS** — 97 files, 1304 tests, 0 failures (`.tmp/rev-test.log`) |
| `npm run check` | **PASS** — `tsc -noEmit` clean for `src/` and `e2e/` (`.tmp/rev-check.log`) |
| `./sanity_check.sh` | **not present** in this repo — nothing to run |

`npm run test:e2e` was not run (release gate, real Obsidian; out of scope here). The
implementer's claimed numbers match mine exactly.

## Summary of what changed

- New pure engine class `src/engine/CrossLinkSweep.ts`: iterates the post-truncation
  `visiblePaths`, emits every outgoing link whose target is also visible, deduped through
  the existing `EdgeAccumulator`, count-free.
- `VicinityEngine.visibleEdges()` (`src/engine/VicinityEngine.ts:103`) is the ONE branch:
  walked set, or the sweep. It runs after truncation and after sizing, so node selection is
  untouched by construction.
- `EdgeCounts` input renamed `walkedVisibleEdges` → `visibleEdges`; it remains the sole
  multiplicity authority (`provider.getLinkCount` + `Math.max(1, …)` floor). The doc comment
  the ticket named explicitly (`src/engine/EdgeCounts.ts`) now describes the toggle. ✅
- Settings: `SETTINGS_SPEC.globalView.showCrossLinks` (default `false`), one control kind
  `show-cross-links`, one accessor, one interaction, one row in a new `edges` section →
  picked up by BOTH presenters by construction. Defaults literal lives only in
  `settingsProductDefaults.test.ts`. ✅
- Persistence: boolean-typed parse, non-boolean ⇒ absent ⇒ spec default. No migration
  (correct per the pre-release clean-break rule). ✅
- `ToggleRow` extracted in `SettingsRowView.tsx` and the exclusion toggle re-pointed at it —
  a genuine DRY win, done as a clean break (CSS class renamed, no alias). ✅

Ticket-listed acceptance items all present: ON renders the frontier link, OFF does not,
node set identical, `count: N` on a cross-linked parallel pair, `EdgeCounts.ts` doc updated,
both presenters. The dropped "full cascade" item is the sanctioned deviation and is
implemented correctly as a plain global — no residual per-doc plumbing was introduced.

## 🚨 BLOCKING

None.

## ⚠️ SHOULD-FIX

### 1. ON is not *guaranteed* to be a superset of OFF — the toggle can silently DROP an edge

`src/engine/CrossLinkSweep.ts:33-41` — the sweep *replaces* the walked set rather than
extending it, and does so by reading a **different provider method** than the one that
produced part of the walked set:

- walked edges from the incoming channel come from `provider.getIncomingLinks`
  (`src/engine/VicinityTraversal.ts:163`);
- the sweep reads `provider.getOutgoingLinks` (`src/engine/CrossLinkSweep.ts:36`).

In `ObsidianLinkProvider` those are two independent authorities, not two views of one
answer: `getIncomingLinks` (`src/adapters/ObsidianLinkProvider.ts:133`) is
`getBacklinksForFile` (or a `resolvedLinks` inversion) merged with parsed canvas incoming,
while `getOutgoingLinks` (`:129`) goes through `getFileCache` + `getFirstLinkpathDest`, with
a documented boot-window degradation when the file is not yet cached
(`src/adapters/ObsidianLinkProvider.ts:277-297`). Any disagreement — most plausibly during
the metadata-cache boot window, exactly the window that code block already calls out as
user-visible — means turning "Show cross links" ON makes an edge the user could see with it
OFF *disappear*. That contradicts the contract stated in the commit message, in
`CrossLinkSweep`'s doc, in `high-level-plan.md` and in the README ("only widens edges").

The class doc asserts the invariant ("Outgoing links alone are sufficient: every real link
is some source's outgoing link") but nothing enforces it, and it is an assumption about an
*adapter* made in the *pure engine* — the layering makes it unverifiable from where it is
written.

**Remedy (cheap, makes it true by construction):** seed the accumulator with the walked set
before sweeping, so ON is literally `walked ∪ induced`.

```ts
export interface CrossLinkSweepInput {
	readonly walkedVisibleEdges: readonly DirectedLink[]; // ON must never LOSE an edge
	readonly visiblePaths: ReadonlySet<VaultPath>;
	readonly provider: LinkProvider;
}
// …
const accumulator = new EdgeAccumulator();
for (const walked of input.walkedVisibleEdges) accumulator.add(walked.source, walked.target);
// …then the sweep, unchanged — EdgeAccumulator already dedupes.
```

`EdgeCounts` is unaffected (still one count path), ordering becomes walked-first (more
stable across a toggle, a small bonus for `GraphStructureDiff`), and the doc comment can
then state the superset as a fact rather than an assumption. Pair it with the test in
finding 2.

### 2. Test gap: the sweep is never exercised against the things it actually interacts with

Every ON test runs on one 3-node fixture with `linkDepthIn: 0`, no exclusion patterns and no
node cap (`src/engine/VicinityEngine.test.ts:169-183`, `:202-227`). Three real interactions
are untested:

- **incoming channel** — `linkDepthIn > 0` is precisely the case finding 1 is about; no test
  proves a backlink-discovered edge survives the toggle.
- **exclusion** — an excluded neighbour is safe only because it never enters `visiblePaths`;
  a test should pin that, since exclusion is a user-visible privacy-ish guarantee and the
  sweep is a new path that could re-admit it.
- **node cap** — the "visible node set is identical to OFF" test
  (`src/engine/VicinityEngine.test.ts:224-227`) cannot fail as written: 3 nodes, cap not
  reached, so both sides are trivially the whole vault. Under a cap that actually truncates,
  it would become a real tripwire for the ticket's headline requirement.

**Remedy:** three cases in `VicinityEngine.test.ts` — (a) `linkDepthIn: 1` + ON ⇒ the walked
incoming edge is still present; (b) ON + an exclusion pattern matching a linked note ⇒ no
edge to it; (c) ON + `nodeCap` small enough to truncate ⇒ node set equals OFF.

## 💡 NICE-TO-HAVE

### 3. `src/engine/CrossLinkSweep.test.ts:59-62` — the determinism test is vacuous

```ts
it("WHEN the sweep runs twice over the same input THEN the pair lists are identical (determinism)", () => {
	expect(sweptPairs()).toEqual(sweptPairs());
});
```

`sweptPairs()` rebuilds the provider and the `Set` each call **and `.sort()`s the result**,
so no ordering or determinism regression can make it red. Either delete it, or make it earn
its place: build `visiblePaths` in two different insertion orders and assert the *unsorted*
output order is the `visiblePaths` order (that is the property `EdgeAccumulator` exists to
provide, and it is what a rendering diff depends on).

### 4. Kind-blindness of the sweep vs `embedDepthOut` is an unstated interaction

`getOutgoingLinks` is kind-blind, so with `embedDepthOut: 0` the graph draws **no** embed
edges when the toggle is OFF but **does** draw embed edges between visible notes when it is
ON. I think that is the right answer (it matches the kind-blind `getLinkCount` and the
setting's "every link between two visible nodes" wording), but a future reader will read it
as a bug. One WHY sentence in `CrossLinkSweep`'s doc block settles it permanently.

### 5. Cost of the sweep deserves a WHY note

ON adds up to `nodeCap` extra `getOutgoingReferences` calls per rebuild — on frontier nodes
the walk deliberately never expanded — each a `getFileCache` plus one `getFirstLinkpathDest`
per reference. At the shipped cap of 100 this is negligible, but "Performance" is a shipped
settings section and rebuilds fire on every active-leaf change; a one-line note in
`CrossLinkSweep` recording that the cost is bounded by `nodeCap` (not by vault size) keeps a
future cap increase honest.

## The new "Edges" settings section — judgement requested

**Keep it.** It is the right call, for three reasons:

1. It is the only setting about what is drawn *between* nodes. Filing it under
   *Depth (all notes)* would make the section heading lie (depth is about reach, this is
   about which reached links are drawn), and *Node contents* would lie harder.
2. A one-row section is already precedented (*Performance*), and both presenters render
   sections generically, so it cost nothing structurally.
3. It is the natural home for the edge settings that plausibly follow (arrowheads, count
   badges, routing), so the heading is not a dead end.

The placement (directly after *Depth (all notes)*, `src/view/settingsSectionFields.ts:24-30`)
is right — a user scanning "how much do I see" hits reach then density in that order. The
section reset scope, its copy, and the tab-wide enumeration were all updated consistently,
and the reset description correctly declines to restate the default literal.

One watch item, not a finding: seven sections with two single-row cards is at the edge of
where a settings tab starts to feel fragmented. If *Edges* is still one row in six months,
revisit — but adding the row somewhere dishonest today to avoid that is the worse trade.

## Things I checked and found clean

- Engine purity: no `obsidian` / `react` / `obsidian-id-lib` import in the new engine file;
  import guard green.
- `EdgeCounts` remains the ONLY place a count is attached — no second multiplicity path.
- One write pipeline: the tab's `addToggleRow` `void`s `this.writes.apply(...)` with no
  try/catch and no queue of its own; the panel goes through `useSettingsValue`. Correct per
  the ONE-failure-policy rule.
- No hand-typed label, heading, order or accessible name in either presenter.
- Defaults/ranges literal appears only in `settingsProductDefaults.test.ts`.
- Branded types used throughout the new code; strict-TS clean.
- `styles.css` was *not* regenerated in the commit — a non-issue: it is gitignored (line 9)
  and produced at build.
- No anchor point (`ap_XXX_E`) removed; no behavior-capturing test removed or weakened. The
  `walkedVisibleEdges` → `visibleEdges` rename in `EdgeCounts.test.ts` is a parameter rename
  only, with every assertion intact.
- `_tickets/…` ticket closed with an accurate note recording the deviation.

## Documentation updates needed

None beyond findings 4 and 5 (both are in-code WHY comments). `README.md`,
`docs-internal/plan/high-level-plan.md` and the ticket note were all updated accurately and
in the right places; no `CLAUDE.md` change is warranted — the feature added no new rule.

## Readiness signal

**NOT YET READY TO MERGE AS-IS — ready after findings 1 and 2.** Finding 1 is a ~10-line
change plus one test; finding 2 is three test cases. Neither requires a design revisit, and
nothing else in the change should be touched.
