/**
 * Reviews for Hermes Desktop: pull requests that wait for my review (sidebar row "Reviews",
 * route /reviews). The list, a GitHub-like PR page (description, checks, conversation, Files with
 * @pierre/diffs and @pierre/trees), a one-click "Please review <link>" chat, and an on-demand
 * walkthrough written in the background (Codiff's idea, our flavour).
 *
 * Source: desktop/src (this file). Built into desktop/plugin.js by scripts/build.mjs.
 */
import { ROUTES_AREA, SIDEBAR_NAV_AREA } from '@hermes/plugin-sdk'
import { loadPrefs, setCtx, useStore } from './api.js'
import { ReviewsList } from './list.jsx'
import { PrPage } from './pr.jsx'
import { STYLES } from './styles.js'

const ID = 'reviews'
const PATH = '/reviews'

function ReviewsRoute() {
  const selected = useStore(s => s.selected)
  return <div className="rv-root">{selected ? <PrPage key={selected} id={selected} /> : <ReviewsList />}</div>
}

export default {
  id: ID,
  name: 'Reviews',
  register(ctx) {
    setCtx(ctx)
    loadPrefs()
    const style = document.createElement('style')
    style.dataset.plugin = ID
    style.textContent = STYLES
    document.head.append(style)
    ctx.onDispose?.(() => style.remove())

    ctx.register({ id: 'page', area: ROUTES_AREA, title: 'Reviews', data: { path: PATH }, render: () => <ReviewsRoute /> })
    ctx.register({ id: 'nav', area: SIDEBAR_NAV_AREA, data: { path: PATH, label: 'Reviews', codicon: 'git-pull-request' } })
  }
}
