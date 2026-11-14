# Reviews for Hermes: code wiki

Reviews is a Hermes plugin. It adds a Reviews page to Hermes Desktop. The page lists the open pull requests in one GitHub org that wait for your review. It also shows one pull request in a GitHub-like layout, and it can ask a model to write a walkthrough of the change. All GitHub access goes through the signed-in `gh` CLI. The plugin has no tokens of its own.

This wiki describes the code at version 0.2.0 (`plugin.yaml`).

## Key concepts

- **Queue**: the open pull requests in the configured org where your review is requested. The backend gets it with one GitHub GraphQL search.
- **Project group**: the queue groups rows by project. The project comes from the branch name, else from the changed files, else it is `Other`.
- **Hidden list**: pull request URLs that you hide from your queue. The list is local and lives in `$HERMES_HOME/reviews/state.json`.
- **PR id**: the string `owner/repo#number`. The page uses it to select a pull request and the backend uses it to load one.
- **Hunk id**: the string `<path>:h<n>`, the n-th hunk in the patch of one file. Walkthroughs point at code only through hunk ids.
- **Walkthrough**: an ordered review path of chapters and stops, written by `hermes -z` in a background process.

## Entry points

- [`__init__.py`](../../__init__.py): the agent side of the plugin. `register(ctx)` returns `None`. The plugin adds no tools and no hooks.
- [`dashboard/plugin_api.py`](../../dashboard/plugin_api.py): the HTTP route `/api/plugins/reviews/call/<name>` in the Hermes gateway.
- [`desktop/plugin.js`](../../desktop/plugin.js): the built Desktop page. Its source is [`desktop/src/plugin.jsx`](../../desktop/src/plugin.jsx).
- [`walkthrough_runner.py`](../../walkthrough_runner.py): the background process for one walkthrough.

## Where to read next

[Getting started](getting-started.md) is a short lesson. It clones the repository, builds the Desktop bundle, runs the tests and validates the plugin.

[Architecture](architecture.md) explains how the Desktop page, the gateway route, the `gh` CLI and the walkthrough process connect, and why the code has this shape.

[Backend API](api.md) is the reference for every backend call, the plugin settings and the files on disk.

The diagrams folder has the [data types](diagrams/class-diagram.md) that move between the backend and the page, and [sequence diagrams](diagrams/sequences.md) for the main workflows.

## Module map

| Module | Purpose |
|---|---|
| [`reviews_core.py`](modules/reviews-core.md) | All backend logic: `gh` calls, queue, PR page data, hidden list, walkthrough files. |
| [`dashboard/plugin_api.py`](modules/dashboard-route.md) | Gateway route. Checks the request, reloads `reviews_core`, calls `api_<name>`. |
| [`walkthrough_runner.py`](modules/walkthrough-runner.md) | Detached process. Runs `hermes -z`, cleans the JSON, writes `walkthrough.json`. |
| [`desktop/src` page](modules/desktop-page.md) | Plugin registration, store, backend client, queue view, PR page. |
| [`desktop/src/diffs.js`](modules/desktop-diffs.md) | React wrappers for `@pierre/diffs` and `@pierre/trees`, review thread annotations. |
| [`desktop/src/walkthrough.jsx`](modules/desktop-walkthrough.md) | Walkthrough tab: start, poll, show stops with their hunks. |
| [`scripts/build.mjs`](modules/build.md) | esbuild script that writes `desktop/plugin.js`. |
