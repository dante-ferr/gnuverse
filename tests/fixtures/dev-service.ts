import { createServer } from 'node:http'
import { appendFileSync } from 'node:fs'

const command = process.argv[3]
const role =
  command === 'cms:dev' ? 'cms' : command === 'game:dev' ? 'game' : 'site'
const port = Number(
  process.env[
    role === 'cms' ? 'CMS_PORT' : role === 'game' ? 'GAME_PORT' : 'SITE_PORT'
  ],
)
const server = createServer((_request, response) => {
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(role === 'cms' ? { docs: [] } : { ok: true }))
})
server.listen(port, '127.0.0.1', () => {
  appendFileSync(
    process.env.DEV_TEST_LOG!,
    JSON.stringify({
      role,
      api: process.env.NEXT_PUBLIC_GAME_API_URL,
      origins: process.env.GAME_ALLOWED_ORIGINS,
    }) + '\n',
  )
})
process.on('SIGTERM', () => server.close(() => process.exit(0)))
