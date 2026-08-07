---
closed_iso: 2026-08-07T19:33:07Z
id: nid_zv32b4i33zd8c7z69hx10g4zc_e
title: Node sizing lets add a setting to be able to control min height of nodes with
  images
status: closed
deps: []
links: []
created_iso: '2026-08-07T19:19:10Z'
status_updated_iso: 2026-08-07T19:33:07Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
---
Lets add a setting to control the minimum height of nodes with images. - Meaning nodes that render with an image.

Additionally lets clarity the current node sizing settings of what they control Right now it says "Minimum node size" which isnt clear is it height, width, something else?

## Notes

**2026-08-07T19:33:07Z**

RESOLVED.

## What shipped
1. New global setting `sizing.minImageHeightPx` — an EXTRA height floor applied ONLY to
   nodes whose preview slot resolves to the thumbnail (image nodes). It only ever raises
   such a node and, like every floor, is still capped by `maxPx` (a floor, not a bypass).
   Ships at 120px — just below a thumbnail's ~122px natural reveal floor — so it is a
   NO-OP on the default graph until raised. The thumbnail CSS (`flex: 1 1 ...`) already
   grows the image to fill a taller node, so the extra height becomes picture, not slack.
2. Clarified the existing sizing labels: "Minimum/Maximum node size (px)" ->
   "Minimum/Maximum node height (px)" (all three sizing dials are node HEIGHTS; width
   follows the title), and each row now carries a short description. Section description
   updated too.

## Files
- src/engine/types.ts — `SizingSettings.minImageHeightPx` (+ doc that all three are heights).
- src/engine/SettingsSpec.ts — `SizingSpec.minImageHeightPx` + spec default 120, bounds = shared NODE_SIZE_PX_BOUNDS (1..400).
- src/engine/constants.ts — SIZING_RANGES, clampSizingSettings (independent clamp, NO cross-field rule), EngineDefaults.sizingSettings.
- src/engine/NodeSizer.ts — resolves preview once (resolvePreview) and floors thumbnail nodes at max(minPx, minImageHeightPx), still min()'d under maxPx.
- src/persistence/persistedShapes.ts — parseSizing reads the new key, defaults + clamps like the pair.
- src/view/settingsRows.ts — new "Minimum height of image nodes (px)" row + relabelled min/max rows. Both surfaces (settings tab + in-graph panel) render it automatically (field-driven sizing-number control).

## Design choices
- INDEPENDENT floor, not a cross-field party: no inversion rule vs min/max (CROSS_FIELD_ROWS stays [minPx,maxPx]); `maxPx` caps it at sizer time instead. Documented in constants.ts, high-level-plan.md.
- Default 120 preserves current behavior (image nodes already floor ~122 via the CSS reveal), so nothing on screen moves until a user raises it.

## Tests
- npm run check + npm test: green (1725 passed). Added NodeSizer image-floor behavior tests, sizing clamp independence tests, product-defaults literal, bounds-enforcer registration.
- e2e (real Obsidian): controlsRestart + settingsTypedInput + settingsUxVisual (34) and settingsReset*/nodeResize/nodeOutline (51) all green. Updated one hardcoded label + a stale count comment.
- Docs: README.md + docs-internal/plan/high-level-plan.md sizing sections.
