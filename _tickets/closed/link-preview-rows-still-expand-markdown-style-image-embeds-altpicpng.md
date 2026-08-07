---
id: nid_vvdc7lhh92122ght4m66t5d61_e
title: Link-preview rows still expand markdown-style image embeds ![alt](pic.png)
status: closed
deps: [nid_lgo91fzkivxiu32g1j5bttzca_e]
links: []
created_iso: '2026-08-04T22:26:32Z'
closed_iso: '2026-08-06T23:10:00Z'
status_updated_iso: '2026-08-06T23:10:00Z'
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [link-preview, display]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
---
Follow-up to nid_yw2m80g72pahcvtsxi09o7vkd_e, which flattened WIKILINK embeds (`![[…]]`) in link-preview context snippets to a `!<<Name>>` marker (`src/shared/MarkdownEmbeds.ts`, applied in `src/adapters/ObsidianLinkOccurrenceProvider.ts`).

The SAME user-visible defect remains for the markdown-style embed syntax: `![alt](pictures/chart.png)` written in a note is still handed verbatim to `GraphUiPort.renderMarkdown` (see `src/view/LinkPreviewContent.tsx` `SnippetMarkdown`), so Obsidian renders the IMAGE inside a one-line occurrence row and blows up the row.

The syntax matcher already exists: `src/shared/MarkdownInlineLinks.ts` captures the embed marker and the destination, exactly the two things `MarkdownEmbeds.flattened` needs. Naming should follow the same precedence already implemented for wikilinks (written label, else target frontmatter title, else file name).

## Update (2026-08-04, review round 3)

Two things this ticket must NOT be picked up without:

1. **It depends on `nid_lgo91fzkivxiu32g1j5bttzca_e`** (now recorded in `deps`).
   `INLINE_LINK_SOURCE` matches ACROSS newlines, and `MarkdownEmbeds.flattened`
   REWRITES what it matches — so wiring the inline matcher into the flattener
   before that newline decision is made would re-open, for the markdown syntax,
   exactly the deleted-prose path round 2 closed for wikilinks.
2. **EXTERNAL destinations are in scope here.** `![alt](https://host/pic.png)`
   expands to a remote image in the row just like a vault-relative one, but
   `MarkdownInlineLinks.harvestedLinksOf` deliberately yields NOTHING for
   external destinations (they name no vault document). So the flattener cannot
   simply reuse that harvest — display naming needs the written label, else the
   destination as written; the vault-resolution precedence (frontmatter title,
   file name) applies only to destinations that resolve.

## Acceptance Criteria

- A snippet containing `![alt](pic.png)` renders as a marker, not an image.
- A snippet containing `![alt](https://host/pic.png)` renders as a marker too.
- Plain markdown links `[label](note.md)` stay clickable links (unchanged).
- Unit tests in `src/shared/MarkdownEmbeds.test.ts` cover the new syntax alongside the wikilink cases.

## Resolution (2026-08-06)

`MarkdownEmbeds.flattened` now runs a SECOND escape pass over
`MarkdownInlineLinks.globalPattern()` after the existing wikilink pass, escaping
every markdown-style embed (`![alt](…)`, marker group `"!"`) the same way it
escapes `![[…]]` — the whole match is backslash-escaped so Obsidian's renderer
shows it VERBATIM instead of expanding an image into the one-line row. Because
escaping only touches the WRITTEN text and never resolves the destination, the
naming-precedence question the ticket raised is moot: external destinations
(`![alt](https://host/pic.png)`) escape identically to vault-relative ones, so
no `harvestedLinksOf` reuse (which drops externals) was needed.

The dep on `nid_lgo91fzkivxiu32g1j5bttzca_e` is honoured: the inline matcher
tolerates a single newline but not a paragraph break, so the flattener skips any
match where the new public `MarkdownInlineLinks.spansParagraphBreak(match)` is
true — leaving a blank-line-straddling match verbatim rather than rewriting it
and deleting the reader's prose between the halves. That predicate is the same
one `harvestedLinksOf` already used inline (now extracted and shared, DRY).

Plain `[label](note.md)` links (no bang → `LinkKinds.ofEmbedMarker` = `"link"`)
are left untouched and stay clickable.

**Tests.** `src/shared/MarkdownEmbeds.test.ts` gains cases for the vault-path
embed, the external-image embed, verbatim escaping, the untouched plain link,
the paragraph-break-straddling non-rewrite, and a mixed both-syntaxes line.
`e2e/linkPreview.e2e.ts` gains a real-Obsidian test proving the row shows raw
`![chart](pictures/chart.png)` text with zero `<img>` in the drawer, while the
plain `[[md-embed-target]]` beside it renders as its clickable label. Full
`npm test` (1717) + `npm run check` + `npm run test:e2e -- linkPreview.e2e.ts`
(7 passed) green.

Touched: `src/shared/MarkdownEmbeds.ts`, `src/shared/MarkdownInlineLinks.ts`,
`src/shared/MarkdownEmbeds.test.ts`, `e2e/linkPreview.e2e.ts`.
