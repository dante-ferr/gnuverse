import { createGameServer } from './server.ts'
import { GameStore } from './persistence/game-store.ts'
import {
  resolveGameDatabaseURL,
  resolveGameHost,
  resolveGamePort,
} from './config/runtime-env.ts'

const databaseUrl = resolveGameDatabaseURL()
const store = databaseUrl ? await GameStore.openPostgres(databaseUrl) : undefined
const game = createGameServer({ store })
const port = resolveGamePort()
const host = resolveGameHost()
await game.listen(port, host)
console.log(
  `GNUverse game listening on http://${host}:${port} (${databaseUrl ? 'postgres' : 'sqlite'})`,
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => game.close().then(() => process.exit(0)))
