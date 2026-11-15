// Backend calls, shared state and small helpers for the Reviews page.
import { useSyncExternalStore } from 'react'

let ctx = null
export const setCtx = c => {
  ctx = c
}
export const getCtx = () => ctx

// Every call is a POST with a JSON body: the Webapp's REST door sends no JSON content type on
// a bodiless GET, and the backend refuses such requests as possibly cross-site.
export async function call(name, { id = '', body = {} } = {}) {
  const method = 'POST'
  const q = id ? `?id=${encodeURIComponent(id)}` : ''
  let r
  try {
    r = await ctx.rest(`/call/${name}${q}`, { method, body, timeoutMs: 120_000 })
  } catch (e) {
    throw new Error(e?.body?.error || e?.message || `${name} failed`)
  }
  if (!r?.ok) throw new Error(r?.error || `${name} failed`)
  return r
}

export const errText = e => String(e?.message || e || 'failed')

export function openUrl(url) {
  if (/^https:\/\//.test(url || '')) ctx.os.openExternal(url)
}

export const copyText = text => ctx.os.writeClipboard(String(text || ''))

// ---------------------------------------------------------------- tiny store

function createStore(initial) {
  let state = initial
  const subs = new Set()
  return {
    get: () => state,
    set: patch => {
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
      subs.forEach(fn => fn())
    },
    subscribe: fn => {
      subs.add(fn)
      return () => subs.delete(fn)
    }
  }
}

export const store = createStore({
  selected: null, // PR id "owner/repo#n" or null for the list
  tab: 'overview',
  diffStyle: 'split',
  wrap: false,
  groupBy: 'project', // 'project' | 'person' | 'none'
  show: 'awaiting' // 'awaiting' | 'all'. Not saved: every app start opens on Awaiting.
})

export const useStore = sel => useSyncExternalStore(store.subscribe, () => sel(store.get()))

export function loadPrefs() {
  const prefs = ctx.storage?.get?.('prefs', null)
  if (prefs && typeof prefs === 'object') {
    store.set({
      diffStyle: prefs.diffStyle === 'unified' ? 'unified' : 'split',
      wrap: Boolean(prefs.wrap),
      groupBy: ['project', 'person', 'none'].includes(prefs.groupBy) ? prefs.groupBy : 'project'
    })
  }
}

export function savePrefs() {
  const { diffStyle, wrap, groupBy } = store.get()
  ctx.storage?.set?.('prefs', { diffStyle, wrap, groupBy })
}

// ---------------------------------------------------------------- format

export function ago(iso) {
  const t = Date.parse(iso)
  if (!t) return ''
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d`
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const TINTS = ['orange', 'cyan', 'blue', 'purple', 'magenta', 'green', 'yellow', 'red']
export function tintFor(name) {
  let h = 0
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TINTS[h % TINTS.length]
}

export const shortRepo = repo => String(repo || '').split('/').pop()

// GitHub patch -> hunks (each starts with its @@ line). Must match reviews_core.split_hunks.
export function splitHunks(patch) {
  const hunks = []
  for (const line of String(patch || '').split('\n')) {
    if (line.startsWith('@@ ') || !hunks.length) hunks.push([line])
    else hunks[hunks.length - 1].push(line)
  }
  return hunks.filter(h => h[0].startsWith('@@ ')).map(h => h.join('\n'))
}

// A git-style patch for one file, so @pierre/diffs can parse it. `hunks` limits it to some hunks.
export function filePatch(file, hunks) {
  const body = hunks ? hunks.join('\n') : String(file.patch || '')
  const oldPath = file.prevPath || file.path
  const head = [`diff --git a/${oldPath} b/${file.path}`]
  if (file.status === 'added') head.push('new file mode 100644', '--- /dev/null', `+++ b/${file.path}`)
  else if (file.status === 'removed') head.push('deleted file mode 100644', `--- a/${oldPath}`, '+++ /dev/null')
  else {
    if (file.prevPath) head.push(`rename from ${file.prevPath}`, `rename to ${file.path}`)
    head.push(`--- a/${oldPath}`, `+++ b/${file.path}`)
  }
  return `${head.join('\n')}\n${body}${body.endsWith('\n') ? '' : '\n'}`
}
