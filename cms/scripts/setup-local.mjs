import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
await mkdir(path.join(root, 'data'), { recursive: true })
try {
  await writeFile(path.join(root, '.env'), [
    `PAYLOAD_SECRET=${randomBytes(32).toString('hex')}`,
    'CMS_SERVER_URL=http://localhost:3001',
    'DATABASE_ADAPTER=sqlite',
    'DATABASE_URL=file:./data/gnuverse.db',
    'STORAGE_ADAPTER=local',
    '',
  ].join('\n'), { flag: 'wx', mode: 0o600 })
  console.log('cms/.env criado com segredo local. Nenhuma chave foi exibida.')
} catch (error) {
  if (error.code !== 'EEXIST') throw error
  console.log('cms/.env existente preservado.')
}
