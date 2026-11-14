# Module: `dashboard/plugin_api.py`

`dashboard/plugin_api.py` is the HTTP surface of the plugin in the Hermes gateway. It has one route that checks a request and calls a function in `reviews_core`. Source: [`dashboard/plugin_api.py`](../../../dashboard/plugin_api.py).

## Responsibilities

- Refuse requests from other sites and data changes without POST.
- Reload `reviews_core` before each call.
- Map `/call/<name>` to `reviews_core.api_<name>`.
- Run the call in a thread pool and turn exceptions into JSON errors.

## Public API

| Name | Kind | Description |
|---|---|---|
| `router` | `fastapi.APIRouter` | The router that the gateway mounts at `/api/plugins/reviews`. |
| `call` | `async (name, request, id="")` | Route `GET` and `POST` `/call/{name}`. |
| `refusal` | `(name, method, headers) -> str` | Reason to refuse the request, or `""`. |
| `CHANGES` | `set[str]` | Calls that must be POST: `add`, `hide`, `unhide`, `walkthrough`. |
| `ROOT` | `Path` | The repository root. The module adds it to `sys.path` to import `reviews_core`. |

Status codes, refusal texts and call names: [api.md](../api.md#route).

## Internal structure

`call()` runs these steps in order:

1. `refusal()`. A reason gives 403.
2. `importlib.reload(core)`.
3. `getattr(core, f"api_{name}")`, only when `name.isidentifier()`. No function gives 404.
4. For POST, `json.loads()` of a body that is not empty. Bad JSON gives 400.
5. `starlette.concurrency.run_in_threadpool(fn, id, body)`. `ValueError` gives 400. Any other exception gives 502.

## Dependencies

- **Used by:** the Hermes gateway, and the Desktop page through `ctx.rest` ([desktop-page.md](desktop-page.md)).
- **Uses:** [`reviews_core`](reviews-core.md), `fastapi`, `starlette`.

The folder also has `dashboard/manifest.json`. The file is empty (0 bytes) in this version.

## Notes

- `reviews_core` is reloaded per request, but this module is not. A change here needs a gateway restart.
- The `id` query parameter shadows the Python built-in `id` inside `call()` (`noqa: A002`).
