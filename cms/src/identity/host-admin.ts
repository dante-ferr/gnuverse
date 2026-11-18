import type { Payload } from 'payload'
import { emailVerificationEnabled } from '../email/settings'
import {
  readHostAdminCredentials,
  type HostAdminCredentials,
} from './host-admin-credentials'

export type { HostAdminCredentials }
export { readHostAdminCredentials }

function hostAdminData(credentials: HostAdminCredentials) {
  return {
    name: credentials.name,
    username: credentials.username,
    email: credentials.email,
    password: credentials.password,
    role: 'admin' as const,
    ...(emailVerificationEnabled ? { _verified: true } : {}),
  }
}

/**
 * When the users collection is empty, create the host administrator from
 * HOST_ADMIN_* environment variables. Payload's first-user UI is not used.
 * Changing HOST_ADMIN_* after the first user exists does nothing — use
 * `npm run set-host-admin` (make cms-set-host-admin) to redefine credentials.
 */
export async function ensureHostAdmin(payload: Payload) {
  const existing = await payload.count({ collection: 'users', overrideAccess: true })
  if (existing.totalDocs > 0) return

  const credentials = readHostAdminCredentials()
  await payload.create({
    collection: 'users',
    overrideAccess: true,
    disableVerificationEmail: true,
    data: hostAdminData(credentials),
  })
  payload.logger.info(
    `Conta administradora inicial criada a partir de HOST_ADMIN_EMAIL (${credentials.email}, apelido ${credentials.username}).`,
  )
}

/**
 * Creates or updates the host administrator from HOST_ADMIN_*.
 * Match order: HOST_ADMIN_MATCH_EMAIL, then HOST_ADMIN_EMAIL, then the sole admin.
 */
export async function setHostAdminFromEnv(
  payload: Payload,
  env: Record<string, string | undefined> = process.env,
): Promise<{ action: 'created' | 'updated'; email: string; username: string }> {
  const credentials = readHostAdminCredentials(env)
  const matchEmail = (env.HOST_ADMIN_MATCH_EMAIL?.trim() || credentials.email).toLowerCase()

  const byMatch = await payload.find({
    collection: 'users',
    overrideAccess: true,
    where: { email: { equals: matchEmail } },
    limit: 1,
  })
  let target = byMatch.docs[0]

  if (!target) {
    const admins = await payload.find({
      collection: 'users',
      overrideAccess: true,
      where: { role: { equals: 'admin' } },
      limit: 2,
      sort: 'createdAt',
    })
    if (admins.docs.length === 1) target = admins.docs[0]
    else if (admins.docs.length > 1) {
      throw new Error(
        'Há vários administradores. Defina HOST_ADMIN_MATCH_EMAIL com o e-mail atual da conta a redefinir.',
      )
    }
  }

  if (!target) {
    await payload.create({
      collection: 'users',
      overrideAccess: true,
      disableVerificationEmail: true,
      data: hostAdminData(credentials),
    })
    return { action: 'created', email: credentials.email, username: credentials.username }
  }

  const usernameClash = await payload.find({
    collection: 'users',
    overrideAccess: true,
    where: {
      and: [
        { username: { equals: credentials.username } },
        { id: { not_equals: target.id } },
      ],
    },
    limit: 1,
  })
  if (usernameClash.totalDocs) {
    throw new Error(`O apelido ${credentials.username} já está em uso por outra conta.`)
  }

  const emailClash = await payload.find({
    collection: 'users',
    overrideAccess: true,
    where: {
      and: [
        { email: { equals: credentials.email } },
        { id: { not_equals: target.id } },
      ],
    },
    limit: 1,
  })
  if (emailClash.totalDocs) {
    throw new Error(`O e-mail ${credentials.email} já está em uso por outra conta.`)
  }

  await payload.update({
    collection: 'users',
    id: target.id,
    overrideAccess: true,
    data: hostAdminData(credentials),
  })
  return { action: 'updated', email: credentials.email, username: credentials.username }
}
