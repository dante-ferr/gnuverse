import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
await mkdir(path.join(root, 'data'), { recursive: true })
try {
  await writeFile(path.join(root, '.env'), [
    `PAYLOAD_SECRET=${randomBytes(32).toString('hex')}`,
    'DATABASE_ADAPTER=sqlite',
    'DATABASE_URL=file:./data/gnuverse.db',
    'STORAGE_ADAPTER=local',
    '',
  ].join('\n'), { flag: 'wx', mode: 0o600 })
  console.log('cms/.env criado com segredo local. Nenhuma chave foi exibida.')
} catch (error) {
  if (error.code !== 'EEXIST') throw error
  const filename = path.join(root, '.env')
  const existing = await readFile(filename, 'utf8')
  const legacyURL = existing.match(/^CMS_SERVER_URL=(.*)$/m)?.[1]
  if (legacyURL) {
    try {
      const url = new URL(legacyURL.replace(/^['"]|['"]$/g, ''))
      if (['localhost', '127.0.0.1'].includes(url.hostname)) {
        await writeFile(filename, existing.replace(/^CMS_SERVER_URL=.*\n?/m, ''), { mode: 0o600 })
        console.log('Endereço local antigo removido de cms/.env; agora deriva CMS_PORT da raiz.')
      }
    } catch { /* Preservar valores remotos ou inválidos. */ }
  }
  console.log('cms/.env existente preservado.')
}
