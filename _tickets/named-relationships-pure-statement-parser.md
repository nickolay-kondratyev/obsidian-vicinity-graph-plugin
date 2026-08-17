---
closed_iso: 2026-08-17T17:49:55Z
session_ids: [{"a": "claude", "type": "execution", "id": "18e57125-cfe7-4248-82b3-4e1bb920fb75"}, {"a": "claude", "type": "review", "id": "ae7869e7-c9df-413a-956d-ab6d96cc73e7"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_0bhqajvtdq3joblfdzgqogw0x_e
title: "Named relationships: pure statement parser"
status: closed
deps: []
links: []
created_iso: 2026-08-17T16:44:23Z
status_updated_iso: 2026-08-17T17:49:55Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [named-relationships]
---

Part of the named-relationships set. Read the PLAN first: `_tickets/add-ability-for-named-relationships.md` (closed plan ticket nid_fg66tanwkoyq3cqs1wdxagn21_e) — full syntax spec, signed-off decisions, architecture. Repo conventions: `CLAUDE.md` (layering view→adapters→engine, BDD tests, settings machinery).

Build a PURE parser (src/engine/, no obsidian/react imports — guarded by src/engine/importGuard.test.ts) that extracts relationship statements from markdown text.

Forms, decided precedence at each `::` (check left context):
1. ends with `]]` → REL-NOTE form: `[[he supports]]::[[target]]` — the name IS a note link (label = alias else basename). WRAPPED REL-NOTE (signed off 2026-08-17): if the statement is inside a `[...]`/`(...)` wrapper whose opener is separated from the rel-note link by WHITESPACE ONLY — `[ [[he supports]]:: [[x]] but not strongly ]` — the name stays the rel note but the statement takes form 2's EXTENT: runs to the wrapper's closer, consumes it, and captures the qualifier (`but not strongly`). Prose between opener and the rel-note link (`[because [[he supports]]:: [[x]] q]`) disqualifies the wrapper — never guess — so that parses as a PLAIN rel-note statement (brackets stay prose, no qualifier).
2. inside `[...]` or `(...)` wrapper → BRACKETED form: `[he supports:: [[x]]]` — name = text between opener and `::` (spaces allowed, trimmed); statement extends to the wrapper's closing bracket and consumes it. Text between the target run and the closer is the statement's QUALIFIER (trimmed, may be empty): `[supports:: [[x]] but not strongly]` → name `supports`, qualifier `but not strongly`. Qualifier is plain text — links inside it stay plain cache edges. Qualifiers exist ONLY in wrapped forms, the wrapped rel-note variant included (the closer is the terminator); bare/unwrapped-rel-note trailing prose stays ignored — WHY: without a bracket there is no terminator, and greedy unbracketed matching is Dataview's most-complained-about behavior, which this spec deliberately refuses to repeat.
3. else → BARE form: name = LONGEST run of `[A-Za-z0-9_-]` immediately before `::` (stops at punctuation: `prose.he-supports::[[x]]` → `he-supports`). Mid-sentence OK; surrounding prose ignored.

Precedence note: `(he-supports::[[x]])` is inside a `(...)` wrapper, so it parses via form 2 (name = `he-supports`, same by coincidence since the wrapped text is one token) — NOT form 3. Form 3 only fires when no unclosed `[`/`(` wrapper encloses the `::`.

Rules: NO whitespace immediately before `::` in EVERY form, bracketed included (`[he supports :: [[x]]]` rejects — stricter than Dataview, signed off; "trimmed" covers the leading space after the opener only); optional whitespace after. Targets = greedy comma-separated RUN of `[[link]]` / `![[embed]]` tokens after `::`, stopping at first non-link/non-comma token (reads Breadcrumbs/ExcaliBrain lists `up:: [[a]], [[b]]`). Embed targets keep an isEmbed flag. Unrecognized text yields NOTHING (links degrade to plain cache edges elsewhere — never guess).

Input masking (added at review 2026-08-17, consistency fix — flag to human if it feels like scope): statements inside CODE REGIONS (fenced blocks + inline code) and inside the leading FRONTMATTER block are NOT statements. WHY: Obsidian core does not index links in code regions, so a `supports::[[x]]` in a code fence would mint a named edge whose underlying link the rest of the graph cannot see — and the index scan gate (metadataCache links/embeds) would include or skip that file based on UNRELATED body links, making the behavior flicker; Dataview likewise ignores inline fields in code. Frontmatter is excluded from the INLINE scan because frontmatter relations have their own dedicated source (ticket nid_ibx7hmt6cvmjh5rydi2aiyab9_e via `frontmatterLinks`) — scanning the raw YAML text too would double-report. Reuse `src/shared/MarkdownCodeRegions.ts` as a pre-pass (engine already imports shared/; masking is same-length so all reported offsets stay FILE offsets — update that module's doc comment, which currently claims canvas harvesting is its only call site). Frontmatter exclusion may be a same-idea mask of the leading `---` block.

Output per statement: name (text or rel-note link ref), ordered targets, optional qualifier (wrapped forms only), and OFFSETS/positions of the whole statement and of the rel-note occurrence (needed later for flyout snippets and rel-note folding).

BDD fixture tests (WHEN/THEN, one behavior per test) covering every form, precedence collisions, punctuation boundaries, comma-run termination, embeds, qualifiers (present/empty/containing links), wrapped rel-note (whitespace-only opener gap → qualifier captured + closer consumed; prose before the rel-note link → plain rel-note, brackets stay prose), code-region + frontmatter masking (statement in a fence / inline code / frontmatter yields nothing; offsets after a masked region stay file offsets), and degenerate inputs.

--------------------------------------------------------------------------------

## Resolution (2026-08-17)

Built the pure parser as **`src/engine/RelationshipStatements.ts`** — class
`RelationshipStatements` with a single static `parse(text): readonly
RelationshipStatement[]`. Tests: **`src/engine/RelationshipStatements.test.ts`**
(65 BDD cases). Public API re-exported from `src/engine/index.ts`
(`RelationshipStatements` + types `RelationshipStatement`, `RelationshipName`,
`RelationshipTarget`, `TextSpan`).

### Output shape
- `RelationshipStatement` = `{ name, targets, qualifier, span }`.
- `name` is a discriminated union: `{ kind: "text", text }` (bare/bracketed) or
  `{ kind: "rel-note", linkText, label, occurrence }` where `label` = alias else
  basename of the link target, and `occurrence` is the `[[…]]` span (folds out of
  the graph later).
- `targets`: ordered `{ linkText, isEmbed }[]` (link text is target only —
  alias/subpath stripped via `Wikilinks.partsOf`). A statement needs ≥1 target.
- `qualifier`: `string | null` — the trimmed trailing text in WRAPPED forms
  (possibly `""`); `null` for unwrapped forms (they have no terminator).
- `span` / `occurrence`: half-open `[start, end)` FILE offsets.

### How it works
Scans every `::` in a MASKED copy of the text (structure decisions read the
mask; all extracted TEXT is sliced from the original, so a link inside a
qualifier survives its own inline-code masking). Masking = `frontmatterMasked`
(leading `---`…`---`/`...` block blanked to same-length spaces) then
`MarkdownCodeRegions.withCodeMasked` — both same-length so offsets stay file
offsets. Per `::`: reject whitespace-before, then precedence rel-note (link ends
at `::`) → bracketed (innermost unclosed `[`/`(` left of `::`) → bare (longest
`[A-Za-z0-9_-]` run). Wrapper closers matched by bracket-type depth count so a
nested `[[x]]` balances; wrapped rel-note gated on a whitespace-only gap between
opener and link.

### Decisions made autonomously (ticket left them open)
- **Empty/pure-subpath target** (`rel::[[#h]]`) terminates the target run and, if
  it leaves zero targets, yields no statement.
- **Bracketed opener with no closer on the line** degrades to no qualifier, span
  = target-run extent (no terminator ⇒ no greedy swallow of the rest of the line).
- **Frontmatter without a closing fence** is not treated as frontmatter (matches
  Obsidian) and is left scannable.
- Frontmatter masking lives as a private helper in the parser (parser-specific
  YAML concern, SRP) rather than in `MarkdownCodeRegions`; that module's doc
  comment was updated to name this second call site as the ticket required.

### Verification
`npm run check` (0 errors), `npm test` (2251 passed / 1 pre-existing skip),
import guard green. Pure engine change ⇒ no e2e gate per CLAUDE.md. Not consumed
yet — the adapter/engine tickets in the set wire it in.

