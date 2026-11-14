// One pull request: header, Overview (description, checks, conversation), Files, Walkthrough.
import { Codicon, host } from '@hermes/plugin-sdk'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ago, call, copyText, errText, openUrl, savePrefs, shortRepo, store, tintFor, useStore } from './api.js'
import { DiffView, TreeView, diffItem, makeLoader, renderThread, threadAnnotations } from './diffs.js'
import { cleanHtml, onHtmlClick } from './html.js'
import { Avatar } from './list.jsx'
import { WalkthroughTab, useWalkthrough } from './walkthrough.jsx'

const prCache = new Map()

async function reviewInChat(url) {
  host.newChat()
  const text = `Please review ${url}`
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 120))
    if (host.composer.submit?.('new', text)) return true
  }
  // Older desktops: leave it drafted, one Enter away.
  for (let i = 0; i < 10; i++) {
    if (await host.composer.setDraft('new', text)) {
      host.composer.focus('new')
      return true
    }
    await new Promise(r => setTimeout(r, 120))
  }
  host.notify?.({ kind: 'error', message: 'Reviews: could not open a new chat' })
  return false
}

function Html({ html, className }) {
  const clean = useMemo(() => cleanHtml(html), [html])
  return <div className={`rv-prose ${className || ''}`} onClick={onHtmlClick(openUrl)} dangerouslySetInnerHTML={{ __html: clean }} />
}

// ---------------------------------------------------------------- checks

function checkState(c) {
  if (c.status !== 'COMPLETED') return 'run'
  if (['SUCCESS'].includes(c.conclusion)) return 'ok'
  if (['FAILURE', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE'].includes(c.conclusion)) return 'bad'
  return 'skip'
}
const CHECK_ICON = { ok: 'pass-filled', bad: 'error', run: 'loading', skip: 'circle-slash' }
const CHECK_ORDER = { bad: 0, run: 1, ok: 2, skip: 3 }

function Checks({ checks }) {
  const counts = { ok: 0, bad: 0, run: 0, skip: 0 }
  for (const c of checks) counts[checkState(c)]++
  const [open, setOpen] = useState(counts.bad > 0)
  if (!checks.length) return null
  const total = checks.length
  const headline = counts.bad
    ? `${counts.bad} failing`
    : counts.run
      ? `${counts.run} running`
      : 'All checks passed'
  const sorted = [...checks].sort((a, b) => CHECK_ORDER[checkState(a)] - CHECK_ORDER[checkState(b)] || a.name.localeCompare(b.name))
  return (
    <section className="rv-card">
      <button type="button" className="rv-checks-sum" data-open={open} onClick={() => setOpen(v => !v)}>
        <Codicon name="chevron-right" />
        <Codicon
          name={CHECK_ICON[counts.bad ? 'bad' : counts.run ? 'run' : 'ok']}
          className={`rv-st-${counts.bad ? 'bad' : counts.run ? 'run' : 'ok'}`}
          spinning={!counts.bad && counts.run > 0}
        />
        <b style={{ fontWeight: 600 }}>{headline}</b>
        <span className="rv-dim">
          {counts.ok} passed{counts.skip ? `, ${counts.skip} skipped` : ''} of {total}
        </span>
        <span className="rv-spacer" />
        <span className="rv-checks-bar" aria-hidden="true">
          {['ok', 'run', 'bad', 'skip'].map(k =>
            counts[k] ? (
              <span
                key={k}
                style={{
                  width: `${(counts[k] / total) * 100}%`,
                  background: { ok: 'var(--ui-green)', run: 'var(--ui-yellow)', bad: 'var(--ui-red)', skip: 'var(--ui-text-quaternary)' }[k]
                }}
              />
            ) : null
          )}
        </span>
      </button>
      {open ? (
        <div className="rv-checks">
          {sorted.map((c, i) => {
            const st = checkState(c)
            return (
              <button type="button" key={`${c.name}-${i}`} className="rv-check" onClick={() => openUrl(c.url)} title={c.url}>
                <Codicon name={CHECK_ICON[st]} className={`rv-st-${st}`} spinning={st === 'run'} />
                <span className="rv-check-name">
                  {c.group && c.group !== c.name ? <span className="rv-dim">{c.group} / </span> : null}
                  {c.name}
                </span>
                <span className="rv-mono rv-faint">{st === 'run' ? 'running' : (c.conclusion || '').toLowerCase()}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

// ---------------------------------------------------------------- conversation

const REVIEW_WORD = { APPROVED: 'approved', CHANGES_REQUESTED: 'requested changes', COMMENTED: 'reviewed', DISMISSED: 'review dismissed' }

function Event({ ev }) {
  const bot = ev.user.bot || /\[bot\]$|^linear|^github-actions|^vercel|^codecov/i.test(ev.user.login)
  const [open, setOpen] = useState(!bot)
  return (
    <div className="rv-event" data-bot={bot}>
      <Avatar login={ev.user.login} />
      <div className="rv-event-card">
        <div className="rv-event-head">
          <b>{ev.user.login}</b>
          {ev.kind === 'review' ? (
            <span className="rv-badge" data-tone={ev.state === 'APPROVED' ? 'ok' : ev.state === 'CHANGES_REQUESTED' ? 'bad' : ''}>
              {REVIEW_WORD[ev.state] || ev.state.toLowerCase()}
            </span>
          ) : null}
          {bot ? <span className="rv-badge">bot</span> : null}
          {ev.kind === 'outdated' ? (
            <>
              <span className="rv-badge">outdated</span>
              <span className="rv-mono rv-dim" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {ev.path.split('/').pop()}
              </span>
            </>
          ) : null}
          <span className="rv-mono rv-faint">{ago(ev.created)}</span>
          <span className="rv-spacer" />
          {bot ? (
            <button type="button" className="rv-collapse" onClick={() => setOpen(v => !v)}>
              {open ? 'Hide' : 'Show'}
            </button>
          ) : null}
          <button type="button" className="rv-collapse" title="Open on GitHub" onClick={() => openUrl(ev.url)}>
            <Codicon name="link-external" />
          </button>
        </div>
        {open && ev.html ? (
          <div className="rv-event-body">
            <Html html={ev.html} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Overview({ data }) {
  const { pr, checks, comments, reviews, threads } = data
  const events = useMemo(
    () =>
      [
        ...comments.map(c => ({ ...c, kind: 'comment' })),
        ...reviews.filter(r => r.html || r.state !== 'COMMENTED').map(r => ({ ...r, kind: 'review' })),
        // Threads on code that has changed since: they have no line in the diff any more.
        ...threads.filter(t => !t.replyTo && t.outdated).map(t => ({ ...t, kind: 'outdated' }))
      ].sort((a, b) => Date.parse(a.created) - Date.parse(b.created)),
    [comments, reviews, threads]
  )
  const openThreads = threads.filter(t => !t.replyTo && !t.outdated).length
  return (
    <div className="rv-ov">
      <section className="rv-card">
        <div className="rv-card-head">
          <Avatar login={pr.author.login} small />
          <b>{pr.author.login}</b>
          <span className="rv-dim">opened {ago(pr.created)} ago</span>
          {pr.labels.map(l => (
            <span key={l.name} className="rv-badge" style={{ color: `#${l.color}`, borderColor: `#${l.color}66` }}>
              {l.name}
            </span>
          ))}
        </div>
        <div className="rv-card-body">
          {pr.bodyHtml ? <Html html={pr.bodyHtml} /> : <span className="rv-dim rv-italic">No description.</span>}
        </div>
      </section>
      <Checks checks={checks} />
      {openThreads ? (
        <button type="button" className="rv-btn" style={{ justifySelf: 'start' }} onClick={() => store.set({ tab: 'files' })}>
          <Codicon name="comment-discussion" />
          {openThreads} inline thread{openThreads === 1 ? '' : 's'} on the code
        </button>
      ) : null}
      {events.length ? (
        <div className="rv-timeline">
          <span className="rv-label">Conversation</span>
          {events.map(ev => (
            <Event key={`${ev.kind}-${ev.id}`} ev={ev} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------- files

const GIT_STATUS = { added: 'added', removed: 'deleted', modified: 'modified', renamed: 'renamed', changed: 'modified', copied: 'added' }

function Files({ data }) {
  const { pr, files, threads } = data
  const diffStyle = useStore(s => s.diffStyle)
  const wrap = useStore(s => s.wrap)
  const [viewer, setViewer] = useState(null)
  const [current, setCurrent] = useState(files[0]?.path)
  const [showTree, setShowTree] = useState(true)
  const paths = useMemo(() => files.map(f => f.path), [files])
  const status = useMemo(() => files.map(f => ({ path: f.path, status: GIT_STATUS[f.status] || 'modified' })), [files])
  const loader = useMemo(() => makeLoader(pr, files), [pr, files])
  const items = useMemo(
    () => files.map(f => diffItem({ ...f, sha: pr.headSha }, { annotations: threadAnnotations(threads, f.path) })),
    [files, threads, pr.headSha]
  )
  const render = useCallback(a => renderThread(a, { open: openUrl, ago, tintFor }), [])
  // While we scroll on purpose (tree click, next thread), the scroll passes other files. Do not let
  // "follow the diff" re-select them in the tree; release once the scroll has been still a moment.
  const lock = useRef(false)
  const idle = useRef(0)
  const holdFollow = () => {
    lock.current = true
    clearTimeout(idle.current)
    idle.current = setTimeout(() => (lock.current = false), 700)
  }
  const follow = useCallback(id => {
    if (lock.current) {
      clearTimeout(idle.current)
      idle.current = setTimeout(() => (lock.current = false), 200)
      return
    }
    setCurrent(id)
  }, [])
  useEffect(() => () => clearTimeout(idle.current), [])
  const roots = useMemo(() => threads.filter(t => !t.replyTo && !t.outdated && t.line && paths.includes(t.path)), [threads, paths])
  const [threadAt, setThreadAt] = useState(-1)
  const nextThread = () => {
    if (!roots.length || !viewer) return
    const k = (threadAt + 1) % roots.length
    const t = roots[k]
    setThreadAt(k)
    holdFollow()
    setCurrent(t.path)
    viewer.scrollTo({ type: 'line', id: t.path, lineNumber: t.line, side: t.side === 'LEFT' ? 'deletions' : 'additions', align: 'center', behavior: 'smooth' })
  }
  const jump = useCallback(
    path => {
      holdFollow()
      setCurrent(path)
      viewer?.scrollTo({ type: 'item', id: path, align: 'start', behavior: 'smooth' })
    },
    [viewer]
  )
  const set = patch => {
    store.set(patch)
    savePrefs()
  }
  return (
    <div className="rv-files" data-tree={showTree}>
      <aside className="rv-side">{showTree ? <TreeView paths={paths} status={status} selected={current} onSelect={jump} /> : null}</aside>
      <div className="rv-main">
        <div className="rv-toolbar">
          <button type="button" className="rv-btn rv-btn-ghost rv-icon-btn" title={showTree ? 'Hide files' : 'Show files'} onClick={() => setShowTree(v => !v)}>
            <Codicon name="list-tree" />
          </button>
          <span className="rv-mono rv-dim">
            {files.length} files · <span className="rv-plus">+{pr.additions}</span> <span className="rv-minus">−{pr.deletions}</span>
          </span>
          <span className="rv-spacer" />
          {roots.length ? (
            <button type="button" className="rv-btn rv-btn-ghost" onClick={nextThread} title="Jump to the next review thread">
              <Codicon name="comment-discussion" />
              {threadAt < 0 ? `${roots.length} thread${roots.length === 1 ? '' : 's'}` : `Thread ${threadAt + 1} of ${roots.length}`}
            </button>
          ) : null}
          <div className="rv-seg" role="group" aria-label="Diff layout">
            <button type="button" data-on={diffStyle === 'split'} onClick={() => set({ diffStyle: 'split' })}>
              Side by side
            </button>
            <button type="button" data-on={diffStyle === 'unified'} onClick={() => set({ diffStyle: 'unified' })}>
              Stacked
            </button>
          </div>
          <button type="button" className="rv-btn rv-btn-ghost" data-on={wrap} onClick={() => set({ wrap: !wrap })} title="Wrap long lines">
            <Codicon name="word-wrap" />
            {wrap ? 'Wrap on' : 'Wrap'}
          </button>
        </div>
        <DiffView
          items={items}
          diffStyle={diffStyle}
          wrap={wrap}
          loader={loader}
          renderAnnotation={render}
          onViewer={setViewer}
          onScrollItem={follow}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function PrPage({ id }) {
  const [data, setData] = useState(prCache.get(id) || null)
  const [error, setError] = useState('')
  const tab = useStore(s => s.tab)

  const load = useCallback(async () => {
    try {
      const r = await call('pr', { id })
      prCache.set(id, r)
      setData(r)
      setError('')
    } catch (e) {
      setError(errText(e))
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const wt = useWalkthrough(id, data)
  const back = () => store.set({ selected: null })

  if (!data) {
    return (
      <>
        <div className="rv-pr-head">
          <div className="rv-crumbs">
            <button type="button" onClick={back}>
              <Codicon name="chevron-left" /> Reviews
            </button>
          </div>
        </div>
        {error ? (
          <div className="rv-empty">
            Could not load this pull request.
            <span className="rv-italic">{error}</span>
            <div style={{ marginTop: 14 }}>
              <button type="button" className="rv-btn" onClick={load}>
                Try again
              </button>
            </div>
          </div>
        ) : (
          <div className="rv-skeleton">
            {[60, 35, 90, 80, 70, 40].map((w, i) => (
              <i key={i} style={{ width: `${w}%` }} />
            ))}
          </div>
        )}
      </>
    )
  }

  const { pr } = data
  const threads = data.threads.filter(t => !t.replyTo && !t.outdated).length
  const hide = async () => {
    await call(pr.hidden ? 'unhide' : 'hide', { method: 'POST', body: { url: pr.url } }).catch(() => {})
    if (!pr.hidden) back()
    else load()
  }
  return (
    <>
      <header className="rv-pr-head">
        <div className="rv-crumbs">
          <button type="button" onClick={back}>
            <Codicon name="chevron-left" /> Reviews
          </button>
          <span className="rv-faint">/</span>
          <span className="rv-mono">{shortRepo(pr.repo)}</span>
        </div>
        <div className="rv-pr-titlebar">
          <h1 className="rv-pr-title">
            {pr.title} <span className="rv-num">#{pr.number}</span>
          </h1>
          <div className="rv-pr-actions">
            <button type="button" className="rv-btn rv-btn-ghost rv-icon-btn" title="Open on GitHub" onClick={() => openUrl(pr.url)}>
              <Codicon name="github" />
            </button>
            <button type="button" className="rv-btn rv-btn-ghost rv-icon-btn" title={pr.hidden ? 'Show in my list again' : 'Hide from my list'} onClick={hide}>
              <Codicon name={pr.hidden ? 'eye' : 'eye-closed'} />
            </button>
            <button type="button" className="rv-btn" onClick={() => wt.start()} disabled={wt.state === 'running'} title="Explain this change step by step">
              <Codicon name={wt.state === 'running' ? 'loading' : 'sparkle'} spinning={wt.state === 'running'} />
              {wt.state === 'done' ? 'Walkthrough' : wt.state === 'running' ? 'Walking through…' : 'Walk me through'}
            </button>
            <button type="button" className="rv-btn rv-btn-primary" onClick={() => reviewInChat(pr.url)} title={`New chat: Please review ${pr.url}`}>
              <Codicon name="comment-discussion" />
              Review
            </button>
          </div>
        </div>
        <div className="rv-pr-meta">
          {pr.draft ? <span className="rv-badge" data-tone="draft">Draft</span> : null}
          {pr.state !== 'open' ? <span className="rv-badge" data-tone="accent">{pr.state}</span> : null}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Avatar login={pr.author.login} small /> {pr.author.login}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            wants to merge
            <button type="button" className="rv-branch" title={`Copy ${pr.head}`} onClick={() => copyText(pr.head)}>
              {pr.head}
            </button>
            into
            <button type="button" className="rv-branch" title={`Copy ${pr.base}`} onClick={() => copyText(pr.base)}>
              {pr.base}
            </button>
          </span>
          <span className="rv-mono rv-dim">
            <span className="rv-plus">+{pr.additions}</span> <span className="rv-minus">−{pr.deletions}</span> · {pr.changedFiles} files · {pr.commits} commits · updated{' '}
            {ago(pr.updated)}
          </span>
        </div>
        <nav className="rv-tabs">
          {[
            ['overview', 'Overview', 'book', null],
            ['files', 'Files', 'diff', pr.changedFiles],
            ['walkthrough', 'Walkthrough', 'sparkle', null]
          ].map(([key, label, icon, count]) => (
            <button key={key} type="button" className="rv-tab" data-on={tab === key} onClick={() => store.set({ tab: key })}>
              <Codicon name={icon} />
              {label}
              {count != null ? <span className="rv-count">{count}</span> : null}
              {key === 'files' && threads ? <span className="rv-count">· {threads} threads</span> : null}
              {key === 'walkthrough' && wt.state === 'running' ? <span className="rv-dot" /> : null}
            </button>
          ))}
        </nav>
      </header>
      <div className="rv-body">
        {tab === 'overview' ? (
          <div className="rv-pane" key="overview">
            <Overview data={data} />
          </div>
        ) : null}
        {tab === 'files' ? <Files data={data} /> : null}
        {tab === 'walkthrough' ? <WalkthroughTab wt={wt} data={data} /> : null}
      </div>
    </>
  )
}
