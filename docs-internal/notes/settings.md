# Settings — overarching context

Single source of over-arching context for all settings work. Every ticket tagged
`settings-cleanup` links here; read this before picking any of them up.

## Grouping convention (no epics)

There are **no epic tickets** for this work. Grouping is done with the tag
`settings-cleanup`; ordering is encoded in each ticket's `deps` frontmatter.

```bash
ticket ready -T settings-cleanup     # what is unblocked right now
ticket blocked -T settings-cleanup   # what is waiting, and on what
ticket dep tree nid_fay1hu5sxcoygizopkkg0f0d7_e   # full chain (terminal ticket)
```

## Why this exists (the problem)

Adding ONE settings field costs **~180 lines across ~15 files** and touches
**~8 hand-maintained parallel lists** that fail *silently* when one is missed
(measured in research ticket `nid_8p0nn2g34d97finokwlz3u1dt_e`, closed). The
genuinely silent holes are:

1. `src/persistence/persistedShapes.ts` — `parseViewOverride` branch table
2. the reset-scope table (`src/engine/settingsResetPlan.ts` / `settingsWriteScope`)
3. settings-tab vs in-graph-panel UI parity (no guard at all)

(`ViewSettingsResolver.resolve` is NOT a hole — its `ViewSettings` return type
makes an omitted field a compile error.)

This drift has already produced real symptom tickets: stale baseline tests
(twice), reset racing a queued write, sibling-field clobbering from stale
snapshots, tab rows with no panel counterpart, and a11y naming divergence.

The owner approved the larger rewrite on 2026-07-29.

## The chain — order and why

| # | Ticket | What | Why this position |
|---|--------|------|-------------------|
| 1 | `nid_niz5dz6uqeyv237ckm15ittqa_e` | Delete orphan fields `groupByFolder` + `edgeVisibility` (owner decided: DELETE) | Shrink the field surface *before* building descriptors — don't pay descriptor cost for dead fields. |
| 2 | `nid_wimjq4ewgbg21n4zx9d4qq3a0_e` | **Descriptor model**: one declarative field descriptor drives spec, type, defaults, parse, write plan, reset scope | The foundation everything else derives from. Primary invariant: absent override = "inherit". |
| 3 | `nid_m5hxe4eo9jgt7cfic7s2o3uvi_e` | **Write/refresh pipeline**: one serial chain, fresh-read writes, reset drains queue, one fan-out rule | Fixes 4 symptom bugs that share one cause. Before presenters, so presenters wire to the final write path once. |
| 4 | `nid_armoson86j0ii8c33r1odo1rc_e` | **Dual presenters**: tab + in-graph panel render one descriptor model | Needs descriptors (rows as data) and the pipeline (writes). Unblocks 4 UX satellite tickets. |
| 5 | `nid_x6hgehsu5il1d1shuraz3ufqy_e` | **Spec-driven tests**: iterate the descriptor list instead of hand-enumerated literals; parity test tab-vs-panel | Needs the final shape of 2–4 to pin against. |
| 6 | `nid_fay1hu5sxcoygizopkkg0f0d7_e` | **Embedded-outgoing-link depth field** — first new field added under the new model, WITH cost measurement | The proof step (absorbed former E5): record files/lines cost vs the ~15-file baseline. Last, so the measurement is honest. |

```mermaid
graph LR
  niz[1 delete orphan fields] --> desc[2 descriptor model]
  desc --> pipe[3 write/refresh pipeline]
  desc --> pres[4 dual presenters]
  pipe --> pres
  pipe --> tests[5 spec-driven tests]
  pres --> tests
  tests --> field[6 embed-depth field + measurement]
  pres --> field
```

## Satellite tickets (blocked on the chain)

- Behind **pipeline (3)**: `nid_8b97fdqznqsncc5kgya1p871w_e` (reset display()
  races queued write), `nid_4zffe7mj5p1eabi9m6wfh06k0_e` (three hand-rolled
  serial chains → one helper). Legacy-file tickets subsumed by (3), close when
  it lands: `docs-internal/tickets/ticket-per-doc-write-leaves-sibling-views-stale.md`,
  `docs-internal/tickets/ticket-controls-optimistic-input-latency.md`.
- Behind **presenters (4)**: `nid_1rslube8at5xj60ji4jeve0b0_e` (Depth group),
  `nid_qp56jugz8en8wkgjirwcb269p_e` (exclusion row disabled-not-hidden),
  `nid_klkdpmx6axf90y4xj8khwrlf2_e` (panel outline-depth control),
  `nid_que9qloigra7ku2boh83qizz0_e` (panel a11y nits),
  `nid_hatwq2jlkhno5t6awcz0q6t9q_e` (minPx/maxPx validation UX — fix once in
  the unified renderer, not twice),
  `nid_puf4a4q6fgn5lpehh5dowfm1r_e` ("Show cross links" — new full-cascade
  boolean, default OFF; decided wanted 2026-07-29, both presenters).
- Behind **tests (5)**: `nid_ek3wrqoh1rsftk6ulg836mghf_e` (e2e types into a
  settings input).
- Behind **descriptor model (2)** only: `nid_zvoay26y4y9h1e2p2b1y9glfk_e`
  (new intra-group spacing field — add it under the new model, not the old).

Independent (no reason to block): `nid_aau4r0sj8oudhi711qr9j5x1l_e` (nodeCap
upper bound), `nid_uwnew3dok0gn8ijar54hiozst_e` (pre-release slider tuning),
`nid_7fq9y51mbucmduzf9z31hmwmq_e` (doc-data dir constant).

## Standing owner decisions (2026-07-29)

- **Clean breaks on stored data while unpublished** — no migrations, no
  dual-key shims; announce resets in the release note (see `CLAUDE.md`).
- **Absent override means "inherit"** — the ViewSettings vs ViewSettingsOverride
  split is the primary design constraint a naive descriptor rewrite would break.
- **Orphan fields**: delete `groupByFolder` + `edgeVisibility`, hardcode
  surviving behavior (grouping ON, edges `walked-from-center`).
- **Exclusion patterns row**: always render, disabled when inapplicable —
  becomes a declarative `disabledWhen` flag.
- **Depth naming** (full rename, no migration): `linkDepthOut` / `embedDepthOut`
  (new) / `linkDepthIn`; UI: "Links out" / "Embeds out" / "Links in".
- **Tests**: structural spec-iterating tests, but KEEP a small number of literal
  assertions for product-meaningful defaults (e.g. nodeCap 100).
- **Obsidian constraint**: the Setting API cannot mount inside React, so there
  will always be two renderer *implementations* — parity is guarded by a test
  over the descriptor list, not by a single renderer.
