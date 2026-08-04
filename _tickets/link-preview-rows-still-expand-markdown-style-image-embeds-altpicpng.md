---
id: nid_vvdc7lhh92122ght4m66t5d61_e
title: "Link-preview rows still expand markdown-style image embeds ![alt](pic.png)"
status: open
deps: [nid_lgo91fzkivxiu32g1j5bttzca_e]
links: []
created_iso: 2026-08-04T22:26:32Z
status_updated_iso: 2026-08-04T22:26:32Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [link-preview, display]
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

