// The queue: open PRs that wait for my review. Add by link, hide in my space, open a PR.
import { Codicon } from '@hermes/plugin-sdk'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ago, call, errText, openUrl, shortRepo, store, tintFor } from './api.js'

const POLL_MS = 120_000

export function Avatar({ login, small }) {
  return (
    <span className={`rv-avatar${small ? ' rv-avatar-sm' : ''}`} data-tint={tintFor(login)} title={login}>
      {(login || '?')[0].toUpperCase()}
    </span>
  )
}

function Row({ pr, index, onHide, onUnhide, hidden }) {
  const open = () => store.set({ selected: `${pr.repo}#${pr.number}`, tab: 'overview' })
  return (
    <div
      role="button"
      tabIndex={0}
      className="rv-row rv-enter"
      style={{ '--i': Math.min(index, 14) }}
      onClick={open}
      onKeyDown={e => {
        if (e.key === 'Enter') open()
      }}
    >
      <Avatar login={pr.author} />
      <div style={{ minWidth: 0 }}>
        <div className="rv-row-title">{pr.title}</div>
        <div className="rv-row-meta">
          <span className="rv-mono">
            {shortRepo(pr.repo)} #{pr.number}
          </span>
          <span>·</span>
          <span>{pr.author}</span>
          {pr.draft ? <span className="rv-badge" data-tone="draft">Draft</span> : null}
        </div>
      </div>
      <div className="rv-row-side">
        <div className="rv-row-actions">
          <button
            type="button"
            className="rv-btn rv-btn-ghost rv-icon-btn"
            title="Open on GitHub"
            onClick={e => {
              e.stopPropagation()
              openUrl(pr.url)
            }}
          >
            <Codicon name="link-external" />
          </button>
          <button
            type="button"
            className="rv-btn rv-btn-ghost rv-icon-btn"
            title={hidden ? 'Show in my list again' : 'Hide from my list'}
            onClick={e => {
              e.stopPropagation()
              hidden ? onUnhide(pr) : onHide(pr)
            }}
          >
            <Codicon name={hidden ? 'eye' : 'eye-closed'} />
          </button>
        </div>
        <span className="rv-mono rv-faint" title={`Updated ${pr.updated}`}>
          {ago(pr.updated)}
        </span>
      </div>
    </div>
  )
}

let cache = null // survives leaving and re-entering the page

export function ReviewsList() {
  const [data, setData] = useState(cache)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState({ text: '', tone: '' })
  const [link, setLink] = useState('')
  const [adding, setAdding] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const added = useRef([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await call('list')
      // Search lags a little behind a fresh review request: keep rows added here until it catches up.
      added.current = added.current.filter(p => !r.prs.some(f => f.url === p.url))
      cache = { prs: [...added.current, ...r.prs], hidden: r.hidden || [] }
      setData(cache)
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
      const r = await call('add', { method: 'POST', body: { url } })
      added.current = [r.pr, ...added.current.filter(p => p.url !== r.pr.url)]
      cache = {
        prs: [r.pr, ...(cache?.prs || []).filter(p => p.url !== r.pr.url)],
        hidden: (cache?.hidden || []).filter(p => p.url !== r.pr.url)
      }
      setData(cache)
      setLink('')
      setMsg({ text: `Added ${shortRepo(r.pr.repo)} #${r.pr.number}. You are a reviewer on it now.`, tone: 'ok' })
    } catch (e) {
      setMsg({ text: errText(e), tone: 'error' })
    } finally {
      setAdding(false)
    }
  }

  const move = async (pr, hide) => {
    const from = hide ? 'prs' : 'hidden'
    const to = hide ? 'hidden' : 'prs'
    cache = { ...cache, [from]: cache[from].filter(p => p.url !== pr.url), [to]: [pr, ...cache[to]] }
    setData(cache)
    try {
      await call(hide ? 'hide' : 'unhide', { method: 'POST', body: { url: pr.url } })
    } catch (e) {
      setMsg({ text: errText(e), tone: 'error' })
      load()
    }
  }

  const prs = data?.prs || []
  const hidden = data?.hidden || []
  return (
    <div className="rv-scroll">
      <div className="rv-wrap">
        <div className="rv-title-row">
          <h1 className="rv-h1">Reviews</h1>
          <span className="rv-count">{data ? `${prs.length} waiting` : ''}</span>
          <span className="rv-spacer" />
          <button type="button" className="rv-btn rv-btn-ghost" disabled={loading} onClick={load}>
            <Codicon name={loading ? 'loading' : 'refresh'} spinning={loading} />
            Refresh
          </button>
        </div>
        <p className="rv-sub rv-dim" style={{ fontSize: '0.82rem' }}>
          Open pull requests that wait for your review.
        </p>
        <div className="rv-add">
          <input
            className="rv-input"
            value={link}
            placeholder="Paste a pull request link to add yourself as a reviewer"
            spellCheck={false}
            onChange={e => setLink(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') add()
            }}
          />
          <button type="button" className="rv-btn" disabled={adding || !link.trim()} onClick={add}>
            <Codicon name={adding ? 'loading' : 'add'} spinning={adding} />
            Add
          </button>
        </div>
        <div className="rv-msg" data-tone={msg.tone}>
          {msg.text}
        </div>
        {!data ? (
          <div className="rv-skeleton" style={{ padding: 0 }}>
            {[70, 55, 62, 48].map((w, i) => (
              <i key={i} style={{ width: `${w}%`, height: 40 }} />
            ))}
          </div>
        ) : prs.length ? (
          <div className="rv-list">
            {prs.map((pr, i) => (
              <Row key={pr.url} pr={pr} index={i} onHide={p => move(p, true)} />
            ))}
          </div>
        ) : (
          <div className="rv-empty">
            Nothing waits for your review.
            <span className="rv-italic">The well is still.</span>
          </div>
        )}
        {hidden.length ? (
          <div className="rv-hidden-toggle">
            <button type="button" className="rv-collapse" onClick={() => setShowHidden(v => !v)}>
              <Codicon name={showHidden ? 'chevron-down' : 'chevron-right'} /> Hidden ({hidden.length})
            </button>
            {showHidden ? (
              <div className="rv-list" style={{ marginTop: 6, opacity: 0.7 }}>
                {hidden.map((pr, i) => (
                  <Row key={pr.url} pr={pr} index={i} hidden onUnhide={p => move(p, false)} />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
