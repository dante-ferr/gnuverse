import type { Endpoint, PayloadRequest } from 'payload'
import { parseCookies } from 'payload/shared'
import { can } from '../../../core/authz/policy.ts'
import { cmsActor } from '../access'
import { RoleManagementError } from '../../../core/authz/manage-role-store.ts'

function requireChatModerator(req: PayloadRequest) {
  if (!req.user) throw new RoleManagementError(401, 'Entre no painel administrativo.')
  if (!can(cmsActor(req.user), 'room:chat:moderate'))
    throw new RoleManagementError(403, 'Apenas administradores e moderadores do jogo podem moderar o chat.')
}

function handler(run: (req: PayloadRequest) => Promise<unknown>): Endpoint['handler'] {
  return async (req) => {
    try {
      requireChatModerator(req)
      return Response.json(await run(req), { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      if (!(error instanceof RoleManagementError))
        req.payload.logger.error({ err: error }, 'Falha na moderação do chat')
      return Response.json(
        {
          error:
            error instanceof RoleManagementError
              ? error.message
              : 'Não foi possível concluir a moderação do chat.',
        },
        {
          status: error instanceof RoleManagementError ? error.status : 500,
          headers: { 'Cache-Control': 'no-store' },
        },
      )
    }
  }
}

async function forwardGame(req: PayloadRequest, path: string, method: 'GET' | 'DELETE' = 'GET') {
  const base = process.env.GAME_INTERNAL_URL || `http://localhost:${process.env.GAME_PORT || 3002}`
  const token = parseCookies(req.headers).get(`${req.payload.config.cookiePrefix}-token`)
  const authorization = req.headers.get('authorization') || (token ? `JWT ${token}` : '')
  const response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    method,
    headers: { authorization },
    signal: AbortSignal.timeout(7000),
    redirect: 'error',
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new RoleManagementError(
      [401, 403, 404].includes(response.status) ? response.status : 503,
      typeof data.error === 'string'
        ? data.error
        : 'O servidor do jogo não respondeu à moderação.',
    )
  }
  return data
}

function roomId(req: PayloadRequest) {
  const value = req.routeParams?.roomId
  if (typeof value !== 'string' || !value) throw new RoleManagementError(400, 'Sala inválida.')
  return encodeURIComponent(value)
}

function messageId(req: PayloadRequest) {
  const value = req.routeParams?.messageId
  if (typeof value !== 'string' || !value) throw new RoleManagementError(400, 'Mensagem inválida.')
  return encodeURIComponent(value)
}

export const chatModerationEndpoints: Endpoint[] = [
  {
    path: '/game-chat/rooms',
    method: 'get',
    handler: handler(async (req) => forwardGame(req, '/api/admin/rooms')),
  },
  {
    path: '/game-chat/rooms/:roomId',
    method: 'get',
    handler: handler(async (req) => forwardGame(req, `/api/admin/rooms/${roomId(req)}/chat`)),
  },
  {
    path: '/game-chat/rooms/:roomId/messages',
    method: 'delete',
    handler: handler(async (req) =>
      forwardGame(req, `/api/admin/rooms/${roomId(req)}/chat`, 'DELETE'),
    ),
  },
  {
    path: '/game-chat/rooms/:roomId/messages/:messageId',
    method: 'delete',
    handler: handler(async (req) =>
      forwardGame(req, `/api/admin/rooms/${roomId(req)}/chat/${messageId(req)}`, 'DELETE'),
    ),
  },
]
