# Module: Desktop page (`desktop/src`)

The Desktop page is the user interface of Reviews in Hermes Desktop. It registers a route and a sidebar row, keeps a small store, calls the backend, and shows the queue or one pull request. This page covers [`plugin.jsx`](../../../desktop/src/plugin.jsx), [`api.js`](../../../desktop/src/api.js), [`list.jsx`](../../../desktop/src/list.jsx), [`pr.jsx`](../../../desktop/src/pr.jsx), [`html.js`](../../../desktop/src/html.js) and [`styles.js`](../../../desktop/src/styles.js). The diff views and the walkthrough tab have their own pages: [desktop-diffs.md](desktop-diffs.md) and [desktop-walkthrough.md](desktop-walkthrough.md).

## Responsibilities

- Register the route `/reviews` (`ROUTES_AREA`) and the sidebar row "Reviews" (`SIDEBAR_NAV_AREA`, codicon `git-pull-request`).
- Add the page CSS as one `<style>` element and remove it on dispose.
- Send backend calls and keep shared state and saved preferences.
- Show the queue: group, hide, add by link, refresh every 2 minutes.
- Show one pull request: header, Overview, Files and Walkthrough tabs.
- Start a new chat with `Please review <url>`.
- Clean GitHub HTML before it goes into the DOM.

## Key files

| File | Exports | Description |
|---|---|---|
| `plugin.jsx` | default plugin object `{id: 'reviews', name: 'Reviews', register(ctx)}` | Entry point. `ReviewsRoute` shows `PrPage` when `selected` is set, else `ReviewsList`. |
| `api.js` | `call`, `store`, `useStore`, `loadPrefs`, `savePrefs`, `setCtx`, `getCtx`, `openUrl`, `copyText`, `errText`, `ago`, `tintFor`, `shortRepo`, `splitHunks`, `filePatch` | Backend client, store and helpers. |
| `list.jsx` | `ReviewsList`, `Avatar` | The queue view. |
| `pr.jsx` | `PrPage` | The pull request view. |
| `html.js` | `cleanHtml`, `onHtmlClick`, `inlineCode` | HTML cleaning, link clicks, inline code in walkthrough text. |
| `styles.js` | `STYLES` | All page CSS as one string. Colours use the app tokens. |

## Backend client

`call(name, { id = '', body = {} })` sends `ctx.rest('/call/<name>?id=<id>', { method: 'POST', body, timeoutMs: 120_000 })`. It always uses POST. It throws an `Error` with the backend `error` text when the request fails or `ok` is not true. Some callers pass a `method` key. `call()` does not read it.

## Store

`store` is a small external store read with `useSyncExternalStore`.

| Key | Default | Values | Saved |
|---|---|---|---|
| `selected` | `null` | PR id `owner/repo#n`, or `null` for the queue | no |
| `tab` | `'overview'` | `'overview'`, `'files'`, `'walkthrough'` | no |
| `diffStyle` | `'split'` | `'split'`, `'unified'` | yes |
| `wrap` | `false` | boolean | yes |
| `groupBy` | `'project'` | `'project'`, `'person'`, `'none'` | yes |

`savePrefs()` writes the saved keys to `ctx.storage` under `prefs`. `loadPrefs()` reads them in `register()`.

## Queue view (`ReviewsList`)

- Calls `list` on mount and every `POLL_MS` (120 000 ms). A module variable `cache` keeps the last result when the user leaves and comes back.
- `add` calls `add` with the pasted link. The new row stays in a local `added` list until `list` returns it, because GitHub search can lag behind a new review request.
- Hide and unhide move the row in the cache first, then call `hide` or `unhide`. On error the view calls `list` again.
- `groupsOf()` groups by `project` or `author`. Groups sort with `Other` last, then by size, then by name. A project group is marked "from files" when every row has `projectSource === 'files'`.
- Collapsed groups are kept in a module `Set` for the session.

## Pull request view (`PrPage`)

- Calls `pr` with the PR id and keeps results in `prCache` by id.
- The header has buttons for GitHub, hide or unhide, "Walk me through" and "Review". Branch names copy to the clipboard on click.
- **Overview**: description, `Checks`, a button that opens Files when inline threads exist, and a timeline. The timeline merges comments, reviews with text or a state other than `COMMENTED`, and outdated thread roots, sorted by time.
- `checkState()` maps a check to `ok`, `bad`, `run` or `skip`. The checks card opens by default when a check fails.
- Comments by bots are collapsed. A user is a bot when `user.bot` is true or the login matches `[bot]$`, `^linear`, `^github-actions`, `^vercel` or `^codecov`.
- **Files**: a `TreeView` and a `DiffView`, a "next thread" button, and toggles for layout and wrap. A scroll lock of 700 ms stops the tree from following the diff during a jump.
- `reviewInChat(url)` calls `host.newChat()` and tries `host.composer.submit('new', text)` up to 30 times at 120 ms. If that fails, it tries `setDraft` and `focus`. If that also fails, it shows an error notice.

## HTML cleaning (`cleanHtml`)

`cleanHtml()` parses HTML with `DOMParser` and then:

- Removes `script`, `style`, `iframe`, `frame`, `object`, `embed`, `form`, `meta`, `link`, `base`, `template` and `noscript` elements.
- Removes every `input` except checkboxes. Checkboxes become `disabled`.
- Removes `on*`, `style`, `srcset` and `formaction` attributes.
- Removes `href`, `src` and `xlink:href` unless the value starts with `https:`, `http:`, `#` or `mailto:`.
- Adds `loading="lazy"` and `referrerpolicy="no-referrer"` to images.

`onHtmlClick(open)` opens clicked links with `open()`, except `#` links. `openUrl()` opens only `https://` URLs.

## Dependencies

- **Used by:** Hermes Desktop, through the built [`desktop/plugin.js`](build.md).
- **Uses:** `@hermes/plugin-sdk` (`ROUTES_AREA`, `SIDEBAR_NAV_AREA`, `Codicon`, `host`), `react`, [`diffs.js`](desktop-diffs.md), [`walkthrough.jsx`](desktop-walkthrough.md), the backend calls in [api.md](../api.md).
