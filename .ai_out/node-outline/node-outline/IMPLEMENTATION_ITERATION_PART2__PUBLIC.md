# IMPLEMENTATION_ITERATION_PART2__PUBLIC — response to the part-2 review

Role: `IMPLEMENTATION_PART2` (fresh instance). Input:
`IMPLEMENTATION_REVIEW_PART2__PUBLIC.md` (verdict **CHANGES REQUIRED**).
One commit: `086549f`, plus this doc pair and one ticket. Tree clean.

## Status

| | |
|---|---|
| `npm run check` | **PASS** (clean). `tsc -p e2e/tsconfig.json` also clean. |
| `npm test` | **815 passed / 3 failed** — the same 3 **PRE-EXISTING** `collidePaddingPx` failures (`SettingsSpec.test.ts` ×2, `forceLayoutSettings.test.ts` ×1). Not touched, not re-pinned. Unchanged count: this iteration adds e2e coverage only. |
| `npm run test:e2e` | **36 passed / 2 failed** (was 33/2 — **+3 new cases**, all green). The 2 failures are the same pre-existing, already-ticketed ones: `edgeRoutingEval` radial routing gate and `vicinityGraph` gamma breadcrumb. |
| Mutation verification | **5 mutations run, 5 went red on exactly the intended test**, tree restored each time. |

---

## Findings — disposition

### M1 — `data-preview="outline"` un-pinned the attachment strip below 104px → **FIXED**

`src/view/graph-view.css`: the
`[data-preview="outline"] .vicinity-graph-node__preview-zone { flex: 0 0 auto }`
rule moved **inside** `@container (min-height: 104px)`, next to the reveal it
belongs with. The comment now states the WHY explicitly ("below the threshold the
outline is `display: none` and cannot absorb anything, so dropping the title
zone's flex-grow there unpins the strip").

**A test that would have caught it — added, and honestly failable.** New e2e case
`an outline-bearing node below the outline threshold still pins its attachment
strip to the bottom`:

- New `ObsidianHarness.setMaxNodeSizePx(96)`. Centrals are always sized at
  `maxPx`, so this is the **one deterministic lever** for putting MAIN in a chosen
  density band — the same reason every other case in this file asserts on MAIN.
- Preconditions asserted, so the case cannot pass vacuously: `data-preview` is
  `outline`, the outline element is **hidden**, and the node's height is in
  `[72, 104)`.
- The assertion is the user-visible fact, not the CSS property: the dead space
  between the bottom of the attachment strip and the node's bottom padding edge
  must be ≤ 1px. Measured with `clientHeight` / `offsetTop` / `offsetHeight`
  (layout px — immune to React Flow's zoom transform).
- Runs **last** in the serial file, because it shrinks every node afterwards.

No RTL/jsdom excuse needed: this one was reachable.

### M2 — nothing proved the RAW heading (not the label) is the link key → **FIXED**

New e2e case `the linktext is built from the RAW heading, not the stripped label`
clicks the fixture's markdown-carrying heading
(`## Status of [[outline-cover]] **today**`) and asserts the recorded linktext
**contains `**today**`** — which survives only if `entry.rawText` was the key.
Deliberately `toContain`, not an equality assertion: the exact output belongs to
`stripHeadingForLink`, and pinning it would be pinning Obsidian's internals (the
reviewer's own framing, and the reason the previous case used a plain heading).

### M3 — nothing proved `stopPropagation` blocks the node-level open → **FIXED**

New e2e case `clicking an outline entry does not ALSO trigger the node-level
open`. The spy helper now wraps **both** navigation paths:

- `workspace.openLinkText` (as before), and
- `WorkspaceLeaf.prototype.openFile` — prototype-level, because leaves are created
  per navigation. Each call is recorded as `` `${file.path}${eState?.subpath ?? ""}` ``,
  so a heading-carrying open and a plain "open at the top" are distinguishable.

The assertion is an exact list: `["outline-note.md#Background"]`. A leaked
node-level click appends a second, subpath-less entry. Measured, not assumed —
the recorded shape was confirmed against real Obsidian 1.12.7 before the
assertion was written.

### MINOR 1 — the `openLinkText` spy was never restored → **FIXED**

`spyOnOpenLinkText` became `recordNavigationFromNow()`: the wrappers install **at
most once** (re-wrapping would make one click record twice — a real bug the new
tests would otherwise have hit, since three cases now install), the logs clear on
every call, and `restoreNavigationSpies()` runs in `afterAll` before the harness
closes. The doc comment now matches what the code does.

### MINOR 2 — `outlineEntryLabel`'s bounded scope was incomplete → **FIXED**

Two entries added to the module's "DELIBERATELY NOT HANDLED" list: multi-pipe
wikilink aliases (`[[a|b|c]]` → `c`, Obsidian shows `b|c`) and the pathological
`"## "`, whose empty-result fallback is the sole path by which a `#` marker
reaches the display. Documentation only — no behaviour change, and no test added:
pinning behaviour the module explicitly does **not** promise would convert a
documented limit into a contract.

### MINOR 3 — the CSS tie-break is still order-sensitive → **REJECTED (with a test instead)**

The suggestion is to move the 104px reveal out of `graph-view.css` into
`node-outline.css`. Rejected on **PARETO + consistency**:

- The current split is a documented, conscious choice at *both* ends
  (`node-outline.css`'s header says "ONE rule lives elsewhere on purpose … the
  split is purely editorial"; `graph-view.css` names the tie-breaker and why).
  Moving it splits the "what shows at what node size" density ladder — thumbnail
  at 104, attachments at 72, outline at 104 — across two files, trading one trap
  for a different discoverability problem.
- M1's fix puts the second outline-gated rule in that same ladder block, which
  makes keeping the ladder together *more* valuable, not less.

What I did instead is address the **risk** rather than the layout: the first E1
case now asserts the outline is **visible**, not merely present. `toHaveText`
reads `textContent`, which a `display: none` outline satisfies — i.e. the exact
regression this trap produces was previously only caught indirectly (by E5's
overflow precondition), and is now caught by name. Mutation-verified: reverting
the ancestor tie-breaker turns that case red with
`expect(locator).toBeVisible() failed`.

### MINOR 4 — E5 proved `overflow-y: auto`, not the wheel path → **FIXED**

The case now performs a **real wheel** over the list
(`outline.hover()` → `page.mouse.wheel(0, 120)`) instead of assigning
`scrollTop`, and is renamed `the wheel scrolls the outline (not the canvas) while
its scrollbar is hidden`. The `scrollHeight > clientHeight` precondition stays.
Mutation-verified by dropping the `nowheel` class: the wheel then zooms the
canvas and `scrollTop` stays 0 → red. Observed green on 3 separate runs, so the
headless-flakiness worry did not materialise; if it ever does, the honest fallback
is the old programmatic assertion **plus** the narrower name, not a weakened one.

---

## Also done — a binding requirement that was still outstanding

CLARIFICATION **Round 4, decision #10** (added with the review commit `de0bee9`,
after the previous implementation instance finished) accepts the manual GUI check
as a post-merge smoke test **and requires a ticket** so it is not forgotten. That
ticket did not exist. Added:
`docs-internal/tickets/ticket-node-outline-heading-jump-smoke-run.md` — six
concrete steps (late heading, reading view, the markdown-carrying heading,
ctrl-click), with what to record and an explicit statement of which half of the
contract the e2e already covers.

---

## Mutation verification (all 5 run against real Obsidian; tree restored after each)

| # | Mutation | Expected red | Observed |
|---|---|---|---|
| 1 | re-add the `[data-preview="outline"]` flex rule **outside** the container block (the reviewed bug, verbatim) | M1 case | **1 failed / 10 passed** ✅ |
| 2 | `NodeOutline.tsx`: `outlineEntryOpenOptions(entry.rawText, …)` → `(label, …)` | M2 case | **1 failed / 4 passed** ✅ — and the pre-existing plain-heading case stayed **green**, confirming the reviewer's diagnosis exactly |
| 3 | `NodeOutline.tsx`: drop `event.stopPropagation()` | M3 case | **1 failed / 5 passed** ✅ |
| 4 | `NodeOutline.tsx`: drop the `nowheel` class | wheel case | **1 failed / 8 passed** ✅ |
| 5 | `graph-view.css`: revert the ancestor tie-breaker on the reveal | E1 visibility | **1 failed** (`toBeVisible`) ✅ |

Mutations 2–5 abort the rest of the serial file after the failure ("N did not
run") — expected, not extra breakage.

## Not touched, on purpose

- The 3 pre-existing vitest failures and the 2 pre-existing e2e failures.
- `change_log` and `docs-internal/CHANGELOG.md` — TOP_LEVEL_AGENT owns them.
- `main.js` / `styles.css` (build artifacts; regenerated via
  `npm run setup:dev-vault`, never hand-edited, and untracked in this repo).
- No `ap_XXX_E` anchor, no behaviour-capturing test weakened or removed. The one
  changed assertion (`scrollTop` → real wheel) is **strictly stronger**.

## Questions for the human

None.
