# Editorial method

Blog parallel to the game: authorial texts on free software and democratizing access, with references and links to course talks. External visitors may contribute; everything needs approval before it appears on the static site.

Proof of concept: **14 posts** (two per member). Navigation by list, categories, and article pages — posts do not become game rooms.

## Flow

`draft` → `in_review` → `changes_requested` or `approved` → `_status: published`.

| Who | Where | Can |
| :--- | :--- | :--- |
| Author | Panel on `/blog/` (after dedicated login/register pages) | Draft, submit for review, see `reviewNotes` on own texts |
| Reviewer / admin | Payload `/admin` | Feedback, approve, publish, unpublish, delete, cover, rich text |
| Admin | `/admin` + `/acessos` | Members and shared roles |

Authors **must not** publish directly (API and hooks block `_status: published`). The site `/admin` route only redirects to the CMS.

Auth for contributors must redirect to dedicated login/registration pages — not inline forms in the submission panel (`AGENTS.md`).

## What the site covers vs `/admin`

On the site: author session (via auth pages), plain-text draft, hashtags, references, submit for review, status and feedback.

CMS only: review of others’ work, publish/unpublish, advanced Lexical, media/covers library, creating reviewers, People and access.

## Hosting

- Payload on Render Free; Postgres + S3 on Supabase; site on Cloudflare Pages.
- Publishing triggers a deploy hook → build syncs published articles and covers.
- Readers never call the CMS; the submission path and `/admin` need the CMS awake (120 s client timeout).

SMTP and rate limits for broad signup remain on the [roadmap](../engineering/roadmap.md).
