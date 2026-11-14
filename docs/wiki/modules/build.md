# Module: `scripts/build.mjs`

`scripts/build.mjs` builds `desktop/plugin.js` from `desktop/src` with esbuild. `npm run build` runs it (`package.json`). Source: [`scripts/build.mjs`](../../../scripts/build.mjs).

## Output

| Property | Value |
|---|---|
| Entry point | `desktop/src/plugin.jsx` |
| Output file | `desktop/plugin.js` |
| Format | ESM, one bundled file |
| Target | `chrome130` |
| JSX | `automatic` |
| External imports | `react`, `react/jsx-runtime`, `@hermes/plugin-sdk` |
| Minify | yes, except with `--watch` |
| Banner | `// Built by scripts/build.mjs from desktop/src. Do not edit.` |
| Legal comments | none |

After the build, the script prints `desktop/plugin.js <size> MB`. When the env var `META` is set, it writes the esbuild metafile to that path.

## Plugin `curated-shiki-langs`

The esbuild plugin replaces three module groups:

| Import | Replacement |
|---|---|
| `shiki/langs` | A generated module. It has lazy imports from `@shikijs/langs/<id>` only for the ids in `LANGS`, plus their aliases. |
| `collections/shiki.js` imported from `@pierre/theming` | An empty theme collection. The page registers Flexoki itself. |
| `./backends/highlights.js` and `@pierre/highlights/themes/loader` | Stubs that throw `Highlights backend is not bundled`. The page uses the Shiki JavaScript highlighter only. |

## `LANGS`

`typescript`, `tsx`, `javascript`, `jsx`, `json`, `jsonc`, `json5`, `python`, `css`, `scss`, `html`, `markdown`, `mdx`, `yaml`, `shellscript`, `dockerfile`, `sql`, `toml`, `graphql`, `go`, `rust`, `diff`, `xml`, `ini`, `prisma`, `vue`, `java`, `make`, `hcl`, `terraform`, `dotenv`.

## Dependencies

- **Uses:** `esbuild`, `shiki/langs` (from the `@pierre/diffs` dependency tree), `@pierre/theming`.
- **Writes:** [`desktop/plugin.js`](../../../desktop/plugin.js), which is committed to the repository.
