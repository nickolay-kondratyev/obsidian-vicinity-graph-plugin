---
id: nid_fay1hu5sxcoygizopkkg0f0d7_e
title: "[decide] Depth should have separate name for embedded outgoing link"
status: open
deps: []
links: [nid_869bt9d9rlrbr8of1403dnmf3_e, nid_8p0nn2g34d97finokwlz3u1dt_e, nid_1rslube8at5xj60ji4jeve0b0_e]
created_iso: 2026-07-28T17:29:00Z
status_updated_iso: 2026-07-28T17:29:00Z
type: task
priority: 3
assignee: nickolaykondratyev
---

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

## DECISIONS NEEDED FROM THE OWNER (why this is `[decide]`)

1. **§6 traversal semantics: (6a) kind-pure BFS ×4 (cheap, mixed chains
   invisible) or (6b) per-kind hop accounting (intuitive, real complexity)?**
   This is the single highest-leverage choice; everything else is mechanical.
2. **Naming** (the ticket's literal title). Proposal:
   `outgoingDepth`/`incomingDepth` keep meaning *plain links*, plus
   `outgoingEmbedDepth` / `incomingEmbedDepth`. UI labels: "Outgoing links",
   "Embedded notes", "Incoming links", "Embedded in". Owner picks the words.
3. **Defaults.** Recommendation: `embedDepth === linkDepth` (both `1`) at ship.
   This has a valuable property — while the defaults match, every "kind unknown ⇒
   treat as link" degradation is **unobservable**, so the residual data-path risk
   only materialises for users who deliberately diverge the budgets.
4. **Scope of stage 2** — is a visual embed distinction wanted at all, or is depth
   control the whole point?
5. **§7 attachment redefinition** — separate ticket, yes/no?

Implementation tickets are intentionally **not** created yet: decisions 1 and 2
determine their shape.

## Notes

**2026-07-28T17:41:23Z**

Research complete (see RESEARCH FINDINGS in body). Verdict: feasible; embed-ness is discarded by 4 places in this repo, not withheld by Obsidian. Two data paths need real work (core-indexed canvases, backlinks). Ticket is now [decide]: owner must pick traversal semantics (kind-pure BFS x4 vs per-kind hop accounting) and the field/label naming before implementation tickets can be split.
