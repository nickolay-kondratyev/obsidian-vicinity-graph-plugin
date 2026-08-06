---
closed_iso: 2026-08-06T21:01:26Z
id: nid_u877k92mv4vgcc3h3i2t2e1wi_e
title: Work on styling the links in the side panel
status: closed
deps: []
links: []
created_iso: '2026-08-01T01:30:37Z'
status_updated_iso: 2026-08-06T21:01:26Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
---
Need to improve the styling of the links in the side panel.

Use playwright to analyze how the styling/display of links looks like right now.

Problems that currently exist (may be more of them):
- there is no wrapping which shows up especially for longer text, we should have wrapping and multi line rendering of markdown
- The style of the link reference looks a bit ugly itself (the gray backgounrd right now on dark background does not looked polished.)

## Resolution (2026-08-06)

CSS-only polish of the link-preview drawer occurrence rows
(`src/view/link-preview.css`; `styles.css` is the generated build artifact).
Analyzed live in a real Obsidian via Playwright screenshots (dark + light),
which showed: collapsed rows hard-clamped to ONE ellipsised line (no wrapping),
a flat `--background-secondary` count pill reading as a grey slab on dark, and
the row `:hover` painting a full-bleed grey slab that sprawled once a row was
expanded to several lines. (The persistent "grey box" first seen in shots was
just that hover state — the DOM row background is transparent otherwise.)

Changes:
- **Wrapping / multi-line** — collapsed context now WRAPS, clamped to two lines
  via `-webkit-line-clamp: 2` (was `white-space: nowrap` + one-line ellipsis).
  Longer context reads as multi-line prose with an ellipsis on line 2; expanding
  still drops the clamp (`-webkit-line-clamp: none; display: block`) and shows
  the whole rendered snippet, wrapped.
- **Count pill** — from a filled `--background-secondary` slab to a subtle
  OUTLINED chip (`1px solid var(--background-modifier-border)`, transparent fill,
  `--text-muted`), so it stops reading as an unpolished grey block on dark.
- **Row hover** — kept the hover highlight but made it feel intentional: an
  always-reserved 2px transparent `border-left` that colours to
  `--interactive-accent` on hover (accent rail, no layout shift), alongside the
  contained rounded highlight.

Verification: `npm run check` (tsc strict, src + e2e), `npm test` (1669 passed),
and `npm run test:e2e -- linkPreview.e2e.ts` (6 passed — the three `all: unset`
button-chrome guards still bite). Visual QA via Playwright screenshots in both
themes confirmed the wrapped collapsed rows, the outlined pill, and the accent
hover rail.
