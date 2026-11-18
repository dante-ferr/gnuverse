import type { Endpoint, PayloadRequest } from 'payload'
import type { IdentityAccount } from '../../../core/authn/identity-provider.ts'
import { authorizationFilePath, FileRoleStore } from '../../../core/authz/file-role-store.ts'
import { existsSync } from 'node:fs'
import { cmsActor } from '../access'
import {
  confirmationEmailFailureMessage,
  isEmailDeliveryError,
} from '../email/delivery'
import {
  sendAccountVerificationEmail,
  VERIFICATION_SENT_MESSAGE,
} from '../email/registration-mail'
import { emailVerificationEnabled } from '../email/settings'
import {
  consumeRegistrationAttempt,
  registrationClientKey,
} from './registration-rate-limit'
import { isUsernameIdentifier, normalizeUsername } from './username'
import { confirmEmailVerificationToken } from './verify-email'

export function identityAccount(req: PayloadRequest): IdentityAccount {
  if (!req.user) throw new Error('Authentication required')
  const identity = { provider: 'cms', id: String(req.user.id) }
  const path = authorizationFilePath()
  const entry = (process.env.GNUVERSE_AUTHZ_FILE || existsSync(path)) ? new FileRoleStore(path).find(identity) : undefined
  // Game profiles still consume `nickname`; Payload stores the unique handle as `username`.
  const username = typeof req.user.username === 'string' ? req.user.username : null
  return {
    identity, email: req.user.email, name: req.user.name, nickname: username,
    roles: cmsActor(req.user)!.roles,
    linkedIdentities: entry && 'identities' in entry ? entry.identities as IdentityAccount['linkedIdentities'] : [],
  }
}

async function discardUnverifiedRegistration(req: PayloadRequest, email: string) {
  const found = await req.payload.find({
    collection: 'users', overrideAccess: true, showHiddenFields: true, req,
    where: { email: { equals: email } }, limit: 1,
  })
  const user = found.docs[0]
  if (!user || user._verified === true) return
  await req.payload.delete({ collection: 'users', id: user.id, overrideAccess: true, req })
}

export const identityEndpoints: Endpoint[] = [
  { path: '/identity/me', method: 'get', handler: async (req) => {
    if (!req.user) return Response.json({ error: 'Entre na sua conta.' }, { status: 401 })
    return Response.json({ account: identityAccount(req) }, { headers: { 'Cache-Control': 'no-store' } })
  } },
  { path: '/identity/verify-email', method: 'post', handler: async (req) => {
    if (!req.headers.get('content-type')?.startsWith('application/json')) {
      return Response.json({ error: 'Envie JSON.' }, { status: 415 })
    }
    const source = await req.text!()
    if (source.length > 4096) return Response.json({ error: 'Pedido muito grande.' }, { status: 413 })
    let body: Record<string, unknown>
    try { body = JSON.parse(source) } catch { return Response.json({ error: 'Pedido inválido.' }, { status: 400 }) }
    if (!body || typeof body !== 'object' || typeof body.token !== 'string') {
      return Response.json({ error: 'Link de verificação inválido.' }, { status: 400 })
    }
    const result = await confirmEmailVerificationToken(req.payload, body.token, req)
    return Response.json(
      { message: result.message, confirmed: result.confirmed },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  } },
  { path: '/identity/register', method: 'post', handler: async (req) => {
    if (!req.headers.get('content-type')?.startsWith('application/json')) return Response.json({ error: 'Envie JSON.' }, { status: 415 })
    const rate = consumeRegistrationAttempt(registrationClientKey(req.headers))
    if (!rate.ok) {
      return Response.json(
        { error: 'Muitas tentativas. Aguarde um minuto.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
      )
    }
    const source = await req.text!()
    if (source.length > 16384) return Response.json({ error: 'Pedido muito grande.' }, { status: 413 })
    let body: Record<string, unknown>
    try { body = JSON.parse(source) } catch { return Response.json({ error: 'Pedido inválido.' }, { status: 400 }) }
    if (!body || typeof body !== 'object' || typeof body.email !== 'string' ||
        body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) ||
        typeof body.password !== 'string' || body.password.length < 1 || body.password.length > 128 ||
        typeof body.nickname !== 'string' || !isUsernameIdentifier(body.nickname))
      return Response.json({ error: 'Confira o e-mail, o apelido e a senha.' }, { status: 400 })
    const email = body.email.toLowerCase()
    const username = normalizeUsername(body.nickname)
    // The initial administrator comes from HOST_ADMIN_* on CMS init, not from public signup.
    if (!(await req.payload.count({ collection: 'users', overrideAccess: true, req })).totalDocs)
      return Response.json({ error: 'O administrador precisa configurar o site antes do cadastro de participantes.' }, { status: 409 })
    const existing = await req.payload.find({ collection: 'users', overrideAccess: true, showHiddenFields: true, req,
      where: { or: [{ email: { equals: email } }, { username: { equals: username } }] }, limit: 1 })
    if (existing.totalDocs) {
      const account = existing.docs[0]
      // A failed SMTP send still inserts the user when SQLite transactions are off.
      // Retrying that address resends the confirmation instead of reporting a duplicate.
      if (emailVerificationEnabled && account.email.toLowerCase() === email && account._verified !== true) {
        try {
          await sendAccountVerificationEmail(req, account)
        } catch (error) {
          if (isEmailDeliveryError(error)) return Response.json({ error: confirmationEmailFailureMessage() }, { status: 503 })
          throw error
        }
        return Response.json({
          verificationRequired: true,
          message: VERIFICATION_SENT_MESSAGE,
        }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
      }
      return Response.json({ error: 'E-mail ou apelido já utilizado. Se você já tem uma conta no painel, use Entrar.' }, { status: 409 })
    }
    // Fixed fields prevent public callers from granting themselves editorial or admin rights.
    try {
      await req.payload.create({ collection: 'users', overrideAccess: true, req, context: { publicRegistration: true }, data: {
        name: body.nickname, username, email, password: body.password, role: 'member',
      } })
    } catch (error) {
      if (!isEmailDeliveryError(error)) throw error
      await discardUnverifiedRegistration(req, email)
      return Response.json({ error: confirmationEmailFailureMessage() }, { status: 503 })
    }
    if (emailVerificationEnabled) {
      return Response.json({
        verificationRequired: true,
        message: VERIFICATION_SENT_MESSAGE,
      }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
    }
    const result = await req.payload.login({ collection: 'users', req, data: { email, password: body.password } })
    return Response.json({ token: result.token }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } },
]
