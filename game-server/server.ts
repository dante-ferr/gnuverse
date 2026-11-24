import { createServer } from 'node:http'
import { resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { ServerOptions } from './domain/types.ts'
import { createRules } from './runtime/rules.ts'
import { GameStore } from './persistence/game-store.ts'
import { WalletService } from './economy/wallet-service.ts'
import { AuthService } from './auth/auth-service.ts'
import { CMSIdentityProvider } from './auth/cms-identity-provider.ts'
import { HistoryService } from './rooms/history-service.ts'
import { RoomService } from './rooms/room-service.ts'
import { GovernanceService } from './governance/governance-service.ts'
import { SimulationCoordinator } from './runtime/simulation-coordinator.ts'
import { HttpApplication } from './transport/http-application.ts'
import {
  applyLoadedGameConfig,
  resolveGameConfigPath,
} from './config/load-game-config.ts'
import { resolveGameAllowedOrigins } from './config/runtime-env.ts'
import { watchGameConfig } from './config/watch-game-config.ts'

/** Composition root. Domain services own behavior; transport only maps requests. */
export function createGameServer(options: ServerOptions = {}) {
  const rules = createRules(options.rules)
  const now = options.now ?? Date.now
  const store =
    options.store ??
    new GameStore(
      options.dbPath ??
        process.env.GAME_DB_PATH ??
        resolve('.content/game.sqlite'),
    )
  const runtime = new SimulationCoordinator(store, rules.pipeline)
  store.onRollback = () => runtime.rollback()
  const history = new HistoryService(now, (roomId) =>
    runtime.publishChange(roomId),
  )
  for (const room of Object.values(store.state.rooms)) {
    room.beltCount ??= 0
    room.actionCount ??= 0
    room.chat ??= []
    delete (room as { restoreMode?: unknown }).restoreMode
    delete (room as { wind?: unknown }).wind
    delete (room as { placementCount?: unknown }).placementCount
  }
  store.persist()
  const wallet = new WalletService(rules, now)
  const auth = new AuthService(
    store,
    rules,
    now,
    wallet,
    options.identityProvider ?? new CMSIdentityProvider(),
  )
  const rooms = new RoomService(
    store,
    rules,
    now,
    wallet,
    runtime,
    history,
  )
  const governance = new GovernanceService(rules, now, runtime, history)
  const origins = options.allowedOrigins ?? resolveGameAllowedOrigins()
  const application = new HttpApplication({
    store,
    rules,
    auth,
    wallet,
    rooms,
    governance,
    runtime,
    origins,
  })
  const server = createServer((request, response) => {
    void application.handle(request, response)
  })
  server.requestTimeout = 120000
  server.headersTimeout = 10000
  runtime.start(governance)
  let stopWatching: (() => void) | undefined
  if (!options.rules) {
    const configPath = resolveGameConfigPath(process.env.GAME_CONFIG_PATH)
    stopWatching = watchGameConfig(configPath, (loaded) => {
      applyLoadedGameConfig(rules, loaded)
      runtime.setPipelineRules(rules.pipeline)
      runtime.publishAllChanges()
      console.log(`Pipeline rules reloaded from ${configPath}`)
    })
  }
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
      stopWatching?.()
      runtime.close()
      store.persist()
      await new Promise<void>((resolveClose) => {
        if (!server.listening) return resolveClose()
        server.close(() => resolveClose())
        server.closeIdleConnections()
      })
      await store.close()
    },
  }
}