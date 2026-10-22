import { createGameServer } from './server.ts'

const game = createGameServer()
const port = Number(process.env.GAME_PORT ?? 3002)
const host = process.env.GAME_HOST ?? '127.0.0.1'
await game.listen(port, host)
console.log(`GNUverse game listening on http://${host}:${port}`)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => game.close().then(() => process.exit(0)))
