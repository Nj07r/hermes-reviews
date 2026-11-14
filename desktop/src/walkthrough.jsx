// Walkthrough: a short ordered review path written by a model in the background, Codiff style.
import { Codicon } from '@hermes/plugin-sdk'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ago, call, errText, openUrl, splitHunks, store, tintFor, useStore } from './api.js'
import { DiffView, diffItem, makeLoader, renderThread, threadAnnotations } from './diffs.js'
import { inlineCode } from './html.js'

const POLL_MS = 2500

export function useWalkthrough(id, data) {
  const [status, setStatus] = useState(data?.walkthrough || { state: 'none' })
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (data?.walkthrough) setStatus(data.walkthrough)
  }, [data])

  const fetchDoc = useCallback(
    async sha => {
      try {
        const r = await call('walkthrough_get', { id: sha ? `${id}@${sha}` : id })
        setDoc(r)
      } catch (e) {
        setError(errText(e))
      }
    },
    [id]
  )

  // Poll while running; load the document when done (or the older one when stale).
  useEffect(() => {
    if (status.state === 'done' || status.state === 'stale') {
      if (!doc || doc.sha !== status.sha) fetchDoc(status.sha)
      return
    }
    if (status.state !== 'running') return
    const t = setInterval(async () => {
      try {
        const r = await call('walkthrough_status', { id })
        setStatus(r.walkthrough)
      } catch {
        /* keep polling */
      }
    }, POLL_MS)
    return () => clearInterval(t)
  }, [status.state, status.sha, id])

  const start = useCallback(
    async ({ force } = {}) => {
      store.set({ tab: 'walkthrough' })
      if (!force && (status.state === 'running' || status.state === 'done')) return
      setError('')
      setStatus(s => ({ ...s, state: 'running', started: new Date().toISOString() }))
      try {
        const r = await call('walkthrough', { id, method: 'POST' })
        setStatus(r.walkthrough)
      } catch (e) {
        setStatus({ state: 'error', error: errText(e) })
      }
    },
    [id, status.state]
  )

  return { state: status.state, status, doc, error, start }
}

// ---------------------------------------------------------------- preparing

function Prose({ text }) {
  return inlineCode(text).map((p, i) => (p.code != null ? <code key={i}>{p.code}</code> : <Fragment key={i}>{p.text}</Fragment>))
}

function linesFor(files) {
  const names = files.length ? files : ['the diff']
  const out = []
  names.forEach((f, i) => {
    out.push(`Reading \`${f}\``)
    if (i === 1) out.push('Finding the change the rest depends on')
    if (i === 3) out.push('Grouping hunks that share one idea')
    if (i === 5) out.push('Ordering stops by review leverage')
  })
  out.push('Writing the review path', 'Checking every hunk id')
  return out
}

function Preparing({ status, files }) {
  const lines = useMemo(() => linesFor(status.files?.length ? status.files : files), [status.files, files])
  const [i, setI] = useState(0)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const a = setInterval(() => setI(n => n + 1), 2600)
    const b = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      clearInterval(a)
      clearInterval(b)
    }
  }, [])
  const started = Date.parse(status.started) || now
  const secs = Math.max(0, Math.round((now - started) / 1000))
  const bars = useMemo(
    () =>
      Array.from({ length: 11 }, (_, k) => ({
        w: 30 + ((k * 37) % 62),
        kind: k % 5 === 2 ? 'del' : k % 3 === 1 ? 'add' : 'ctx'
      })),
    []
  )
  return (
    <div className="rv-prep">
      <div className="rv-prep-box">
        <div className="rv-reader" aria-hidden="true">
          {bars.map((b, k) => (
            <i key={k} data-k={b.kind} style={{ '--w': `${b.w}%`, '--i': k }} />
          ))}
        </div>
        <div className="rv-prep-line" aria-live="polite">
          <span key={i}>
            <Prose text={lines[i % lines.length]} />…
          </span>
        </div>
        <span className="rv-mono rv-faint">
          {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')} · usually under a minute · you can leave this page
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- view

function Stop({ stop, n, files, pr, threads, diffStyle, wrap }) {
  const byPath = useMemo(() => new Map(files.map(f => [f.path, f])), [files])
  const items = useMemo(() => {
    // Group the stop's hunks per file, in the order the stop names them.
    const order = []
    const groups = new Map()
    for (const hid of stop.hunkIds) {
      const m = /^(.*):h(\d+)$/.exec(hid)
      if (!m) continue
      const [, path, num] = m
      if (!groups.has(path)) {
        groups.set(path, [])
        order.push(path)
      }
      groups.get(path).push(Number(num))
    }
    return order
      .map(path => {
        const f = byPath.get(path)
        if (!f) return null
        const nums = groups.get(path)
        const all = splitHunks(f.patch)
        const picked = nums.includes(0) ? null : nums.map(k => all[k - 1]).filter(Boolean)
        return diffItem(
          { ...f, sha: `${pr.headSha}:${stop.id}` },
          { key: `${stop.id}::${path}`, hunks: picked, annotations: threadAnnotations(threads, path) }
        )
      })
      .filter(Boolean)
  }, [stop, byPath, threads, pr.headSha])
  const loader = useMemo(() => makeLoader(pr, files), [pr, files])
  const render = useCallback(a => renderThread(a, { open: openUrl, ago, tintFor }), [])
  return (
    <DiffView
      key={stop.id}
      items={items}
      diffStyle={diffStyle}
      wrap={wrap}
      loader={loader}
      renderAnnotation={render}
      header={null}
    />
  )
}

function Walkthrough({ wt, data }) {
  const { walkthrough: doc, files } = wt.doc
  const diffStyle = useStore(s => s.diffStyle)
  const wrap = useStore(s => s.wrap)
  const stops = useMemo(() => doc.chapters.flatMap(c => c.stops.map(s => ({ ...s, chapter: c }))), [doc])
  const [at, setAt] = useState(0)
  const seen = useRef(new Set([0]))
  const go = useCallback(
    k => {
      const next = Math.max(0, Math.min(stops.length - 1, k))
      seen.current.add(next)
      setAt(next)
    },
    [stops.length]
  )
  useEffect(() => {
    const onKey = e => {
      if (e.target.closest?.('input, textarea, [contenteditable]')) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (e.altKey || e.metaKey) return
        go(at + 1)
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (e.altKey || e.metaKey) return
        go(at - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [at, go])
  const stop = stops[at]
  const stale = wt.state === 'stale'
  let n = 0
  return (
    <div className="rv-wt">
      <aside className="rv-wt-rail">
        <div className="rv-wt-focus">
          <h3>{doc.title}</h3>
          <Prose text={doc.focus} />
        </div>
        {doc.chapters.map(ch => (
          <div className="rv-wt-chapter" key={ch.id}>
            <span className="rv-label" title={ch.blurb}>
              {ch.title}
            </span>
            {ch.stops.map(s => {
              const k = n++
              return (
                <button key={s.id} type="button" className="rv-wt-stop" data-on={k === at} data-seen={seen.current.has(k)} onClick={() => go(k)}>
                  <span className="rv-wt-n">{k + 1}</span>
                  <span>{s.title}</span>
                </button>
              )
            })}
          </div>
        ))}
        {doc.support.length ? (
          <p className="rv-dim" style={{ fontSize: '0.75rem', padding: '14px 8px 0' }}>
            {doc.support.length} supporting hunk{doc.support.length === 1 ? '' : 's'} (lockfiles, renames, small edits) are in Files.
          </p>
        ) : null}
      </aside>
      <div className="rv-wt-main">
        <div className="rv-progress">
          <span style={{ width: `${((at + 1) / stops.length) * 100}%` }} />
        </div>
        {stale ? (
          <div className="rv-banner">
            <Codicon name="warning" />
            The pull request has new commits since this walkthrough.
            <span className="rv-spacer" />
            <button type="button" className="rv-btn" onClick={() => wt.start({ force: true })}>
              <Codicon name="refresh" /> Walk me through again
            </button>
          </div>
        ) : null}
        <div className="rv-wt-card" key={stop.id}>
          <span className="rv-label">
            {stop.chapter.title} · {at + 1} of {stops.length}
          </span>
          <h2>{stop.title}</h2>
          {stop.summary ? (
            <p className="rv-wt-summary">
              <Prose text={stop.summary} />
            </p>
          ) : null}
          {stop.prose ? (
            <p className="rv-wt-prose">
              <Prose text={stop.prose} />
            </p>
          ) : null}
          {stop.check ? (
            <div className="rv-wt-check">
              <Codicon name="eye" />
              <span>
                <Prose text={stop.check} />
              </span>
            </div>
          ) : null}
          <div className="rv-wt-nav">
            <button type="button" className="rv-btn" disabled={at === 0} onClick={() => go(at - 1)}>
              <Codicon name="arrow-left" /> Back
            </button>
            <button type="button" className={`rv-btn${at < stops.length - 1 ? ' rv-btn-primary' : ''}`} disabled={at === stops.length - 1} onClick={() => go(at + 1)}>
              Next <Codicon name="arrow-right" />
            </button>
            <span className="rv-mono rv-faint" style={{ marginLeft: 6 }}>
              ← → to move
            </span>
          </div>
        </div>
        <Stop stop={stop} n={at} files={files} pr={data.pr} threads={stale ? [] : data.threads} diffStyle={diffStyle} wrap={wrap} />
      </div>
    </div>
  )
}

export function WalkthroughTab({ wt, data }) {
  const fileNames = useMemo(() => data.files.map(f => f.path.split('/').pop()), [data.files])
  if (wt.state === 'running') return <Preparing status={wt.status} files={fileNames} />
  if ((wt.state === 'done' || wt.state === 'stale') && wt.doc) return <Walkthrough wt={wt} data={data} />
  if (wt.state === 'done' || wt.state === 'stale') {
    return (
      <div className="rv-prep">
        <span className="rv-dim">{wt.error || 'Opening the walkthrough…'}</span>
      </div>
    )
  }
  const failed = wt.state === 'error'
  return (
    <div className="rv-prep">
      <div className="rv-cta">
        <Codicon name={failed ? 'warning' : 'sparkle'} style={{ fontSize: 26, color: failed ? 'var(--ui-red)' : 'var(--ui-accent)' }} />
        <h3>{failed ? 'The walkthrough did not finish' : 'Walk through this change'}</h3>
        <p>
          {failed
            ? wt.status.error || wt.error || 'Something went wrong.'
            : 'Hermes reads the diff and writes a short review path: the change the rest depends on first, related hunks together, tests and wiring last.'}
        </p>
        <button type="button" className="rv-btn rv-btn-primary" onClick={() => wt.start({ force: true })}>
          <Codicon name={failed ? 'refresh' : 'sparkle'} />
          {failed ? 'Try again' : 'Walk me through'}
        </button>
        <span className="rv-mono rv-faint">runs in the background · about a minute</span>
      </div>
    </div>
  )
}
