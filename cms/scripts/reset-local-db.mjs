import { rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getLocalCMSURL, loadLocalEnvironment } from './local-config.mjs'

loadLocalEnvironment()

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
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
console.log(`Aplique o seed com: make cms-seed`)
console.log(`Ou inicie o CMS e abra ${getLocalCMSURL()}/admin para criar o primeiro administrador.`)
