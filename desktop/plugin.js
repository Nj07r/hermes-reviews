/**
 * Reviews for Hermes Desktop: a page in the main area (sidebar row "Reviews", route /reviews) with
 * the open pull requests in one GitHub org that wait for my review.
 *
 * Data comes from the plugin backend through ctx.rest('/call/<name>'), which runs the signed-in
 * gh CLI. Paste a PR link to request my own review on it; it joins the list at once.
 * A row click opens the PR in the browser.
 */
import { Codicon, ROUTES_AREA, SIDEBAR_NAV_AREA } from '@hermes/plugin-sdk'
import { useCallback, useEffect, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const ID = 'reviews'
const PATH = '/reviews'
const POLL_MS = 120_000

let pluginCtx = null

const call = (name, method = 'GET', body) =>
  pluginCtx.rest(`/call/${name}`, { method, body, timeoutMs: 60_000 })

const openUrl = url => {
  if (/^https:\/\/github\.com\//.test(url || '')) pluginCtx.os.openExternal(url)
}

function ago(iso) {
  const t = Date.parse(iso)
  if (!t) return ''
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}

const errText = e => String(e?.body?.error || e?.message || e || 'failed')

const STYLES = `
.rv-page { height: 100%; overflow: auto; }
.rv-wrap { max-width: 880px; margin: 0 auto; padding: 24px 24px 48px; }
.rv-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 14px; }
.rv-head h1 { font-size: 1.15rem; font-weight: 600; color: var(--ui-text-primary); margin: 0; }
.rv-count { font-size: 0.8rem; color: var(--ui-text-tertiary); }
.rv-spacer { flex: 1; }
.rv-btn { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 6px;
  border: 1px solid var(--ui-stroke-secondary); background: transparent; color: var(--ui-text-secondary);
  font-size: 0.8125rem; cursor: pointer; }
.rv-btn:hover { background: var(--ui-control-hover-background); color: var(--ui-text-primary); }
.rv-btn:disabled { opacity: 0.5; cursor: default; }
.rv-add { display: flex; gap: 8px; margin-bottom: 6px; }
.rv-add input { flex: 1; height: 30px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--ui-stroke-secondary);
  background: transparent; color: var(--ui-text-primary); font-size: 0.8125rem; outline: none; }
.rv-add input:focus { border-color: var(--ui-accent); }
.rv-msg { min-height: 18px; font-size: 0.75rem; color: var(--ui-text-tertiary); margin-bottom: 8px; }
.rv-msg[data-tone='error'] { color: var(--dt-destructive, #d14d41); }
.rv-list { display: grid; gap: 1px; }
.rv-row { display: grid; grid-template-columns: 16px minmax(0, 1fr) auto; gap: 10px; align-items: start; width: 100%;
  padding: 9px 10px; border: 1px solid transparent; border-radius: 6px; background: transparent; text-align: left; cursor: pointer; }
.rv-row:hover { background: var(--ui-control-hover-background); }
.rv-row .codicon { margin-top: 2px; color: var(--ui-accent); }
.rv-row[data-draft='true'] .codicon { color: var(--ui-text-quaternary); }
.rv-title { font-size: 0.875rem; color: var(--ui-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rv-meta { font-size: 0.75rem; color: var(--ui-text-tertiary); margin-top: 2px; }
.rv-age { font-size: 0.75rem; color: var(--ui-text-quaternary); margin-top: 2px; }
.rv-badge { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.06em; padding: 1px 5px; margin-left: 6px;
  border-radius: 4px; border: 1px solid var(--ui-stroke-secondary); color: var(--ui-text-tertiary); }
.rv-empty { padding: 40px 0; text-align: center; color: var(--ui-text-tertiary); font-size: 0.875rem; }
`

function Row({ pr }) {
  return jsxs('button', {
    type: 'button',
    className: 'rv-row',
    'data-draft': String(pr.draft),
    title: pr.url,
    onClick: () => openUrl(pr.url),
    children: [
      jsx(Codicon, { name: pr.draft ? 'git-pull-request-draft' : 'git-pull-request' }),
      jsxs('div', {
        style: { minWidth: 0 },
        children: [
          jsx('div', { className: 'rv-title', children: pr.title }),
          jsxs('div', {
            className: 'rv-meta',
            children: [
              `${pr.repo.split('/').pop()} #${pr.number} · ${pr.author}`,
              pr.draft ? jsx('span', { className: 'rv-badge', children: 'Draft' }) : null
            ]
          })
        ]
      }),
      jsx('div', { className: 'rv-age', title: `Updated ${pr.updated}`, children: ago(pr.updated) })
    ]
  })
}

function ReviewsPage() {
  const [prs, setPrs] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState({ text: '', tone: '' })
  const [link, setLink] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await call('list')
      if (!r?.ok) throw new Error(r?.error || 'list failed')
      // Search lags a few seconds behind a new review request: keep rows we just added.
      setPrs(prev => {
        const fresh = r.prs
        const added = (prev || []).filter(p => p.addedHere && !fresh.some(f => f.url === p.url))
        return [...added, ...fresh]
      })
      setMsg(m => (m.tone === 'error' ? { text: '', tone: '' } : m))
    } catch (e) {
      setMsg({ text: `Could not load: ${errText(e)}`, tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  const add = async () => {
    const url = link.trim()
    if (!url) return
    setAdding(true)
    setMsg({ text: 'Requesting your review…', tone: '' })
    try {
      const r = await call('add', 'POST', { url })
      if (!r?.ok) throw new Error(r?.error || 'add failed')
      const pr = { ...r.pr, addedHere: true }
      setPrs(prev => [pr, ...(prev || []).filter(p => p.url !== pr.url)])
      setLink('')
      setMsg({ text: `Added ${pr.repo.split('/').pop()} #${pr.number}`, tone: '' })
    } catch (e) {
      setMsg({ text: errText(e), tone: 'error' })
    } finally {
      setAdding(false)
    }
  }

  const list = prs || []
  return jsx('div', {
    className: 'rv-page',
    children: jsxs('div', {
      className: 'rv-wrap',
      children: [
        jsxs('div', {
          className: 'rv-head',
          children: [
            jsx('h1', { children: 'Reviews' }),
            jsx('span', { className: 'rv-count', children: prs ? `${list.length} waiting` : '' }),
            jsx('span', { className: 'rv-spacer' }),
            jsxs('button', {
              type: 'button',
              className: 'rv-btn',
              disabled: loading,
              onClick: load,
              children: [jsx(Codicon, { name: loading ? 'loading' : 'refresh', spinning: loading }), 'Refresh']
            })
          ]
        }),
        jsxs('div', {
          className: 'rv-add',
          children: [
            jsx('input', {
              value: link,
              placeholder: 'Paste a pull request link to request your review',
              spellCheck: false,
              onChange: e => setLink(e.target.value),
              onKeyDown: e => {
                if (e.key === 'Enter') add()
              }
            }),
            jsx('button', { type: 'button', className: 'rv-btn', disabled: adding || !link.trim(), onClick: add, children: 'Add' })
          ]
        }),
        jsx('div', { className: 'rv-msg', 'data-tone': msg.tone, children: msg.text }),
        prs && !list.length
          ? jsx('div', { className: 'rv-empty', children: 'Nothing waits for your review.' })
          : jsx('div', { className: 'rv-list', children: list.map(pr => jsx(Row, { pr }, pr.url)) })
      ]
    })
  })
}

export default {
  id: ID,
  name: 'Reviews',
  register(ctx) {
    pluginCtx = ctx
    const style = document.createElement('style')
    style.dataset.plugin = ID
    style.textContent = STYLES
    document.head.append(style)
    ctx.onDispose?.(() => style.remove())

    ctx.register({ id: 'page', area: ROUTES_AREA, title: 'Reviews', data: { path: PATH }, render: () => jsx(ReviewsPage, {}) })
    ctx.register({ id: 'nav', area: SIDEBAR_NAV_AREA, data: { path: PATH, label: 'Reviews', codicon: 'git-pull-request' } })
  }
}
