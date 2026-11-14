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

TIMEOUT = 30
FIELDS = "number,title,url,repository,author,isDraft,updatedAt,createdAt"
PR_URL = re.compile(r"^https://github\.com/([A-Za-z0-9-]+)/([A-Za-z0-9._-]+)/pull/(\d+)(?:[/?#].*)?$")
OWNER = re.compile(r"^[A-Za-z0-9-]+$")


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
    result = subprocess.run([_gh_path(), *args], capture_output=True, text=True, timeout=TIMEOUT,
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


def api_list(_id: str = "", _body=None) -> dict:
    org = owner()
    out = gh("search", "prs", "--review-requested=@me", "--state=open", f"--owner={org}",
             "--json", FIELDS, "--limit", "100")
    prs = [shape(p) for p in json.loads(out or "[]")]
    prs.sort(key=lambda p: p["updated"], reverse=True)
    return {"ok": True, "owner": org, "prs": prs}


def api_add(_id: str = "", body=None) -> dict:
    """Request my review on a PR given by link, then return that PR's row."""
    pr_owner, repo, number = parse_pr_url((body or {}).get("url", ""))
    org = owner()
    if pr_owner.lower() != org.lower():
        raise ValueError(f"only {org} pull requests")
    full = f"{pr_owner}/{repo}"
    view = json.loads(gh("pr", "view", str(number), "-R", full, "--json", "number,title,url,author,isDraft,updatedAt,createdAt,state"))
    if view.get("state") != "OPEN":
        raise ValueError(f"{full}#{number} is {str(view.get('state', '')).lower()}")
    me = gh("api", "user", "--jq", ".login").strip()
    if (view.get("author") or {}).get("login", "").lower() == me.lower():
        raise ValueError("you are the author of this pull request")
    gh("api", "-X", "POST", f"repos/{full}/pulls/{number}/requested_reviewers", "-f", f"reviewers[]={me}", "--silent")
    view["repository"] = {"nameWithOwner": full}
    return {"ok": True, "pr": shape(view)}
