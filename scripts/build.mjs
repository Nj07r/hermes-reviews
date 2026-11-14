// Build desktop/plugin.js: one ESM file that Hermes Desktop loads from a blob.
// The loader allows only `@hermes/plugin-sdk` and `react*` imports, so everything else
// (@pierre/diffs, @pierre/trees, Shiki) is bundled in. Shiki's language set is cut down to
// the languages our repos use, which keeps the bundle small.
import { build } from 'esbuild'
import { bundledLanguagesInfo } from 'shiki/langs'

const LANGS = [
  'typescript', 'tsx', 'javascript', 'jsx', 'json', 'jsonc', 'json5', 'python', 'css', 'scss',
  'html', 'markdown', 'mdx', 'yaml', 'shellscript', 'dockerfile', 'sql', 'toml', 'graphql',
  'go', 'rust', 'diff', 'xml', 'ini', 'prisma', 'vue', 'java', 'make', 'hcl', 'terraform', 'dotenv'
]

function langsModule() {
  const rows = []
  for (const info of bundledLanguagesInfo) {
    if (!LANGS.includes(info.id)) continue
    const load = `() => import('@shikijs/langs/${info.id}')`
    for (const key of [info.id, ...(info.aliases || [])]) rows.push(`  ${JSON.stringify(key)}: ${load},`)
  }
  return `export const bundledLanguages = {\n${rows.join('\n')}\n}\n`
}

const curatedLangs = {
  name: 'curated-shiki-langs',
  setup(b) {
    b.onResolve({ filter: /^shiki\/langs$/ }, () => ({ path: 'shiki-langs', namespace: 'curated' }))
    b.onLoad({ filter: /^shiki-langs$/, namespace: 'curated' }, () => ({ contents: langsModule(), resolveDir: process.cwd(), loader: 'js' }))
    // We register Flexoki ourselves: drop Shiki's 60 bundled themes from @pierre/theming.
    b.onResolve({ filter: /collections\/shiki\.js$/ }, args =>
      args.importer.includes('@pierre/theming') ? { path: 'no-shiki-themes', namespace: 'curated' } : undefined
    )
    b.onLoad({ filter: /^no-shiki-themes$/, namespace: 'curated' }, () => ({
      contents: `import { createThemeCollection } from '${process.cwd()}/node_modules/@pierre/theming/dist/modules/createThemeCollection.js'\nexport const shikiThemes = createThemeCollection({ themes: [] })\n`,
      resolveDir: process.cwd(),
      loader: 'js'
    }))
    // We use the shiki-js highlighter only: drop the Highlights WASM backend.
    b.onResolve({ filter: /^(\.\/backends\/highlights\.js|@pierre\/highlights\/themes\/loader)$/ }, () => ({ path: 'no-highlights', namespace: 'curated' }))
    b.onLoad({ filter: /^no-highlights$/, namespace: 'curated' }, () => ({
      contents: `const off = () => { throw new Error('Highlights backend is not bundled') }\nexport const HighlightsHighlighter = off\nexport default off\nexport const loadTheme = off\nexport const themes = {}\n`,
      loader: 'js'
    }))
  }
}

const watch = process.argv.includes('--watch')
const options = {
  entryPoints: ['desktop/src/plugin.jsx'],
  bundle: true,
  format: 'esm',
  minify: !watch,
  target: 'chrome130',
  jsx: 'automatic',
  outfile: 'desktop/plugin.js',
  external: ['react', 'react/jsx-runtime', '@hermes/plugin-sdk'],
  plugins: [curatedLangs],
  legalComments: 'none',
  banner: { js: '// Built by scripts/build.mjs from desktop/src. Do not edit.' },
  logLevel: 'warning',
  metafile: true
}

const result = await build(options)
if (process.env.META) (await import("node:fs")).writeFileSync(process.env.META, JSON.stringify(result.metafile))
const bytes = Object.values(result.metafile.outputs)[0].bytes
console.log(`desktop/plugin.js ${(bytes / 1e6).toFixed(2)} MB`)
