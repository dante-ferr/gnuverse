import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const filename = path.join(root, '.env.local')
const template = (await readFile(path.join(root, '.env.example'), 'utf8'))
  .replace('CMS_CONTENT_MODE=demo', 'CMS_CONTENT_MODE=live')
try {
  await writeFile(filename, template, { flag: 'wx', mode: 0o600 })
  console.log('.env.local preparado para ler o CMS local.')
} catch (error) {
  if (error.code !== 'EEXIST') throw error
  let existing = await readFile(filename, 'utf8')
  if (!/^CMS_PORT=/m.test(existing)) {
    let port = template.match(/^CMS_PORT=(.*)$/m)[1]
    const legacyURL = existing.match(/^CMS_URL=(.*)$/m)?.[1]
    if (legacyURL) {
      try {
        const url = new URL(legacyURL.replace(/^['"]|['"]$/g, ''))
        if (['localhost', '127.0.0.1'].includes(url.hostname)) {
          port = url.port || port
          existing = existing.replace(/^CMS_URL=.*$/m, 'CMS_URL=')
        }
      } catch { /* Preservar configurações remotas ou inválidas para revisão do usuário. */ }
    }
    await writeFile(filename, `${existing.trimEnd()}\nCMS_PORT=${port}\n`, { mode: 0o600 })
    console.log('.env.local migrado para CMS_PORT; outras configurações preservadas.')
  } else {
    console.log('.env.local existente preservado.')
  }
}
