import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Rules } from '../domain/types.ts'
import { HttpError, fail } from '../domain/validation.ts'
import { GameStore } from '../persistence/game-store.ts'
import { AuthService, publicUser } from '../auth/auth-service.ts'
import { WalletService } from '../economy/wallet-service.ts'
import { RoomService } from '../rooms/room-service.ts'
import { GovernanceService } from '../governance/governance-service.ts'
import { SimulationCoordinator } from '../runtime/simulation-coordinator.ts'
import { json, readBody } from './http-helpers.ts'
import { can, canManageRoom } from '../../core/authz/policy.ts'
import { isPipelineFrame } from '../pipeline/world/frame.ts'
import { verifyCMSAdministrator } from '../auth/cms-administrator.ts'

type Dependencies = {
  store: GameStore
  rules: Readonly<Rules>
  auth: AuthService
  wallet: WalletService
  rooms: RoomService
  governance: GovernanceService
  runtime: SimulationCoordinator
  origins: string[]
}

/** Maps HTTP requests to domain operations; mutations run in one store transaction. */
export class HttpApplication {
  private services: Dependencies
  constructor(services: Dependencies) {
    this.services = services
  }

  async handle(req: IncomingMessage, res: ServerResponse) {
    const { store, rules, auth, wallet, rooms, governance, runtime, origins } =
      this.services
    try {
      const origin = req.headers.origin
      if (origin && !origins.includes(origin))
        fail(403, 'Origem não permitida.')
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Vary', 'Origin')
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Max-Age': '600',
        })
        res.end()
        return
      }
      const requestUrl = new URL(req.url ?? '/', 'http://localhost')
      const path = requestUrl.pathname
        .split('/')
        .filter(Boolean)
      if (path[0] !== 'api') fail(404, 'Não encontrado.')
      if (req.method === 'GET' && path[1] === 'health' && path.length === 2)
        return json(res, 200, { ok: true })
      if (req.method === 'GET' && path[1] === 'rules' && path.length === 2)
        return json(res, 200, { rules })
      if (req.method === 'GET' && path[1] === 'admin' && path[2] === 'accounts' && path.length === 3) {
        await verifyCMSAdministrator({ cookie: req.headers.cookie, authorization: req.headers.authorization })
        return json(res, 200, { accounts: Object.values(store.state.users).map((user) => ({
          provider: 'game', id: user.id, name: user.nickname, email: user.email,
          cmsUserId: user.identity?.provider === 'cms' ? user.identity.id : undefined,
        })) })
      }
      const body = req.method === 'POST' ? await readBody(req) : {}
      if (
        req.method === 'POST' &&
        ['register', 'login'].includes(path[1]) &&
        path.length === 2
      ) {
        auth.rateLimit(req.socket.remoteAddress ?? 'unknown')
        const result = await auth.login(body, path[1] === 'register')
        return json(res, path[1] === 'register' ? 201 : 200, result)
      }
      if (req.method === 'POST' && path[1] === 'forgot-password' && path.length === 2) {
        auth.rateLimit(req.socket.remoteAddress ?? 'unknown')
        return json(res, 200, await auth.forgotPassword(body))
      }
      if (req.method === 'POST' && path[1] === 'reset-password' && path.length === 2) {
        auth.rateLimit(req.socket.remoteAddress ?? 'unknown')
        return json(res, 200, await auth.resetPassword(body))
      }
      if (req.method === 'POST' && path[1] === 'verify-email' && path.length === 3) {
        auth.rateLimit(req.socket.remoteAddress ?? 'unknown')
        return json(res, 200, await auth.verifyEmail(path[2]))
      }
      if (req.method === 'GET' && path[1] === 'me' && path.length === 2) {
        const user = await auth.authenticate(req.headers.authorization)
        return json(
          res,
          200,
          store.atomic(() => {
            return { user: publicUser(user), wallet: wallet.read(user) }
          }),
        )
      }
      if (req.method === 'POST' && path[1] === 'logout' && path.length === 2) {
        await auth.logout(req.headers.authorization)
        return json(res, 200, { ok: true })
      }
      if (path[1] !== 'towers') fail(404, 'Não encontrado.')
      if (req.method === 'GET' && path.length === 2) {
        const pageSize = Math.min(
          50,
          Math.max(1, Math.floor(Number(requestUrl.searchParams.get('limit')) || 12)),
        )
        const params = requestUrl.searchParams
        const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')
        const search = normalize((params.get('search') ?? '').trim())
        const cost = params.get('cost') ?? 'all'
        const sort = params.get('sort') ?? 'oldest'
        if (!['all', 'free', 'paid'].includes(cost)) fail(400, 'Filtro de custo inválido.')
        if (!['oldest', 'name', 'cost-asc', 'cost-desc', 'belts-desc'].includes(sort))
          fail(400, 'Ordenação inválida.')
        const creatorId = params.get('mine') === 'true'
          ? (await auth.authenticate(req.headers.authorization)).id : null
        const available = Object.values(store.state.rooms).filter((room) =>
          isPipelineFrame(room.frame) &&
          (!search || normalize(room.name).includes(search)) &&
          (cost === 'all' || (cost === 'free' ? room.cost === 0 : room.cost > 0)) &&
          (!creatorId || room.creatorId === creatorId),
        )
        available.sort((a, b) => {
          if (sort === 'name') return a.name.localeCompare(b.name, 'pt-BR')
          if (sort === 'cost-asc') return a.cost - b.cost
          if (sort === 'cost-desc') return b.cost - a.cost
          if (sort === 'belts-desc')
            return b.frame.belts.length - a.frame.belts.length
          return 0
        })
        const total = available.length
        const page = Math.min(
          Math.max(1, Math.ceil(total / pageSize)),
          Math.max(1, Math.floor(Number(params.get('page')) || 1)),
        )
        const start = (page - 1) * pageSize
        return json(res, 200, {
          filtersApplied: true,
          rooms: available.slice(start, start + pageSize).map((room) => rooms.publicRoom(room)),
          page,
          pageSize,
          total,
          pageCount: Math.ceil(total / pageSize),
        })
      }
      if (req.method === 'POST' && path.length === 2) {
        const user = await auth.authenticate(req.headers.authorization)
        return json(
          res,
          201,
          store.atomic(() =>
            rooms.create(user, body),
          ),
        )
      }
      const room = store.state.rooms[path[2]]
      if (!room) fail(404, 'Sala não encontrada.')
      if (req.method === 'DELETE' && path.length === 3) {
        const user = await auth.authenticate(req.headers.authorization)
        store.atomic(() => {
          const room = store.state.rooms[path[2]]
          if (!room) fail(404, 'Sala não encontrada.')
          if (!canManageRoom({ id: user.id, roles: user.roles ?? [] }, 'delete', room.creatorId))
            fail(403, 'Somente quem criou a sala pode excluí-la.')
          runtime.remove(room.id)
          delete store.state.rooms[room.id]
        })
        return json(res, 200, { ok: true })
      }
      if (req.method === 'GET' && path[3] === 'status' && path.length === 4) {
        const user = await auth.authenticate(req.headers.authorization)
        return json(
          res,
          200,
          store.atomic(() => rooms.statusPayload(room, user)),
        )
      }
      if (req.method === 'GET' && path.length === 3) {
        store.atomic(() => governance.expireBans(room))
        return json(res, 200, rooms.detail(room))
      }
      if (req.method === 'GET' && path[3] === 'events' && path.length === 4) {
        runtime.subscribe(room, res)
        return
      }
      if (req.method !== 'POST') fail(404, 'Não encontrado.')
      const user = await auth.authenticate(req.headers.authorization)
      const result = store.atomic(() => {
        const room = store.state.rooms[path[2]]
        if (!room) fail(404, 'Sala não encontrada.')
        governance.expireBans(room)
        const actor = { id: user.id, roles: user.roles ?? [] }
        // Administrative actions do not depend on room membership or local governance.
        if (path[3] === 'settings' && path.length === 4 && can(actor, 'room:update:any')) {
          rooms.member(room, user)
          return rooms.settings(room, user, body)
        }
        if (path[3] === 'advance' && path.length === 4) return rooms.advance(room, user)
        const participant = rooms.member(room, user)
        if (participant.banned) fail(403, 'Você foi banido desta sala.')
        if (path[3] === 'settings' && path.length === 4)
          return rooms.settings(room, user, body)
        const pipelineActions = ['place', 'remove', 'join', 'chat'] as const
        if (
          pipelineActions.includes(path[3] as (typeof pipelineActions)[number]) &&
          path.length === 4
        ) {
          if (path[3] === 'place') return rooms.place(room, user, participant, body)
          if (path[3] === 'remove') return rooms.removeBelt(room, user, participant, body)
          if (path[3] === 'chat') return rooms.chat(room, user, participant, body)
          return rooms.join(room, user)
        }
        if (
          path[3] === 'members' &&
          path[5] === 'eligibility' &&
          path.length === 6
        )
          return rooms.eligibility(room, user, path[4], body)
        if (path[3] !== 'proposals') fail(404, 'Não encontrado.')
        if (path.length === 4)
          return governance.propose(room, user, participant, body)
        const proposal = room.proposals.find((item) => item.id === path[4])
        if (!proposal) fail(404, 'Proposta não encontrada.')
        if (proposal.status !== 'pending') fail(409, 'Proposta encerrada.')
        if (path[5] === 'decide' && path.length === 6)
          return governance.decide(room, user, proposal, body)
        fail(404, 'Não encontrado.')
      })
      json(res, 200, result)
    } catch (error) {
      if (!(error instanceof HttpError))
        console.error('Game request failed:', error)
      if (!res.headersSent)
        json(res, error instanceof HttpError ? error.status : 500, {
          error:
            error instanceof HttpError
              ? error.message
              : 'Erro interno do servidor.',
        })
      else res.end()
    }
  }
}