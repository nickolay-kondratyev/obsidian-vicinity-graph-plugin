# Release Checklist

Ship-readiness checklist for cutting a Vicinity Graph release. Covers the
Obsidian community-plugin *artifact* requirements. **Actual community-store
submission is OUT OF SCOPE** and deferred — a repo move + plugin rename ("vicinity
graph") is planned for a later round, so store listing waits until after that.
When that submission happens, the WASM scorecard findings (libavoid-js) have
ready-to-paste disclosure responses in
[`wasm-disclosures.md`](./wasm-disclosures.md).

Release automation now exists: `./release_update_tag.sh` runs the green gates and,
if they pass, bumps the version, tags, and pushes; the pushed tag fires
`.github/workflows/release.yml`, which builds and **publishes** a GitHub Release
with the raw assets — no manual publish click. §3 and §6 describe those two halves;
the tag push IS the publish decision (the two-version e2e matrix ran locally first),
and the manual re-verify below is not automated.

## 1. Green gates (must all pass)

(`./release_update_tag.sh` runs these gates as its first phase: `check` → `npm test` → the e2e
suite on BOTH shipped Obsidian builds — the pinned default AND the manifest floor —
running both e2e arms even if the first fails and printing a per-version pass/fail
matrix. That is the two-version coverage a release needs, in one command. It covers
the four gates below (`test:e2e` builds the production bundle before it drives
Obsidian, which is the `npm run build` gate) but NOT the manual re-verify below.
`npm run test:all` is the lighter every-change gate — pinned build only, fail-fast;
`-- --with-floor` appends the floor run but stops at the first red rather than
reporting the full matrix.)

- [ ] `npm run check` — strict `tsc -noEmit`, EXIT 0.
- [ ] `npm test` — vitest suite, 0 failures.
- [ ] `npm run build` — production bundle to `main.js` + `styles.css`, EXIT 0.
- [ ] `./release_update_tag.sh` — real-Obsidian Playwright gate on BOTH shipped builds (pinned
      + manifest floor). Run in a display-capable env before release (auto-provisions
      each Obsidian binary on Linux/CI). Both arms must be green — see the per-version
      summary it prints. A floor-only red that is version-dependent Obsidian chrome
      (not a plugin regression) is the one documented exception; confirm it is that
      before shipping.
- [ ] On an Obsidian version bump: visually re-verify the in-graph exclusion
      toggle — `src/view/ToggleSwitch.tsx` reuses Obsidian's internal
      `checkbox-container` markup contract (no plugin CSS fallback).

## 2. Pre-ship gates (tracked separately, not this step's exit criteria)

- [ ] **step-06 controls human smoke run** still OPEN —
      `docs-internal/tickets/ticket-step-06-controls-human-smoke-run.md`. This is a
      human visual/native-feel pass and is a release gate; do not ship V1 without
      it being run.
- [ ] Confirm no other blocking ticket is left in `docs-internal/tickets/` that a
      release would regress.

## 3. Version agreement

The version must match in **four** files before tagging:

- [ ] `package.json` → `version`
- [ ] `manifest.json` → `version`
- [ ] `versions.json` → contains a `"<version>": "<minAppVersion>"` entry
- [ ] `package-lock.json` → `version` **and** `packages[""].version` (npm keeps it
      in both; `npm ci` — the tag build's gate — refuses on any disagreement)

Bump procedure: **`./release_update_tag.sh` does this for you** — once its gates are
green it runs `scripts/bump-version.py`, which revs the PATCH version and updates
all four files coherently (preserving their tab indentation: `package.json` +
`manifest.json` `version`, the two `package-lock.json` root versions, and a new
`versions.json` entry mapping the new version to `minAppVersion`), then commits and
tags (see §6). To do it by hand, edit all four the same way, then commit and tag.
`src/releaseVersionConsistency.test.ts` (run in `npm test`) fails the gate if any
of the four drift. Current state: all four agree at **0.1.2** with `minAppVersion`
**1.12.4**.

## 4. `manifest.json` field correctness

All seven required Obsidian fields are present and current:

- [x] `id` = `vicinity-graph` — **DONE:** community guidelines discourage an
      `obsidian-` prefix, so the prior `obsidian-`-prefixed id was dropped during
      the vicinity rename. Since the plugin has no released users yet, retiring the
      old id is safe.
- [x] `name` = `Vicinity Graph`
- [x] `version` = matches §3
- [x] `minAppVersion` = `1.12.4` (floor; rationale in README)
- [x] `description` present and accurate — **DONE:** reworded to drop the word
      "Obsidian" per review guidance (no "Obsidian"/"plugin" in metadata). Kept
      matching in `package.json`.
- [x] `author` = `Nickolay Kondratyev`
- [x] `isDesktopOnly` = `true` — **DECIDED (V1):** no Node-only APIs are used, but
      mobile is **untested**, so we claim desktop-only rather than assert unverified
      mobile support. Revisit (flip to `false`) only after a real mobile smoke pass.

Optional fields not set (fine for V1): `authorUrl`, `fundingUrl`.

## 5. `versions.json` format

- [ ] Shape is a flat `{ "<pluginVersion>": "<minAppVersion>" }` map (Obsidian
      uses it to serve the right plugin build to older apps). Current:
      `{ "0.1.0": "1.12.4", "0.1.1": "1.12.4" }` — correct.

## 6. GitHub Release (tag-triggered, PUBLISHED)

`main.js` and `styles.css` are gitignored build outputs, so they only exist after
`npm run build`. This is now **automated**: pushing a tag whose name is the raw
version fires `.github/workflows/release.yml`, which builds the bundle in CI and
cuts a **published** release with the raw assets. `./release_update_tag.sh` creates
and pushes exactly that tag (§3), so the normal path is: run the driver — the tag
push publishes the release, no manual step. The flow:

- [ ] `./release_update_tag.sh` — on a green matrix it PATCH-bumps + commits +
      tags the raw version (no `v` prefix — Obsidian matches the raw string) and
      pushes the tag.
- [ ] The tag workflow runs `npm ci` → `check` → `npm test` → `npm run build`,
      **attests build provenance** for `main.js` + `styles.css`
      (`actions/attest-build-provenance`), then creates a **published** GitHub
      Release named for the tag, attaching **`manifest.json`, `main.js`, and
      `styles.css`** as **raw release assets** (not only inside the source zip —
      Obsidian/BRAT fetch the raw files).
- [ ] Confirm the release went live at the tag with the three raw assets attached.
- [ ] Confirm the two built assets carry attestations — the run's summary lists
      them, or `gh attestation verify main.js --repo <owner>/<repo>` succeeds.

To cut a release entirely by hand instead: `npm run build`, then
`gh release create <version> manifest.json main.js styles.css` (tag ==
manifest `version`, no `v` prefix).

## 7. Release notes — stored-data breaks and behaviour shifts

While unpublished we take clean breaks on stored data (`CLAUDE.md`), but **never
silently**: every break gets a line in the release body. Carry these forward until
they ship, then drop them.

- [ ] **Per-note depth and view overrides are removed; settings are global-only.**
      Any per-note overrides stored by an earlier build are **discarded** — the
      whole `.obsidian/plugins/vicinity-graph/doc-data/` directory is no longer
      read or written and can be deleted by hand. Nothing else is lost: global
      settings and **pinned notes are kept** (they live in `data.json`).
      Ticket `nid_ez38gf1mrdgh5kxedzrdicwzl_e`.
- [ ] **Per-note size/content overrides and local pins moved OUT of `data.json`
      into the vault** — they now live as vault content under
      `.plugin_data/vicinity_graph/per_file/<note-id>.json` (one file per note), so
      they SYNC alongside your notes instead of only travelling with `.obsidian`.
      Clean break: any per-note SIZE/CONTENT override or LOCAL pin stored by an
      earlier build (in the old `data.json` `nodeOverrides` / `localPins` keys) is
      **discarded** — re-set them once. **Nothing else is lost:** global settings AND
      **globally pinned notes are kept** — the global pinned set stays in `data.json`
      (a pin is treated as plugin config, so Obsidian manages it and it does NOT sync
      when you exclude `.obsidian`). No version bump was needed: the two dropped keys
      simply stop being read, so global settings and global pins carry over untouched.
      Ticket `nid_8f8ey41extajt08zphwwxhnwq_e`.
- [ ] **UX shift in the same change:** the graph controls panel's depth steppers now
      change a **GLOBAL** setting — a bump there affects every note's graph and
      every open view, where it used to affect only the active note. One depth pair
      also drives MAIN and every pinned central; the per-pinned-central dials are
      gone. Both surfaces now say so on the label: the panel disclosure and the
      settings-tab card are both headed **"Depth"** (the card used to read
      "Depth defaults", which implied a per-note override; the heading briefly
      read "Depth (all notes)" before the per-role split below made that wrong).
- [ ] **Saved GLOBAL depth settings reset to the defaults on this upgrade.** The
      three depth budgets were renamed in `data.json` (`outgoingDepth` →
      `linkDepthOut`, `incomingDepth` → `linkDepthIn`, plus a new
      `embedDepthOut`), and old keys are not read — there is no migration. If you
      had changed a depth, set it again: **Depth** → Links out /
      Embeds out / Links in, each back at **1**. Nothing else in `data.json` is
      touched (pins, view settings and exclusions are kept).
      Ticket `nid_fay1hu5sxcoygizopkkg0f0d7_e`.
- [ ] **New setting in the same change: "Embeds out".** Embedded notes
      (`![[note]]`, canvas cards holding a note) now traverse on their OWN budget
      instead of counting as plain links. It ships at **1**, equal to "Links out",
      so a default install renders exactly as before. Two consequences worth
      stating: (a) attachments are unaffected — an image is an attachment however
      it is written, and never becomes a node; (b) the two outgoing budgets are
      walked INDEPENDENTLY, so above 1 hop a chain that changes kind partway (a
      note you embed, which then links something else) stops at the change.
- [ ] **New settings: per-role depth for pinned notes** ("Pinned links out",
      "Pinned embeds out", "Pinned links in"). Pinned centrals now traverse with
      their own global depth trio; the active note keeps the original trio, and a
      pinned note that is ALSO the active note uses the active-note depths. All
      three ship at **1**, equal to the active-note defaults, so a default
      install renders exactly as before. The section heading dropped its
      "(all notes)" suffix to plain **"Depth"** — depths are global per ROLE,
      never per note. Ticket `nid_ts4rx2pfo6o18verzk07z16g8_e`.

## 8. License note

- [ ] Ship with `LICENSE.md` (KSAL-2.3, source-available — NOT OSI open-source).
      The README states this plainly and points to `LICENSE.md` as authoritative.
      Human has signed off on stating it plainly (CLARIFICATION §5). Note that a
      non-OSI license does not block a future Obsidian store submission but should
      be disclosed honestly.

## Out of scope (deferred)

- Community-store submission PR to `obsidianmd/obsidian-releases`.
- Plugin id/name rename ("vicinity graph") and repository move.

(Release automation — the tag-triggered publish-release workflow + the
`release_update_tag.sh` bump/tag driver — now EXISTS; see §3 and §6.)
