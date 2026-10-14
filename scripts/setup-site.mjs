import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
try {
  await writeFile(path.join(root, '.env.local'), 'CMS_CONTENT_MODE=live\nCMS_URL=http://localhost:3001\n', {
    flag: 'wx', mode: 0o600,
  })
  console.log('.env.local preparado para ler o CMS local.')
} catch (error) {
  if (error.code !== 'EEXIST') throw error
  console.log('.env.local existente preservado.')
}
