# Reviews for Hermes

The pull requests that wait for your review, inside Hermes Desktop.

- **Your queue.** Open PRs in one GitHub org where your review is requested. Paste a PR link to
  add yourself as a reviewer. Hide a PR from your list (local only, nobody else sees it).
- **A GitHub-like PR page.** Title, branches, description, checks, and the conversation. Files
  shows side-by-side diffs ([`@pierre/diffs`](https://diffs.com)) with a file tree
  ([`@pierre/trees`](https://trees.software)), inline review threads, and "expand unchanged lines".
- **Review** starts a new chat with `Please review <link>`.
- **Walk me through** (on demand) runs `hermes -z` in the background and writes a short review
  path through the change: chapters, stops, and the real hunks for each stop. The idea comes from
  [Codiff](https://github.com/nkzw-tech/codiff) (MIT); the authoring guide is
  `walkthrough_guide.md`.

All GitHub access goes through the signed-in `gh` CLI. Walkthroughs and the hidden list live in
`$HERMES_HOME/reviews/`.

## Settings

`plugins.entries.reviews.settings` in `config.yaml`:

| Key | Meaning |
|---|---|
| `owner` | The GitHub org whose PRs the page lists (required). |
| `walkthrough_model` / `walkthrough_provider` | Model for walkthroughs. Empty = your default. |

## Develop

```bash
npm install
npm run build            # desktop/src -> desktop/plugin.js (one ESM file, ~2.9 MB)
~/.hermes/hermes-agent/venv/bin/python -m unittest discover -s tests
hermes plugins validate .
```

Desktop plugins may import only `@hermes/plugin-sdk` and `react`, so the build bundles
`@pierre/diffs`, `@pierre/trees` and a cut-down Shiki (our languages, Flexoki theme only).
Backend calls are `POST /api/plugins/reviews/call/<name>`; `reviews_core.py` is reloaded per
request, so backend edits are live without a gateway restart (except `dashboard/plugin_api.py`).

## Docs

Code wiki: [docs/wiki/README.md](docs/wiki/README.md)
