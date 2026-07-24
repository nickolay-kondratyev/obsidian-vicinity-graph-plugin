# Ticket: verify how fast a node's outline refreshes while headings are edited

**Status:** OPEN — **verify first, only then decide whether to build anything.**
**Origin:** `node-outline` CLARIFICATION Round 2, decision #6 (binding: no speculative work now).

## The question

A node's heading outline is recomputed on every graph rebuild, never persisted.
So: after a human edits a heading in the open note, **how long until the graph
shows the new text?**

## What is already wired (do not re-derive)

`VicinityGraphView.tsx` registers `metadataCache.on("resolved")` →
`controller.handleMetadataResolved()`, debounced by `REBUILD_DEBOUNCE_MS = 500`.
Obsidian fires `resolved` after it re-indexes a changed file, so edited headings
very likely already refresh on their own. The earlier assumption that no such
listener existed was **wrong**.

## Do this

1. In a real vault (not the dev vault — index size matters), open a note with an
   outline-bearing neighbour, edit one of that neighbour's headings, and time how
   long the node takes to show the new label.
2. Repeat while editing the **active** note's own headings.
3. Record the observed latency here.

## Then decide

- **Feels immediate** → close this ticket. No code.
- **Noticeably laggy** → add a debounced `metadataCache.on("changed")` trigger
  alongside the existing `resolved` one, reusing the same debounce. `changed`
  fires per-file on edit, ahead of the vault-wide resolve pass.

Do **not** add the `changed` listener before step 1 says it is needed: it fires
far more often than `resolved`, so it buys latency at the cost of rebuild churn.

## Out of scope

Persisting outlines, or any incremental "patch just this node's outline" path.
The outline is cheap to recompute; the only open question is the trigger.
