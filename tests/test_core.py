import json
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).absolute().parent.parent))
import reviews_core as core  # noqa: E402

SEARCH = [
    {"number": 1, "title": "Old", "url": "https://github.com/acme/app/pull/1", "repository": {"nameWithOwner": "acme/app"},
     "author": {"login": "dana"}, "isDraft": False, "updatedAt": "2026-11-01T10:00:00Z"},
    {"number": 2, "title": "New", "url": "https://github.com/acme/app/pull/2", "repository": {"nameWithOwner": "acme/app"},
     "author": {"login": "eli"}, "isDraft": True, "updatedAt": "2026-11-12T10:00:00Z"},
]


class ParseUrl(unittest.TestCase):
    def test_ok(self):
        self.assertEqual(core.parse_pr_url("https://github.com/acme/app/pull/12"), ("acme", "app", 12))
        self.assertEqual(core.parse_pr_url(" https://github.com/acme/my.repo/pull/7/files?x=1 "), ("acme", "my.repo", 7))

    def test_bad(self):
        for url in ["", "https://github.com/acme/app/issues/1", "http://github.com/acme/app/pull/1",
                    "https://github.com/acme/app/pull/1;rm -rf", "https://evil.com/acme/app/pull/1"]:
            with self.assertRaises(ValueError, msg=url):
                core.parse_pr_url(url)


@mock.patch.object(core, "settings", lambda: {"owner": "acme"})
class Api(unittest.TestCase):
    def test_list_sorted_newest_first(self):
        with mock.patch.object(core, "gh", return_value=json.dumps(SEARCH)) as gh:
            out = core.api_list()
        self.assertEqual([p["number"] for p in out["prs"]], [2, 1])
        self.assertTrue(out["prs"][0]["draft"])
        self.assertIn("--owner=acme", gh.call_args.args)

    def test_add_refuses_other_org(self):
        with mock.patch.object(core, "gh") as gh, self.assertRaises(ValueError):
            core.api_add("", {"url": "https://github.com/other/app/pull/1"})
        gh.assert_not_called()

    def test_add_refuses_own_pr(self):
        view = {"number": 3, "title": "Mine", "url": "https://github.com/acme/app/pull/3", "author": {"login": "Me"}, "state": "OPEN"}
        calls = iter([json.dumps(view), "me\n"])
        with mock.patch.object(core, "gh", side_effect=lambda *a: next(calls)), self.assertRaises(ValueError):
            core.api_add("", {"url": view["url"]})

    def test_add_requests_review(self):
        view = {"number": 3, "title": "T", "url": "https://github.com/acme/app/pull/3", "author": {"login": "dana"},
                "isDraft": False, "updatedAt": "2026-11-12T10:00:00Z", "state": "OPEN"}
        seen = []

        def fake(*args):
            seen.append(args)
            return {0: json.dumps(view), 1: "me\n"}.get(len(seen) - 1, "")

        with mock.patch.object(core, "gh", side_effect=fake):
            out = core.api_add("", {"url": view["url"]})
        self.assertEqual(out["pr"]["repo"], "acme/app")
        self.assertEqual(seen[2][:4], ("api", "-X", "POST", "repos/acme/app/pulls/3/requested_reviewers"))
        self.assertIn("reviewers[]=me", seen[2])

    def test_owner_required(self):
        with mock.patch.object(core, "settings", lambda: {}), self.assertRaises(ValueError):
            core.api_list()


if __name__ == "__main__":
    unittest.main()
