# Development

Developer-facing setup, scripts, and the e2e matrix for Vicinity Graph. User-facing
docs live in [`../README.md`](../README.md); the design source of truth is
[`plan/high-level-plan.md`](./plan/high-level-plan.md) and the code map is
[`architecture-map.md`](./architecture-map.md).

Fresh clone → running dev build, following only these steps:

```bash
npm install                   # pulls stable-ids-for-obsidian from npm, among other deps
npm run setup:dev-vault       # build + create/copy the plugin into .dev-vault/
npm run dev                   # esbuild watch; re-copies artifacts on every rebuild
```

Then open `.dev-vault/` as a vault in Obsidian, enable community plugins, enable
**Vicinity Graph**, and run the **Open vicinity graph in right sidebar** command.

`npm run setup:dev-vault` is idempotent: it creates `.dev-vault/` fixtures and a
minimal `.obsidian/` config (which auto-enables the plugin) only when missing, so
re-running never clobbers local edits.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | esbuild watch build; copies artifacts into the dev vault on every rebuild |
| `npm run build` | `npm run check`, then production bundle to `main.js` + dev-vault copy |
| `npm run check` | strict `tsc -noEmit` over `src/`, then `check:e2e` |
| `npm run check:e2e` | `tsc -noEmit -p e2e/tsconfig.json` (type-checks the e2e specs) |
| `npm test` | our vitest suite (`stable-ids-for-obsidian` ships its own tested build from npm) |
| `npm run setup:dev-vault` | build + create/copy the plugin into `.dev-vault/` |
| `npm run test:e2e` | Playwright e2e: drives a REAL Obsidian on a copy of the dev vault (see below) |
| `npm run test:e2e:floor` | the same e2e suite against the `minAppVersion` floor build (see below) |
| `npm run test:all` | every gate in one command: `check` → `npm test` → `test:e2e`, fail-fast (`-- --with-floor` adds the floor e2e run) |
| `./release_update_tag.sh` | **release driver:** the pre-publish gate (`check` → `npm test` → e2e on BOTH shipped builds, per-version matrix — see below) then, only if green, PATCH-bumps the three release files, commits, tags the raw version, and pushes (firing the tag build workflow) |

## e2e suite (`npm run test:e2e`)

Launches a real Obsidian (Electron) on a throwaway COPY of `.dev-vault` (plus
e2e-only `crowd/` fixtures) with a sandboxed `--user-data-dir`, and asserts
rendered DOM state (node counts, tier classes, badges, edge markers,
theme-reactive arrowheads). It is separate from `npm test` (which never launches
Obsidian), but it is **not release-only**: it is the only suite that exercises
the real rendered plugin, so run it while developing any change to the view
layer, the settings tab, or graph behavior — and again as a release gate.

On **Linux / Docker / CI it just runs** — no setup:

```bash
npm run test:e2e
```

`scripts/run-e2e.sh` (the `test:e2e` entry) makes it self-contained:

- **Binary:** when `OBSIDIAN_PATH` is unset it auto-downloads a pinned Obsidian
  build once (the Linux tarball — no FUSE/AppImage extraction), caches it under
  `.tmp/obsidian/`, and points the suite at it (`scripts/setup-obsidian-bin.sh`;
  also `npm run setup:obsidian`). Bump that script's pinned default
  deliberately; override it per run with `OBSIDIAN_VERSION` (see below).
- **Display:** when no display server is detected (`$DISPLAY`/`$WAYLAND_DISPLAY`
  unset), it defaults the headless Chromium-Ozone flags
  (`--ozone-platform=headless --disable-gpu`) so Electron boots offscreen instead
  of dying on a missing X server.

Both are overridable — set `OBSIDIAN_PATH` and/or `OBSIDIAN_E2E_EXTRA_ARGS`
yourself and the script leaves them untouched. `OBSIDIAN_PATH` is **required** on
macOS/Windows (no drop-in binary to auto-provision), e.g.:

```bash
# macOS
export OBSIDIAN_PATH='/Applications/Obsidian.app/Contents/MacOS/Obsidian'
npm run test:e2e
```

In its default mode the suite is idempotent (fresh vault copy + fresh sandbox
config per run under `.tmp/e2e/`) and never touches your real Obsidian config or
the dev-vault fixtures.

### Running against another Obsidian version (`OBSIDIAN_VERSION`)

The default run downloads ONE pinned build, so nothing proves the plugin still
works on the [`minAppVersion` floor](#minappversion-manifestjson) — the oldest
Obsidian we claim to support — or on a newer release. Both are one command:

```bash
npm run test:e2e:floor       # the floor, derived from manifest.json minAppVersion
OBSIDIAN_VERSION=1.13.1 npm run test:e2e   # any other published build
```

`OBSIDIAN_VERSION` overrides the pinned default for one run (it only takes
effect when `OBSIDIAN_PATH` is unset, i.e. when the binary is auto-downloaded —
Linux/Docker). Each version is cached separately under `.tmp/obsidian/`, so
switching back and forth re-downloads nothing. `test:e2e:floor` never names a
version literal: it reads `manifest.json`, so bumping the floor is one edit — and
it **refuses to run at all** when `OBSIDIAN_PATH` is set, since that binary would
win and its green would not be a floor green (use `npm run test:e2e` for your own
binary).

Expect a little version-dependent noise: a few specs match Obsidian's own chrome,
which moves between releases (e.g. on 1.13+ the slider value readout moves from a
hover tooltip to an inline element — see the caveat in
`scripts/setup-obsidian-bin.sh`). A red there is likelier a locator miss than a
plugin regression; confirm against the default run before treating it as one.

#### Both versions at once — the release matrix (`./release_update_tag.sh`)

Running the floor and the pinned build is TWO commands, and neither `npm run
test:e2e` nor `npm run test:all` runs both on the hot path — the floor build is a
second ~200MB download plus a full second suite run, too costly to pay on every
change. So the two-version matrix is a **release gate, not an every-change gate**:
run `./release_update_tag.sh` to cut a release. It runs `check` → `npm test` once,
then the SAME e2e suite on both shipped builds, runs **both arms even if the first
fails**, and prints a per-version pass/fail summary that NAMES which build broke —
so a floor-only red (usually version-dependent chrome, per the caveat above) is
triaged with the version in hand. Only if the whole matrix is green does it go on
to PATCH-bump the three release files, commit, tag the raw version, and push
(firing `.github/workflows/release.yml`, which builds and PUBLISHES a GitHub Release
with the raw `manifest.json` / `main.js` / `styles.css` assets — no manual publish). `npm run test:all --
--with-floor` still appends the floor run for a dev spot-check, but stops at the
first red; `./release_update_tag.sh` is the one that reports the full matrix.

### Driving your own vault (`VICINITY_E2E_VAULT`) — opt-in

To reproduce "the graph looks wrong in MY vault", point the harness at that
vault. It is then opened **in place** — no copy, no wipe, no fixture writes — and
the `externalVault.e2e.ts` spec centres the graph on one note and screenshots it
to `.out/external-vault-graph.png`:

```bash
# one-time: install the plugin into the target vault (symlinks track your builds)
npm run build
VAULT=/path/to/vault
mkdir -p "$VAULT/.obsidian/plugins/vicinity-graph"
for f in main.js manifest.json styles.css; do
  ln -sf "$PWD/$f" "$VAULT/.obsidian/plugins/vicinity-graph/$f"
done
# …then enable "Vicinity Graph" in that vault's Settings → Community plugins

VICINITY_E2E_VAULT="$VAULT" VICINITY_E2E_NOTE='some/note.md' \
  npm run test:e2e -- externalVault.e2e.ts
```

(Symlink the three artifacts, **not** the repo root as the plugin folder — with
the repo as the plugin dir, Obsidian writes that vault's plugin state
(`data.json`) into your checkout.)

`externalVault.e2e.ts` is the only spec that may run this way; every other spec
drives plugin settings (restore-defaults, exclusion patterns, pins) and
refuses to start against a real vault, as does passing e2e fixture notes. The
harness also refuses to install or enable the plugin for you — you enable it, and
we then only load what your vault already lists. Unset the variable and
everything above behaves exactly as before.

> ⚠️ **Caveat — use a scratch or backed-up vault. The run is not read-only.**
> The harness never deletes, copies over or writes files into the vault, but
> Obsidian and the plugins do:
> - Obsidian rewrites its own config in that vault (observed:
>   `.obsidian/workspace.json`, `.obsidian/core-plugins.json`).
>   `workspace.json` is rewritten because the graph opens in the right sidebar
>   and detaches the other sidebar leaves — and because the harness ends
>   Obsidian with a signal, it can be left **truncated to 0 bytes**, i.e. your
>   saved layout for that vault is lost.
> - The plugin writes its own `.obsidian/plugins/vicinity-graph/data.json`.
> - Turning on community plugins is required to load anything at all, so
>   **every community plugin enabled in that vault loads and runs** (Templater,
>   periodic notes, sync, …), each free to write to it — exactly as when you
>   open the vault yourself.

## `minAppVersion` (manifest.json)

`1.12.4` — the first public Obsidian release with core canvas backlink/graph link
indexing
([1.12 changelog](https://obsidian.md/changelog/2026-02-10-desktop-v1.12.0/)). It
is a floor, never a ceiling: newer Obsidian versions must keep working. Note:
canvas `metadata.frontmatter` (used by `stable-ids-for-obsidian` for canvas doc ids) was
not introduced by any core release — it relies on the canvas format's documented
arbitrary-key forward compatibility.

## Dependency: `stable-ids-for-obsidian`

Consumed as a published npm package (`"stable-ids-for-obsidian": "^0.1.3"`) and bundled
into `main.js` by our esbuild (not external). `obsidian` itself is a types-only
external and is never bundled. See the [package](https://www.npmjs.com/package/stable-ids-for-obsidian)
for the id-scheme contracts.
