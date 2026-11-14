# Module: `reviews_core.py`

`reviews_core.py` has all backend logic of the plugin. The gateway route calls its `api_*` functions, and `walkthrough_runner.py` imports its hunk and status helpers. Source: [`reviews_core.py`](../../../reviews_core.py).

## Responsibilities

- Run the `gh` CLI with argument lists and turn its errors into `RuntimeError`.
- Read the plugin settings from the Hermes config.
- Check every PR link, PR id, owner, SHA and file path before use.
- Build the queue, group rows by project, and keep the local hidden list.
- Collect all data for the PR page in one call.
- Prepare walkthrough input, start the runner, and report walkthrough status.
- Split patches into hunks and clean the walkthrough document from the model.

## Public API

### Settings and `gh`

| Function | Signature | Description |
|---|---|---|
| `settings` | `() -> dict` | `plugins.entries.reviews.settings` from `hermes_cli.config.load_config()`. Returns `{}` on any error. |
| `owner` | `() -> str` | The `owner` setting. Raises `ValueError` if it does not match `OWNER`. |
| `walkthrough_settings` | `() -> dict` | `{"model", "provider"}` from `walkthrough_model` and `walkthrough_provider`. |
| `gh` | `(*args: str) -> str` | Runs `gh` with `TIMEOUT` and no stdin. Returns stdout. Raises `RuntimeError` with the first 500 characters of the error. |

`_gh_path()` uses `shutil.which("gh")`, then `/opt/homebrew/bin/gh`, then `/usr/local/bin/gh`.

### Parsing and shaping

| Function | Signature | Description |
|---|---|---|
| `parse_pr_url` | `(url: str) -> tuple[str, str, int]` | `(owner, repo, number)` from a PR link. Raises `ValueError`. |
| `parse_pr_id` | `(value: str) -> tuple[str, int]` | `("owner/repo", number)` from `owner/repo#n`. Raises `ValueError` for a bad id or another owner. |
| `shape` | `(raw: dict) -> dict` | One queue row from GraphQL or `gh pr view` JSON. |
| `project_of` | `(branch: str, paths: list[str]) -> tuple[str, str]` | `(project, source)`. See [Project rule](#project-rule). |

### Local state

| Function | Signature | Description |
|---|---|---|
| `state_path` | `() -> Path` | `<hermes home>/reviews/state.json`. |
| `load_state` | `() -> dict` | Contents of `state.json`, or `{}`. |
| `save_state` | `(data: dict) -> None` | Writes `state.json` through a `.tmp` file and `replace`. |
| `set_hidden` | `(url: str, hidden: bool) -> list[str]` | Adds or removes one URL under `_state_lock`. Returns the new list. |

### Calls

`api_list`, `api_add`, `api_hide`, `api_unhide`, `api_pr`, `api_file`, `api_walkthrough`, `api_walkthrough_status`, `api_walkthrough_get`. Each takes `(id: str = "", body = None)` and returns a dict with `ok: True`. Details: [api.md](../api.md#calls).

### Walkthrough helpers

| Function | Signature | Description |
|---|---|---|
| `split_hunks` | `(patch) -> list[str]` | A file patch split at lines that start with `@@ `. Text before the first hunk is dropped. |
| `hunk_ids` | `(files: list[dict]) -> dict[str, dict]` | `<path>:h<n>` to `{path, n, text}`. A file without hunks gets `<path>:h0`. |
| `walkthrough_dir` | `(repo, number, sha="") -> Path` | `<reviews>/walkthroughs/<owner>__<repo>/<n>[/<sha>]`. |
| `walkthrough_status` | `(repo, number, head_sha) -> dict` | Status for the head SHA. See [api.md](../api.md#walkthrough-states). |
| `write_input` | `(pr: dict, files: list[dict]) -> str` | Markdown text of `input.md`. |
| `clean_walkthrough` | `(doc: dict, ids: dict) -> dict` | Cleaned document. See [Walkthrough cleaning](#walkthrough-cleaning). |

## Project rule

`project_of()` uses the first rule that gives a result:

1. **Branch**: the branch has 3 or more `/` segments and the first segment matches `TICKET` (`^[A-Za-z][A-Za-z0-9]*-\d+$`). The project is the second segment in lower case. Source is `"branch"`.
2. **Files**: more than half of all changed paths are under `apps/<name>/`, and one `<name>` has that majority. Source is `"files"`.
3. Otherwise the project is `"Other"` and the source is `""`.

Example: the branch `ABC-12/web/fix/login` gives `("web", "branch")`.

## Walkthrough cleaning

`clean_walkthrough()` limits the model output to known data:

- Hunk ids that are not in `ids` are dropped. Each id is used once, in document order.
- A stop without hunk ids is dropped. A chapter without stops is dropped.
- Text fields are cut: chapter `title` 24, stop `title` 80, `summary` 400, `prose` 1600, `check` 400, document `focus` 600 characters.
- Missing stop and chapter ids get `s<chapter>-<stop>` and `c<chapter>`.
- `support` is the valid ids from the model `support` list, then every id that no stop uses.
- With no chapters left, the function raises `ValueError("the walkthrough has no stops with known hunks")`.

## Dependencies

- **Used by:** [`dashboard/plugin_api.py`](dashboard-route.md), [`walkthrough_runner.py`](walkthrough-runner.md), `tests/test_core.py`.
- **Uses:** the `gh` CLI, `hermes_cli.config` and `hermes_constants` (both optional, with fallbacks), Python standard library only.

## Notes

- The route reloads this module on every request. Module-level values, for example `_state_lock`, are new after each reload.
- `split_hunks()` must give the same result as `splitHunks()` in `desktop/src/api.js`. Hunk ids depend on it.
- GitHub omits `patch` for binary and large files. Such files have the single id `<path>:h0`.
- `api_list` reads at most 100 changed files for each pull request (`files(first: 100)` in `SEARCH_QUERY`).
