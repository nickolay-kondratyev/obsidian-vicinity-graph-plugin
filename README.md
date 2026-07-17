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

### Dev vault

The build copies `main.js` / `manifest.json` / `styles.css` into
`.dev-vault/.obsidian/plugins/obsidian-neighborhood-graph/` (git-ignored). Open `.dev-vault/`
as a vault in Obsidian, enable community plugins, enable "Neighborhood Graph", then run the
"Open neighborhood graph" command to see the placeholder view.

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
