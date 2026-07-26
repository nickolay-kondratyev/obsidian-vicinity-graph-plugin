# IMPLEMENTATION_REVIEW — PUBLIC

Ticket `nid_vqw34wdpmb5qzn52cy6qugqgd_e`, branch `e2e-controls-panel-disclosure-exhaustiveness`,
diff reviewed: `c5b5316..HEAD` (commits `1a38ca4`, `a594c58`).

## Summary

Purely ADDITIVE e2e change. `e2e/settingsBaseline.ts` gains a derived
`CONTROLS_PANEL_DISCLOSURE_SUMMARIES` (mapped from `CONTROLS_PANEL_DISCLOSURES`, mirroring the
existing `SETTINGS_TAB_SECTION_HEADINGS` idiom — no hand-duplication) plus
`PINNED_CENTRALS_SUMMARY`, and its doc comment now states how the two exclusions survive the
new pin. `e2e/settingsUxVisual.e2e.ts` gains `topLevelPanelSummaries()` and one BDD test
asserting count + identity + order of the direct-child disclosures of
`.vicinity-graph-toolbar__body`.

Verified independently:

- `git diff c5b5316..HEAD --stat` touches only `e2e/settingsBaseline.ts`,
  `e2e/settingsUxVisual.e2e.ts` and two `.ai_out/` docs. **No `src/` change** — the temporary
  6th `<Disclosure>` used for the proof is genuinely reverted; `src/view/GraphToolbar.tsx`
  is byte-identical to `c5b5316`. Tree is clean.
- `npm run check` → exit 0. `npm test` → exit 0, 74 files / 990 tests.
- The empirical proof is credible: `.tmp/e2e-proof.log:267-271` contains the real
  `toHaveCount` failure (`Expected: 5 / Received: 6`) with the exact locator string, and
  `.tmp/e2e-after-revert.log` ends `18 passed`. I did not re-run e2e.
- Nothing removed or weakened: the per-entry open-state loop
  (`e2e/settingsUxVisual.e2e.ts:61-72`) is untouched, `PanelDisclosure` /
  `summaryAlsoMatchesAnAncestor` semantics untouched, no `ap_XXX_E` anchors in the touched
  files. No scope creep.

The acceptance criterion is met: the direct-child chain sees exactly the 5 listed sections
(`src/view/GraphToolbar.tsx:42-58`), "Advanced spacing" is structurally out
(`src/view/ForceLayoutSection.tsx:50`, nested), "Pinned centrals" is filtered by name, and a
6th top-level disclosure fails both assertions.

## 🚨 CRITICAL / BLOCKING

None.

## ⚠️ SHOULD

**S1 — the prefix regexes are looser than they need to be; anchor the tail too.**
`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2/e2e/settingsUxVisual.e2e.ts:110-112`

```ts
CONTROLS_PANEL_DISCLOSURE_SUMMARIES.map((text) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))
```

The motivation is sound and well evidenced (`NodeExclusionSection.tsx:44-56` appends an
optional count badge inside the same `<summary>`, so exact `toHaveText` would flake once a
fixture excludes nodes). But an open-ended prefix pins less than the sibling settings-tab
assertion at `:186`, which uses exact strings. Concretely, all of these would still PASS today:
"Depth" renamed to "Depth & scope", "Force layout" → "Force layout (beta)", "Node contents" →
"Node contents and previews". The rename half of the "identity" claim in the comment is
therefore only true for prefix-preserving renames.

The badge is a bare integer (`{excludedNodeCount}` in its own `<span>`, no separator), so a
fully anchored form is a one-token change with strictly stronger pinning and the same flake
tolerance:

```ts
new RegExp(`^${escaped}\\d*$`)
```

Also worth a half-line of WHY: `\d*` exists solely for the exclusion badge, so if the badge
ever becomes non-numeric the failure is intended, not a flake. (Rejected alternative, for the
record: asserting `.vicinity-graph-exclusion__summary-label` instead — that class exists only
on the one section, so it cannot drive the uniform 5-entry comparison. Adding a `data-`
summary hook to `Disclosure` would be the cleanest of all but is a `src` change and more
machinery than this 80/20 warrants.)

## 💡 NICE-TO-HAVE

**N1 — make the "Pinned centrals" exclusion an exact match, not a substring.**
`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2/e2e/settingsUxVisual.e2e.ts:88-90`.
`filter({ hasNotText: PINNED_CENTRALS_SUMMARY })` is a substring match, so a future *real*
top-level disclosure whose summary contains that phrase (e.g. "Pinned centrals defaults")
would be silently dropped from the count and escape the very exhaustiveness this test exists
to provide. Hardening costs one expression:
`filter({ hasNotText: new RegExp(`^${PINNED_CENTRALS_SUMMARY} \\(\\d+\\)$`) })`, which matches
exactly the shape `GraphToolbar.tsx:47` renders. The decision to filter by name rather than
trust the fixture is right and is documented in both places — this only tightens the filter.

**N2 — the filter makes this spec blind to a "Pinned centrals renders unconditionally"
regression.** That is inherent to the chosen design and is not a regression (nothing asserted
it before), but no e2e currently asserts the disclosure's ABSENCE on an unpinned view —
`controlsRestart.e2e.ts:80` and `pinnedCentralScenario.e2e.ts:95` only assert presence when
pinned. Worth a small ticket rather than growing this test.

**N3 — file the DRY follow-up the implementation identified.** The literal `"Pinned centrals"`
now exists three times: `e2e/settingsBaseline.ts:136`, `e2e/controlsRestart.e2e.ts:80`,
`e2e/pinnedCentralScenario.e2e.ts:95`. Folding the latter two onto `PINNED_CENTRALS_SUMMARY`
is a two-line change; leaving it out of THIS change was the correct scoping call, but it
should become a `docs-internal/tickets/` entry rather than living only in a `.ai_out` note.

## Documentation Updates Needed

None. The `CONTROLS_PANEL_DISCLOSURES` doc (`e2e/settingsBaseline.ts:100-118`) accurately
describes the new enforcement and correctly distinguishes the structural exclusion from the
by-name one. If S1 is applied, update the "Exact `toHaveText`…" comment at `:106-109` to say
the regex tolerates the numeric badge only.

VERDICT: READY

---

## Round 2 — iteration confirmation

Scope: `git diff 9262aa8..HEAD` only — one commit, `06a97fe test(e2e): tighten the
controls-panel disclosure pin (review round 1)`. Touched: `e2e/settingsUxVisual.e2e.ts`,
`e2e/settingsBaseline.ts` (doc comment only), 2 `.ai_out` docs, 2 new `_tickets/` files.
No `src/` change, no deletions, `git status` clean.

### S1 — anchored summary regexes: CORRECT

`new RegExp(`^${escaped}\\d*$`)` at `e2e/settingsUxVisual.e2e.ts:123-125`.

- **Badge absent** → `\d*` matches empty → `"Depth"` passes. Confirmed by
  `.tmp/e2e-iter-final.log` (18 passed) with no exclusion seeded.
- **Badge present, 1 digit** → `"Node exclusion1"` passes. Confirmed empirically by the
  temporary probe dump quoted in the implementer's notes (`.tmp/e2e-iter-badge-proof.log`) —
  the badge contributes NO separator, so `\d*` is the right and sufficient tolerance.
- **2+ digits** → `\d*` is unbounded, so `"Node exclusion12"` also passes. Not over-tight.
- **Over-loose?** No. `.tmp/e2e-iter-rename-proof.log:275-276` shows the anchored form
  rejecting `"Depth & scope"` (`- /^Depth\d*$/ / + "Depth & scope"`), and
  `.tmp/e2e-iter-old-form-lets-rename-through.log:266` shows the OLD prefix form passing
  16/16 with the same rename in place. The hole is demonstrated closed, not asserted.
- **`$` vs trailing whitespace**: the anchor would be brittle if Playwright matched raw
  un-normalized `textContent`; the green runs above with `$` in place are direct evidence
  it does not bite here.

The escaping of `text` before interpolation is retained, so a future summary containing
regex metacharacters stays literal.

### N1 — full-text pinned-centrals exclusion: CORRECT, cannot over-filter

`filter({ hasNotText: new RegExp(`^${PINNED_CENTRALS_SUMMARY} \\(\\d+\\)$`) })` matches
exactly `GraphToolbar.tsx:47` (`` `Pinned centrals (${pinned.length})` ``) — space, parens,
one-or-more digits. A future real section `"Pinned centrals defaults"` no longer matches, so
it can no longer be silently dropped from the count. That was the point.

Can it silently mask a regression? No, and the failure direction is worth stating: if the
regex ever STOPS matching the real disclosure (rename, count formatting change), the
disclosure is no longer excluded and `toHaveCount(5)` fails loudly with 6. There is no
silent-pass direction. Note the filter is not exercised today in a pinned state — that is
acceptable precisely because the untested direction fails loud, and the adjacent gap is now
ticketed (`nid_d9j4o9ecp93g5zhury5m1fb43_e`).

### Claimed verification — credible

`.tmp/e2e-iter-{base,rename-proof,old-form-lets-rename-through,badge-proof,sixth-proof,final}.log`
all exist (16:50–16:53, consistent with the commit). Spot-checked contents:
`sixth-proof.log:267-271` = real `toHaveCount` failure `Expected: 5 / Received: 6` with the
new locator string including `/^Pinned centrals \(\d+\)$/`; `rename-proof.log:302-305` =
`1 failed`; `old-form-…log:266` = `16 passed`; `final.log:268` = `18 passed`. Matches the
report exactly. I re-ran `npm run check` → exit 0 (`.tmp/review-r2-check.log`); e2e not
re-run, per instruction.

### Nothing weakened or crept in

Per-entry open-state loop (`:61-72`) untouched. `CONTROLS_PANEL_DISCLOSURES` list unchanged
(5 entries, same order/flags). No `ap_` anchors touched. The `PINNED_CENTRALS_SUMMARY` doc
update is accurate — it no longer claims "invariant prefix" and now states callers spell the
count out; the `CONTROLS_PANEL_DISCLOSURES` doc's "filters it out explicitly by
{@link PINNED_CENTRALS_SUMMARY}" remains true. The round-1 documentation follow-up (rewrite
the "Exact toHaveText…" rationale) was done. N2/N3 filed as tickets.

Ticket-location nit, non-blocking: the two new tickets landed in `_tickets/` while CLAUDE.md
points follow-ups at `docs-internal/tickets/`. That matches what the `ticket` tool does in
this repo, so I read it as a repo-wide convention drift, not this change's problem.

### Residual NICE-TO-HAVE (not blocking, no action required)

`PINNED_CENTRALS_SUMMARY` is interpolated into the `hasNotText` regex WITHOUT the escape
helper used two lines below for the summary list. Harmless today ("Pinned centrals" has no
metacharacters) and adding an escape would arguably hurt readability of a one-off, but the
asymmetry is visible. Mentioning only so it is a conscious choice.

VERDICT: READY
