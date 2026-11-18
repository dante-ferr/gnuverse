import { createConnection } from 'node:net'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getCMSPort, getLocalCMSURL, loadLocalEnvironment } from './local-config.mjs'

loadLocalEnvironment()

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
try {
  process.loadEnvFile(path.join(root, '.env'))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

const dbUrl = process.env.DATABASE_URL || 'file:./data/gnuverse.db'
if (!dbUrl.startsWith('file:')) {
  throw new Error('cms:reset-db só remove bancos SQLite locais (DATABASE_URL file:…).')
}

const db = path.resolve(root, dbUrl.slice('file:'.length))
for (const suffix of ['', '-wal', '-shm', '-journal']) {
  await rm(`${db}${suffix}`, { force: true })
}

const mediaDir = process.env.MEDIA_DIR
  ? path.resolve(process.env.MEDIA_DIR)
  : path.resolve(root, 'media')
await rm(mediaDir, { recursive: true, force: true })

console.log('Banco local do CMS removido:', path.relative(process.cwd(), db))
console.log('Mídia local removida:', path.relative(process.cwd(), mediaDir))

const port = Number(getCMSPort())
const cmsListening = await new Promise((resolve) => {
  const socket = createConnection({ host: '127.0.0.1', port }, () => {
    socket.end()
    resolve(true)
  })
  socket.on('error', () => resolve(false))
})
if (cmsListening) {
  console.log(`CMS ainda escuta em ${getLocalCMSURL()}. Pare e inicie de novo para soltar o arquivo do banco antigo.`)
}
console.log('Em seguida o seed local recria a conta HOST_ADMIN_* e os dados de demonstração.')
