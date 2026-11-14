# Backend API reference

The backend has one HTTP route in the Hermes gateway. Every call goes to `reviews_core.api_<name>(id, body)`. Source: [`dashboard/plugin_api.py`](../../dashboard/plugin_api.py) and [`reviews_core.py`](../../reviews_core.py).

## Route

```text
GET|POST  /api/plugins/reviews/call/<name>?id=<id>
```

| Part | Value |
|---|---|
| `name` | The call name. The route runs `reviews_core.api_<name>`. `name` must be a Python identifier. |
| `id` | Query parameter. A PR id `owner/repo#number`, or empty. |
| Body | JSON object, read only for POST. An empty body gives `body = None`. |
| Request rules | See [Request checks](#request-checks). |

### Responses

| Status | Body | Cause |
|---|---|---|
| 200 | `{"ok": true, ...}` | The call returned. |
| 400 | `{"ok": false, "error": "..."}` | The call raised `ValueError`, or the body is not JSON. |
| 403 | `{"ok": false, "error": "..."}` | `refusal()` refused the request. |
| 404 | `{"ok": false, "error": "no such call: <name>"}` | No function `api_<name>`. |
| 502 | `{"ok": false, "error": "..."}` | The call raised any other exception, for example a `gh` error. |

### Request checks

`refusal(name, method, headers)` returns a reason, or `""` when the request may run.

| Check | Refusal text |
|---|---|
| `name` is in `CHANGES` and the method is not POST | `<name> needs POST` |
| `Sec-Fetch-Site` is present and is not `same-origin` | `cross-site request` |
| No `X-Reviews: 1` header and no `application/json` content type | `missing X-Reviews header` |

`CHANGES` is `{"add", "hide", "unhide", "walkthrough"}`.

## Calls

All calls need the setting `owner`. Calls that take a PR id refuse ids from other owners with `only <owner> pull requests`.

| Call | Method | `id` | Body | Result fields |
|---|---|---|---|---|
| `list` | GET or POST | not used | not used | `owner`, `prs` (rows not hidden), `hidden` (hidden rows) |
| `add` | POST | not used | `{"url": "<PR link>"}` | `pr` (one row) |
| `hide` | POST | not used | `{"url": "<PR link>"}` | none |
| `unhide` | POST | not used | `{"url": "<PR link>"}` | none |
| `pr` | GET or POST | PR id | not used | `pr`, `walkthrough`, `checks`, `files`, `comments`, `reviews`, `threads` |
| `file` | GET or POST | not used | `{"repo", "path", "ref"}` | `contents` (text, or `null` when GitHub gives 404) |
| `walkthrough` | POST | PR id | not used | `walkthrough` (status) |
| `walkthrough_status` | GET or POST | PR id | not used | `walkthrough` (status) |
| `walkthrough_get` | GET or POST | PR id, or PR id + `@<head sha>` | not used | `sha`, `walkthrough` (document), `files` |

The shapes of `pr`, rows, status and document are in [diagrams/class-diagram.md](diagrams/class-diagram.md).

### `list`

Runs one GraphQL search `is:pr is:open review-requested:@me org:<owner>`, first 100 results, with the first 100 changed file paths of each pull request. Rows are sorted by `updated`, newest first. Each row gets `branch`, `project` and `projectSource` from `project_of()`.

### `add`

Accepts only a link that matches `PR_URL` and has the configured owner. Refuses a pull request that is not `OPEN` and a pull request that you wrote. Then it POSTs your login to `repos/<owner>/<repo>/pulls/<n>/requested_reviewers`, removes the URL from the hidden list, and returns the row.

### `hide` and `unhide`

Add the URL to the hidden list or remove it. The URL must match `PR_URL`. A lock protects the read and write of `state.json`.

### `pr`

Runs seven jobs in a thread pool: the pull request (`full+json`), files, issue comments, review comments, reviews, `gh pr view --json statusCheckRollup,commits,reviewDecision`, and the merge base from the compare API. `mergeBase` is `""` when the compare request fails.

### `file`

`ref` must be a 40-character hex SHA. `path` must not be empty, must not start with `/` and must not contain a `..` segment. The call gets the raw file from `repos/<repo>/contents/<path>?ref=<ref>`.

### `walkthrough`

Gets the head SHA. If the status for that SHA is `running` or `done`, returns it and starts nothing. Otherwise writes `input.md` and `files.json`, deletes an old `walkthrough.json` and `raw.txt`, starts `walkthrough_runner.py <folder>` as a new session, and writes `status.json` with `state: "running"`.

### `walkthrough_get`

Without a SHA, uses the newest `walkthrough.json` by file time. Raises `no walkthrough yet` or `no walkthrough for this commit` when nothing is there.

## Walkthrough states

| `state` | Meaning |
|---|---|
| `none` | No walkthrough for this pull request. |
| `running` | The runner for the head SHA is alive. |
| `done` | `walkthrough.json` exists for the head SHA. |
| `error` | The runner failed, or `status.json` says `running` but the process id is not alive. |
| `stale` | No status for the head SHA, but a walkthrough exists for an older SHA. |

## Settings

Path in `config.yaml`: `plugins.entries.reviews.settings`. Schema: `config_schema` in [`plugin.yaml`](../../plugin.yaml).

| Key | Type | Default | Description |
|---|---|---|---|
| `owner` | str | `""` | GitHub org whose pull requests the page lists. Must match `^[A-Za-z0-9-]+$`. Required by every call. |
| `walkthrough_model` | str | `""` | Passed to `hermes -z` as `-m`. Empty means the default model. |
| `walkthrough_provider` | str | `""` | Passed to `hermes -z` as `--provider`. Empty means the default provider. |

## Files on disk

Root: `$HERMES_HOME/reviews/` (from `hermes_constants.get_hermes_home()`, else `~/.hermes/reviews/`).

| Path | Writer | Content |
|---|---|---|
| `state.json` | `save_state()` | `{"hidden": [<PR URL>, ...]}`, written through a `.tmp` file and rename. |
| `walkthroughs/<owner>__<repo>/<n>/<sha>/input.md` | `api_walkthrough()` | PR facts, description, every hunk with its id. |
| `.../<sha>/files.json` | `api_walkthrough()` | Changed files with `path`, `prevPath`, `status`, `additions`, `deletions`, `patch`. |
| `.../<sha>/status.json` | core, then runner | `state`, `pid`, `started`, `finished`, `error`, `files` (first 40 file names). |
| `.../<sha>/run.log` | runner stdout and stderr | Process log. |
| `.../<sha>/raw.txt` | runner | Raw stdout of `hermes -z`. |
| `.../<sha>/usage.json` | `hermes -z --usage-file` | Token usage of the run. |
| `.../<sha>/walkthrough.json` | runner | Cleaned walkthrough document. |

## Constants

| Name | Value |
|---|---|
| `TIMEOUT` (core) | 30 seconds for each `gh` call |
| `TIMEOUT` (runner) | 15 minutes for `hermes -z` |
| `PR_URL` | `^https://github\.com/<owner>/<repo>/pull/<n>` with an optional `/`, `?` or `#` tail |
| `PR_ID` | `^<owner>/<repo>#<n>$` |
| `SHA` | `^[0-9a-f]{40}$` |
