import { rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getLocalCMSURL, loadLocalEnvironment } from './local-config.mjs'

loadLocalEnvironment()

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const db = path.join(root, 'data', 'gnuverse.db')
for (const suffix of ['', '-wal', '-shm']) {
  await rm(`${db}${suffix}`, { force: true })
}
console.log('Banco local do CMS removido:', path.relative(process.cwd(), db))
console.log(`Inicie o CMS e abra ${getLocalCMSURL()}/admin para criar o primeiro administrador.`)