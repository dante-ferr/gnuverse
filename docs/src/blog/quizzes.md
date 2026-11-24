# Quizzes

Quizzes are learning self-assessments. They may complement one article or stand alone; an article can have several quizzes. They do not create rooms, award coins, record player achievements, or store attempts.

## Contributor flow

1. Open **Quizzes** in the site navigation, then **Criar ou editar quiz** (`/quizzes/criar/`). Sign in using the same account as the blog. Login and registration use dedicated pages and return to the quiz editor.
2. Fill in the title, URL slug and summary. Select an optional article: the picker includes published articles and the contributor's own unpublished articles. On the blog submission panel, **Criar quiz relacionado** opens the editor with that article selected.
3. Add 1–30 multiple-choice questions, each with 2–6 distinct alternatives, exactly one correct answer, and a required explanation. The site editor marks the correct alternative with a radio button. All questions must be complete when saving, including drafts.
4. **Salvar rascunho** keeps the quiz private; **Enviar para revisão** changes its status to `in_review`. **Meus quizzes** lists the contributor's submissions, their status, and review feedback; **Editar quiz** resumes any unpublished quiz.
5. A reviewer opens **Quizzes** in the Payload `/admin` panel, checks the content, optionally records feedback and sets `changes_requested`, or sets `published`. In the CMS, the correct-answer index is zero-based (0 means the first alternative).
6. Publishing, updating published content, unpublishing or deleting it requests a static site rebuild through the existing deploy hook. The new site becomes visible only when the build finishes. Local development: restart the site (`make dev`) or run `make sync` and reload to pick up publication changes.

Unlike article versions, quizzes do not maintain a parallel draft over published content. An author must ask a reviewer to unpublish a quiz before editing it. This prevents unreviewed changes to the live answer key. Reviewers can update any quiz, and authors can delete only their own unpublished quizzes through the API.

## Access

- Accounts allowed to contribute articles can also create quizzes. The server assigns and preserves ownership; a submitted `owner` cannot transfer it.
- Authors read and change their own unpublished quizzes, and read feedback on their own submissions. They cannot publish, request changes, change another person's content or forge review notes.
- `admin`, `blog-editor` and legacy blog reviewers manage all quizzes. The shared `quiz-editor` role grants CMS access and quiz management without article-management permissions. Shared role assignments remain authoritative.
- Anonymous API reads return only published quizzes, without ownership or review notes. The public snapshot also removes internal question/alternative IDs.
- The optional article relation must reference an article accessible to the caller. Public links are emitted only when the article is present in the same published article snapshot. Unpublishing an article hides its link without removing its independent quiz; deleting an article clears the relation.

## Reader experience

`/quizzes/` lists published quizzes; `/quizzes/<slug>/` renders a self-contained quiz. Related quizzes also appear after their article. Visitors do not sign in to answer. Each question uses a labelled radio group, with completion progress. Submitting shows the score and all explanations; **Tentar novamente** clears the attempt.

Attempts live only in component memory and reset on reload. Correct answers ship in the static bundle intentionally: these are practice materials, not secure exams, grades or reward-bearing assessments. Publication and removal have the same CDN/deploy delay as articles.

## Code map

| Path | Responsibility |
| :--- | :--- |
| `core/quiz/quiz.ts` | Shared types, validation limits, editorial labels and complete-attempt scoring |
| `cms/src/collections/Quizzes.ts` | Payload schema, ownership, validation, access and review workflow |
| `cms/src/migrations/20261124_120000_quizzes.ts` | PostgreSQL tables, foreign keys, indexes and rollback |
| `scripts/quiz-content.mjs` | Paginated public sync, validation and allowlisted snapshot fields |
| `scripts/sync-content.mjs` | Atomic combined article/quiz snapshot; CMS failure aborts live sync |
| `src/components/quiz/` | Public cards, quiz player and contributor editor |
| `src/lib/quiz-client.ts` | Contributor HTTP requests, timeouts and paginated editorial lists |
| `content/demo-quiz.json` | Local demo independent quiz, without CMS or account |

The site uses the existing visual tokens and static-export architecture. No new backend process or dependency is required.

## Validation

With `make setup` already completed and Node.js 22.18+ active:

```bash
make test-quiz       # Specific unit tests + isolated SQLite/REST editorial integration
make typecheck      # Site and CMS TypeScript
CMS_CONTENT_MODE=demo make build  # Export demo quiz without depending on a running CMS
```

`make test-quiz` creates a temporary database under the system temp directory and destroys it afterwards. It never seeds or clears the local development database. It covers validation, score boundaries, ownership, anonymous reads, author escalation attempts, REST draft-query bypass attempts, review feedback, shared quiz editors, optional article links, sync pagination and deploy-hook events.

Manual checks with `make dev`:

1. As a contributor, create an independent quiz and another linked to an own draft article. Save, reload **Meus quizzes**, edit, and send for review. Expected: both persist privately; the author cannot publish through REST or the CMS.
2. As another contributor, try reading/editing the first account's private quiz. Expected: no access.
3. As reviewer/admin, request changes with feedback. Expected: author sees feedback and can revise and resubmit. Publish both quizzes and the linked article; restart the site or run `make sync` and reload. Expected: quizzes appear on `/quizzes/`, with reciprocal links for the published article.
4. Sign out and answer a quiz on desktop and a narrow viewport, including keyboard-only input. Submit an incomplete attempt: the required radio group must prevent scoring. Complete all questions: score and explanations appear. Retry: selections clear.
5. Unpublish the article and sync: its quiz remains playable but the article link disappears. Unpublish/delete a quiz and sync: it disappears from the list and article. An existing exported site changes only after a successful rebuild.

## Deployment order

Deploy the CMS first and apply `npm run migrate` from `cms/` with the existing production PostgreSQL/S3 environment. The migration adds `quizzes`, nested question/choice tables, and locked-document relations; it does not migrate or seed business data. Local SQLite schema is managed by Payload development schema push.

Then rebuild the static site in live mode. The CMS must expose `/api/quizzes` before live sync runs; a missing route or unavailable CMS aborts the build and preserves the previous deployed site. No new environment variable is needed. Keep the existing `CMS_ALLOWED_ORIGINS`, public CMS URL and deploy-hook configuration. Rolling back the quiz schema drops quiz content, so preserve it before rollback.
