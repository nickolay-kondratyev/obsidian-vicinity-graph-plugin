---
closed_iso: 2026-08-17T16:45:09Z
id: nid_fg66tanwkoyq3cqs1wdxagn21_e
title: Add ability for named relationships
status: closed
deps: []
links: []
created_iso: '2026-08-17T15:20:34Z'
status_updated_iso: 2026-08-17T16:45:09Z
type: task
priority: 3
assignee: nickolaykondratyev
tags:
  - named-relationships
  - plan
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
# PLAN (closed): Named relationships

This is the CLOSED PLAN ticket for the `named-relationships` feature set. It
holds the shared context every implementation ticket in the set relies on. All
decisions below were signed off one by one by the human owner (2026-08-17).

## What we are building

A named relationship is a labeled directed edge between notes, written with
Dataview-style inline-field syntax:

```
supports::[[note2]]        →  THIS_NOTE --supports--> note2
```

Today the graph knows only unlabeled links/embeds; named relationships add the
label — turning the vicinity graph into something that can render system
diagrams and argument maps drawn purely in named links.

## Why `::` (syntax-family decision)

Link-valued Dataview inline fields are the de facto typed-link convention in
the Obsidian ecosystem — Breadcrumbs (`up:: [[parent]]`), ExcaliBrain
(`parent::/child::/friend::`), Juggl (`- type:: [[note]]`). Adopting the same
shape means existing typed vaults work with zero rewriting, statements stay
Dataview-queryable, and live preview renders them. Scalar fields
(`rating:: 8`) are attributes, ignored by construction (a statement's value
must be a link run).

## Syntax spec (signed off)

A statement is `name::targets`, token-anchored, ANYWHERE in a line
(mid-sentence OK; surrounding prose ignored — deliberately NOT Dataview's
greedy full-line keying, its most-complained-about behavior).

Precedence at each `::`, by left context:

1. Ends with `]]` → **rel-note form**: `[[he supports]]::[[target]]` — the
   relationship name IS a note. Label = alias if given, else basename; the
   flyout links to the rel note. The rel-note OCCURRENCE folds into the edge
   (per-occurrence accounting): never a node/edge of its own; the rel note
   renders as a normal node only where it has other, non-relationship usages.
2. Inside a `[...]` / `(...)` wrapper → **bracketed form**:
   `[he supports:: [[x]]]` — name = text between opener and `::` (spaces
   allowed, trimmed); the statement extends to the wrapper's closing
   bracket and consumes it. Text between the target run and the closer is
   the statement's **qualifier** (signed off 2026-08-17):
   `[supports:: [[x]] but not strongly]` → name `supports`, qualifier
   `but not strongly` — never lost in parsing. The qualifier is plain
   text; links inside it stay plain unlabeled cache edges. Clean Dataview
   field; the paren variant rides along.
3. Else → **bare form**: name = LONGEST run of `[A-Za-z0-9_-]` immediately
   before `::` (stops at punctuation: `prose.he-supports::[[x]]` →
   `he-supports`). Note `(he-supports::[[x]])` parses via form 2 (unclosed
   `(` wrapper wins by precedence) — same name by coincidence there.

Shared rules:

- NO whitespace immediately before `::` in EVERY form, bracketed included
  (`[he supports :: [[x]]]` is rejected — stricter than Dataview, signed off
  2026-08-17; rule 2's "trimmed" means the LEADING space after the opener
  only); optional whitespace after (existing vaults write `key:: [[x]]`).
- Qualifiers exist ONLY in wrapped forms — the closing bracket is the
  terminator. Bare and rel-note forms have no terminator, and greedy
  matching without brackets is exactly Dataview's most-complained-about
  behavior (its full-line keying) — we deliberately refuse to repeat it
  (signed off 2026-08-17). Their trailing prose stays ignored (no
  qualifier), per the graceful-degradation rule.
- Targets = greedy comma-separated RUN of `[[link]]` / `![[embed]]` tokens,
  stopping at the first non-link/non-comma token (reads Breadcrumbs/ExcaliBrain
  lists `up:: [[a]], [[b]]`; trailing prose ignored).
- Unrecognized text degrades gracefully: its links stay plain unlabeled cache
  edges — nothing ever disappears, it just gets no name.
- Statements inside CODE REGIONS (fenced blocks, inline code) or the leading
  frontmatter block are NOT statements (review fix 2026-08-17, not separately
  signed off): Obsidian core indexes no links there, so a code-fence statement
  would mint an edge to a node the rest of the graph cannot see, and Dataview
  ignores code regions too; frontmatter is excluded from the INLINE scan
  because frontmatter fields have their own dedicated source below. Reuses
  `src/shared/MarkdownCodeRegions.ts` masking (same-length, offsets preserved).
- **Frontmatter** link-valued fields (`up: "[[parent]]"`) are named
  relationships too — via metadataCache `frontmatterLinks` (key + target, zero
  file reading). Own focused ticket.
- **Embeds**: `rel::![[x]]` allowed; displayed kind stays `embed`.
- DV-cleanliness tradeoff ACCEPTED (opt-in per occurrence): own-line/bullet/
  bracketed forms are clean DV fields; bare mid-sentence creates junk greedy
  DV fields; rel-note form is ours alone. Users wanting clean DV just avoid
  the bare form.

## Architecture (signed off)

- **Discovery: eager incremental index** (metadataCache carries no `::`
  prefixes, so raw markdown must be parsed). Bounded-concurrency initial scan
  over ONLY files that have links OR embeds per metadataCache (a statement's
  target run always contains `[[x]]`/`![[x]]`, and `rel::![[x]]` lands in
  `embeds`, not `links`);
  freshness via `metadataCache.on('changed')` (callback provides content — no
  extra reads) + delete/rename; replace-whole-entry semantics; session-held,
  never persisted; never blocks plugin load — graph builds await readiness.
  Built as REUSABLE index infrastructure for future vault-wide derived
  indexes.
- **Traversal: NEW channels** `named-outgoing` / `named-incoming` with their
  OWN depth budgets (+ pinned variants), so named-link system diagrams
  traverse deep independently of plain-link depth. Defaults (signed off
  2026-08-17): named-outgoing 2, named-incoming 1. EITHER-BUDGET union: a
  named link also rides the plain link channels (and a named embed the embed
  channel) — reachable under whichever budget reaches it, per-path.
- **Edge model**: one edge per ordered pair (collapse, don't multiply);
  `OutgoingReference`/`GraphEdge` carry relation names; kind derives from
  occurrences at edge assembly.
- **Rendering**: the edge shows ALL its relation names (dedicated GREAT-UI
  ticket for the multi-name presentation); count badge coexists; flyout holds
  the full breakdown (names, qualifiers, context snippets, rel-note links).
  A relation WITH a qualifier labels as `supports [X] but not strongly` —
  literal `[X]` marks the target position (never the note title; the edge
  already points at the target). No per-name styling in V1 (idea ticket).

## Scope cuts (signed off)

- **Third-party triples `[[a]]::rel::[[b]]` (from the original ask below):
  DROPPED ENTIRELY** — no deferred ticket. Not expressible as a Dataview
  field; Dataview compatibility was prioritized. Recorded here so the original
  ask's history is preserved.

## Ticket map (all tagged `named-relationships`)

| Ticket | Scope | Deps |
|---|---|---|
| nid_0bhqajvtdq3joblfdzgqogw0x_e | Pure statement parser (engine) | — |
| nid_ufbtmywzbsyn2gwrx7bi0ww08_e | Engine: named channels, labels, rel-note folding | parser |
| nid_82g9goy92k9ciyy64m1r6jofe_e | Reusable incremental vault index infrastructure | — |
| nid_wldz7yfjecf9fuwtlezlbde9s_e | Adapter: index + LinkProvider merge | parser, engine, infra |
| nid_ibx7hmt6cvmjh5rydi2aiyab9_e | Frontmatter relations (`frontmatterLinks`) | adapter |
| nid_fqdc55oifopcxxs4eb0w8q876_e | Named-depth settings rows | engine |
| nid_wnagjm2j144u0jsgixpcmmpar_e | View: edge labels + flyout breakdown | adapter |
| nid_1ycy9aszptp9fih76equxtcqa_e | GREAT UI for multi-name edges | view |
| nid_adesjb4clls56623vdu773ubg_e | Idea: per-name edge styling (deferred, p4) | view |
| nid_onhd5y7uqnbz8fl1hweryjuk4_e | Docs: README syntax + high-level-plan traversal (added at review 2026-08-17) | view, frontmatter, settings |

## Resolution (this ticket)

PLAN task completed 2026-08-17: codebase explored, every decision signed off
one by one by the human (decision log lived in `.out/current_decision.md`
during the session), the 9 tickets above created with deps + tags, and this
ticket rewritten to be the closed plan they all reference.

--------------------------------------------------------------------------------

## Original ask (kept for history)

The typical relationship is just a wiki link or an embed. - These are NOT named.
A named relationship will have some prefixed to it.
Syntax: `<rel-name>::<dest-note>`, e.g. `supports::[[note2]]` in note1.md means
note1 --supports--> note2.

Also wanted: third-party statements `[[note2]]::supports::[[note3]]` (note1
describing note2--supports-->note3 without own edges) — DROPPED per scope
decision above.

NOTES: we will want to grab the context of the links efficiently, and
"parallelize" the file fetch where needed with bounded concurrency, so that we
are able to gather the context to understand these relationships rapidly.
