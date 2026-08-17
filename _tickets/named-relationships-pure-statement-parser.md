---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_0bhqajvtdq3joblfdzgqogw0x_e
title: "Named relationships: pure statement parser"
status: in_progress
deps: []
links: []
created_iso: 2026-08-17T16:44:23Z
status_updated_iso: 2026-08-17T17:40:59Z
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

