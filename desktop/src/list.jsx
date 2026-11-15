// The queue: open PRs that wait for my review. Add by link, hide in my space, open a PR.
import { Codicon } from '@hermes/plugin-sdk'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ago, call, errText, openUrl, savePrefs, shortRepo, store, tintFor, useStore } from './api.js'

const POLL_MS = 120_000

export function Avatar({ login, small }) {
  return (
    <span className={`rv-avatar${small ? ' rv-avatar-sm' : ''}`} data-tint={tintFor(login)} title={login}>
      {(login || '?')[0].toUpperCase()}
    </span>
  )
}

// My review state on the PR. Rows from an add (or old cache) have no status: they wait.
const STATUS = {
  awaiting: { label: 'Awaiting', tone: 'accent', title: 'Waits for your review' },
  approved: { label: 'Approved', tone: 'ok', title: 'You approved it' },
  changes: { label: 'Changes requested', tone: 'bad', title: 'You requested changes' },
  commented: { label: 'Commented', tone: '', title: 'You reviewed with comments only' }
}

function Row({ pr, index, onHide, onUnhide, hidden, groupBy }) {
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
          {groupBy !== 'person' ? (
            <>
              <span>·</span>
              <span>{pr.author}</span>
            </>
          ) : null}
          {groupBy !== 'project' && pr.project && pr.project !== 'Other' ? (
            <span className="rv-tag" title={pr.projectSource === 'files' ? 'Project guessed from the changed files' : `From branch ${pr.branch}`}>
              {pr.project}
            </span>
          ) : null}
          {pr.draft ? <span className="rv-badge" data-tone="draft">Draft</span> : null}
        </div>
      </div>
      <div className="rv-row-status">
        {(() => {
          const s = STATUS[pr.status] || STATUS.awaiting
          return (
            <span className="rv-badge" data-tone={s.tone} title={s.title}>
              {s.label}
            </span>
          )
        })()}
        <span className="rv-mono rv-row-lines" title={`${pr.additions ?? 0} lines added, ${pr.deletions ?? 0} lines removed`}>
          <span className="rv-plus">+{pr.additions ?? 0}</span> <span className="rv-minus">−{pr.deletions ?? 0}</span>
        </span>
      </div>
      <div className="rv-row-side">
        <div className="rv-row-actions">
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
        <button
          type="button"
          className="rv-btn rv-btn-ghost rv-icon-btn"
          title="Open on GitHub"
          onClick={e => {
            e.stopPropagation()
            openUrl(pr.url)
          }}
        >
          <Codicon name="github" />
        </button>
      </div>
    </div>
  )
}

function groupsOf(prs, groupBy) {
  if (groupBy === 'none') return [{ key: 'all', label: null, prs }]
  const map = new Map()
  for (const pr of prs) {
    const key = groupBy === 'person' ? pr.author || 'unknown' : pr.project || 'Other'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(pr)
  }
  return [...map.entries()]
    .map(([key, list]) => ({ key, label: key, prs: list, guessed: groupBy === 'project' && list.every(p => p.projectSource === 'files') }))
    .sort((a, b) => (a.key === 'Other') - (b.key === 'Other') || b.prs.length - a.prs.length || a.key.localeCompare(b.key))
}

const collapsedGroups = new Set()

function Group({ group, groupBy, start, onHide }) {
  const id = `${groupBy}:${group.key}`
  const [open, setOpen] = useState(!collapsedGroups.has(id))
  const toggle = () => {
    open ? collapsedGroups.add(id) : collapsedGroups.delete(id)
    setOpen(!open)
  }
  return (
    <section className="rv-group">
      {group.label ? (
        <button type="button" className="rv-group-head" data-open={open} onClick={toggle}>
          <Codicon name="chevron-right" />
          {groupBy === 'person' ? <Avatar login={group.label} small /> : <Codicon name={group.key === 'Other' ? 'circle-large-outline' : 'folder'} />}
          <span className="rv-group-name">{group.label}</span>
          <span className="rv-count">{group.prs.length}</span>
          {group.guessed ? <span className="rv-faint rv-italic" style={{ fontSize: '0.72rem' }}>from files</span> : null}
        </button>
      ) : null}
      {open ? (
        <div className="rv-list">
          {group.prs.map((pr, i) => (
            <Row key={pr.url} pr={pr} index={start + i} groupBy={groupBy} onHide={onHide} />
          ))}
        </div>
      ) : null}
    </section>
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
  const groupBy = useStore(s => s.groupBy)
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
          <span className="rv-count">{data ? `${prs.filter(p => (p.status || 'awaiting') === 'awaiting').length} waiting` : ''}</span>
          <span className="rv-spacer" />
          <div className="rv-seg" role="group" aria-label="Group by">
            {[
              ['project', 'Project'],
              ['person', 'Person'],
              ['none', 'None']
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                data-on={groupBy === k}
                onClick={() => {
                  store.set({ groupBy: k })
                  savePrefs()
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="rv-btn rv-btn-ghost" disabled={loading} onClick={load}>
            <Codicon name={loading ? 'loading' : 'refresh'} spinning={loading} />
            Refresh
          </button>
        </div>
        <p className="rv-sub rv-dim" style={{ fontSize: '0.82rem' }}>
          Open pull requests that wait for your review, and the ones you already reviewed.
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
          <div className="rv-groups">
            {(() => {
              let start = 0
              return groupsOf(prs, groupBy).map(g => {
                const el = <Group key={`${groupBy}:${g.key}`} group={g} groupBy={groupBy} start={start} onHide={p => move(p, true)} />
                start += g.prs.length
                return el
              })
            })()}
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
