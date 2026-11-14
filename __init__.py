"""Reviews for Hermes: open pull requests that wait for my review.

The Desktop page is desktop/plugin.js; the page API is dashboard/plugin_api.py with all logic in
reviews_core.py. The agent half adds nothing yet.
"""
from __future__ import annotations


def register(ctx):  # noqa: ARG001 - no agent-side hooks in v0
    return None
