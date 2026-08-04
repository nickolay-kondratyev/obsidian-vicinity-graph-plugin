---
closed_iso: 2026-08-01T00:53:06Z
id: nid_22lykzp6opq6zcjrqzkshpeqy_e
title: look into if it would be too much effort to render the markdown in the side
  pane in a nice way
status: closed
deps: []
links: [nid_zlvkl9m4eepitt4efzbhtbhh6_e]
created_iso: '2026-08-01T00:49:52Z'
status_updated_iso: 2026-08-01T00:53:06Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
context right now when we click links we get raw markdown for those links.

I am wondering if it would be straighforward to be able to render that markdown in a nice way. IN that place.
ALso note we would need to render the notes as well such as `[[]]` wiki link notes nicely. Maybe there is some obsidian API that allows us to render markdown for us? Look into this. The goal is be able to do this with minimal code without having to re-implement a markdown renderer.

## Resolution (2026-07-31) — investigated, answer: YES, low effort

**Verdict: NOT too much effort.** Obsidian ships exactly the API we hoped for, and the
repo already has the seam pattern to wire it in. Estimated at a small change
(~50–100 lines + tests), no markdown renderer re-implementation.

### The API

`MarkdownRenderer.render(app, markdown, el, sourcePath, component)` — public, static,
present in our pinned typings (`obsidian` 1.12.3, `@since 0.9.7`; the older
`renderMarkdown` overload is deprecated in favor of it). It renders any markdown
string into a given `HTMLElement` using Obsidian's own renderer:

- `[[wiki links]]` resolve against `sourcePath` and render as real `a.internal-link` anchors.
- Theme CSS applies automatically (light/dark just work — matches our styling convention).
- `component` is a lifecycle owner (our `ItemView` qualifies — it IS a `Component`) so
  embedded child renders unload correctly.
- It is async (`Promise<void>`), which fits a `useEffect` + ref pattern.

### Where it plugs in

The raw markdown lives in `src/view/LinkPreviewContent.tsx` → `OccurrenceRow`
(comment "Raw markdown text, per the parent ticket's explicit v1 allowance" marks the spot;
the snippet `<span>` shows `context.shortContext` / `context.expandedContext` verbatim).

Wiring mirrors the existing `renderIcon` seam exactly:

1. Add `renderMarkdown(el, markdown, sourcePath): Promise<void>` to `GraphUiPort`
   (`src/view/viewPorts.ts`).
2. Implement it in `ObsidianGraphUi` (`src/view/ObsidianGraphUi.ts`) — the one sanctioned
   home for Obsidian UI calls — delegating to `MarkdownRenderer.render`. The hosting
   `ItemView` (via `GraphViewController`) supplies the `Component`.
3. In `OccurrenceRow`, replace the raw text span with a ref'd div + `useEffect`, same shape
   as the existing `GoButton` icon effect. Re-render on expand/collapse toggle.

### Caveats found (small, known solutions)

- **Internal-link clicks are NOT auto-handled** outside a real MarkdownView. Need one
  delegated click listener on the rendered container: on `a.internal-link` click, call
  `app.workspace.openLinkText(href, sourcePath)` — we already use `openLinkText` in
  `ObsidianNoteNavigator.ts`, so route through that seam.
- Optional polish: hover page-preview on those links via the existing `hover-link`
  trigger in `ObsidianGraphUi.showHoverPreview`.
- Snippets are line fragments, so a fragment starting mid-sentence renders as a plain
  paragraph — fine. Effect must guard against double-append on re-run (clear `el` first).

Follow-up implementation ticket filed: see linked ticket (render markdown snippets nicely
in the link preview drawer).
