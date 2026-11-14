# Module: `desktop/src/diffs.js`

`diffs.js` wraps `@pierre/diffs` and `@pierre/trees` in React components. The plugin cannot use the React builds of these libraries, because Desktop plugins get no `react-dom`. Source: [`desktop/src/diffs.js`](../../../desktop/src/diffs.js).

## Responsibilities

- Register the Flexoki dark and light themes for the diff highlighter.
- Follow the dark mode of the app.
- Turn a file from the backend into a diff item, with a cache.
- Load full file contents for "expand unchanged lines".
- Show review threads as diff annotations.
- Give React components for the diff view and the file tree.

## Public API

| Export | Signature | Description |
|---|---|---|
| `useIsDark` | `() => boolean` | True when `document.documentElement` has the class `dark`. One shared `MutationObserver` watches the class. |
| `diffItem` | `(file, { key, hunks, annotations }) => item \| null` | A `type: 'diff'` item from `parsePatchFiles(filePatch(file, hunks))`. A file without `patch` gives a `type: 'file'` item with a short notice. |
| `makeLoader` | `(pr, files) => async (fileDiff) => { oldFile, newFile }` | Loads both sides with the backend call `file`. The old side uses `pr.mergeBase`, else `pr.baseSha`. The new side uses `pr.headSha`. Added files have no old side and removed files have no new side. |
| `threadAnnotations` | `(threads, path) => annotation[]` | One annotation for each thread root on `path` that is not outdated and has a line. `LEFT` maps to `deletions`, other sides to `additions`. |
| `renderThread` | `(annotation, { open, ago, tintFor }) => HTMLElement` | DOM for one thread: avatar, login, time and cleaned HTML for each comment. |
| `DiffView` | React component | Wraps `CodeView`. Props: `items`, `diffStyle`, `wrap`, `loader`, `renderAnnotation`, `onViewer`, `onScrollItem`, `className`, `header`. |
| `TreeView` | React component | Wraps `FileTree`. Props: `paths`, `status`, `onSelect`, `selected`. |

## Internal structure

- `parsed` is a module `Map` from a cache key to the parsed diff. The key is `<key or path>@<sha>`. The diff object must keep the same identity between renders.
- `DiffView` creates one `CodeView` on mount and calls `setOptions` when `diffStyle`, `wrap`, the dark mode or `loader` change. It calls `setItems` when `items` change.
- `DiffView` options include `lineDiffType: 'word'`, `hunkSeparators: 'line-info'`, `stickyHeaders: true` and `expansionLineCount: 20`.
- `onScrollItem` gets the id of the last item whose top is at most 24 px below the scroll position.
- `TreeView` selects the `selected` path without a call to `onSelect`. A `silent` flag blocks the selection callback during this change.
- `TreeView` maps the Flexoki theme to tree styles with `themeToTreeStyles`, then uses the app accent for selection and focus.

## Dependencies

- **Used by:** [`pr.jsx`](desktop-page.md) (Files tab), [`walkthrough.jsx`](desktop-walkthrough.md).
- **Uses:** `@pierre/diffs` (`CodeView`, `parsePatchFiles`, `registerCustomTheme`), `@pierre/trees` (`FileTree`, `themeToTreeStyles`), `react`, `api.js` (`call`, `filePatch`), `html.js` (`cleanHtml`), `themes/flexoki-dark.json`, `themes/flexoki-light.json`.

## Notes

- `filePatch()` in `api.js` adds a git header to each GitHub patch, so `parsePatchFiles` can read it. The header has rename lines and the `/dev/null` side for added and removed files.
- The page passes `sha: pr.headSha` into `diffItem`. The walkthrough passes `<headSha>:<stop id>`, so each stop has its own cache entry.
