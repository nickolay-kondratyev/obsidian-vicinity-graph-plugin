---
closed_iso: 2026-08-15T07:20:46Z
session_ids: [{"a": "claude", "type": "execution", "id": "d6aeca0c-8a09-4f67-ad78-90f5910be0ed"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_3lwh7nfhvevy0y4mg0ylyxaoy_e
title: "Fix this error that came in obsidian publish review"
status: closed
deps: []
links: []
created_iso: 2026-08-15T05:28:31Z
status_updated_iso: 2026-08-15T07:20:46Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

```
Error
Creating and attaching "style" elements is not allowed. For loading CSS, use a "styles.css" file instead, which Obsidian loads for you.
e2e/folderNoteRename.e2e.ts:52
```

## Resolution

The flagged code was TEST-ONLY: `e2e/folderNoteRename.e2e.ts` injects the
community "Folder Notes" plugin's unscoped hide rule (a verbatim stand-in for
that plugin's `styles.css`) into the live Obsidian page to reproduce the ghost
-node regression. The plugin itself creates no style elements — this was the
only `createElement("style")` in the repo — but the publish review scans every
file, so the pattern had to go.

Fix: the beforeAll now injects the same rule via
`new CSSStyleSheet()` + `document.adoptedStyleSheets` (identical document-wide
effect, no `style` element). A comment at the injection site records WHY, so
nobody "simplifies" it back. Verified: `npm run check`,
`npm test` (2183 passed), and `npm run test:e2e -- folderNoteRename.e2e.ts`
(both specs pass — the injected rule still hides tagged nodes, so the
regression is still exercised).