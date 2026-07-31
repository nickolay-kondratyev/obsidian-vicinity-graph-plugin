---
closed_iso: 2026-07-31T18:03:32Z
id: nid_6kjmn2y8jc8a9gxynudusbmlk_e
title: 'Unused DEFAULT_LINK_DEPTH_OUT / DEFAULT_LINK_DEPTH_IN engine exports: delete
  or complete'
status: closed
deps: []
links: []
created_iso: '2026-07-30T04:34:36Z'
status_updated_iso: 2026-07-31T18:03:32Z
type: chore
priority: 4
assignee: CC_WITH-nickolaykondratyev
tags: [settings, cleanup]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
src/engine/constants.ts exports DEFAULT_LINK_DEPTH_OUT and DEFAULT_LINK_DEPTH_IN (re-exported from src/engine/index.ts). Their ONLY readers are src/engine/SettingsSpec.test.ts, which asserts they alias the spec - i.e. they are tested but unused.

Noticed while adding `embedDepthOut` (ticket nid_fay1hu5sxcoygizopkkg0f0d7_e): the new field deliberately did NOT get a third alias, because adding an unused export to match two other unused exports is worse than the asymmetry. That leaves the family inconsistent, which is the POLS smell this ticket exists to remove.

Decide ONE of: (a) delete both aliases plus the test that pins them, and read SETTINGS_SPEC directly wherever a default is ever needed (the sibling DEFAULT_NODE_CAP / DEFAULT_MIN_NODE_PX etc. should be audited the same way - some of those may have real callers); or (b) keep the family and add DEFAULT_EMBED_DEPTH_OUT for symmetry.

Recommend (a): the spec IS the single source of truth and every other consumer reads it through EngineDefaults.

## Resolution (2026-07-31)

Took option (a). Audited every `DEFAULT_*` alias in `src/engine/constants.ts`; ALL SIX were dead outside the pinning test (`DEFAULT_DEPTH_DECAY_K` had zero readers anywhere), so all six were deleted:

- `src/engine/constants.ts`: removed `DEFAULT_NODE_CAP`, `DEFAULT_LINK_DEPTH_OUT`, `DEFAULT_LINK_DEPTH_IN`, `DEFAULT_MIN_NODE_PX`, `DEFAULT_MAX_NODE_PX`, `DEFAULT_DEPTH_DECAY_K`; section comment now states defaults have no aliases — read `SETTINGS_SPEC.<section>.<field>.default` or `EngineDefaults`.
- `src/engine/index.ts`: removed the six re-exports.
- `src/engine/SettingsSpec.test.ts`: removed the "DEFAULT_* named constants alias the spec defaults" test (it pinned only the deleted aliases) plus their imports; header doc updated.

The sibling BOUND aliases (`MIN_NODE_CAP`, `MIN/MAX_STEPPER_DEPTH`, `MIN/MAX_OUTLINE_DEPTH`) were audited too and KEPT — each has real callers (`settingsRowAccessors.ts`, `settingsRowDepthClamp.test.ts`, `settingsSpecBounds.test.ts`, `settingsRowParity.test.ts`).

Verified: `npm run check` clean, `npm test` 1174/1174 passing. (Env note: `node_modules` was stale — `@testing-library/react` missing — fixed by `npm install`, unrelated to this change.)
