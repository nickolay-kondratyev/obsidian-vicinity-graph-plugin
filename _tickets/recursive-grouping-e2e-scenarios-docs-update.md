---
closed_iso: 2026-08-14T02:19:36Z
session_ids: [{"a": "claude", "type": "execution", "id": "af622dcd-c40e-4a17-98d3-6b747ed0c155"}, {"a": "claude", "type": "review", "id": "5869c3bb-d0b6-48aa-9519-b806d1502289"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
id: nid_5hnmpwtzakhd3le95jzigsvs0_e
title: "Recursive grouping: e2e scenarios + docs update"
status: closed
deps: [nid_3wnxsfexabjnx1uj9js2o1c43_e, nid_0nmhmv03071derz5ok30cisaa_e]
links: []
created_iso: 2026-08-14T00:18:09Z
status_updated_iso: 2026-08-14T02:19:36Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

Part of recursive folder grouping. Full design: plan ticket nid_xko67wo2z4awg5gdrm1xx1chz_e (closed). Final gate ticket.

E2E (Playwright, e2e/ submodule - COMMIT there before committing here): add nested-group scenarios: (1) nested box renders inside parent box (multi-level vault fixture), (2) lone note in SQL/sub falls into SQL group, (3) boundary-crossing edge collapses onto boxes while same-container edge stays member-to-member, (4) +N badge on ancestor group for hidden descendant-folder notes, (5) group-label setting flips collapsed-chain label (settle writes via e2e/settingsWriteWindow.ts SettingsWriteWindow, never sleep). Keep the existing pattern of pointer-interaction fixtures staying ROOT-level (no groups intercepting pointer events).

Docs: update docs-internal/plan/high-level-plan.md (documents FLAT grouping as a core differentiator, ~lines 8 and 151) to describe recursive grouping + signed-off rules; update README.md grouping description if it mentions flat/immediate-parent grouping.

Gate: npm run test:all green.

## Resolution — 2026-08-13

`npm run test:all` green (check → 2023 unit tests → 174 e2e passed on the pinned
build, 1 skipped). Parent commit `2d18572`; e2e submodule commit `56206eb`
(committed first, per CLAUDE.md).

### Gap found and closed (the genuine delta)

The group-label PRESENTER was never wired: the rendering ticket
(`nid_9uh2twn8whoqtplbxk0ywzpx7_e`) deferred it to "a separate settings ticket"
and the settings ticket (`nid_0nmhmv03071derz5ok30cisaa_e`) deferred it back to "a
separate flow-rendering ticket" — so `groupLabelFullPath` was threaded end-to-end
but consumed by nothing, and `flowMapping.ts` hard-coded `folderName: group.leafName`.
Scenario (5) requires the label to actually flip, so this final gate wired it:

- `src/view/flowMapping.ts` — `folderName: graph.viewSettings.groupLabelFullPath ? group.chainPath : group.leafName`. For a NON-collapsed group `chainPath === leafName`, so the setting only ever lengthens a collapsed chain's label; the full folder path stays the `FolderGroupNode` tooltip (`data.folder`) either way. No new prop on `FolderGroupNode` (`chainPath` already rode the group model).
- `src/view/flowMapping.test.ts` — new `collapsed-chain group label (groupLabelFullPath)` describe: leaf label by default, full path when on, tooltip unchanged, non-collapsed group unaffected.

This is a decision the ticket settled (signed-off A1), not a product guess.

### E2E (`e2e/nestedGrouping.e2e.ts`, in the submodule)

New self-contained spec: its own `ObsidianHarness.launch({ extraFixtures })`
multi-level fixture opened from a ROOT main note `ng-main.md` (pointer-anchor stays
ungrouped, per the repo rule), driven at outgoing depth 2 so member-to-member and
boundary links are WALKED. Covers all five scenarios:
1. `db/sql` renders as a box nested inside the `db` box (asserted by screen-rect containment — React Flow renders subflow children as separate absolutely-positioned nodes, so geometric containment is the only honest nesting signal).
2. lone note in `db/sql/deep/` (folder too small to group) falls into the `db/sql` box.
3. `s1→s2` (same container) stays a member-to-member edge; `x1→s1` (crosses the db→db/sql boundary) collapses onto `folder-group:db/sql`, and the raw member id does NOT render.
4. a low node cap hides the sole depth-2 note `lone1`; its `+1` badge credits `db/sql` (nearest RENDERED ancestor of `db/sql/deep`), NOT `db`, and no corner overlay appears.
5. the collapsed chain `wiki/lang/en` renders as ONE group labelled `en` by default; flipping the panel's **Full folder path** toggle relabels it `wiki/lang/en` (a non-collapsed group is unaffected).

Assumption stated for scenario 5's "settle via SettingsWriteWindow": a boolean
toggle is NOT debounced (SettingsWriteWindow's flush machinery targets the settings
tab's typed fields), so it is driven through the real in-graph PANEL control (the
same write pipeline the tab uses, which fans out its own rebuild) and settled by a
web-first `toHaveText` on the rebuilt label — deterministic, no sleep. The panel's
per-section `<details>` (only Depth opens by default) are opened before reaching the
Grouping toggle, since a closed `<details>` hides its content from a role locator.

### Docs

- `docs-internal/plan/high-level-plan.md`: Goal 2 now says "RECURSIVELY", the grouping-rendering bullet describes ≥2-descendants + nesting + fall-up, and a new **Folder grouping (recursive)** subsection records D1–D5 + A1 (the flat-grouping description was the ~line 8 / ~line 151 the ticket named).
- `README.md`: the "Folders you can see" bullet now describes nested boxes + fall-up. The Settings → Grouping entry already documented the collapsed-chain label.

