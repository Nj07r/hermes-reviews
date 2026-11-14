// @pierre/diffs and @pierre/trees, wrapped for React (we cannot use their React builds:
// plugins get no react-dom). Flexoki is registered as the Shiki theme.
import { CodeView, parsePatchFiles, registerCustomTheme } from '@pierre/diffs'
import { FileTree, themeToTreeStyles } from '@pierre/trees'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { jsx } from 'react/jsx-runtime'
import { call, filePatch } from './api.js'
import { cleanHtml } from './html.js'
import flexokiDark from './themes/flexoki-dark.json'
import flexokiLight from './themes/flexoki-light.json'

registerCustomTheme('flexoki-dark', async () => ({ ...flexokiDark, name: 'flexoki-dark' }))
registerCustomTheme('flexoki-light', async () => ({ ...flexokiLight, name: 'flexoki-light' }))
const THEME = { dark: 'flexoki-dark', light: 'flexoki-light' }

// ---------------------------------------------------------------- dark mode follows the app

const darkSubs = new Set()
let darkObserver = null
const isDarkNow = () => document.documentElement.classList.contains('dark')
function subscribeDark(fn) {
  darkSubs.add(fn)
  if (!darkObserver) {
    darkObserver = new MutationObserver(() => darkSubs.forEach(f => f()))
    darkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  }
  return () => {
    darkSubs.delete(fn)
    if (!darkSubs.size) {
      darkObserver?.disconnect()
      darkObserver = null
    }
  }
}
export const useIsDark = () => useSyncExternalStore(subscribeDark, isDarkNow)

// ---------------------------------------------------------------- diff items

const parsed = new Map() // cache key -> FileDiffMetadata (identity must stay stable for hydration)

export function diffItem(file, { key, hunks, annotations } = {}) {
  if (!file.patch) {
    return {
      id: key || file.path,
      type: 'file',
      file: { name: file.path, lang: 'text', contents: `No text diff for this file (${file.status}, binary or too large).\nOpen it on GitHub to see the change.` }
    }
  }
  const cacheKey = `${key || file.path}@${file.sha || ''}`
  let fileDiff = parsed.get(cacheKey)
  if (!fileDiff) {
    fileDiff = parsePatchFiles(filePatch(file, hunks), { cacheKeyPrefix: cacheKey })[0]?.files[0]
    if (fileDiff) parsed.set(cacheKey, fileDiff)
  }
  if (!fileDiff) return null
  return { id: key || file.path, type: 'diff', fileDiff, annotations: annotations || [] }
}

// "Expand unchanged lines" needs both sides in full. GitHub diffs a PR against the merge base.
export function makeLoader(pr, files) {
  const byPath = new Map(files.map(f => [f.path, f]))
  const fetchFile = async (path, ref) => {
    if (!path || !ref) return null
    const r = await call('file', { method: 'POST', body: { repo: pr.repo, path, ref } })
    return r.contents == null ? null : { name: path, contents: r.contents, cacheKey: `${ref}:${path}` }
  }
  return async fileDiff => {
    const f = byPath.get(fileDiff.name) || {}
    const oldRef = pr.mergeBase || pr.baseSha
    const [oldFile, newFile] = await Promise.all([
      f.status === 'added' ? null : fetchFile(f.prevPath || f.path, oldRef),
      f.status === 'removed' ? null : fetchFile(f.path, pr.headSha)
    ])
    return { oldFile, newFile }
  }
}

// ---------------------------------------------------------------- review thread annotations

function el(tag, cls, text) {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

export function threadAnnotations(threads, path) {
  const roots = threads.filter(t => !t.replyTo && t.path === path && !t.outdated && t.line)
  return roots.map(root => ({
    side: root.side === 'LEFT' ? 'deletions' : 'additions',
    lineNumber: root.line,
    metadata: { thread: [root, ...threads.filter(t => t.replyTo === root.id)] }
  }))
}

export function renderThread(annotation, { open, ago, tintFor }) {
  const box = el('div', 'rv-thread')
  for (const c of annotation.metadata?.thread || []) {
    const row = el('div', 'rv-thread-item')
    const head = el('div', 'rv-thread-head')
    const av = el('span', 'rv-avatar rv-avatar-sm', (c.user.login || '?')[0].toUpperCase())
    av.dataset.tint = tintFor(c.user.login)
    head.append(av, el('span', 'rv-thread-who', c.user.login), el('span', 'rv-mono rv-dim', ago(c.created)))
    const body = el('div', 'rv-prose rv-thread-body')
    body.innerHTML = cleanHtml(c.html)
    body.addEventListener('click', e => {
      const a = e.target.closest?.('a[href]')
      if (a) {
        e.preventDefault()
        open(a.getAttribute('href'))
      }
    })
    row.append(head, body)
    box.append(row)
  }
  return box
}

// ---------------------------------------------------------------- React wrappers

const DIFF_CSS = `
:host { --diffs-gap-block: 0px; }
[data-diffs-header] { font-family: var(--rv-sans); }
`

export function DiffView({ items, diffStyle, wrap, loader, renderAnnotation, onViewer, onScrollItem, className, header }) {
  const root = useRef(null)
  const viewer = useRef(null)
  const isDark = useIsDark()
  const cb = useRef({})
  cb.current = { renderAnnotation, onScrollItem, header }

  const options = () => ({
    theme: THEME,
    themeType: isDark ? 'dark' : 'light',
    diffStyle,
    overflow: wrap ? 'wrap' : 'scroll',
    lineDiffType: 'word',
    hunkSeparators: 'line-info',
    stickyHeaders: true,
    expansionLineCount: 20,
    loadDiffFiles: loader,
    unsafeCSS: DIFF_CSS,
    layout: { paddingTop: 0, paddingBottom: 48, gap: 14 },
    renderAnnotation: (a, d, c) => cb.current.renderAnnotation?.(a, d, c),
    ...(header ? { renderCodeViewHeader: () => cb.current.header } : {})
  })

  useEffect(() => {
    const v = new CodeView(options())
    v.setup(root.current)
    viewer.current = v
    onViewer?.(v)
    const off = v.subscribeToScroll(top => {
      const fn = cb.current.onScrollItem
      if (!fn) return
      let best = null
      for (const r of v.getRenderedItems()) {
        const t = v.getTopForItem(r.item.id)
        if (t != null && t <= top + 24 && (!best || t > best.t)) best = { id: r.item.id, t }
      }
      if (best) fn(best.id)
    })
    return () => {
      off?.()
      v.cleanUp()
      viewer.current = null
      onViewer?.(null)
    }
  }, [])

  useEffect(() => {
    viewer.current?.setOptions(options())
  }, [diffStyle, wrap, isDark, loader])

  useEffect(() => {
    viewer.current?.setItems(items.filter(Boolean))
  }, [items])

  return jsx('div', { ref: root, className: `rv-diffview ${className || ''}` })
}

function treeStyles(isDark) {
  const base = themeToTreeStyles(isDark ? flexokiDark : flexokiLight)
  return {
    ...base,
    background: 'transparent',
    '--trees-theme-list-active-selection-bg': 'color-mix(in oklab, var(--ui-accent) 22%, transparent)',
    '--trees-theme-list-hover-bg': 'var(--ui-control-hover-background)',
    '--trees-theme-focus-ring': 'var(--ui-accent)'
  }
}

export function TreeView({ paths, status, onSelect, selected }) {
  const root = useRef(null)
  const tree = useRef(null)
  const silent = useRef(false)
  const isDark = useIsDark()
  const cb = useRef(onSelect)
  cb.current = onSelect

  useEffect(() => {
    const t = new FileTree({
      paths,
      gitStatus: status,
      initialExpansion: 'open',
      flattenEmptyDirectories: true,
      density: 'compact',
      search: true,
      onSelectionChange: sel => {
        if (silent.current) return
        const p = sel[sel.length - 1]
        if (p && paths.includes(p)) cb.current?.(p)
      }
    })
    t.render({ fileTreeContainer: root.current })
    tree.current = t
    return () => {
      t.cleanUp?.()
      tree.current = null
    }
  }, [paths])

  useEffect(() => {
    const host = root.current
    if (!host) return
    for (const [k, v] of Object.entries(treeStyles(isDark))) {
      if (k.startsWith('--')) host.style.setProperty(k, v)
      else host.style[k] = v
    }
  }, [isDark])

  // Follow the diff: mark the file in view without firing onSelect.
  useEffect(() => {
    const t = tree.current
    if (!t || !selected) return
    const now = t.getSelectedPaths()
    if (now.length === 1 && now[0] === selected) return
    silent.current = true
    try {
      for (const p of t.getSelectedPaths()) if (p !== selected) t.getItem(p)?.deselect?.()
      t.getItem(selected)?.select?.()
      t.scrollToPath?.(selected, { align: 'nearest' })
    } finally {
      silent.current = false
    }
  }, [selected])

  return jsx('div', { ref: root, className: 'rv-tree' })
}
