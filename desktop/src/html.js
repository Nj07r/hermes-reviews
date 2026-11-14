// GitHub's body_html is already sanitised by GitHub. We clean it once more before it touches
// the app DOM: no scripts, frames, forms, inline handlers or javascript: links.
const DROP = 'script,style,iframe,frame,object,embed,form,meta,link,base,template,noscript'

export function cleanHtml(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html')
  doc.querySelectorAll(DROP).forEach(n => n.remove())
  doc.querySelectorAll('input').forEach(n => {
    if (n.getAttribute('type') !== 'checkbox') n.remove()
    else n.setAttribute('disabled', '')
  })
  for (const el of doc.body.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()
      if (name.startsWith('on') || name === 'style' || name === 'srcset' || name === 'formaction') el.removeAttribute(attr.name)
      else if ((name === 'href' || name === 'src' || name === 'xlink:href') && !/^(https?:|#|mailto:)/.test(value)) el.removeAttribute(attr.name)
    }
    if (el.tagName === 'A') el.setAttribute('data-ext', '')
    if (el.tagName === 'IMG') {
      el.setAttribute('loading', 'lazy')
      el.setAttribute('referrerpolicy', 'no-referrer')
    }
  }
  return doc.body.innerHTML
}

// One click handler for a container of cleaned HTML: links open in the browser.
export function onHtmlClick(open) {
  return e => {
    const a = e.target.closest?.('a[href]')
    if (!a) return
    const href = a.getAttribute('href') || ''
    if (href.startsWith('#')) return
    e.preventDefault()
    open(href)
  }
}

// Inline markdown for walkthrough prose: `code` only, everything else is text.
export function inlineCode(text) {
  const parts = String(text || '').split(/(`[^`\n]+`)/g)
  return parts.map(p => (p.startsWith('`') && p.endsWith('`') && p.length > 2 ? { code: p.slice(1, -1) } : { text: p }))
}
