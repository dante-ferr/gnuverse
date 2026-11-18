import { mkdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'
import { getLocalCMSURL, loadLocalEnvironment } from './local-config.mjs'

const cmsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = path.resolve(cmsRoot, '..')

loadLocalEnvironment(projectRoot)
try {
  process.loadEnvFile(path.join(cmsRoot, '.env'))
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
}

if (!process.env.PAYLOAD_SECRET) {
  throw new Error('cms/.env sem PAYLOAD_SECRET. Execute make setup (cms:setup) antes do bootstrap.')
}

if (process.env.DATABASE_ADAPTER === 'postgres') {
  console.log('Bootstrap local do CMS ignorado (DATABASE_ADAPTER=postgres).')
  process.exit(0)
}

const dbUrl = process.env.DATABASE_URL || 'file:./data/gnuverse.db'
if (!dbUrl.startsWith('file:')) {
  throw new Error('Bootstrap local só aplica a bancos SQLite (DATABASE_URL file:…).')
}

const dbFile = path.resolve(cmsRoot, dbUrl.slice('file:'.length))
await mkdir(path.dirname(dbFile), { recursive: true })

async function needsBootstrap(): Promise<boolean> {
  try {
    const info = await stat(dbFile)
    return info.size === 0
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true
    throw error
  }
}

if (!(await needsBootstrap())) {
  console.log('Banco local do CMS já existe:', path.relative(projectRoot, dbFile))
  process.exit(0)
}

for (const suffix of ['', '-wal', '-shm', '-journal']) {
  await rm(`${dbFile}${suffix}`, { force: true })
}

process.env.SITE_DEPLOY_HOOK_URL ??= ''
process.env.CMS_SEEDING = '1'

const { default: configPromise } = await import('../src/payload.config')
const payload = await getPayload({ config: await configPromise })
try {
  const admins = await payload.count({
    collection: 'users',
    overrideAccess: true,
    where: { role: { equals: 'admin' } },
  })
  if (admins.totalDocs < 1) {
    throw new Error('Bootstrap do CMS falhou: nenhum administrador foi criado a partir de HOST_ADMIN_*.')
  }
  console.log('Banco local do CMS criado com a conta HOST_ADMIN_*:', path.relative(projectRoot, dbFile))
  console.log(`Entre em ${getLocalCMSURL()}/admin com as credenciais de cms/.env.`)
} finally {
  await Promise.race([
    payload.destroy(),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ])
}

// Demo users, covers, and articles are part of a usable local database.
const { spawn } = await import('node:child_process')
await new Promise<void>((resolve, reject) => {
  const child = spawn('npm', ['run', 'seed:demo'], {
    cwd: cmsRoot,
    stdio: 'inherit',
    env: process.env,
  })
  child.on('error', reject)
  child.on('exit', (code) => {
    if (code === 0) resolve()
    else reject(new Error(`seed:demo saiu com código ${code ?? 'null'}`))
  })
})
