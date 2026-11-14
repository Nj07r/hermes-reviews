"""Run one walkthrough in the background: `python walkthrough_runner.py <folder>`.

The folder holds input.md (written by reviews_core.api_walkthrough) and status.json. This process
runs `hermes -z` with the authoring guide, checks the JSON it returns against the real hunk ids,
and writes walkthrough.json plus the final status. It is detached from the gateway, so a gateway
reload or restart does not stop it.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import reviews_core as core

TIMEOUT = 15 * 60
# A parent's YOLO / auto-approve mode must never leak into the child agent.
DROP_ENV = ("HERMES_YOLO", "HERMES_YOLO_MODE", "HERMES_ACP_AUTO_APPROVE")


def hermes_bin() -> str:
    found = shutil.which("hermes")
    if found:
        return found
    for path in (Path.home() / ".hermes/hermes-agent/.hermes/bin/hermes", Path.home() / ".local/bin/hermes"):
        if path.exists():
            return str(path)
    raise RuntimeError("hermes CLI not found")


def prompt(guide: str) -> str:
    return (
        "You are writing a code review walkthrough for a pull request. Read ./input.md with your "
        "file tools; it has the pull request and every hunk with its id. Follow this guide exactly "
        "and reply with the JSON object only.\n\n" + guide
    )


def extract_json(text: str) -> dict:
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("the model did not return JSON")
    return json.loads(text[start:end + 1])


def set_status(folder: Path, **fields) -> None:
    path = folder / "status.json"
    try:
        status = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        status = {}
    status.update(fields)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(status), encoding="utf-8")
    tmp.replace(path)


def main(folder: Path) -> int:
    set_status(folder, pid=os.getpid())
    try:
        files = json.loads((folder / "files.json").read_text(encoding="utf-8"))
        ids = core.hunk_ids(files)
        guide = (core.ROOT / "walkthrough_guide.md").read_text(encoding="utf-8")
        args = [hermes_bin(), "-z", prompt(guide), "-t", "file", "--usage-file", str(folder / "usage.json")]
        opts = core.walkthrough_settings()
        if opts["model"]:
            args += ["-m", opts["model"]]
        if opts["provider"]:
            args += ["--provider", opts["provider"]]
        env = {k: v for k, v in os.environ.items() if not k.startswith(DROP_ENV)}
        result = subprocess.run(args, cwd=str(folder), env=env, capture_output=True, text=True,
                                encoding="utf-8", errors="replace", timeout=TIMEOUT, stdin=subprocess.DEVNULL)
        (folder / "raw.txt").write_text(result.stdout or "", encoding="utf-8")
        if result.returncode != 0:
            raise RuntimeError((result.stderr or result.stdout or f"hermes exit {result.returncode}").strip()[-400:])
        doc = core.clean_walkthrough(extract_json(result.stdout or ""), ids)
        tmp = folder / "walkthrough.tmp"
        tmp.write_text(json.dumps(doc, indent=2), encoding="utf-8")
        tmp.replace(folder / "walkthrough.json")
        set_status(folder, state="done", finished=core._now())
        return 0
    except subprocess.TimeoutExpired:
        set_status(folder, state="error", error="the walkthrough took longer than 15 minutes", finished=core._now())
    except Exception as exc:  # report every failure to the page
        set_status(folder, state="error", error=str(exc)[:400], finished=core._now())
    return 1


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1])))
