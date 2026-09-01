# Telegram Igor — write and post blogs

@Igor_theibot on Railway can publish to this repo without cloning it.

## From Telegram

1. Draft the piece in chat (keep Yahoska’s wording). We do not pick the plan.
2. After she says **post it**, Igor calls `github_write` with `confirmed=true`:

```
method: POST
path: yperez-dot/healthexps-www/dispatches
body:
  event_type: publish-blog
  client_payload:
    enSlug: nch-drops-cigna-wellcare-medicare-advantage-2027
    enTitle: NCH Drops Cigna and Wellcare Medicare Advantage in 2027
    enDescription: NCH will drop Cigna and Wellcare MA on Jan. 1, 2027. We do not pick the plan.
    enMarkdown: "# Heading\n\nBody…"
    esSlug: nch-deja-cigna-wellcare-medicare-advantage-2027
    esTitle: …
    esDescription: …
    esMarkdown: …
    date: "2026-09-01"
    mode: live
```

`mode: live` (or `merge: true`) squash-merges the PR to `main` and Netlify deploys. Omit that to leave a PR.

Railway `GITHUB_TOKEN` needs **Contents + Pull requests** on this repo, plus permission to send `repository_dispatch` (same token, Contents write is enough for dispatches on a repo the token can write).

## Manual

Actions → **Telegram publish blog** → paste the same JSON.

## What the workflow writes

- `blog/<enSlug>.md` and optional `es/blog/<esSlug>.md`
- Cards on `/blog/` (date order) and `/es/blog/` (first)
- `sitemap.xml` hreflang pair

Placeholder copy and plan-recommendation language are rejected.
