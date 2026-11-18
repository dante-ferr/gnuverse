import type { Payload } from 'payload'
import { emailVerificationEnabled } from '../email/settings'
import { isUsernameIdentifier, normalizeUsername } from './username'

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Configure ${name} no ambiente do CMS.`)
  return value
}

/**
 * When the users collection is empty, create the host administrator from
 * HOST_ADMIN_* environment variables. Payload's first-user UI is not used.
 */
export async function ensureHostAdmin(payload: Payload) {
  const existing = await payload.count({ collection: 'users', overrideAccess: true })
  if (existing.totalDocs > 0) return

  const email = requiredEnv('HOST_ADMIN_EMAIL').toLowerCase()
  const password = requiredEnv('HOST_ADMIN_PASSWORD')
  const name = process.env.HOST_ADMIN_NAME?.trim() || 'Administrador'
  const configuredUsername = process.env.HOST_ADMIN_USERNAME?.trim()
  const username = normalizeUsername(configuredUsername || 'Admin')

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('HOST_ADMIN_EMAIL precisa ser um e-mail válido.')
  }
  if (password.length < 1 || password.length > 128) {
    throw new Error('HOST_ADMIN_PASSWORD precisa ter entre 1 e 128 caracteres.')
  }
  if (!isUsernameIdentifier(username)) {
    throw new Error('HOST_ADMIN_USERNAME precisa ter de 3 a 32 letras, números, _ ou -.')
  }

  await payload.create({
    collection: 'users',
    overrideAccess: true,
    disableVerificationEmail: true,
    data: {
      name,
      username,
      email,
      password,
      role: 'admin',
      ...(emailVerificationEnabled ? { _verified: true } : {}),
    },
  })
  payload.logger.info(`Conta administradora inicial criada a partir de HOST_ADMIN_EMAIL (${email}, apelido ${username}).`)
}
