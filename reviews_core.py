"""Reviews core: open pull requests in one GitHub org that wait for my review.

All GitHub access goes through the `gh` CLI as the signed-in user, with argument lists
(never a shell). The dashboard route calls ``api_<name>(id, body)`` and reloads this module
per request, so a change here is live without a gateway restart.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

TIMEOUT = 30
FIELDS = "number,title,url,repository,author,isDraft,updatedAt,createdAt"
PR_URL = re.compile(r"^https://github\.com/([A-Za-z0-9-]+)/([A-Za-z0-9._-]+)/pull/(\d+)(?:[/?#].*)?$")
OWNER = re.compile(r"^[A-Za-z0-9-]+$")
PR_ID = re.compile(r"^([A-Za-z0-9-]+)/([A-Za-z0-9._-]+)#(\d+)$")
SHA = re.compile(r"^[0-9a-f]{40}$")
FULL_JSON = "Accept: application/vnd.github.full+json"
_state_lock = threading.Lock()


def settings() -> dict:
    try:
        from hermes_cli.config import load_config
        entry = (load_config().get("plugins", {}).get("entries", {}) or {}).get("reviews", {}) or {}
        return entry.get("settings", {}) or {}
    except Exception:
        return {}


def owner() -> str:
    value = str(settings().get("owner") or "").strip()
    if not OWNER.match(value):
        raise ValueError("set plugins.entries.reviews.settings.owner to a GitHub org")
    return value


def _gh_path() -> str:
    found = shutil.which("gh")
    if found:
        return found
    for path in ("/opt/homebrew/bin/gh", "/usr/local/bin/gh"):
        if os.path.exists(path):
            return path
    raise RuntimeError("gh CLI not found")


def gh(*args: str) -> str:
    """Run gh with an argument list. Returns stdout; raises RuntimeError with gh's message."""
    result = subprocess.run([_gh_path(), *args], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=TIMEOUT,
                            stdin=subprocess.DEVNULL, check=False)
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout or f"gh exit {result.returncode}").strip()[:500])
    return result.stdout


def parse_pr_url(url: str) -> tuple[str, str, int]:
    """(owner, repo, number) from a PR link. Raises ValueError for anything else."""
    match = PR_URL.match(str(url or "").strip())
    if not match:
        raise ValueError("not a GitHub pull request link")
    return match.group(1), match.group(2), int(match.group(3))


def shape(raw: dict) -> dict:
    """One PR row for the page, from `gh search prs` or `gh pr view` JSON."""
    repo = raw.get("repository") or {}
    name = repo.get("nameWithOwner") or repo.get("name") or ""
    if not name and raw.get("url"):
        o, r, _ = parse_pr_url(raw["url"])
        name = f"{o}/{r}"
    return {
        "repo": name,
        "number": int(raw.get("number") or 0),
        "title": str(raw.get("title") or ""),
        "url": str(raw.get("url") or ""),
        "author": str((raw.get("author") or {}).get("login") or ""),
        "draft": bool(raw.get("isDraft")),
        "updated": str(raw.get("updatedAt") or ""),
        "created": str(raw.get("createdAt") or ""),
    }


# ---------------------------------------------------------------- local state

def state_path() -> Path:
    try:
        from hermes_constants import get_hermes_home
        home = Path(get_hermes_home())
    except Exception:
        home = Path.home() / ".hermes"
    return home / "reviews" / "state.json"


def load_state() -> dict:
    try:
        data = json.loads(state_path().read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def save_state(data: dict) -> None:
    path = state_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
    tmp.replace(path)


def set_hidden(url: str, hidden: bool) -> list[str]:
    parse_pr_url(url)
    with _state_lock:
        data = load_state()
        items = [u for u in data.get("hidden", []) if isinstance(u, str) and u != url]
        if hidden:
            items.append(url)
        data["hidden"] = items
        save_state(data)
        return items


def parse_pr_id(value: str) -> tuple[str, int]:
    """("owner/repo", number) from "owner/repo#123". Raises ValueError for anything else."""
    match = PR_ID.match(str(value or "").strip())
    if not match:
        raise ValueError("bad pull request id")
    if match.group(1).lower() != owner().lower():
        raise ValueError(f"only {owner()} pull requests")
    return f"{match.group(1)}/{match.group(2)}", int(match.group(3))


# ---------------------------------------------------------------- calls

SEARCH_QUERY = """query($q: String!) {
  search(query: $q, type: ISSUE, first: 100) {
    nodes { ... on PullRequest {
      number title url isDraft updatedAt createdAt headRefName
      author { login } repository { nameWithOwner }
      files(first: 100) { nodes { path } }
    } }
  }
}"""
TICKET = re.compile(r"^[A-Za-z][A-Za-z0-9]*-\d+$")


def project_of(branch: str, paths: list[str]) -> tuple[str, str]:
    """(project, source). Our branch template is <TICKET>/<project>/<kind>/<slug>, e.g.
    ACME-3478/billing/fix/strip-formatting. Without it, a clear majority of changed files under
    apps/<name>/ names the project. Otherwise "Other"."""
    segs = [s for s in str(branch or "").split("/") if s]
    if len(segs) >= 3 and TICKET.match(segs[0]):
        return segs[1].lower(), "branch"
    apps = [p.split("/")[1].lower() for p in paths if p.startswith("apps/") and p.count("/") >= 2]
    if apps:
        top = max(set(apps), key=apps.count)
        if apps.count(top) * 2 > len(paths):
            return top, "files"
    return "Other", ""


def api_list(_id: str = "", _body=None) -> dict:
    org = owner()
    out = gh("api", "graphql", "-f", f"query={SEARCH_QUERY}", "-f", f"q=is:pr is:open review-requested:@me org:{org}")
    nodes = [n for n in ((json.loads(out or "{}").get("data") or {}).get("search") or {}).get("nodes") or [] if n]
    hidden = set(load_state().get("hidden", []))
    prs = []
    for n in nodes:
        row = shape(n)
        paths = [f.get("path", "") for f in ((n.get("files") or {}).get("nodes") or [])]
        row["branch"] = n.get("headRefName", "")
        row["project"], row["projectSource"] = project_of(row["branch"], paths)
        prs.append(row)
    prs.sort(key=lambda p: p["updated"], reverse=True)
    shown = [p for p in prs if p["url"] not in hidden]
    return {"ok": True, "owner": org, "prs": shown, "hidden": [p for p in prs if p["url"] in hidden]}


def api_hide(_id: str = "", body=None) -> dict:
    set_hidden(str((body or {}).get("url", "")), True)
    return {"ok": True}


def api_unhide(_id: str = "", body=None) -> dict:
    set_hidden(str((body or {}).get("url", "")), False)
    return {"ok": True}


def _api_json(path: str, *, paginate: bool = False, full: bool = False):
    args = ["api", path]
    if full:
        args += ["-H", FULL_JSON]
    if paginate:
        args += ["--paginate", "--slurp"]
    data = json.loads(gh(*args) or "null")
    if paginate:  # --slurp wraps every page in one outer list
        return [item for page in data or [] for item in (page or [])]
    return data


def _user(u) -> dict:
    u = u or {}
    return {"login": u.get("login", ""), "avatar": u.get("avatar_url", ""), "bot": u.get("type") == "Bot"}


def _check(c: dict) -> dict:
    if c.get("__typename") == "StatusContext":
        state = str(c.get("state") or "").upper()
        return {"name": c.get("context", ""), "group": "", "url": c.get("targetUrl", ""),
                "status": "COMPLETED" if state not in ("PENDING", "EXPECTED") else "IN_PROGRESS",
                "conclusion": {"SUCCESS": "SUCCESS", "FAILURE": "FAILURE", "ERROR": "FAILURE"}.get(state, "")}
    return {"name": c.get("name", ""), "group": c.get("workflowName", ""), "url": c.get("detailsUrl", ""),
            "status": str(c.get("status") or "").upper(), "conclusion": str(c.get("conclusion") or "").upper()}


def api_pr(pr_id: str = "", _body=None) -> dict:
    """Everything the PR page shows: header, body, checks, comments, reviews and file patches."""
    repo, number = parse_pr_id(pr_id)
    base = f"repos/{repo}"
    jobs = {
        "pull": lambda: _api_json(f"{base}/pulls/{number}", full=True),
        "files": lambda: _api_json(f"{base}/pulls/{number}/files?per_page=100", paginate=True),
        "issue_comments": lambda: _api_json(f"{base}/issues/{number}/comments?per_page=100", paginate=True, full=True),
        "review_comments": lambda: _api_json(f"{base}/pulls/{number}/comments?per_page=100", paginate=True, full=True),
        "reviews": lambda: _api_json(f"{base}/pulls/{number}/reviews?per_page=100", paginate=True, full=True),
        "view": lambda: json.loads(gh("pr", "view", str(number), "-R", repo, "--json", "statusCheckRollup,commits,reviewDecision")),
        "compare": lambda: _merge_base(repo, number),
    }
    with ThreadPoolExecutor(max_workers=len(jobs)) as pool:
        futures = {name: pool.submit(fn) for name, fn in jobs.items()}
        got = {name: f.result() for name, f in futures.items()}
    pull, view = got["pull"], got["view"]
    hidden = set(load_state().get("hidden", []))
    return {
        "ok": True,
        "pr": {
            "id": f"{repo}#{number}",
            "repo": repo,
            "number": number,
            "url": pull.get("html_url", ""),
            "title": pull.get("title", ""),
            "bodyHtml": pull.get("body_html") or "",
            "state": "merged" if pull.get("merged") else pull.get("state", ""),
            "draft": bool(pull.get("draft")),
            "author": _user(pull.get("user")),
            "base": (pull.get("base") or {}).get("ref", ""),
            "head": (pull.get("head") or {}).get("ref", ""),
            "baseSha": (pull.get("base") or {}).get("sha", ""),
            "headSha": (pull.get("head") or {}).get("sha", ""),
            "headRepo": ((pull.get("head") or {}).get("repo") or {}).get("full_name", repo),
            "additions": pull.get("additions", 0),
            "deletions": pull.get("deletions", 0),
            "changedFiles": pull.get("changed_files", 0),
            "commits": len(view.get("commits") or []),
            "created": pull.get("created_at", ""),
            "updated": pull.get("updated_at", ""),
            "labels": [{"name": l.get("name", ""), "color": l.get("color", "")} for l in pull.get("labels") or []],
            "reviewDecision": view.get("reviewDecision") or "",
            "hidden": pull.get("html_url", "") in hidden,
            "mergeBase": got["compare"],
        },
        "walkthrough": walkthrough_status(repo, number, (pull.get("head") or {}).get("sha", "")),
        "checks": [_check(c) for c in view.get("statusCheckRollup") or []],
        "files": [{
            "path": f.get("filename", ""),
            "prevPath": f.get("previous_filename") or "",
            "status": f.get("status", ""),
            "additions": f.get("additions", 0),
            "deletions": f.get("deletions", 0),
            "patch": f.get("patch"),
        } for f in got["files"]],
        "comments": [{
            "id": c.get("id"), "user": _user(c.get("user")), "html": c.get("body_html") or "",
            "created": c.get("created_at", ""), "url": c.get("html_url", ""),
        } for c in got["issue_comments"]],
        "reviews": [{
            "id": r.get("id"), "user": _user(r.get("user")), "html": r.get("body_html") or "",
            "state": r.get("state", ""), "created": r.get("submitted_at", ""), "url": r.get("html_url", ""),
        } for r in got["reviews"]],
        "threads": [{
            "id": c.get("id"), "replyTo": c.get("in_reply_to_id"), "user": _user(c.get("user")),
            "html": c.get("body_html") or "", "path": c.get("path", ""), "line": c.get("line"),
            "side": c.get("side") or "RIGHT", "outdated": c.get("line") is None,
            "created": c.get("created_at", ""), "url": c.get("html_url", ""),
        } for c in got["review_comments"]],
    }


def api_file(_id: str = "", body=None) -> dict:
    """One file at one commit, for "expand unchanged lines". Returns contents or null when absent."""
    body = body or {}
    repo, _ = parse_pr_id(f"{body.get('repo', '')}#1")
    path, ref = str(body.get("path", "")), str(body.get("ref", ""))
    if not SHA.match(ref) or not path or path.startswith("/") or ".." in path.split("/"):
        raise ValueError("bad file request")
    from urllib.parse import quote
    try:
        text = gh("api", f"repos/{repo}/contents/{quote(path)}?ref={ref}", "-H", "Accept: application/vnd.github.raw")
    except RuntimeError as exc:
        if "404" in str(exc) or "Not Found" in str(exc):
            return {"ok": True, "contents": None}
        raise
    return {"ok": True, "contents": text}


def api_add(_id: str = "", body=None) -> dict:
    """Request my review on a PR given by link, then return that PR's row."""
    pr_owner, repo, number = parse_pr_url((body or {}).get("url", ""))
    org = owner()
    if pr_owner.lower() != org.lower():
        raise ValueError(f"only {org} pull requests")
    full = f"{pr_owner}/{repo}"
    view = json.loads(gh("pr", "view", str(number), "-R", full, "--json", "number,title,url,author,isDraft,updatedAt,createdAt,state,headRefName,files"))
    if view.get("state") != "OPEN":
        raise ValueError(f"{full}#{number} is {str(view.get('state', '')).lower()}")
    me = gh("api", "user", "--jq", ".login").strip()
    if (view.get("author") or {}).get("login", "").lower() == me.lower():
        raise ValueError("you are the author of this pull request")
    gh("api", "-X", "POST", f"repos/{full}/pulls/{number}/requested_reviewers", "-f", f"reviewers[]={me}", "--silent")
    view["repository"] = {"nameWithOwner": full}
    set_hidden(view.get("url", ""), False)
    row = shape(view)
    row["branch"] = view.get("headRefName", "")
    row["project"], row["projectSource"] = project_of(row["branch"], [f.get("path", "") for f in view.get("files") or []])
    return {"ok": True, "pr": row}


def _merge_base(repo: str, number: int) -> str:
    """The commit GitHub diffs the PR against (needed to expand unchanged lines correctly)."""
    try:
        pull = _api_json(f"repos/{repo}/pulls/{number}")
        base, head = pull["base"]["sha"], pull["head"]["sha"]
        return _api_json(f"repos/{repo}/compare/{base}...{head}?per_page=1").get("merge_base_commit", {}).get("sha", "")
    except Exception:
        return ""


# ---------------------------------------------------------------- walkthroughs

HUNK_HEADER = re.compile(r"^@@ ")
ROOT = Path(__file__).absolute().parent


def split_hunks(patch) -> list[str]:
    """A GitHub file patch split into hunks (each starts with its @@ line)."""
    hunks: list[list[str]] = []
    for line in str(patch or "").split("\n"):
        if HUNK_HEADER.match(line) or not hunks:
            hunks.append([line])
        else:
            hunks[-1].append(line)
    return ["\n".join(h) for h in hunks if h and HUNK_HEADER.match(h[0])]


def hunk_ids(files: list[dict]) -> dict[str, dict]:
    """Every hunk id of a PR -> {path, n, text}. Files without a patch get one synthetic id h0."""
    out: dict[str, dict] = {}
    for f in files:
        path = f.get("path") or f.get("filename") or ""
        hunks = split_hunks(f.get("patch"))
        if not hunks:
            out[f"{path}:h0"] = {"path": path, "n": 0, "text": ""}
        for i, text in enumerate(hunks, 1):
            out[f"{path}:h{i}"] = {"path": path, "n": i, "text": text}
    return out


def walkthrough_dir(repo: str, number: int, sha: str = "") -> Path:
    base = state_path().parent / "walkthroughs" / repo.replace("/", "__") / str(number)
    return base / sha if sha else base


def _pid_alive(pid) -> bool:
    try:
        os.kill(int(pid), 0)
        return True
    except (OSError, ValueError, TypeError):
        return False


def _read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def walkthrough_status(repo: str, number: int, head_sha: str) -> dict:
    """{state: none|running|done|error|stale, ...} for the PR's current head commit."""
    if SHA.match(head_sha or ""):
        status = _read_json(walkthrough_dir(repo, number, head_sha) / "status.json") or {}
        state = status.get("state")
        if state == "running" and not _pid_alive(status.get("pid")):
            state, status["error"] = "error", "the walkthrough run stopped without a result"
        if state in ("running", "done", "error"):
            return {"state": state, "sha": head_sha, "started": status.get("started"), "finished": status.get("finished"),
                    "error": status.get("error", ""), "files": status.get("files", [])}
    older = sorted(walkthrough_dir(repo, number).glob("*/walkthrough.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if older:
        return {"state": "stale", "sha": older[0].parent.name}
    return {"state": "none"}


def write_input(pr: dict, files: list[dict]) -> str:
    """input.md for the model: PR facts, the author's description, and every hunk by id."""
    lines = [
        f"# {pr['title']}",
        "",
        f"- Pull request: {pr['url']}",
        f"- Author: {pr['author']}",
        f"- Branches: `{pr['head']}` into `{pr['base']}`",
        f"- Size: {len(files)} files, +{pr['additions']} -{pr['deletions']}",
        "",
        "## Author's description",
        "",
        (pr.get("body") or "(none)").strip(),
        "",
        "## Changed files and hunks",
        "",
    ]
    for f in files:
        path = f["path"]
        moved = f" (renamed from {f['prevPath']})" if f.get("prevPath") else ""
        lines.append(f"## {f['status']} {path}{moved}  (+{f['additions']} -{f['deletions']})")
        lines.append("")
        hunks = split_hunks(f.get("patch"))
        if not hunks:
            lines += [f"### hunk {path}:h0  (no text diff: binary or too large)", ""]
            continue
        for i, text in enumerate(hunks, 1):
            add = sum(1 for l in text.split("\n")[1:] if l.startswith("+"))
            rem = sum(1 for l in text.split("\n")[1:] if l.startswith("-"))
            lines += [f"### hunk {path}:h{i}  (+{add} -{rem})", "", "```diff", text, "```", ""]
    return "\n".join(lines)


def clean_walkthrough(doc: dict, ids: dict[str, dict]) -> dict:
    """Keep only known hunk ids, each at most once; every hunk not on the path goes to support."""
    if not isinstance(doc, dict):
        raise ValueError("walkthrough is not a JSON object")
    used: set[str] = set()

    def take(values) -> list[str]:
        out = []
        for v in values if isinstance(values, list) else []:
            if isinstance(v, str) and v in ids and v not in used:
                used.add(v)
                out.append(v)
        return out

    text = lambda v, n: str(v or "").strip()[:n]
    chapters = []
    for ci, ch in enumerate(doc.get("chapters") or []):
        if not isinstance(ch, dict):
            continue
        stops = []
        for si, st in enumerate(ch.get("stops") or []):
            if not isinstance(st, dict):
                continue
            hunks = take(st.get("hunkIds"))
            if not hunks:
                continue
            stops.append({
                "id": text(st.get("id"), 60) or f"s{ci}-{si}",
                "title": text(st.get("title"), 80),
                "summary": text(st.get("summary"), 400),
                "prose": text(st.get("prose"), 1600),
                "check": text(st.get("check"), 400),
                "hunkIds": hunks,
            })
        if stops:
            chapters.append({"id": text(ch.get("id"), 40) or f"c{ci}", "title": text(ch.get("title"), 24),
                             "blurb": text(ch.get("blurb"), 300), "stops": stops})
    if not chapters:
        raise ValueError("the walkthrough has no stops with known hunks")
    support = take(doc.get("support")) + [i for i in ids if i not in used and i not in (doc.get("support") or [])]
    support = list(dict.fromkeys(support))
    return {"title": text(doc.get("title"), 80), "focus": text(doc.get("focus"), 600),
            "chapters": chapters, "support": support}


def api_walkthrough(pr_id: str = "", _body=None) -> dict:
    """Start a background walkthrough run for the PR's current head (POST). Idempotent while running."""
    repo, number = parse_pr_id(pr_id)
    pull = _api_json(f"repos/{repo}/pulls/{number}")
    sha = (pull.get("head") or {}).get("sha", "")
    if not SHA.match(sha):
        raise ValueError("pull request has no head commit")
    current = walkthrough_status(repo, number, sha)
    if current["state"] in ("running", "done"):
        return {"ok": True, "walkthrough": current}
    files = [{"path": f.get("filename", ""), "prevPath": f.get("previous_filename") or "", "status": f.get("status", ""),
              "additions": f.get("additions", 0), "deletions": f.get("deletions", 0), "patch": f.get("patch")}
             for f in _api_json(f"repos/{repo}/pulls/{number}/files?per_page=100", paginate=True)]
    pr = {"title": pull.get("title", ""), "url": pull.get("html_url", ""), "author": (pull.get("user") or {}).get("login", ""),
          "head": (pull.get("head") or {}).get("ref", ""), "base": (pull.get("base") or {}).get("ref", ""),
          "additions": pull.get("additions", 0), "deletions": pull.get("deletions", 0), "body": pull.get("body") or ""}
    folder = walkthrough_dir(repo, number, sha)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "input.md").write_text(write_input(pr, files), encoding="utf-8")
    (folder / "files.json").write_text(json.dumps(files), encoding="utf-8")
    for name in ("walkthrough.json", "raw.txt"):
        (folder / name).unlink(missing_ok=True)
    import sys
    log = open(folder / "run.log", "w", encoding="utf-8")
    proc = subprocess.Popen([sys.executable, str(ROOT / "walkthrough_runner.py"), str(folder)], cwd=str(folder),
                            stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, start_new_session=True,
                            env={**os.environ, "PYTHONPATH": os.pathsep.join([str(ROOT), os.environ.get("PYTHONPATH", "")])})
    status = {"state": "running", "pid": proc.pid, "started": _now(),
              "files": [f["path"].rsplit("/", 1)[-1] for f in files][:40]}
    (folder / "status.json").write_text(json.dumps(status), encoding="utf-8")
    return {"ok": True, "walkthrough": walkthrough_status(repo, number, sha)}


def api_walkthrough_get(pr_id: str = "", _body=None) -> dict:
    """The finished walkthrough. id = "owner/repo#n" (newest) or "owner/repo#n@<head sha>"."""
    pr_id, _, sha = str(pr_id or "").partition("@")
    repo, number = parse_pr_id(pr_id)
    if not SHA.match(sha):
        done = sorted(walkthrough_dir(repo, number).glob("*/walkthrough.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        if not done:
            raise ValueError("no walkthrough yet")
        sha = done[0].parent.name
    folder = walkthrough_dir(repo, number, sha)
    doc = _read_json(folder / "walkthrough.json")
    if not doc:
        raise ValueError("no walkthrough for this commit")
    return {"ok": True, "sha": sha, "walkthrough": doc, "files": _read_json(folder / "files.json") or []}


def _now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def walkthrough_settings() -> dict:
    s = settings()
    return {"model": str(s.get("walkthrough_model") or ""), "provider": str(s.get("walkthrough_provider") or "")}


def api_walkthrough_status(pr_id: str = "", _body=None) -> dict:
    repo, number = parse_pr_id(pr_id)
    pull = _api_json(f"repos/{repo}/pulls/{number}")
    return {"ok": True, "walkthrough": walkthrough_status(repo, number, (pull.get("head") or {}).get("sha", ""))}
