# Shared authorization

`core/authz/policy.ts` defines roles and permissions with no dependency on Payload, Next.js, or storage. The client uses the policy only to show controls; every mutation is re-authorized on the backend.

| Role | Permissions |
| :--- | :--- |
| `admin` | All: users, CMS, articles, media, rooms, future quizzes |
| `blog-editor` | CMS panel, articles, media |
| `game-moderator` | CMS panel access; edit or delete any room; moderate room chat |
| `quiz-editor` | Manage quizzes (permission reserved; no UI yet) |
| `member` | Edit rules and delete own rooms |

Roles are cumulative. Payload admin access requires `cms:access`. Game accounts always receive `member` plus any assigned roles.

## Single account

The Payload account authenticates the site and the game with the same email and password. `CMSIdentityProvider` (`game-server/auth/cms-identity-provider.ts`) validates credentials and sessions; the game SQLite stores profile and match state — not passwords. A session revoked on the provider stops working in the game.

Signing in on the panel and on the site does not share cookies across different origins; they are separate sessions over the same identity.

Sign-in and registration must use dedicated pages (see `AGENTS.md`), not inline forms at each call site.

## People and access

1. Sign in to the CMS as admin and open **People and access** (also at `/acessos` on the CMS host).
2. On first use, **Enable shared management**. Legacy blog admin/editor roles are preserved.
3. Create or edit a person: name, roles, canonical CMS account. The game profile links on first login.
4. **Save access**. Reload `/jogo/` to refresh visible controls.

The UI blocks removing the last panel admin. **Remove shared access** revokes roles without deleting accounts, rooms, or articles.

## Storage

Locally the CMS writes `.content/authorization.json` (outside Git; atomic replace with revision). `GNUVERSE_AUTHZ_FILE` or `GNUVERSE_DATA_DIR` change the path. After activation, the file is authoritative; the legacy CMS `role` field no longer grants shared permissions.

The panel queries the game at `GAME_INTERNAL_URL` (default `http://localhost:${GAME_PORT}`). The game checks the panel session at `CMS_URL`. For multiple CMS replicas, replace the file adapter with a shared `RoleStore`.

## Room interventions

Admin and `game-moderator` can delete rooms and change settings through `/api/towers` where those routes remain. Open Pipeline v0.1 gameplay itself only needs a signed-in account to place or remove belts; in-room governance UI was dropped for now (see [`open-pipeline-wip.md`](../../open-pipeline-wip.md)).

## Chat moderation (CMS)

Administrators and game moderators open **Moderação do chat** (`/moderacao-chat` on the CMS host, also linked from the Payload admin nav). The page proxies to the game server:

| CMS route | Game route | Effect |
| :--- | :--- | :--- |
| `GET /api/game-chat/rooms` | `GET /api/admin/rooms` | List rooms with chat counts |
| `GET /api/game-chat/rooms/:id` | `GET /api/admin/rooms/:id/chat` | Read messages |
| `DELETE /api/game-chat/rooms/:id/messages/:messageId` | `DELETE /api/admin/rooms/:id/chat/:messageId` | Delete one message |
| `DELETE /api/game-chat/rooms/:id/messages` | `DELETE /api/admin/rooms/:id/chat` | Clear the room chat |

The game checks the panel session at `CMS_URL` via `/api/access-management/verify-chat-moderator` (`room:chat:moderate`). Live clients receive the updated history on the existing SSE `chat` event.
