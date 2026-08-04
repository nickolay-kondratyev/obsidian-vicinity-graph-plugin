---
closed_iso: 2026-08-01T01:01:46Z
id: nid_zlvkl9m4eepitt4efzbhtbhh6_e
title: Render markdown snippets nicely in the link preview drawer via MarkdownRenderer.render
status: closed
deps: []
links: [nid_22lykzp6opq6zcjrqzkshpeqy_e]
created_iso: '2026-08-01T00:53:02Z'
status_updated_iso: 2026-08-01T01:01:46Z
type: feature
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Investigation ticket nid_22lykzp6opq6zcjrqzkshpeqy_e confirmed this is low effort. Implement:

1. Add renderMarkdown(el, markdown, sourcePath): Promise<void> to GraphUiPort (src/view/viewPorts.ts).
2. Implement in ObsidianGraphUi via MarkdownRenderer.render(app, markdown, el, sourcePath, component); the hosting ItemView (through GraphViewController) is the lifecycle Component.
3. In src/view/LinkPreviewContent.tsx OccurrenceRow, replace the raw snippet <span> with a ref'd div + useEffect (same shape as GoButton icon effect). Clear el before append; re-run on expand/collapse toggle.
4. Delegated click handler on rendered a.internal-link anchors -> route through ObsidianNoteNavigator (openLinkText). Optional: hover-link page preview via ObsidianGraphUi.showHoverPreview.

See resolution section of the investigation ticket for full findings and caveats.

## Notes

**2026-08-01T01:01:46Z**

## Resolution (2026-07-31) — implemented, all tests green

Snippets in the link-preview drawer now render through Obsidian's own markdown renderer.

- src/view/viewPorts.ts: `GraphUiPort.renderMarkdown(el, markdown, sourcePath)` (replaces el content, safe to re-run) and `NoteNavigatorPort.openMarkdownLink(linktext, sourcePath)` (the internal-link click route; no existence guard on purpose — unresolved linktexts get Obsidian's stock create-offer, same as in the editor).
- src/view/ObsidianGraphUi.ts: implements renderMarkdown via `MarkdownRenderer.render`; new `component` ctor param — the hosting ItemView (passed as `this` from VicinityGraphView.onOpen) owns rendered-child lifecycles.
- src/view/ObsidianNoteNavigator.ts: implements openMarkdownLink via `workspace.openLinkText`.
- src/view/GraphViewController.ts: `openMarkdownLink` passthrough so the flow reaches the navigator.
- src/view/LinkPreviewContent.tsx: OccurrenceRow's raw snippet span replaced by `SnippetMarkdown` (ref + useEffect, same shape as GoButton's icon; re-renders on expand/collapse). ONE delegated click handler routes `a.internal-link` clicks (linktext from `data-href`) out through onOpenLink with preventDefault + stopPropagation, so a link click never toggles the row. sourcePath = the note the snippet was read from (goPath), so backlink snippets resolve against their SOURCE note.
- src/view/LinkPreviewDrawer.tsx / VicinityGraphFlow.tsx: thread renderMarkdown + onOpenLink props.
- src/view/link-preview.css: snippet is rendered HTML now — dropped monospace + pre-wrap; collapsed state inlines the rendered block children so the one-line ellipsis still clips them; expanded restores blocks with tight margins.

Tests: new BDD suite in LinkPreviewContent.component.test.tsx (seam calls incl. backlink sourcePath, expanded re-render, link click payload, no-toggle-on-link-click) with a fake that mimics Obsidian's `[[X]]` → a.internal-link/data-href shape; controller test for openMarkdownLink passthrough. npm test 1461 passed, npm run check + build green.

NOT done (optional per ticket): hover-link page preview on rendered anchors — small follow-up if wanted.
