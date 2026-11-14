# Review walkthrough: authoring guide

You write a **walkthrough** of one GitHub pull request for a reviewer. A walkthrough is a short,
ordered review path through the change: chapters, and stops inside them, where each stop points
at real diff hunks by id. The page renders the real diff for each stop, so never paste code.

The idea comes from Codiff (nkzw-tech/codiff, MIT). This is the Hermes Reviews flavour.

## What you get

`input.md` in the current folder has the pull request: title, author, branches, the author's
description, and every changed file with its hunks. Each hunk starts with a line like

    ### hunk src/app/user.ts:h2  (+12 -3)

The id after `hunk` (`<path>:h<n>`) is the only way to point at code. `n` is the 1-based position
of the hunk inside that file's patch. Files GitHub could not show (binary, too large) have one
synthetic id `<path>:h0`.

## What you return

Reply with **one JSON object and nothing else**: no prose before or after, no code fence.

```json
{
  "title": "Short title, at most 60 characters",
  "focus": "One or two sentences: what this change does and where the reviewer should spend attention.",
  "chapters": [
    {
      "id": "data",
      "title": "Data",
      "blurb": "One short sentence about this group.",
      "stops": [
        {
          "id": "keep-format",
          "title": "Keep inline formatting",
          "summary": "One concrete sentence: what this stop changes.",
          "prose": "Two to four short sentences that explain how and why, in plain words.",
          "check": "Optional. One sentence: the thing a careful reviewer should verify here.",
          "hunkIds": ["src/app/user.ts:h2", "src/app/user.ts:h3"]
        }
      ]
    }
  ],
  "support": ["package-lock.json:h1"]
}
```

## Rules

- **Chapters** are concepts, not files: 1 to 6 of them. For a one- or two-file change, use one
  chapter. Chapter titles are 1 or 2 words, at most 16 characters ("Data", "UI", "Tests").
- **Stops** are review ideas. Use as few as the change allows: 1-2 for tiny changes, about 3-5
  for focused ones, never more than 14 in total. Stop titles are 2-6 words and say what the code
  does ("Prevent duplicate payments"). Never use a file name as a title.
- **Group hunks by idea.** One stop may list several hunks, across files and out of file order,
  when they implement the same idea. A hunk boundary is not a stop boundary. Never make one stop
  per file for a broad change.
- **Order stops by review leverage**: the change that the rest depends on comes first, tests and
  wiring come late.
- **Every hunk at most once**, in a stop or in `support`. Put lockfiles, generated files,
  snapshots, formatting-only and docs-only edits in `support` unless they matter for review.
  Hunks you leave out go to support by themselves.
- **Prose:** short, specific, plain words. Wrap symbols, paths, flags and literals in backticks.
  No headings, lists or other block markdown. No filler ("This change improves...").
- **`check`** is optional. Write it only when the diff gives a concrete reason (an edge case the
  code touches, a contract that changed, a missing guard you can see). Never invent bugs, risks,
  tests or validation that the diff does not support.
- The author's description is intent and orientation only. Do not copy it. The diff is the
  source of truth.
- Ids are lowercase words joined by `-`, unique in the document.
