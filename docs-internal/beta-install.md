# Beta / pre-release install (test before the store)

How to run Vicinity Graph in a real vault **before** it reaches the Obsidian
community-plugin store — to dogfood a tagged pre-release or hand a build to a
reviewer. For the from-source dev loop (esbuild watch + `.dev-vault/`) see
[`development.md`](./development.md); for the public store path see the
[`README.md`](../README.md) Install section.

The repo is `nickolay-kondratyev/obsidian-vicinity-graph-plugin`. Every release
tag publishes the three raw assets Obsidian loads directly — `manifest.json`,
`main.js`, `styles.css` — from `.github/workflows/release.yml`, so both routes
below work off any tag, including a pre-release.

Requires Obsidian **1.12.4** or newer (the `minAppVersion` floor) and community
plugins turned on (**Settings → Community plugins**). Desktop only.

## Option A — BRAT (recommended for testers)

[BRAT](https://github.com/TfTHub/obsidian42-brat) (Beta Reviewer's Auto-update
Tool) installs a plugin straight from a GitHub repo's releases and keeps it
updated as new tags land — no manual file copying.

1. Install **BRAT** from the community store (**Settings → Community plugins →
   Browse → "BRAT" → Install → Enable**).
2. **Settings → BRAT → Add beta plugin.**
3. Paste the repo URL:
   `https://github.com/nickolay-kondratyev/obsidian-vicinity-graph-plugin`
   - Leave the version blank to track the **latest** release, or pin a specific
     tag (e.g. `0.1.16`) to freeze on one build.
4. **Add plugin.** BRAT fetches the assets, installs into
   `.obsidian/plugins/vicinity-graph/`, and enables it.
5. Run **Vicinity Graph: Open in right sidebar**.

To update later: **Settings → BRAT → Check for updates**, or BRAT auto-checks on
startup. Remove via **Settings → BRAT → remove** (then disable/uninstall the
plugin as usual).

> BRAT matches the **raw** tag name (no `v` prefix), which is exactly what
> `release_update_tag.sh` pushes and what `manifest.json` `version` states — the
> release workflow refuses to publish a tag whose name disagrees with the
> manifest version, so BRAT always resolves a consistent build.

## Option B — manual install from a release

For a one-off test with no extra plugin, or an air-gapped machine.

1. Open the release: **Releases** tab of the repo, pick the tag you want to test.
2. Download the three assets: `manifest.json`, `main.js`, `styles.css`.
3. Drop them into the vault's plugin folder (create it if missing):

   ```bash
   VAULT=/path/to/your/vault
   mkdir -p "$VAULT/.obsidian/plugins/vicinity-graph"
   # move the three downloaded files into that folder:
   mv manifest.json main.js styles.css "$VAULT/.obsidian/plugins/vicinity-graph/"
   ```

4. In Obsidian: **Settings → Community plugins → Reload** (or restart), then
   **Enable** *Vicinity Graph*.
5. Run **Vicinity Graph: Open in right sidebar**.

Manual installs do **not** auto-update — repeat the download to move to a newer
tag. (This is the same three-file layout `development.md`'s "driving your own
vault" section symlinks; the difference is a released copy vs. your live build.)

## Option C — build from a source checkout (untagged branch)

To test a branch or commit that has no release tag yet, build the artifacts
locally and install them like Option B:

```bash
git checkout <branch-or-commit>
npm install
npm run build            # produces main.js + styles.css; manifest.json is source-controlled

VAULT=/path/to/your/vault
mkdir -p "$VAULT/.obsidian/plugins/vicinity-graph"
cp main.js manifest.json styles.css "$VAULT/.obsidian/plugins/vicinity-graph/"
```

Then **Reload** community plugins and **Enable** *Vicinity Graph*. Use symlinks
instead of `cp` (as in `development.md`) if you want the vault to track rebuilds
of that checkout.

> ⚠️ Test against a **scratch or backed-up vault**. An enabled Vicinity Graph
> writes its own plugin state and, in early betas, stored-data shapes can change
> between builds without migrations (see CLAUDE.md, "clean breaks on stored
> data") — a re-set setting, not lost notes, but worth knowing.
