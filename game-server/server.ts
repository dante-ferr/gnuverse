import { createServer } from 'node:http'
import { resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { ServerOptions } from './domain/types.ts'
import { createRules } from './runtime/rules.ts'
import { GameStore } from './persistence/game-store.ts'
import { WalletService } from './economy/wallet-service.ts'
import { AuthService } from './auth/auth-service.ts'
import { HistoryService } from './towers/history-service.ts'
import { TowerService } from './towers/tower-service.ts'
import { GovernanceService } from './governance/governance-service.ts'
import { SimulationCoordinator } from './runtime/simulation-coordinator.ts'
import { WindService } from './wind/wind-service.ts'
import { HttpApplication } from './transport/http-application.ts'

/** Composition root. Domain services own behavior; transport only maps requests. */
export function createGameServer(options: ServerOptions = {}) {
  const rules = createRules(options.rules)
  const now = options.now ?? Date.now
  const store = new GameStore(
    options.dbPath ??
      process.env.GAME_DB_PATH ??
      resolve('.content/game.sqlite'),
  )
  const runtime = new SimulationCoordinator(store, now)
  store.onRollback = () => runtime.rollback()
  const history = new HistoryService(now, (towerId) =>
    runtime.publishChange(towerId),
  )
  const wind = new WindService(rules, now, history)
  for (const tower of Object.values(store.state.towers)) {
    wind.initialize(tower)
    tower.blockIntervalMs ??= rules.cooldownMs
    tower.lastPlacementAt ??= null
    if (tower.checkpointEveryBlocks === undefined) {
      tower.checkpointEveryBlocks = 5
      tower.lastCheckpointPlacementCount = tower.placementCount
      tower.pendingSnapshot = false
    }
  }
  store.persist()
  const wallet = new WalletService(rules, now)
  const auth = new AuthService(store, rules, now, wallet)
  const towers = new TowerService(
    store,
    rules,
    now,
    wallet,
    runtime,
    history,
    wind,
  )
  const governance = new GovernanceService(rules, now, runtime, history)
  const origins =
    options.allowedOrigins ??
    (
      process.env.GAME_ALLOWED_ORIGINS ??
      'http://localhost:3000,http://127.0.0.1:3000'
    )
      .split(',')
      .map((value) => value.trim())
  const application = new HttpApplication({
    store,
    rules,
    auth,
    wallet,
    towers,
    governance,
    runtime,
    origins,
  })
  const server = createServer((request, response) => {
    void application.handle(request, response)
  })
  server.requestTimeout = 15000
  server.headersTimeout = 10000
  runtime.start(history, governance, wind)
  let closed = false
  return {
    server,
    rules,
    listen(port = 0, host = '127.0.0.1'): Promise<string> {
      return new Promise((resolveListen, reject) => {
        server.once('error', reject)
        server.listen(port, host, () => {
          server.off('error', reject)
          resolveListen(
            `http://${host}:${(server.address() as AddressInfo).port}`,
          )
        })
      })
    },
    async close() {
      if (closed) return
      closed = true
      runtime.close()
      store.persist()
      await new Promise<void>((resolveClose) => {
        if (!server.listening) return resolveClose()
        server.close(() => resolveClose())
        server.closeIdleConnections()
      })
      store.close()
    },
  }
}
