import { createGameServer } from './server.ts'
import { resolveGameHost, resolveGamePort } from './config/runtime-env.ts'

const game = createGameServer()
const port = resolveGamePort()
const host = resolveGameHost()
await game.listen(port, host)
console.log(`GNUverse game listening on http://${host}:${port}`)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => game.close().then(() => process.exit(0)))
