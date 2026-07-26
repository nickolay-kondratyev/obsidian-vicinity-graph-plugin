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
