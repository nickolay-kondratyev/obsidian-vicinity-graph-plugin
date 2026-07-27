# IMPLEMENTATION_REVIEW — pin sizePx / nodePreviewPreference independence

Ticket `nid_f8csd65emmy6p62ad9x5w1psz_e`. Reviewed `git diff main...HEAD` (impl commit `16bed89`).

**Verdict: APPROVE.** No BLOCKING findings. The "settings object carries the
preference" arrangement is **not** a hack. Two SHOULD-FIX follow-ups below, both
small and both about coverage completeness rather than correctness.

## Independent verification (run by the reviewer, not taken on trust)

| Check | Result |
|---|---|
| `npm test` | exit 0 — **76 files / 1013 tests passed** (`.tmp/rev-test.log`) |
| `npm run check` | exit 0 — strict tsc for `src/` and `e2e/` (`.tmp/rev-check.log`) |
| Production code touched | **No.** Diff = 2 `*.test.ts` files + ticket front-matter + `.ai_out/` docs. Nothing under `src/**` non-test. |
| No `sanity_check.sh` in repo | n/a |

### Mutation replay (done in a throwaway `git worktree`, source tree never touched)

I did not reuse the implementer's mutation; I ran two *independent* ones.

- **Mutation A — sizer reads the preference off its settings arg.** In
  `src/engine/NodeSizer.ts`, probe `rawSettings as SizingSettings & { nodePreviewPreference?: string }`
  and double `maxPx` for `"image"`. Result: **NodeSizer.test.ts FAILS**,
  VicinityEngine.test.ts passes. → the new NodeSizer guard genuinely bites.
- **Mutation C — coupling introduced entirely in `VicinityEngine.ts:63`**
  (`maxPx * 2` when preference is `"image"`, sizer untouched). Result:
  **VicinityEngine.test.ts FAILS** (`:350`), NodeSizer.test.ts passes.

Both mutations reverted; `git status` clean, worktree removed.

## 1. Does the guard bite? — Yes, but the load is unevenly carried

The NodeSizer test bites for exactly one regression shape: *a sizer that reads a
`nodePreviewPreference` field off the settings object it is handed*. Mutation C
proves it is blind to the arguably more likely shape — a coupling introduced at
the call site or via a new constructor dependency — and that shape is caught
**only** by the added `VicinityEngine` test.

So: the ticket's mandated NodeSizer-suite test is the narrower of the two, and
the `VicinityEngine` test the implementer added *beyond* the ticket is the
load-bearing guard. That is a good call, not a problem — but it should be stated
plainly rather than left implied, because someone later "simplifying" the
VicinityEngine test away would gut most of the real protection. The WHY comment
in `VicinityEngine.test.ts` does say it covers the resolver→sizer seam; good.

## 2. The "settings object carries the preference" question — NOT a hack

Verified precisely:

- `src/engine/NodeSizer.test.ts` builds
  `const settings = { ...viewSettings.sizing, nodePreviewPreference: viewSettings.nodePreviewPreference };`
  and passes that local into the pre-existing `sizeAll(spec, settings, ["m.md"])`
  helper, whose parameter is typed `SizingSettings`.
- `SizingSettings` (`src/engine/types.ts:245`) is **unchanged** — no
  `nodePreviewPreference` field was added.
- `NodeSizer.computeSizes(nodes, rawSettings: SizingSettings)` signature is
  **unchanged**.
- No `as any`, no `as unknown as`, no `@ts-expect-error`, no cast of any kind in
  the test. The extra property is legal because TS excess-property checking only
  fires on *fresh* object literals at the assignment site; `settings` is a named
  local, so structural typing accepts it.

This is a legitimate structural-typing arrangement **confined to the test file**.
Nothing production-side was polluted or widened. I looked for the hack the
briefing suspected and it is not there.

One honest caveat (NIT, below): the arrangement is subtle enough that a future
maintainer could delete the extra spread as dead weight. The WHY comment above
the `describe` already anticipates this and explains it, which is the right
mitigation.

## 3. Production code untouched — confirmed

`git diff main...HEAD --stat` shows only:
`src/engine/NodeSizer.test.ts`, `src/engine/VicinityEngine.test.ts`,
`_tickets/…-node-preview-must-not-resize-a-node.md` (status → closed),
and four `.ai_out/` docs. Zero behavior change. Scope respected.

## Findings

### BLOCKING
None.

### SHOULD-FIX

**S1 — the pointer comment in `src/view/GraphStructureDiff.test.ts:47-53` is now stale.**
It still reads *"…would slip past HERE and **needs pinning** where sizePx is
computed instead"* — future tense, as if the work were outstanding. That comment
is literally what generated this ticket. It should now name the guard, e.g.
"…which IS pinned in `NodeSizer.test.ts` / `VicinityEngine.test.ts`". Leaving it
as-is invites a future agent to re-open the same ticket. Cheap, closes the loop.
File: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/view/GraphStructureDiff.test.ts`

**S2 — partial push-back on the declined view-layer guard.**
The implementer's stated reasoning is *correct as far as it goes*:
`nodeDimensionsPx(node: GraphNode)` (`src/view/graphIdentity.ts:53`) takes no
settings, so a guard in `graphIdentity.test.ts` really would be `f(x) === f(x)`.
Declining **there** is justified — I agree.

But the ticket's "and/or" second half pointed at the *view layer*, and the
non-tautological place for it is one level up, in `flowMapping.test.ts`:
`vicinityGraphToFlow` **does** have the preference in scope
(`graph.viewSettings` → `nodePreviewKind(...)` at `src/view/flowMapping.ts:322`)
and sets each flow node's `width`/`height` right next to it
(`flowMapping.ts:188-196`). The view is where preview rendering actually lives,
so "image previews need a taller node box" is the most plausible way this
invariant dies in practice — and nothing pins it today. With the existing
`makeGraph`/`makeNode` fixtures this is ~8 lines:
*WHEN only nodePreviewPreference varies THEN every flow node's width and height are identical.*

Not blocking (the engine guard catches the engine-side coupling, and the ticket
said "and/or"), but the decline was argued against the wrong function. Suggest a
follow-up `docs-internal/tickets/` entry rather than reopening this one.

### NIT

- **N1** — In both new tests the baseline is `NODE_PREVIEW_PREFERENCES[0]`'s own
  result, so the keyed map compares entry 0 against itself. Harmless; the keying
  buys a good failure message, which is worth more than the redundancy.
- **N2** — The
  `Object.fromEntries(NODE_PREVIEW_PREFERENCES.map(...))` assertion idiom is
  duplicated verbatim across the two test files. Extracting it would couple two
  engine test files through a new shared helper for four lines; I would leave it.
- **N3** — `NodeSizer.test.ts` asserts `sizeScore` *and* `sizePx` in one test.
  The title says both, and they are one `NodeSize` value object, so this reads as
  one behavior. Fine.

## Test quality against CLAUDE.md

- BDD `WHEN … THEN …` naming: yes, both.
- Iterates `NODE_PREVIEW_PREFERENCES` rather than hardcoding three literals: yes
  — a fourth preference is covered for free, and the const tuple keeps
  `[0]` type-safe under `noUncheckedIndexedAccess` (confirmed: `npm run check` green).
- Reuses existing fixtures/helpers (`sizeAll`, `build`, `EngineDefaults`,
  `FakeVaultSpec`): yes, no parallel fixture stack introduced.
- WHY comments explain what is protected (`SIZE_RELAYOUT_THRESHOLD` /
  data-only refresh) and carry a WHY-NOT for `GraphStructureDiff.test.ts`: yes,
  and they are the right length.
- Behavior-capturing tests removed or anchors touched: **none**. Verified in the diff.
- Over-engineering: none.

## Documentation Updates Needed

- `GraphStructureDiff.test.ts` comment (S1) — the only doc-shaped debt.
- No `CLAUDE.md` change warranted; this adds no new convention.
- `change_log` entry is owned by TOP_LEVEL_AGENT per the implementation notes — still outstanding at review time.

---

## Round 2 — delta review of commit `517b391`

**Verdict: CONVERGED. Ready to merge. 0 blocking, 0 SHOULD-FIX.**

Scope: only `517b391` (the S1/S2 response). Round-1 approved material not re-litigated.

### Independent verification (re-run by the reviewer)

| Check | Result |
|---|---|
| `npm test` | exit 0 — **76 files / 1014 tests** (`.tmp/rev2-test.log`); +1 vs round 1, as claimed |
| `npm run check` | exit 0 — strict tsc for `src/` and `e2e/` (`.tmp/rev2-check.log`) |
| `git diff main...HEAD --stat -- src` | 4 files, **all `*.test.ts`**. Zero `src/**` production files. |
| Working tree after my mutation replay | clean; worktree removed |

### S1 — pointer comment: ACCURATE

`src/view/GraphStructureDiff.test.ts:49-54` now reads "…would slip past HERE; that half is
pinned where sizes are produced: `NodeSizer.test.ts`, `VicinityEngine.test.ts` and
`flowMapping.test.ts`." All three named guards exist and pin what the sentence claims
(`NodeSizer.test.ts:325`, `VicinityEngine.test.ts:340`, `flowMapping.test.ts:600`). The diff
touches the comment only — the `decideLayout` WHY (nobody may add a `nodePreviewPreference`
trigger) and the test body/assertion are byte-identical. Closed correctly.

### S2 — new flowMapping guard: NON-TAUTOLOGICAL, mutation-confirmed

I did not take the implementer's mutation on trust; I re-ran both halves in a throwaway
worktree.

1. **Fixture really flips `data.preview`** (the vacuity risk). Probe test dumping
   `data.preview` per preference for the exact fixture:
   `auto → ["thumbnail","none"]`, `outline → ["outline","none"]`, `image → ["thumbnail","none"]`.
   Node `a.md` carries a renderable outline entry (level 1 ≤ `outlineMaxDepth` 2) **and**
   `firstImagePath`, with `imagePrecedesOutline: true`, so it hits `nodePreviewKind`'s
   preference `switch` rather than either single-sided short circuit. The mapped preview
   genuinely changes while geometry must not — the test is not `f(x) === f(x)`.
2. **Mutation claim credible — reproduced exactly.** Emitting
   `nodePreviewPreference === "image" ? height + 30 : height` in the `noteNodes` map of
   `src/view/flowMapping.ts` → `1 failed | 62 passed` in `flowMapping.test.ts`, and the single
   failure is the new test, diffing `"height": 160 → 190` / `40 → 70` keyed under `"image"`
   (the keyed map does buy the naming benefit N1 was rejected to preserve). Log:
   `.tmp/rev2-mut.log`.

Test quality: BDD naming, one behavior, reuses `makeGraph`/`makeNode`/`toFlow`, iterates
`NODE_PREVIEW_PREFERENCES` so a fourth preference is covered for free, WHY block explains the
`SIZE_RELAYOUT_THRESHOLD` stake. No behavior-capturing test or anchor removed.

### Rejected NITs — both rejections REASONABLE, accepted

- **N1 (self-comparing baseline entry).** Upheld. The keyed map is what produced the
  "which preference broke it" diff I saw in the mutation run above — the rejection is
  empirically justified, not just stylistic. Consistency across all three guards is the
  right call.
- **N2 (extract the `Object.fromEntries(NODE_PREVIEW_PREFERENCES.map(...))` idiom).**
  Upheld, and the argument got *stronger* than at review time: the idiom now spans
  `src/engine/` and `src/view/`, and a shared test helper would have no natural home without
  coupling the two layers' test suites. Four readable lines is below the DRY threshold for
  knowledge duplication (this is idiom, not business rule). No push-back.

### Optional (do NOT block the merge)

- The new test asserts geometry only; the preview-flips property it depends on lives in a
  comment, not an assertion. If someone later trims `firstImagePath` from the fixture the test
  silently becomes vacuous. A one-line companion assertion (or noting the flip in the WHY as a
  *verified* fact) would make the fixture self-defending. Genuinely optional — the fixture is
  local to the `describe`, so the blast radius is small.
- Pedantic: `flowMapping.test.ts` is grouped under "where sizes are produced" in the S1
  comment; it pins where sizes are *consumed into node geometry*. Harmless and arguably the
  more useful grouping for a reader.

### Still outstanding (owned by TOP_LEVEL_AGENT, unchanged from round 1)

`change_log` entry, branch merge, ticket state. Also note `517b391` incidentally adds a new
open ticket `nid_brwl5gfd2l2ephq9pdiqfkqzp_e` (nodes with images need enough space) — that is
follow-up capture, not scope creep, and it is worth flagging that it points at behavior this
very invariant constrains: whoever picks it up must not make `sizePx` preference-dependent.
