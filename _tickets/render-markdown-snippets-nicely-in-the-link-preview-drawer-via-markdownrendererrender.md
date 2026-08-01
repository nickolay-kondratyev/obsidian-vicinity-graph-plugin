---
id: nid_zlvkl9m4eepitt4efzbhtbhh6_e
title: "Render markdown snippets nicely in the link preview drawer via MarkdownRenderer.render"
status: open
deps: []
links: [nid_22lykzp6opq6zcjrqzkshpeqy_e]
created_iso: 2026-08-01T00:53:02Z
status_updated_iso: 2026-08-01T00:53:02Z
type: feature
priority: 3
assignee: nickolaykondratyev
---

Investigation ticket nid_22lykzp6opq6zcjrqzkshpeqy_e confirmed this is low effort. Implement:

1. Add renderMarkdown(el, markdown, sourcePath): Promise<void> to GraphUiPort (src/view/viewPorts.ts).
2. Implement in ObsidianGraphUi via MarkdownRenderer.render(app, markdown, el, sourcePath, component); the hosting ItemView (through GraphViewController) is the lifecycle Component.
3. In src/view/LinkPreviewContent.tsx OccurrenceRow, replace the raw snippet <span> with a ref'd div + useEffect (same shape as GoButton icon effect). Clear el before append; re-run on expand/collapse toggle.
4. Delegated click handler on rendered a.internal-link anchors -> route through ObsidianNoteNavigator (openLinkText). Optional: hover-link page preview via ObsidianGraphUi.showHoverPreview.

See resolution section of the investigation ticket for full findings and caveats.

