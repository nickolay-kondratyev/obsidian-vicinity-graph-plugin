---
closed_iso: 2026-08-06T16:53:52Z
id: nid_0dle910iia37t42t28dqndc5b_e
title: Adjust the formatting of embed links in link fly out
status: closed
deps: []
links: []
created_iso: '2026-08-06T16:44:37Z'
status_updated_iso: 2026-08-06T16:53:52Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
Right now the formatting has odd `<< >>` this is left over from prompting. When it comes to embedded note links lets just render the `![[note-link]]` as is in the link fly out panel. That means `![[note-link|alias]]` would render just as is in the link fly out if the link is embedded WITHOUT being rendered as markdown at all for now. 

So in other words if the link is embedded link then it is drawn as raw markdown not as rendered markdown in the link fly out.

---

## Resolution (closed)

An embed occurrence in the link-preview drawer now renders as its OWN raw
wikilink text (`![[note-link]]`, `![[note-link|alias]]`) verbatim — the odd
`!<<Name>>` marker is gone.

The drawer renders each context snippet through Obsidian's markdown renderer,
which would EXPAND an `![[…]]` into the whole embedded note. The previous fix
(ticket `nid_yw2m80g72pahcvtsxi09o7vkd_e`) prevented that by collapsing each
embed to a resolved-name marker `!<<Name>>`. The new fix keeps the anti-expansion
guarantee but shows the embed as written: it simply backslash-escapes every
markdown-significant character in the raw `![[…]]` so the renderer prints it
literally instead of expanding it. No link resolution, no title lookup, no
alias/size interpretation.

### Changes
- `src/shared/MarkdownEmbeds.ts` — `flattened(markdown)` now escapes the raw
  embed match instead of building a `!<<name>>` marker. Dropped the whole
  naming machinery (`EmbedTargetTitle`, `displayNameOf`, `SIZE_SPEC`,
  `fileNameOf`, whitespace collapse, `MARKER_OPEN/CLOSE`). `titleOf` param
  removed.
- `src/adapters/ObsidianLinkOccurrenceProvider.ts` — removed the now-unused
  `embedTitleResolver` / `frontmatterTitleOf` memoised resolver and the
  `titleOf` threading through `occurrenceAt`.
- Stale doc references updated in `src/shared/Wikilinks.ts` and
  `src/shared/Wikilinks.test.ts` (`MarkdownEmbeds` no longer names embeds via
  `partsOf`).
- Tests updated to the raw-text behavior: `src/shared/MarkdownEmbeds.test.ts`,
  `src/adapters/ObsidianLinkOccurrenceProvider.test.ts`, and the real-Obsidian
  spec `e2e/linkPreview.e2e.ts`.

### Verification
- `npm run check` (tsc strict, src + e2e) — passes.
- `npm test` — 1661 passed.
- `npm run test:e2e -- linkPreview.e2e.ts` — 6 passed, including the embed row
  now showing `Source line embeds ![[embed-target]] inline.` and never the
  embedded body.
