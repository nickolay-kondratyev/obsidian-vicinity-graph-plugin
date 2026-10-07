---
closed_iso: 2026-10-07T16:00:30Z
id: nid_hg4yxf9zqkg9mvs5kmeporfjw_e
title: "Relationships: should Excalidraw drawings (*.excalidraw.md) be excluded from AI naming?"
status: closed
deps: []
links: []
created_iso: 2026-10-07T00:55:36Z
status_updated_iso: 2026-10-07T16:00:30Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
parent: nid_fc47gtxej6z7fqc53bflme8p5_e
tags: [relationships]
---

Plain version: the AI namer (ticket 3/4, nid_cbnhpdfn4myqfzqr8weyg7kq5_e) only names links between notes that are `.md` or `.canvas` (your earlier decision). Excalidraw drawings are saved as `*.excalidraw.md`, so today they count as notes. Their body is mostly drawing data, not prose, so the AI would be paid to read JSON-like junk.

Options:
- A (recommended): exclude `*.excalidraw.md` from AI naming. A small change in the pure eligibility check (`src/engine/AiEligibility.ts`, rule (e)) plus one test.
- B: keep them eligible (current behavior). Cost is wasted when such a note passes the 200-char minimum.

Reply A or B. Not blocking: 4/4 proceeds either way.

## Decision (human, 2026-10-07)
Option A: exclude `*.excalidraw.md` from AI naming "for now". Implement it in the pure eligibility check (rule (e)), with a test, and update the README AI-naming section if it lists the eligible file types.

## Implementation note
`aiEdgeEligibility` returns a new reason `excalidraw-drawing` when either end is `*.excalidraw.md` (case-insensitive, via `FileKinds.isExcalidrawPath`, the same suffix rule that already keeps drawings out of outline parsing). Plain notes whose name merely contains "excalidraw" stay eligible. README AI-naming skip list updated.
