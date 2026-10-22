import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Rules } from '../domain/types.ts'
import { HttpError, fail } from '../domain/validation.ts'
import { GameStore } from '../persistence/game-store.ts'
import { AuthService, publicUser } from '../auth/auth-service.ts'
import { WalletService } from '../economy/wallet-service.ts'
import { TowerService } from '../towers/tower-service.ts'
import { GovernanceService } from '../governance/governance-service.ts'
import { SimulationCoordinator } from '../runtime/simulation-coordinator.ts'
import { json, readBody } from './http-helpers.ts'

type Dependencies = {
  store: GameStore
  rules: Readonly<Rules>
  auth: AuthService
  wallet: WalletService
  towers: TowerService
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
    const { store, rules, auth, wallet, towers, governance, runtime, origins } =
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
      const path = new URL(req.url ?? '/', 'http://localhost').pathname
        .split('/')
        .filter(Boolean)
      if (path[0] !== 'api') fail(404, 'Não encontrado.')
      if (req.method === 'GET' && path[1] === 'health' && path.length === 2)
        return json(res, 200, { ok: true })
      if (req.method === 'GET' && path[1] === 'rules' && path.length === 2)
        return json(res, 200, { rules })
      const body = req.method === 'POST' ? await readBody(req) : {}
      if (
        req.method === 'POST' &&
        ['register', 'login'].includes(path[1]) &&
        path.length === 2
      ) {
        auth.rateLimit(req.socket.remoteAddress ?? 'unknown')
        const result = auth.login(body, path[1] === 'register')
        return json(res, path[1] === 'register' ? 201 : 200, result)
      }
      if (req.method === 'GET' && path[1] === 'me' && path.length === 2)
        return json(
          res,
          200,
          store.atomic(() => {
            const user = auth.authenticate(req.headers.authorization)
            return { user: publicUser(user), wallet: wallet.read(user) }
          }),
        )
      if (req.method === 'POST' && path[1] === 'logout' && path.length === 2) {
        auth.logout(req.headers.authorization)
        return json(res, 200, { ok: true })
      }
      if (path[1] !== 'towers') fail(404, 'Não encontrado.')
      if (req.method === 'GET' && path.length === 2)
        return json(res, 200, {
          towers: Object.values(store.state.towers).map((tower) =>
            towers.publicTower(tower),
          ),
        })
      if (req.method === 'POST' && path.length === 2)
        return json(
          res,
          201,
          store.atomic(() =>
            towers.create(auth.authenticate(req.headers.authorization), body),
          ),
        )
      const tower = store.state.towers[path[2]]
      if (!tower) fail(404, 'Torre não encontrada.')
      if (req.method === 'DELETE' && path.length === 3) {
        store.atomic(() => {
          const user = auth.authenticate(req.headers.authorization)
          if (tower.creatorId !== user.id)
            fail(403, 'Somente quem criou a torre pode excluí-la.')
          runtime.remove(tower.id)
          delete store.state.towers[tower.id]
        })
        return json(res, 200, { ok: true })
      }
      if (req.method === 'GET' && path.length === 3) {
        store.atomic(() => governance.finishVoting(tower))
        return json(res, 200, towers.detail(tower))
      }
      if (req.method === 'GET' && path[3] === 'events' && path.length === 4) {
        runtime.subscribe(tower, res)
        return
      }
      if (req.method !== 'POST') fail(404, 'Não encontrado.')
      const result = store.atomic(() => {
        const user = auth.authenticate(req.headers.authorization)
        governance.finishVoting(tower)
        const participant = towers.member(tower, user)
        if (participant.banned) fail(403, 'Você foi banido desta torre.')
        if (path[3] === 'settings' && path.length === 4)
          return towers.settings(tower, user, body)
        if (path[3] === 'blocks' && path.length === 4)
          return towers.place(tower, user, participant, body)
        if (
          path[3] === 'members' &&
          path[5] === 'eligibility' &&
          path.length === 6
        )
          return towers.eligibility(tower, user, path[4], body)
        if (path[3] !== 'proposals') fail(404, 'Não encontrado.')
        if (path.length === 4)
          return governance.propose(tower, user, participant, body)
        const proposal = tower.proposals.find((item) => item.id === path[4])
        if (!proposal) fail(404, 'Proposta não encontrada.')
        if (proposal.status !== 'pending') fail(409, 'Proposta encerrada.')
        if (path[5] === 'vote' && path.length === 6)
          return governance.vote(tower, user, proposal, body)
        if (path[5] === 'decide' && path.length === 6)
          return governance.decide(tower, user, proposal, body)
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
