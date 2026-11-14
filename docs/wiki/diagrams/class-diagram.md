# Data types

The backend and the Desktop page share plain JSON objects. The code has no classes for them. The diagrams below show the fields that `reviews_core.py` writes. Sources: `shape()`, `api_list()`, `api_pr()`, `_check()`, `_user()`, `walkthrough_status()` and `clean_walkthrough()` in [`reviews_core.py`](../../../reviews_core.py).

## Queue and PR page

```mermaid
---
title: queue and pr payloads
---
classDiagram
    class PrRow {
        +string repo
        +int number
        +string title
        +string url
        +string author
        +bool draft
        +string updated
        +string created
        +string branch
        +string project
        +string projectSource
    }
    class PrPayload {
        +Pr pr
        +WalkthroughStatus walkthrough
        +list~Check~ checks
        +list~File~ files
        +list~Comment~ comments
        +list~Review~ reviews
        +list~Thread~ threads
    }
    class Pr {
        +string id
        +string repo
        +int number
        +string bodyHtml
        +string state
        +User author
        +string base
        +string head
        +string baseSha
        +string headSha
        +string mergeBase
        +string reviewDecision
        +bool hidden
    }
    class File {
        +string path
        +string prevPath
        +string status
        +int additions
        +int deletions
        +string patch
    }
    class Thread {
        +int id
        +int replyTo
        +string path
        +int line
        +string side
        +bool outdated
        +string html
    }
    class Check {
        +string name
        +string group
        +string url
        +string status
        +string conclusion
    }
    class User {
        +string login
        +string avatar
        +bool bot
    }
    PrPayload --> Pr
    PrPayload --> File
    PrPayload --> Thread
    PrPayload --> Check
    Pr --> User
    Thread --> User
```

`Pr` also has `url`, `title`, `draft`, `headRepo`, `additions`, `deletions`, `changedFiles`, `commits`, `created`, `updated` and `labels` (`{name, color}`). `Comment` has `id`, `user`, `html`, `created` and `url`. `Review` has the same fields plus `state`. `Thread` also has `user`, `created` and `url`.

## Walkthrough

```mermaid
---
title: walkthrough document
---
classDiagram
    class WalkthroughStatus {
        +string state
        +string sha
        +string started
        +string finished
        +string error
        +list~string~ files
    }
    class Walkthrough {
        +string title
        +string focus
        +list~Chapter~ chapters
        +list~string~ support
    }
    class Chapter {
        +string id
        +string title
        +string blurb
        +list~Stop~ stops
    }
    class Stop {
        +string id
        +string title
        +string summary
        +string prose
        +string check
        +list~string~ hunkIds
    }
    Walkthrough --> Chapter
    Chapter --> Stop
```

## Notes

- `state` in `WalkthroughStatus` is `none`, `running`, `done`, `error` or `stale`. For `stale`, only `state` and `sha` are present. For `none`, only `state` is present.
- `hunkIds` and `support` hold hunk ids in the form `<path>:h<n>`.
- `Thread.outdated` is true when GitHub gives no `line`. `Thread.side` is `RIGHT` when GitHub gives no side.
- `Check` normalises two GitHub types. A `StatusContext` maps `SUCCESS`, `FAILURE` and `ERROR` to a conclusion, and `PENDING` or `EXPECTED` to `IN_PROGRESS`.
- `File.patch` is `null` when GitHub gives no text diff.
