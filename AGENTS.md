<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Method book

- Team method authority: `docs/` (mdBook). Preview with `make docs-serve` (`http://localhost:3003`).
- External course brief: `docs/references/trabalho-multimodal-2026.2.pdf`. Do not copy the brief into chapters.
- Conflicts: the brief wins for the problem statement; the book wins for team method; if code and book disagree on method, update the book when the method changed, or the code when the book still defines the method.
- Book language: English (`docs/book.toml`).

## Language

- **UI only in Portuguese** (labels, copy, user-facing errors, blog and game text shown in the browser).
- **Code and documentation in English** (identifiers, comments, commit messages, this file, the mdBook, READMEs aimed at developers).

## Authentication UX

- When a control asks the user to sign in or register, **redirect to a dedicated login or registration page**.
- Do not embed login or registration forms inline where the action was requested (for example, do not keep a full auth form inside the blog submission panel or a game panel). Link or navigate to the shared auth pages instead.
