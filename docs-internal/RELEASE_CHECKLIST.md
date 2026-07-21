# Release Checklist

Ship-readiness checklist for cutting a Neighborhood Graph release. Covers the
Obsidian community-plugin *artifact* requirements. **Actual community-store
submission is OUT OF SCOPE** and deferred — a repo move + plugin rename ("vicinity
graph") is planned for a later round, so store listing waits until after that.

There is no release automation yet; every step below is **manual.**

## 1. Green gates (must all pass)

- [ ] `npm run check` — strict `tsc -noEmit`, EXIT 0.
- [ ] `npm test` — vitest suite + `obsidian-id-lib` sublib suite, 0 failures.
- [ ] `npm run build` — production bundle to `main.js` + `styles.css`, EXIT 0.
- [ ] `npm run test:e2e` — real-Obsidian Playwright gate. Run in a display-capable
      env before release (auto-provisions the pinned Obsidian binary on Linux/CI).

## 2. Pre-ship gates (tracked separately, not this step's exit criteria)

- [ ] **step-06 controls human smoke run** still OPEN —
      `docs-internal/tickets/ticket-step-06-controls-human-smoke-run.md`. This is a
      human visual/native-feel pass and is a release gate; do not ship V1 without
      it being run.
- [ ] Confirm no other blocking ticket is left in `docs-internal/tickets/` that a
      release would regress.

## 3. Version agreement

The version must match in **three** files before tagging:

- [ ] `package.json` → `version`
- [ ] `manifest.json` → `version`
- [ ] `versions.json` → contains a `"<version>": "<minAppVersion>"` entry

Bump procedure: edit all three, ensure `versions.json` maps the new version to the
correct `minAppVersion`, commit, then tag (see §6). Current state: all three agree
at **0.1.0** with `minAppVersion` **1.12.4**.

## 4. `manifest.json` field correctness

All seven required Obsidian fields are present and current:

- [ ] `id` = `obsidian-neighborhood-graph` — **KNOWN, DEFERRED:** the community
      guidelines discourage an `obsidian-` prefix, and changing the id later
      breaks existing users' data path (`.obsidian/plugins/<id>/`). Human decision
      (CLARIFICATION §5): **keep as-is for V1**; the planned repo move + rename to
      "vicinity graph" will settle the id then. Do not rename now.
- [ ] `name` = `Neighborhood Graph`
- [ ] `version` = matches §3
- [ ] `minAppVersion` = `1.12.4` (floor; rationale in README)
- [ ] `description` present and accurate
- [ ] `author` = `Nickolay Kondratyev`
- [ ] `isDesktopOnly` = `false` — no Node-only APIs are used, but mobile is
      **untested**. Either verify on mobile before claiming mobile support, or flip
      to `true` if mobile is not a V1 target.

Optional fields not set (fine for V1): `authorUrl`, `fundingUrl`.

## 5. `versions.json` format

- [ ] Shape is a flat `{ "<pluginVersion>": "<minAppVersion>" }` map (Obsidian
      uses it to serve the right plugin build to older apps). Current:
      `{ "0.1.0": "1.12.4" }` — correct.

## 6. GitHub Release (manual)

`main.js` and `styles.css` are gitignored build outputs, so they only exist after
`npm run build`. There is **no `gh release create` automation** — do this by hand:

- [ ] `npm run build` to regenerate `main.js` + `styles.css`.
- [ ] Create a GitHub Release whose **tag exactly equals the manifest `version`**
      (no `v` prefix — Obsidian matches the raw version string).
- [ ] Attach **`manifest.json`, `main.js`, and `styles.css`** as **raw release
      assets** (not only inside the source zip — Obsidian/BRAT fetch the raw
      files).

## 7. License note

- [ ] Ship with `LICENSE.md` (KSAL-2.3, source-available — NOT OSI open-source).
      The README states this plainly and points to `LICENSE.md` as authoritative.
      Human has signed off on stating it plainly (CLARIFICATION §5). Note that a
      non-OSI license does not block a future Obsidian store submission but should
      be disclosed honestly.

## Out of scope (deferred)

- Community-store submission PR to `obsidianmd/obsidian-releases`.
- Plugin id/name rename ("vicinity graph") and repository move.
- Release automation (a `gh release`-cutting script/CI).
