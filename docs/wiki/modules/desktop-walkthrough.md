# Module: `desktop/src/walkthrough.jsx`

`walkthrough.jsx` is the Walkthrough tab of the PR page. It starts a walkthrough, polls its status, and shows the finished document one stop at a time with the real hunks of each stop. Source: [`desktop/src/walkthrough.jsx`](../../../desktop/src/walkthrough.jsx).

## Public API

| Export | Signature | Description |
|---|---|---|
| `useWalkthrough` | `(id, data) => { state, status, doc, error, start }` | Hook for one PR id. `data` is the result of the `pr` call. |
| `WalkthroughTab` | React component, props `{ wt, data }` | Shows the start card, the progress view, the error card or the walkthrough. |

## `useWalkthrough`

- The first status is `data.walkthrough`, else `{ state: 'none' }`.
- When the state is `done` or `stale`, the hook calls `walkthrough_get` with `<id>@<sha>`, unless `doc.sha` is already that SHA.
- When the state is `running`, the hook calls `walkthrough_status` every `POLL_MS` (2500 ms). Errors during polling are ignored.
- `start({ force })` opens the Walkthrough tab. Without `force`, it does nothing more when the state is `running` or `done`. Otherwise it sets the state to `running` and calls `walkthrough`.

## `WalkthroughTab` views

| State | View |
|---|---|
| `running` | `Preparing`: animated bars, a rotating line such as ``Reading `<file>` ``, and the elapsed time. The lines come from the file names in the status. |
| `done` or `stale`, document loaded | `Walkthrough` |
| `done` or `stale`, no document yet | The text `Opening the walkthrough…`, or the load error. |
| `none` | Start card with the button "Walk me through". |
| `error` | Error card with the error text and the button "Try again". |

## `Walkthrough`

- A rail lists the title, the focus text, and the chapters with numbered stops. Stops that the user opened are marked as seen.
- The main area has a progress bar, the stop card (`summary`, `prose`, optional `check`), and Back and Next buttons.
- Arrow keys move between stops. They do nothing when the focus is in an input, a textarea or an editable element. They also do nothing when Alt or Meta is down.
- When the state is `stale`, a banner says the pull request has new commits and offers "Walk me through again". Review threads are not shown on a stale walkthrough.
- The rail shows the number of `support` hunks. These hunks are only in the Files tab.

## `Stop`

`Stop` builds the diff items for one stop:

1. Parses each hunk id with `/^(.*):h(\d+)$/` and groups the numbers by path, in the order of the stop.
2. Splits the file patch with `splitHunks()` and picks hunk `n` as item `n - 1`.
3. Uses the whole file when the stop names `h0`.
4. Calls `diffItem()` with the key `<stop id>::<path>`, the picked hunks and the thread annotations.

Text in `focus`, `summary`, `prose` and `check` goes through `inlineCode()`. Only backtick spans become `<code>`. All other text stays plain text.

## Dependencies

- **Used by:** [`pr.jsx`](desktop-page.md).
- **Uses:** `api.js` (`call`, `splitHunks`, `store`, `useStore` and format helpers), [`diffs.js`](desktop-diffs.md), `html.js` (`inlineCode`), the backend calls `walkthrough`, `walkthrough_status` and `walkthrough_get` ([api.md](../api.md#calls)).
