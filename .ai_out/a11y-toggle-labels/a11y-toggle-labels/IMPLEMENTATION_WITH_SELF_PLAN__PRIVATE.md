# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (a11y toggle labels)

State: **COMPLETE**. Commit `25e75f6` on `a11y-toggle-labels`. Tree clean. Nothing left to do
except what TOP_LEVEL_AGENT owns (change log, ticket closure, merge).

## Plan I executed

1. Probe real Obsidian DOM to answer the 3 open questions (the whole reason this ticket was deferred).
2. Extend `e2e/settingsUxVisual.e2e.ts` guard → watch RED for the right reason.
3. Implement `nameToggle` + wire both call sites → GREEN.
4. Mutation-check the guard.
5. Delete the probe, run all four gates, commit.

## Raw probe output (kept — the probe file is deleted)

### Probe run 1 — baseline DOM (`.tmp/probe.log`)

```
REQUIRE_FAILED Error: Cannot find module 'obsidian'
Require stack:
- electron/js2c/renderer_init
ROW name=[Own file size] control=[<div class="setting-item-control"><label class="checkbox-container is-enabled" tabindex="0"><input type="checkbox" tabindex="0"></label><input type="number" spellcheck="false" min="0" max="100" step="0.5" aria-label="Own file size weight"></div>]
  cb rect=[15x15] opacity=[0] visibility=[visible] display=[block] tabIndex=[0]
ROW name=[Total linker size] control=[… <label class="checkbox-container" tabindex="0"><input type="checkbox" tabindex="0"></label><input type="number" … disabled="" aria-label="Total linker size weight"></div>]
ROW name=[Backlinks] …            (same shape)
ROW name=[Outlinks] …             (same shape)
ROW name=[Depth decay] …          (same shape)
ROW name=[Exclude notes from the graph] control=[<div class="setting-item-control"><label class="checkbox-container" tabindex="0"><input type="checkbox" tabindex="0"></label></div>]
  cb rect=[15x15] opacity=[0] visibility=[visible] display=[block] tabIndex=[0]
```

Findings: container is a **`<label>`** (not a div, as the ticket/comment claimed) and it is **textless**;
6 toggles exactly; checkbox is opacity-0 but boxed, `visibility:visible`, `tabIndex=0`.
`window.require("obsidian")` is NOT available in the renderer — dead end for introspecting
`ToggleComponent` directly.

### Probe run 2 — marker patch to answer Q1 (`.tmp/probe2.log`)

Temporarily inserted in `addSizingMetricRow`:
`toggle.then((t) => t.toggleEl.setAttribute("data-probe-toggleel", "1"))` — rebuilt, re-probed:

```
<label class="checkbox-container is-enabled" tabindex="0" data-probe-toggleel="1"><input type="checkbox" tabindex="0"></label>
```

→ **`toggleEl` IS the wrapping `<label>`.** Marker reverted immediately after.

### Probe run 3 — tooltip side-effect (`.tmp/probe3.log`)

Hover + read body `.tooltip`:

```
=== TIP checkbox=[Own file size enabled]
=== TIP number=[Own file size weight]
=== TIP resetButton=[Restore depth defaults]
```

→ Obsidian pops a tooltip for ANY `aria-label`. Killed the idea of calling `setTooltip` (would be a
second source for the same string). Noted in the `nameControl` doc + PUBLIC's "no visual change" caveat.

## Decisions and why

- **`querySelector("input")`, no `instanceof` fallback, no throw.** Verified shape + e2e guard as the
  drift alarm beats a speculative branch. Silent no-op instead of throw because a cosmetic a11y
  attribute must never break a user's settings tab on a future Obsidian; the guard fails loudly.
- **`${label} enabled` for sizing toggles**, bare row name for the exclusion toggle. Matches the rule
  already written in `nameControl`'s doc ("plus the control's role where one row holds two controls")
  and the existing `${label} weight`. Also dodges the substring-`getByLabel` strict-mode trap the
  exploration flagged, so the guard needed no `exact: true`.
- **Block bodies over `.then()` chaining** at both `addToggle` sites — `.then()` inside a builder that
  also chains `.setValue().onChange()` reads worse than two statements.
- **`const name` in `renderExclusion`** so `setName` and the aria-label share one literal (mirrors the
  existing `const name = "Exclusion patterns"` idiom in `addExclusionPatterns`).
- **`getByRole("checkbox", { name })` in the guard** — the only assertion that would catch an
  `aria-label` set on something with no role. Every other assertion in that test is attribute-level.
- **Moved the "two controls share this row" comment** from the weight input up to the toggle (it now
  explains both) rather than writing it twice — DRY on WHY comments.

## Dead ends

- `window.require("obsidian")` in the renderer → `Cannot find module 'obsidian'`. Marker patch instead.
- Considered `aria-label` on `toggleEl` (the `<label>`): would not name the input (labels name by TEXT)
  and would not satisfy the `input[type=checkbox]:not([aria-label])` clause. Rejected on both counts.
- Considered putting visible text inside the `<label>` (real `<label>`-wraps-input naming, like the
  radio exemption): rejected — that IS a visual change.

## Exact commands run

```bash
npm run test:e2e -- _probe.e2e.ts                       > .tmp/probe.log      # DOM baseline
npm run test:e2e -- _probe.e2e.ts                       > .tmp/probe2.log     # toggleEl marker
npm run test:e2e -- settingsUxVisual.e2e.ts -g "every input carries" > .tmp/guard-red.log   # RED (exit 1)
npm run check                                           > .tmp/check.log      # exit 0
npm run test:e2e -- settingsUxVisual.e2e.ts             > .tmp/guard-green.log # 17 passed
npm run test:e2e -- settingsUxVisual.e2e.ts -g "every input carries" > .tmp/mutation.log    # RED (exit 1)
npm test                                                > .tmp/unit.log       # 1053 passed
npm run test:e2e -- settingsDependentRows.e2e.ts        > .tmp/dep.log        # 3 passed
npm run test:e2e -- _probe.e2e.ts                       > .tmp/probe3.log     # tooltip probe
rm -f e2e/_probe.e2e.ts
npm run check; npm test; npm run test:e2e -- settingsUxVisual.e2e.ts          # all exit 0
git add -A && git commit                                                      # 25e75f6
```

Mutation was applied/reverted with a small python3 heredoc against the exact indented line.

## If someone reopens this

- The guard's floor is now 26 and it enumerates by "any input EXCEPT radio". Adding an `addDropdown`
  or `addSearch` row will be caught automatically; adding a *radio* row will not (documented exemption).
- If a future Obsidian makes `toggleEl` the input itself, `nameToggle` silently stops labelling and
  `settingsUxVisual.e2e.ts` goes red on the `getByLabel`/count assertions. Fix is a one-liner there.
