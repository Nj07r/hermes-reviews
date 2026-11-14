"""Reviews backend: /api/plugins/reviews/*. Runs in the gateway; dashboard sign-in applies.

  GET|POST  /call/<name>   reviews_core.api_<name>(id, json_body), core reloaded per request

Cross-site requests are refused: a call must carry a JSON content type (Desktop's REST door)
or ``X-Reviews: 1``; both force a CORS preflight that this route never answers. A browser request
must also be ``Sec-Fetch-Site: same-origin``. Writes are POST only.
"""
import importlib
import json
import sys
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

ROOT = Path(__file__).absolute().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
import reviews_core as core  # noqa: E402

router = APIRouter()
CHANGES = {"add"}


def refusal(name: str, method: str, headers) -> str:
    """Why a /call request is refused, or "" when it may run."""
    if name in CHANGES and method != "POST":
        return f"{name} needs POST"
    site = headers.get("sec-fetch-site")
    if site is not None and site != "same-origin":
        return "cross-site request"
    if headers.get("x-reviews") != "1" and not headers.get("content-type", "").startswith("application/json"):
        return "missing X-Reviews header"
    return ""


@router.api_route("/call/{name}", methods=["GET", "POST"])
async def call(name: str, request: Request, id: str = ""):  # noqa: A002 - query parameter name
    if why := refusal(name, request.method, request.headers):
        return JSONResponse({"ok": False, "error": why}, status_code=403)
    importlib.reload(core)
    fn = getattr(core, f"api_{name}", None) if name.isidentifier() else None
    if fn is None:
        return JSONResponse({"ok": False, "error": f"no such call: {name}"}, status_code=404)
    body = None
    if request.method == "POST":
        raw = await request.body()
        if raw:
            try:
                body = json.loads(raw)
            except ValueError:
                return JSONResponse({"ok": False, "error": "body is not JSON"}, status_code=400)
    try:
        from starlette.concurrency import run_in_threadpool
        return await run_in_threadpool(fn, id, body)
    except ValueError as exc:
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=400)
    except Exception as exc:  # never raise out to the client
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)
