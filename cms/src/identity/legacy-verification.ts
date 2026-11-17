import type { Payload } from 'payload'
import { emailVerificationEnabled } from '../email/settings'

type StoredUser = { id: number | string; _verified?: boolean | null }

/**
 * Login accepts a null verification flag, then the JWT strategy rejects the token
 * because it only keeps a truthy `_verified`. Accounts created before verification
 * was enabled are stored that way, so a correct password looks like an expired session.
 */
export async function markLegacyAccountsVerified(payload: Payload) {
  if (!emailVerificationEnabled) return
  const found = await payload.db.find<StoredUser>({
    collection: 'users',
    limit: 0,
    pagination: false,
  })
  for (const user of found.docs) {
    if (user._verified != null) continue
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { _verified: true },
      overrideAccess: true,
      depth: 0,
    })
  }
}
