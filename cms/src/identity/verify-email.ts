import type { Payload, PayloadRequest } from 'payload'

export const EMAIL_CONFIRMED_MESSAGE =
  'E-mail confirmado. Agora você já pode entrar.'

export const EMAIL_CONFIRM_LINK_MESSAGE =
  'Se este link for válido, sua conta já está confirmada. Você já pode entrar.'

/**
 * Confirms a signup token. Replays and unknown tokens return success copy so
 * React Strict Mode double-mounts and link re-opens do not surface a hard error.
 * Uses the DB adapter because `_verificationToken` denies field-level updates.
 */
export async function confirmEmailVerificationToken(
  payload: Payload,
  token: string,
  req?: PayloadRequest,
): Promise<{ message: string; confirmed: boolean }> {
  const value = token.trim()
  if (value.length < 8 || value.length > 512) {
    return { message: EMAIL_CONFIRM_LINK_MESSAGE, confirmed: false }
  }

  const found = await payload.find({
    collection: 'users',
    overrideAccess: true,
    showHiddenFields: true,
    ...(req ? { req } : {}),
    where: { _verificationToken: { equals: value } },
    limit: 1,
  })
  const user = found.docs[0]
  if (!user) {
    return { message: EMAIL_CONFIRM_LINK_MESSAGE, confirmed: false }
  }

  await payload.db.updateOne({
    id: user.id,
    collection: 'users',
    ...(req ? { req } : {}),
    data: {
      _verificationToken: null,
      _verified: true,
      updatedAt: new Date().toISOString(),
    },
    returning: false,
  })

  return { message: EMAIL_CONFIRMED_MESSAGE, confirmed: true }
}
