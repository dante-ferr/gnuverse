import { randomBytes } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import type { User } from '../payload-types'
import { verificationEmailHTML } from './auth-messages'

export const VERIFICATION_SENT_MESSAGE =
  'Enviamos um e-mail de confirmação. Abra o link antes de entrar.'

/** Sends the existing verification token, creating one when a failed signup left it empty. */
export async function sendAccountVerificationEmail(req: PayloadRequest, user: User) {
  let token = typeof user._verificationToken === 'string' ? user._verificationToken : ''
  if (!token) {
    token = randomBytes(20).toString('hex')
    await req.payload.update({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
      req,
      data: { _verificationToken: token },
    })
  }
  await req.payload.sendEmail({
    to: user.email,
    subject: 'Confirme seu e-mail no GNUverse',
    html: verificationEmailHTML({ token, user: { email: user.email } }),
  })
}
