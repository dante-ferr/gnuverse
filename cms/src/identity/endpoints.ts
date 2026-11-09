import type { Endpoint, PayloadRequest } from 'payload'
import type { IdentityAccount } from '../../../core/authn/identity-provider.ts'
import { authorizationFilePath, FileRoleStore } from '../../../core/authz/file-role-store.ts'
import { existsSync } from 'node:fs'
import { cmsActor } from '../access'

export function identityAccount(req: PayloadRequest): IdentityAccount {
  if (!req.user) throw new Error('Authentication required')
  const identity = { provider: 'cms', id: String(req.user.id) }
  const path = authorizationFilePath()
  const entry = (process.env.GNUVERSE_AUTHZ_FILE || existsSync(path)) ? new FileRoleStore(path).find(identity) : undefined
  return {
    identity, email: req.user.email, name: req.user.name, nickname: req.user.nickname,
    roles: cmsActor(req.user)!.roles,
    linkedIdentities: entry && 'identities' in entry ? entry.identities as IdentityAccount['linkedIdentities'] : [],
  }
}

export const identityEndpoints: Endpoint[] = [
  { path: '/identity/me', method: 'get', handler: async (req) => {
    if (!req.user) return Response.json({ error: 'Entre na sua conta.' }, { status: 401 })
    return Response.json({ account: identityAccount(req) }, { headers: { 'Cache-Control': 'no-store' } })
  } },
  { path: '/identity/register', method: 'post', handler: async (req) => {
    if (!req.headers.get('content-type')?.startsWith('application/json')) return Response.json({ error: 'Envie JSON.' }, { status: 415 })
    const source = await req.text!()
    if (source.length > 16384) return Response.json({ error: 'Pedido muito grande.' }, { status: 413 })
    let body: Record<string, unknown>
    try { body = JSON.parse(source) } catch { return Response.json({ error: 'Pedido inválido.' }, { status: 400 }) }
    if (!body || typeof body !== 'object' || typeof body.email !== 'string' ||
        body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) ||
        typeof body.password !== 'string' || body.password.length < 1 || body.password.length > 128 ||
        typeof body.nickname !== 'string' || !/^[\p{L}\p{N}_-]{3,32}$/u.test(body.nickname))
      return Response.json({ error: 'Confira o e-mail, o apelido e a senha.' }, { status: 400 })
    const email = body.email.toLowerCase()
    const nickname = body.nickname.toLowerCase()
    // The initial administrator is created only through Payload's first-user flow.
    if (!(await req.payload.count({ collection: 'users', overrideAccess: true, req })).totalDocs)
      return Response.json({ error: 'O administrador precisa configurar o site antes do cadastro de participantes.' }, { status: 409 })
    const existing = await req.payload.find({ collection: 'users', overrideAccess: true, req,
      where: { or: [{ email: { equals: email } }, { nickname: { equals: nickname } }] }, limit: 1 })
    if (existing.totalDocs) return Response.json({ error: 'E-mail ou apelido já utilizado. Se você já tem uma conta no painel, use Entrar.' }, { status: 409 })
    // Fixed fields prevent public callers from granting themselves editorial or admin rights.
    await req.payload.create({ collection: 'users', overrideAccess: true, req, context: { publicRegistration: true }, data: {
      name: body.nickname, nickname, email, password: body.password, role: 'member',
    } })
    const result = await req.payload.login({ collection: 'users', req, data: { email, password: body.password } })
    return Response.json({ token: result.token }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } },
]
