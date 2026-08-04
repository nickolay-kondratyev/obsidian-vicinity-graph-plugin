---
closed_iso: 2026-08-04T22:14:16Z
id: nid_yw2m80g72pahcvtsxi09o7vkd_e
title: Improve the rendering of link preview when embedded link is used
status: closed
deps: []
links: []
created_iso: '2026-08-04T00:20:25Z'
status_updated_iso: 2026-08-04T22:14:16Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
Right now when we have embedded links they render as their full note in link preview which is NOT what we want. 

I am thinking maybe we just render them as 

```
!<<Rendered Note Name/or title if title exists in frontmatter>>
```

So that we would just render the note name and the `!` to signify the embed. But not the full embedded portion.

## Resolution (2026-08-04)

Done as asked: every `![[…]]` inside a link-preview context snippet is replaced
by the marker `!<<Name>>` before the snippet reaches Obsidian's markdown
renderer, so no embed expands into an occurrence row.

**How the marker is NAMED** (most specific first): the written alias
(`![[note|Shown]]` → `!<<Shown>>`), else the target's frontmatter title
(`title`, else `name` — reusing `LinkProvider.getFileMetadata().frontmatterTitle`,
the same precedence node labels use), else the file name — extension dropped for
notes, kept for attachments (`![[chart.png]]` → `!<<chart.png>>`). A same-file
section embed (`![[#Section]]`) is named by its subpath.

**Where:**
- `src/shared/MarkdownEmbeds.ts` (new, pure) — the rewrite, plus the markdown
  ESCAPING that makes it survive rendering: unescaped, `<Name …>` is a
  well-formed HTML open tag and the renderer swallows the marker.
- `src/shared/Wikilinks.ts` — new public `partsOf()` (target / subpath / alias),
  the display-side split next to the resolution split it already did.
- `src/adapters/ObsidianLinkOccurrenceProvider.ts` — flattens both context views
  right after `LinkContextSnippets` extraction. Flattening lives HERE because
  only an adapter can resolve a link text against the vault; the pure snippet
  extractor stays raw-text, and the view has no resolver.

**Tests:** `src/shared/MarkdownEmbeds.test.ts` (naming precedence + escaping),
`Wikilinks.test.ts` (partsOf), `ObsidianLinkOccurrenceProvider.test.ts` (embed
occurrence + frontmatter-title case + line unchanged), and a real-Obsidian case
in `e2e/linkPreview.e2e.ts` — the only place that can prove the renderer no
longer expands the embed and that the escaped marker shows literally.
`npm test` (1616), `npm run check` and `npm run test:e2e -- linkPreview.e2e.ts`
(6/6) all pass.

**Deliberately out of scope:** markdown-style `![alt](img.png)` embeds (different
syntax, nothing asked for it) and code-span awareness (an `![[x]]` written inside
a code span is flattened too — cosmetic, in a preview).
