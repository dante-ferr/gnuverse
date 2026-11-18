import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'
import { setHostAdminFromEnv } from '../src/identity/host-admin.ts'
import { loadLocalEnvironment } from './local-config.mjs'

const cmsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = path.resolve(cmsRoot, '..')

if (process.env.NODE_ENV !== 'production') {
  loadLocalEnvironment(projectRoot)
  try {
    process.loadEnvFile(path.join(cmsRoot, '.env'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

if (!process.env.PAYLOAD_SECRET) {
  throw new Error('PAYLOAD_SECRET ausente. Defina as variáveis do CMS antes de redefinir o administrador.')
}

process.env.CMS_SEEDING ??= '1'

const { default: configPromise } = await import('../src/payload.config.ts')
const payload = await getPayload({ config: await configPromise })
try {
  const result = await setHostAdminFromEnv(payload)
  console.log(
    result.action === 'created'
      ? `Administrador criado: ${result.email} (apelido ${result.username}).`
      : `Administrador atualizado: ${result.email} (apelido ${result.username}).`,
  )
  console.log('Use essas credenciais em /admin. HOST_ADMIN_* no ambiente do servidor só cria a conta na primeira inicialização vazia.')
} finally {
  await Promise.race([
    payload.destroy(),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ])
}
