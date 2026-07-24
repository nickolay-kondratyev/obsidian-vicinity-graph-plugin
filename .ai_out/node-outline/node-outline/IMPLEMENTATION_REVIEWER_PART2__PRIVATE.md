# IMPLEMENTATION_REVIEWER_PART2 — private notes

Session: review of `node-outline` steps 6–10 (`96d4093` … `27ca2b5`).
Verdict issued: **CHANGES REQUIRED** (M1 regression + M2/M3 coverage gaps).

## What I actually executed (so a re-review does not redo it)

- `npm test` → 815/3 (the 3 pre-existing `collidePaddingPx` ones). Log
  `.tmp/npm-test.log`.
- `npm run check` → clean. Log `.tmp/npm-check.log`.
- `npm run test:e2e` → **33 passed / 2 failed**, ~1.1 min, real Obsidian
  auto-downloaded. Log `.tmp/e2e-review.log`. Failures are
  `edgeRoutingEval.e2e.ts` radial-gate and `vicinityGraph.e2e.ts` breadcrumb —
  both pre-existing; `.vicinity-graph-node__breadcrumb` exists nowhere in `src/`.
- Mutation harness `.tmp/mutcheck.py` — patches a file, runs the one vitest
  file, restores from the in-memory original. 5 mutations, 5 red. `git status`
  clean afterwards. Re-runnable as-is.

## Reasoning behind the one non-obvious finding (M1)

The chain is:
1. `graph-view.css:128` gives `.vicinity-graph-node__preview-zone`
   `flex: 1 1 auto`, and its comment says this *replaces* the attachment
   strip's old `margin-top: auto`.
2. `graph-view.css:181` repeats the dependency on the strip itself.
3. The new rule at `:223` sets `flex: 0 0 auto` on the preview zone for
   **every** `[data-preview="outline"]` node, at any size.
4. `.vicinity-graph-outline` is `display: none` below 104px, so it is not a flex
   item and cannot take the slack.
→ 72–104px outline-bearing nodes lose the bottom-pinned strip.

I did not visually confirm this in a browser — it is pure CSS box reasoning, but
the chain is explicit in the repo's own comments. If the implementer pushes back,
the cheap disproof is a screenshot of a 72–104px node with attachments whose
note has headings (dev vault: any small neighbour of `note1` with an outline).

## Judgement calls I made

- **Did not** re-litigate the 3 pre-existing vitest failures (settled), nor
  part 1's design (`empty outline ≡ image wins`, array on `FlowNodeData`).
- **Did not** flag the `useNoteOpen()` call per entry button (≤40 context reads
  per node) — not a real cost, would be a nitpick.
- **Did not** flag `preview === "thumbnail" && thumbnailUrl !== null` as
  redundant — it is a cheap belt-and-braces, not duplicated knowledge.
- Classified M2/M3 as MAJOR rather than MINOR because both guard the *specific*
  behaviours the human named in Round 3 / the original task, and both would stay
  green under a one-word regression.
- Verdict is CHANGES REQUIRED rather than APPROVED WITH MINORS solely because M1
  is a loss of previously shipped behaviour, which the role treats as a
  first-class concern.

## Open with the human

One `#QUESTION_FOR_HUMAN` in the public file: the manual dev-vault check
(Obsidian scrolls to + flashes the heading, editing AND reading view) was never
performed and needs a GUI. Implementer disclosed it honestly.
