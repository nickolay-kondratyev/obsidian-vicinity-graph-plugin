---
id: nid_fay1hu5sxcoygizopkkg0f0d7_e
tags: [settings, settings-cleanup]
title: "Separate depth budget for embedded outgoing links (decisions settled; measures the new settings model's plumbing cost)"
status: open
deps: [nid_8p0nn2g34d97finokwlz3u1dt_e, nid_wimjq4ewgbg21n4zx9d4qq3a0_e, nid_armoson86j0ii8c33r1odo1rc_e, nid_x6hgehsu5il1d1shuraz3ufqy_e]
links: [nid_869bt9d9rlrbr8of1403dnmf3_e, nid_8p0nn2g34d97finokwlz3u1dt_e, nid_1rslube8at5xj60ji4jeve0b0_e, nid_d57npvuvjk95n03c2xqgl3y6o_e]
created_iso: 2026-07-28T17:29:00Z
status_updated_iso: 2026-07-28T17:29:00Z
type: task
priority: 2
assignee: nickolaykondratyev
---

Overarching context, ordering rationale and standing owner decisions: docs-internal/notes/settings.md (grouping tag: settings-cleanup, step 6 — the FINAL step of the chain). This ticket absorbed former ticket nid_d57npvuvjk95n03c2xqgl3y6o_e ("prove the plumbing cost dropped"); see MEASUREMENT MANDATE at the bottom.

First research if we have a solid way to gather the data if something is embedded or NOT both from the notes which would be the `![[note]]` syntax.


As well as canvas having two ways to embed a note
- One is also by having a node with `![[note]]`
Another is by adding the file directly as:
{"id":"bbdb169bfabab45d","type":"file","file":"tmp1.canvas","x":-460,"y":-320,"width":400,"height":400}

The outcome of this ticket is the updated ticket with the research finding and feasibility of fully respecting embedded as first class citizen of relationship.

---

# RESEARCH FINDINGS (2026-07-28)

## Verdict up front

**Feasible, and cheap on the outgoing side. Not free.** Embed-ness is obtainable
today with **zero new Obsidian API surface** for: markdown notes, and canvas files
in the fallback-parse regime. Two data paths cannot report it as currently
written — **core-indexed canvases** and **incoming links (backlinks)** — both
fixable, one at a real cost.

The information is not lost by Obsidian; it is discarded by **four** places in
this repo (all one-line-ish):

| Where | What it drops | File:line |
|---|---|---|
| `ReferenceOrder.bodyReferencesOf` | merges `cache.links` + `cache.embeds` into one untagged array | `src/adapters/ReferenceOrder.ts:44` |
| `ReferencePort` | exposes only `link` + `position.start.offset`; no `original` | `src/adapters/obsidianPorts.ts:34-38` |
| `Wikilinks` / `MarkdownInlineLinks` | regex is `!?…` with the `!` **outside** capture group 1 | `src/shared/Wikilinks.ts:19`, `src/shared/MarkdownInlineLinks.ts:32` |
| `BacklinksAdapter.extractSourcePaths` | keeps only the map **keys**, throws away the per-source `Reference[]` | `src/adapters/BacklinksAdapter.ts:30-42` |

`LinkProvider`'s doc comment already anticipated this seam: *"Provider-owned so
adapters can refine the rule (e.g. embeds vs. plain …)"* —
`src/engine/LinkProvider.ts:25`.

## 1. Can we detect embed-ness? Per data path

| Data path | Detectable? | Mechanism | Confidence |
|---|---|---|---|
| Markdown body `![[x]]` / `![](x)` | **YES, free** | provenance: the ref came from `cache.embeds`, not `cache.links` | **High** — documented, pinned `obsidian@1.12.3` `CachedMetadata.embeds?: EmbedCache[]` (`obsidian.d.ts:1396`) |
| Markdown frontmatter links | **N/A** | `frontmatterLinks` are never embeds; classify as `link` unconditionally | High |
| Canvas **fallback** regime, `type:"file"` node | **YES, free** | already tagged `{kind:"file-node"}` at `CanvasFallbackParser.ts:165`; a canvas file-node *renders the file inline* ⇒ it **is** an embed | High |
| Canvas **fallback** regime, `type:"text"` node | **YES, ~2-line fix** | move the existing `!?` into a capture group and return it; the regexes already match embeds | High |
| Canvas **core-indexed** regime | **NO as written** | `resolvedLinks` is `Record<path, Record<path, count>>` (`obsidian.d.ts:4293`) and **merges links + embeds**; core exposes no canvas node list | see §3 |
| **Incoming** via `getBacklinksForFile` | **NO as written** | we discard the `Reference[]` values that carry the signal | see §4 |
| **Incoming** via `resolvedLinks` inversion fallback | **NO, ever** | merged counts only | — |

### Important negative finding: `EmbedCache` has no discriminator

```ts
// node_modules/obsidian/obsidian.d.ts (1.12.3)
3577: export interface LinkCache extends ReferenceCache {}
2670: export interface EmbedCache extends ReferenceCache {}
5151: export interface Reference { link: string; original: string; displayText?: string }
```

`EmbedCache` and `LinkCache` are **structurally identical** empty extensions.
There are exactly **two** runtime signals:

1. **Array provenance** — which of `cache.links` / `cache.embeds` it came from.
   Preferred: cheapest, documented, and cannot be fooled by odd markdown.
2. **`Reference.original[0] === "!"`** — documented but flagged *"Not available
   on Publish"*. Useful as the signal in contexts where provenance is lost
   (the backlinks map values, §4) and as a cross-check test.

## 2. What "first-class citizen" costs downstream

Nothing downstream of the adapter knows kinds today — **by construction**:

- `DirectedLink` = `{source, target}` (`src/engine/types.ts:132`), `GraphEdge`
  adds only `count` (`:141`). No `kind` field anywhere.
- Direction is deliberately **normalised away** at record time
  (`VicinityTraversal.ts:204-209`) — edges always point linker → linked.
- Depth is a 2-field concept: `DepthSettings.outgoingDepth` / `.incomingDepth`
  (`types.ts:196-199`) with one map `DIRECTION_DEPTH_FIELD` (`:226-229`), and
  traversal is exactly two BFS runs per root (`VicinityTraversal.ts:52`, `:87`).

So "separate depth for embeds" means **kind joins direction as a traversal
axis**: `Direction × LinkKind` → 4 BFS runs per root, 4 depth fields, `DepthTag`
gains `kind`.

### Cost model (measured, from the sibling research ticket `nid_8p0nn2g34d97finokwlz3u1dt_e`)

One new settings field currently costs **~180 lines across ~15 files** and must
be added to **~8 hand-maintained parallel lists** that fail *silently* when one
is missed. Two new depth fields ⇒ **~2×** that, plus per-central steppers
(2 → 4 controls, `CentralDepthControls.tsx:29-36`) and persistence validation
(`persistedShapes.ts`). **This ticket is a strong argument for doing
`nid_8p0nn2g34d97finokwlz3u1dt_e` (Option A compile-time completeness guards)
FIRST** — otherwise the silent-omission bug class is paid twice over.

## 3. The core-indexed canvas gap

`CanvasCapability.detectFor` (`src/adapters/CanvasCapability.ts:22-26`) skips
JSON parsing entirely for canvases that core *did* index, and serves
`resolvedLinks` keys instead (`ObsidianLinkProvider.ts:258`). Those keys carry no
kind. Options:

- **(3a) Always parse canvases** — delete the core-indexed shortcut for outgoing
  links. Costs one `vault.read` + `JSON.parse` per canvas, already mtime-cached
  (`CanvasParseCache.ts:23-31`), and the fallback path resolves with the *same*
  `getFirstLinkpathDest` resolver core uses, so it is not a downgrade. **Bonus:
  this is also the permanent fix shape for the closed race ticket
  `nid_s676x55uojmtcwh9t4l9mc6zl_e`** (regime re-detected per rebuild from a
  racing `resolvedLinks`). **Recommended.**
- **(3b) Kind = `unknown` for core-indexed canvases**, degraded to `link`. Free,
  but produces boot-timing-dependent *kinds* — the same class of nondeterminism
  that ticket was about. **Not recommended.**

## 4. The incoming gap (the genuinely weak link)

`getBacklinksForFile` is **absent from the pinned typings** (zero hits in
`obsidian.d.ts` 1.12.3) — hence the single isolated cast at
`BacklinksAdapter.ts:46`. Two routes:

- **(4a) Keep the map values and read `Reference.original`.** Smallest diff. But
  it deepens reliance on an *undocumented* shape (today we only depend on
  "`data` is Map-like or record-like"; this would add "values are
  `Reference[]` with a usable `original`"). Needs a live probe on the e2e build
  (1.12.7) before committing — there is already a debug command hook at
  `src/main.ts:246-254`.
- **(4b) Re-derive kind from the source's own outgoing references.** Backlinks
  give us source path `S`; kind of `S → C` is a property of `S`'s own file cache,
  which we can read with **fully documented** APIs (`getFileCache(S)` +
  `getFirstLinkpathDest`) — exactly the machinery `getOutgoingLinks` already
  runs. Cost: one `getFileCache` per backlink source (in-memory, cheap) and it
  works uniformly for markdown *and* canvas sources. **Recommended** — it also
  makes the `resolvedLinks`-inversion fallback path kind-correct for free, which
  (4a) cannot.

## 5. Multiplicity: a pair can be BOTH

Nothing stops `A` from both embedding and plainly linking `B`. `getLinkCount` is
the sole multiplicity authority (`LinkProvider.ts:73`, impl
`ObsidianLinkProvider.ts:135-149`) and would need to become kind-aware, or the
edge would need `embedCount` alongside `count`. Consequence: **the edge kind is a
summary, not a scalar** — `"link" | "embed" | "both"`. `EdgeVisibility`'s
`all-edges` induced sweep (`EdgeVisibility.ts:49-59`) reads counts too, so it
must be kind-aware or induced edges will render kind-blind.

## 6. Traversal semantics with two budgets — the real design question

Today: `visited: Map<path, depth>`, one budget per BFS. With two budgets:

- **(6a) Kind-pure BFS × 4** (mirrors the existing direction axis exactly).
  Simplest, smallest diff, matches the "independent BFS, union the results"
  architecture already in place. **Cost of the simplicity:** a mixed chain
  `A ![[B]] → B [[C]] → C` is unreachable in *any* single BFS, so `C` never
  appears even when both budgets are ≥ 1. That is a real, user-visible
  surprise (POLS risk).
- **(6b) Mixed BFS with per-kind hop accounting** — visited state becomes
  `(path, linkHops, embedHops)`. Correct/intuitive, but the "expand once,
  shallowest first" invariant (`VicinityTraversal.ts:56-59`) no longer holds:
  a node reachable in (2 link, 0 embed) vs (0 link, 2 embed) is two distinct
  frontier states. This is a genuine complexity step up (Pareto-negative unless
  the mixed-chain case is judged important).

## 7. Free side-benefit, and a behavior-change warning

`attachments` is currently defined as *"outgoing refs to non-node-bearing
files"* (`ObsidianLinkProvider.ts:293-297`). With kinds available, attachments
could be defined precisely as **embedded** non-node-bearing files — which is what
"attachment" actually means. **Warning:** that changes behavior — a plain
`[[diagram.png]]` link stops being an attachment/thumbnail. Do NOT bundle this
with the depth work; it deserves its own ticket + human sign-off.

Also note the still-open accuracy bug that embed detection inherits verbatim:
`nid_869bt9d9rlrbr8of1403dnmf3_e` (canvas text-node links inside code
spans/fences produce phantom edges). Phantom *embeds* would be equally phantom.

## 8. Recommended staging (Pareto)

Deliberately ordered so each stage ships value alone and the risky part is last.

- **Stage 0 (prerequisite)** — land the compile-time completeness guards from
  `nid_8p0nn2g34d97finokwlz3u1dt_e`, so 2 new depth fields don't cost 2× the
  silent-omission risk.
- **Stage 1 — carry the kind, change no behavior.** `LinkKind = "link" | "embed"`
  in the engine (vault-generic, no canvas leakage ⇒ OCP-clean); tag markdown refs
  by array provenance; capture the `!` in the two shared regexes; tag canvas
  `file-node` as embed; adopt **(3a)** always-parse and **(4b)** re-derive for
  incoming. Kind is *carried* and unit-tested via `FakeLinkProvider`, but nothing
  consumes it yet. High confidence, fully reversible.
- **Stage 2 — make it visible before making it configurable.** Render embed
  edges distinctly (CSS-only: dashed/weighted stroke on
  `vicinity-graph-edge`, `src/view/graph-view.css:38`). Cheap, and it lets the
  owner *see* whether embed-vs-link separation is worth 2 more settings fields
  before paying for them.
- **Stage 3 — separate depth budgets.** Only after §6 is decided.

---

# SCOPE DECISION (2026-07-29, owner)

**Outgoing embeds only.** Embed-ness becomes a first-class relationship on the
OUTGOING side. Incoming stays kind-blind. Rationale: the incoming side is where
all the cost and all the API risk live, and it buys the least.

## What this cut removes outright

- **§4 (the incoming gap) — GONE.** That was the only path with no documented
  API: `getBacklinksForFile` is absent from the pinned `obsidian@1.12.3` typings
  (single isolated cast at `src/adapters/BacklinksAdapter.ts:46`). Both routes
  (4a keep-map-values, 4b re-derive-from-source) are now unnecessary. No live
  probe on the e2e build needed. **The single largest risk in the ticket is
  retired by scoping, not by engineering.**
- **The `resolvedLinks`-inversion fallback** (§1, "NO, ever") stops mattering —
  it only ever fed incoming.
- **One of the two new depth fields**, and its stepper, spec entry, parse branch,
  reset row, and per-field test cases.

## What stays required

- **§3a always-parse canvases** — still needed; core-indexed canvases are an
  OUTGOING path. Retains the bonus of being the permanent fix shape for the
  closed race ticket `nid_s676x55uojmtcwh9t4l9mc6zl_e`.
- Markdown provenance tagging, the two shared regex `!` captures, canvas
  `file-node` ⇒ embed. All High confidence, all free.

## Revised traversal shape — the axis collapses, it does not widen

The 2×2 `Direction × LinkKind` (4 BFS runs) that made §6 hard **does not
happen**. What is actually needed is one flat enum of traversal channels:

    outgoing-link | outgoing-embed | incoming

This is a *generalisation of the existing `Direction`*, not a second axis
alongside it, and it lands on machinery already built for exactly this:

| Today | Becomes |
|---|---|
| `DIRECTIONS = ["outgoing","incoming"]` (`VicinityTraversal.ts:52`) | 3-element channel list |
| `DIRECTION_DEPTH_FIELD` 2 entries (`types.ts:226-229`) | `CHANNEL_DEPTH_FIELD` 3 entries |
| `bfs()` ternary picking the depth limit (`VicinityTraversal.ts:96`) | map lookup on channel |
| `neighborsOf(current, direction)` | switches on channel; outgoing splits by kind |
| `DepthTag.direction` | `DepthTag.channel` |
| `DepthSettings` 2 fields | 3 fields |

**3 BFS runs per root, one new depth field.** Roughly **half** the cost model in
§2 — and the remaining half is mechanical, in files that already enumerate
`Direction` and would now fail to compile if a channel were missed (the
`Record<Direction, …>` at `types.ts:226` becomes the completeness guard for free).

### §6 is largely answered by the cut

Kind-pure BFS (6a) was rejected on the mixed-chain surprise: `A ![[B]] → B [[C]]`
leaves `C` invisible. That case survives — but now it is confined to two
same-direction channels rather than four, and both budgets default equal (§ below),
under which the union of the two outgoing BFS runs is **exactly** today's single
outgoing BFS. So (6a) ships with **zero observable change at defaults**, and the
mixed-chain gap only appears once a user deliberately diverges the budgets.
That makes (6a) the Pareto answer. (6b) per-kind hop accounting is **not**
recommended: it breaks the "expand once, shallowest first" invariant
(`VicinityTraversal.ts:56-59`) for a case the defaults hide.

### Accepted asymmetry (POLS — call it out in the UI, not just the code)

A note embedded by the current note is an `outgoing-embed` neighbour; a note that
embeds the current note arrives as a plain `incoming` neighbour, indistinguishable
from one that merely links it. This is a deliberate scope line, not an oversight.
The UI labels must not imply an "embedded in" budget exists. Cheap escape hatch
later: adding an `incoming-embed` channel is additive to the enum (OCP), so this
decision is reversible without rework.

### §5 multiplicity — still open, but smaller

`A` can both embed and link `B`, so an outgoing pair can belong to both channels.
`getLinkCount` (`LinkProvider.ts:73`) remains the sole multiplicity authority and
must become channel-aware, else `EdgeVisibility`'s `all-edges` induced sweep
(`EdgeVisibility.ts:49-59`) renders kind-blind. Unchanged by the cut.

## Revised staging

- **Stage 0** — unchanged prerequisite: compile-time completeness guards
  (`nid_8p0nn2g34d97finokwlz3u1dt_e`). Now guards **one** new field, not two.
- **Stage 1** — carry `LinkKind`, change no behavior: markdown provenance, the two
  regex captures, canvas `file-node` ⇒ embed, adopt **3a always-parse**.
  Drop 4b entirely.
- **Stage 2** — visual distinction for embed edges (CSS-only,
  `src/view/graph-view.css:38`). Still gated on decision 4.
- **Stage 3** — the `outgoing-embed` channel + its depth field, via **6a**.

---

---

# OWNER DECISIONS — ALL SETTLED (2026-07-29)

Every open question is now answered. **This ticket is no longer `[decide]`;** what
remains is splitting implementation tickets per the staging below.

## D1 — Traversal semantics: **(6a) kind-pure channels**
Settled by the scope cut. At equal defaults the two outgoing channels union to
exactly today's outgoing BFS ⇒ zero observable change at ship.

## D2 — Naming: **`Links out` / `Embeds out` / `Links in`**, full rename, **no migration**

| TS + persisted key | UI label |
|---|---|
| `linkDepthOut` (renamed from `outgoingDepth`) | Links out |
| `embedDepthOut` (**new**) | Embeds out |
| `linkDepthIn` (renamed from `incomingDepth`) | Links in |

**BREAKING, DELIBERATE, AND DESTRUCTIVE — must not be discovered by surprise.**
These are literal JSON keys in every user's saved data, verified in-repo:
per-doc `depths: { outgoingDepth: 3 }` and per-central
`centralDepths: { <docid>: { incomingDepth: 2 } }`
(`src/persistence/DocDataMutations.ts`, `DocDataStore`, `OrphanSweeper`).

Owner chose the clean break over a migration shim (consistent with the repo's
"make clean breaks, avoid `@Deprecated`" rule). Consequences, accepted:

- Every stored **per-doc** depth override and every **per-pinned-central** depth
  override silently reverts to defaults on upgrade. Global defaults likewise.
- Old keys are simply ignored by `parseDepthOverride` — no read-shim, no dual-key
  window.

**Required mitigation (cheap, turns silent into announced):** a release-note line
in `docs-internal/RELEASE_CHECKLIST.md` stating that saved depth overrides reset
on this upgrade. Losing settings is acceptable; losing them *silently* is not.

This is now the repo-wide default, not a one-off: **the plugin is unpublished, so
stored-data changes take clean breaks** (`CLAUDE.md` → Conventions). No migration,
no dual-key read window.

**Still don't bump `PERSISTED_SHAPE_VERSION` for this** — but note the *reason has
changed*. The original rationale ("it would discard every user's stored globals")
is void with no users. It holds now only on KISS grounds: unknown/renamed keys
already fall back to spec defaults, so a bump buys nothing and merely widens the
blast radius from three depth keys to every global. If a future change genuinely
needs the wholesale reset, bumping is now cheap and allowed.

## D3 — Stage 2 visual embed distinction: **YES, but AFTER Stage 3**
Depth control is the point; the dashed/weighted stroke on
`vicinity-graph-edge` (`src/view/graph-view.css:38`) follows it.
**Note the consequence:** this forfeits the "see it before you buy it" rationale
that originally justified Stage 2 first — the settings field gets paid for before
there is any visual evidence embed-vs-link separation is useful. Accepted; the
owner wants the budget regardless.

## D4 — Stage 0 still **GATES** this work
Land the compile-time completeness guards (`nid_8p0nn2g34d97finokwlz3u1dt_e`)
first. Reinforced by D2: this change now touches persistence key parsing on
**three** fields (two renames + one addition), so the silent-omission bug class
is exactly what would bite. **`deps` frontmatter updated accordingly.**

## D5 — §7 attachments: **REJECTED — keep attachments orthogonal to embed-ness**
Owner: *"A diagram should be an attachment, they should be clearly separated from
embedded out links."*

Interpretation, for implementors:

- **Attachment-ness is decided by node-bearing-ness, NOT by kind.** A diagram is
  an attachment whether written `[[diagram.png]]` or `![[diagram.png]]`.
  The §7 redefinition ("attachment = embedded non-node-bearing file") is
  **dropped, not deferred** — no follow-up ticket. A plain `[[diagram.png]]`
  keeps its thumbnail.
- **`embedDepthOut` covers embedded NOTES only.** Attachments never enter the
  channel — `VicinityTraversal` already guarantees this via the
  `eligibility.isNodeBearing` gate before enqueue, so **no new code is needed to
  honour this decision**; it is a constraint to preserve and pin with a test, not
  to build.
- Canvas `type:"file"` nodes pointing at non-node-bearing files therefore stay
  attachments too, despite being embeds.

---

## Superseded decision list (kept for provenance)

1. ~~§6 traversal semantics~~ — **SETTLED: (6a) kind-pure channels.** See the
   scope decision above; the cut makes (6a) observably identical to today at
   default settings.
2. **Naming** (the ticket's literal title) — now **three** budgets, not four.
   Proposal: `outgoingDepth` (keeps meaning *plain links*), `outgoingEmbedDepth`
   (new), `incomingDepth` (unchanged, kind-blind). UI labels: "Outgoing links",
   "Embedded notes", "Incoming links". Owner picks the words. **Coordinate with
   `nid_1rslube8at5xj60ji4jeve0b0_e`** — that ticket groups these under a "Depth"
   heading and asks the same naming question; the third row lands inside its group.
3. **Defaults.** Recommendation: `outgoingEmbedDepth === outgoingDepth` (both `1`)
   at ship. Under the scope cut this is stronger than before: at equal defaults
   the two outgoing channels union to exactly today's outgoing BFS, so both the
   new channel AND every "kind unknown ⇒ treat as link" degradation are
   **unobservable** until a user deliberately diverges the budgets.
4. **Scope of stage 2** — is a visual embed distinction wanted at all, or is depth
   control the whole point?
5. **§7 attachment redefinition** — separate ticket, yes/no?

Implementation tickets are intentionally **not** created yet: decisions 1 and 2
determine their shape.

## Notes

**2026-07-28T17:41:23Z**

Research complete (see RESEARCH FINDINGS in body). Verdict: feasible; embed-ness is discarded by 4 places in this repo, not withheld by Obsidian. Two data paths need real work (core-indexed canvases, backlinks). Ticket is now [decide]: owner must pick traversal semantics (kind-pure BFS x4 vs per-kind hop accounting) and the field/label naming before implementation tickets can be split.

**2026-07-29T15:40:01Z**

SCOPE CUT (owner): outgoing embeds only; incoming stays kind-blind.

This retires the ticket's biggest risk by scoping rather than engineering: SS4 (backlinks) was the only path with no documented API in pinned obsidian@1.12.3 -- both routes 4a/4b are dropped, no live e2e probe needed. SS3a (always-parse canvases) still required.

Traversal collapses from a 2x2 Direction x LinkKind (4 BFS) to a flat 3-value channel enum (outgoing-link | outgoing-embed | incoming): 3 BFS runs, ONE new depth field, and the existing Record<Direction,...> at types.ts:226 becomes the completeness guard for free. ~half the SS2 cost model.

SS6 is thereby settled: 6a kind-pure channels, since at equal defaults the two outgoing channels union to exactly today's outgoing BFS => zero observable change at ship.

Accepted asymmetry: no "embedded in" budget; adding incoming-embed later is additive to the enum (OCP), so reversible.

Still open for owner: naming (decision 2, coordinate with nid_1rslube8at5xj60ji4jeve0b0_e), stage-2 visual distinction (4), attachment redefinition (5).

**2026-07-29T16:48:53Z**

All owner decisions settled; [decide] dropped from title.

D1 traversal: 6a kind-pure channels (outgoing-link | outgoing-embed | incoming).
D2 naming: Links out / Embeds out / Links in -- FULL rename of TS+JSON keys to linkDepthOut / embedDepthOut / linkDepthIn, NO migration. Deliberate destructive break: saved per-doc and per-central depth overrides reset on upgrade. Mitigation required: release-note line in docs-internal/RELEASE_CHECKLIST.md so the loss is announced, not silent. Do NOT bump PERSISTED_SHAPE_VERSION (that would discard globals wholesale, strictly worse).
D3 visual embed distinction: yes, but AFTER Stage 3 -- forfeits the see-it-before-you-buy-it rationale; accepted.
D4 Stage 0 STILL GATES: deps frontmatter now points at nid_8p0nn2g34d97finokwlz3u1dt_e.
D5 attachments: SS7 redefinition REJECTED outright, no follow-up ticket. Attachment-ness stays decided by node-bearing-ness, not kind -- a diagram is an attachment whether [[x.png]] or ![[x.png]]. embedDepthOut covers embedded NOTES only; VicinityTraversal isNodeBearing gate already guarantees this, so it is an invariant to pin with a test, not code to write.

Next: split implementation tickets (blocked on Stage 0).

---

# MEASUREMENT MANDATE (absorbed from dissolved ticket nid_d57npvuvjk95n03c2xqgl3y6o_e, 2026-07-29)

This is the MEASUREMENT step for the whole settings cleanup, not just a feature.
Implement this depth field as the FIRST new settings field added under the
declarative descriptor model (nid_wimjq4ewgbg21n4zx9d4qq3a0_e).

ACCEPTANCE: record how many files and lines the new field actually cost, and
compare against the pre-cleanup baseline of ~15 files / ~8 hand-maintained lists
documented in nid_8p0nn2g34d97finokwlz3u1dt_e. If it is not dramatically
cheaper, the descriptor design did not deliver and the descriptor-model ticket
should be revisited rather than declared done.

Be honest in the write-up -- a disappointing number here is the single most
valuable signal the cleanup can produce.
