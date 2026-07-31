---
closed_iso: 2026-07-27T21:11:30Z
id: nid_6kms4zn8o8c8r7g983oqlvvky_e
title: "Pin the obsidian devDependency to minAppVersion instead of \"latest\""
status: closed
deps: []
links: []
created_iso: 2026-07-25T17:39:23Z
status_updated_iso: 2026-07-27T21:11:30Z
type: chore
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [build, tooling]
---

`package.json` has `"obsidian": "latest"` in devDependencies, so the typings installed can (and do)
run ahead of what the plugin actually supports. Currently `node_modules/obsidian` resolves to
**1.13.1**, while `manifest.json` declares `minAppVersion: 1.12.4` and the e2e gate pins
`OBSIDIAN_VERSION="1.12.7"` in `scripts/setup-obsidian-bin.sh`.

This drift already caused a shipped regression. `SliderComponent.setDynamicTooltip()` is marked
`@deprecated` in the 1.13.1 `obsidian.d.ts` with "The value is now always shown inline next to the
slider" — but that inline readout only landed in 1.13.0 (its sibling `setDisplayFormat` is tagged
`@since 1.13.0`). On 1.12.7 the method is NOT a no-op: it installs mouseenter/mouseleave listeners
that render the value in a `.tooltip`. Reading the 1.13.1 tag as a statement about 1.12.4 led to the
call being deleted from `src/view/VicinityGraphSettingTab.ts` (`addLabeledSlider`), which silently
blanked the value readout on all 10 settings-tab sliders. It has since been reverted.

Work:
- Pin the `obsidian` devDependency in `package.json` to a version matching the supported floor
  (or at minimum the e2e-pinned 1.12.7) so `@deprecated`/`@since` tags describe the builds we
  actually support, and update `package-lock.json`.
- Verify `npm run check` still passes on the pinned typings.
- Add one succinct line to `CLAUDE.md` under **Guardrails** recording the rule, e.g. "`obsidian`
  typings must track `minAppVersion` (1.12.4), not `latest` — an `@deprecated` API may still be live
  on the floor; verify against the pinned e2e build before deleting a call."


## Notes

**2026-07-27T21:11:30Z**

Resolved on branch chore/pin-obsidian-typings. Pinned obsidian devDependency to exact 1.12.3 (npm publishes no 1.12.4/1.12.7; 1.12.3 is the highest published typings <= the minAppVersion 1.12.4 floor), regenerated package-lock.json via npm install, and added one Guardrails bullet to CLAUDE.md. Verified: npm run check exit 0, npm test 81 files/1094 tests pass, npm run build exit 0. Confirmed setDynamicTooltip() carries no @deprecated tag on 1.12.3 and the call in src/view/VicinityGraphSettingTab.ts remains intact.
