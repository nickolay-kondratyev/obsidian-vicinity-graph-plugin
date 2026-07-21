# obsidian-neighborhood-graph
Obsidian Plugin: Improved visualization of neighboring notes (envisioned to be used in place of local graph).

## Dev setup

Fresh clone:

```bash
git submodule update --init
npm install
```

Scripts:

| Script | What it does |
|---|---|
| `npm run dev` | esbuild watch build; copies artifacts into the dev vault on every rebuild |
| `npm run build` | `tsc -noEmit` type check, then production bundle to `main.js` + dev-vault copy |
| `npm test` | our vitest suite, then the `obsidian-id-lib` submodule's own suite (`test:sublib`) |
| `npm run check` | `tsc -noEmit` (strict) |
| `npm run test:e2e` | release-time Playwright e2e: drives a REAL Obsidian on a copy of the dev vault (needs `OBSIDIAN_PATH`, see below) |

### Dev vault

The build copies `main.js` / `manifest.json` / `styles.css` into
`.dev-vault/.obsidian/plugins/obsidian-neighborhood-graph/` (git-ignored). Open `.dev-vault/`
as a vault in Obsidian, enable community plugins, enable "Neighborhood Graph", then run the
"Open neighborhood graph" command to see the placeholder view.

### e2e suite (`npm run test:e2e`)

Launches a real Obsidian (Electron) on a throwaway COPY of `.dev-vault` (plus e2e-only
`crowd/` fixtures) with a sandboxed `--user-data-dir`, and asserts rendered DOM state
(node counts, tier classes, badges, edge markers, theme-reactive arrowheads). Not part
of `npm test` — run it as a release gate.

On **Linux / Docker / CI it just runs** — no setup:

```bash
npm run test:e2e
```

`scripts/run-e2e.sh` (the `test:e2e` entry) makes it self-contained:

- **Binary:** when `OBSIDIAN_PATH` is unset it auto-downloads a pinned Obsidian build once
  — the Linux tarball, no FUSE/AppImage extraction — caches it under `.tmp/obsidian/`, and
  points the suite at it (`scripts/setup-obsidian-bin.sh`; also `npm run setup:obsidian`).
  Bump the pinned `OBSIDIAN_VERSION` in that script deliberately.
- **Display:** when no display server is detected (`$DISPLAY`/`$WAYLAND_DISPLAY` unset), it
  defaults the headless Chromium-Ozone flags (`--ozone-platform=headless --disable-gpu`) so
  Electron boots offscreen instead of dying on a missing X server.

Both are overridable — set `OBSIDIAN_PATH` and/or `OBSIDIAN_E2E_EXTRA_ARGS` yourself and the
script leaves them untouched. `OBSIDIAN_PATH` is **required** on macOS/Windows (no drop-in
binary to auto-provision), e.g.:

```bash
# macOS
export OBSIDIAN_PATH='/Applications/Obsidian.app/Contents/MacOS/Obsidian'
npm run test:e2e
```

The suite is idempotent (fresh vault copy + fresh sandbox config per run under `.tmp/e2e/`)
and never touches your real Obsidian config or the dev-vault fixtures.

### `minAppVersion` (manifest.json)

`1.12.4` — the first public Obsidian release with core canvas backlink/graph link indexing
([1.12 changelog](https://obsidian.md/changelog/2026-02-10-desktop-v1.12.0/)). It is a floor,
never a ceiling: newer Obsidian versions must keep working. Note: canvas `metadata.frontmatter`
(used by `obsidian-id-lib` for canvas doc ids) was not introduced by any core release — it relies
on the canvas format's documented arbitrary-key forward compatibility.

### Submodule: `obsidian-id-lib`

Consumed as `"obsidian-id-lib": "file:submodules/obsidian-id-lib"` — raw TypeScript bundled by
our esbuild (no build step in the submodule). `obsidian` itself is a types-only external and is
never bundled. See the submodule README for the id-scheme contracts.
