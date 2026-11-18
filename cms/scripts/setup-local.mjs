import { randomBytes } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envPath = path.join(root, '.env')
const examplePath = path.join(root, '.env.example')

await mkdir(path.join(root, 'data'), { recursive: true })

async function fileExists(target) {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

function withGeneratedSecret(content) {
  const secret = randomBytes(32).toString('hex')
  if (/^PAYLOAD_SECRET=\s*$/m.test(content)) {
    return content.replace(/^PAYLOAD_SECRET=.*$/m, `PAYLOAD_SECRET=${secret}`)
  }
  if (!/^PAYLOAD_SECRET=/m.test(content)) {
    return `PAYLOAD_SECRET=${secret}\n${content}`
  }
  return content
}

function mergeMissingKeys(existing, template) {
  const missing = []
  for (const line of template.split('\n')) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/)
    if (!match) continue
    const key = match[1]
    if (key === 'PAYLOAD_SECRET') continue
    if (new RegExp(`^${key}=`, 'm').test(existing)) continue
    missing.push(line)
  }
  if (!missing.length) return existing
  return `${existing.trimEnd()}\n${missing.join('\n')}\n`
}

if (!(await fileExists(envPath))) {
  const template = await readFile(examplePath, 'utf8')
  await writeFile(envPath, withGeneratedSecret(template), { mode: 0o600 })
  console.log('cms/.env criado a partir de cms/.env.example com segredo local. Nenhuma chave foi exibida.')
} else {
  let existing = await readFile(envPath, 'utf8')
  const legacyURL = existing.match(/^CMS_SERVER_URL=(.*)$/m)?.[1]
  if (legacyURL) {
    try {
      const url = new URL(legacyURL.replace(/^['"]|['"]$/g, ''))
      if (['localhost', '127.0.0.1'].includes(url.hostname)) {
        existing = existing.replace(/^CMS_SERVER_URL=.*\n?/m, '')
        console.log('Endereço local antigo removido de cms/.env; agora deriva CMS_PORT da raiz.')
      }
    } catch { /* Preservar valores remotos ou inválidos. */ }
  }
  const template = await readFile(examplePath, 'utf8')
  const merged = mergeMissingKeys(existing, template)
  if (merged !== existing) {
    await writeFile(envPath, merged, { mode: 0o600 })
    console.log('cms/.env atualizado com chaves novas de cms/.env.example.')
  } else {
    console.log('cms/.env existente preservado.')
  }
}
