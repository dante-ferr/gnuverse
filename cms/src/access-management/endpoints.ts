import { randomUUID } from 'node:crypto'
import type { Endpoint, PayloadRequest } from 'payload'
import { parseCookies } from 'payload/shared'
import { can } from '../../../core/authz/policy.ts'
import type { RoleEntry } from '../../../core/authz/file-role-store.ts'
import { readRoleRegistry, RoleManagementError, updateRoleRegistry } from '../../../core/authz/manage-role-store.ts'
import { cmsActor } from '../access'

export type AccountOption = { provider: 'cms' | 'game'; id: string; name: string; email: string; cmsUserId?: string }
function requireAdministrator(req: PayloadRequest) {
  if (!req.user) throw new RoleManagementError(401, 'Entre no painel administrativo.')
  if (!can(cmsActor(req.user), 'roles:manage')) throw new RoleManagementError(403, 'Apenas administradores podem gerenciar os acessos.')
}
function saveRegistry(req: PayloadRequest, revision: string, change: (entries: RoleEntry[], enabled: boolean) => RoleEntry[]) {
  return updateRoleRegistry(revision, (entries, enabled) => {
    requireAdministrator(req)
    const next = change(entries, enabled)
    if (!next.some((entry) => Array.isArray(entry.roles) && entry.roles.includes('admin') &&
        Array.isArray(entry.identities) && entry.identities.some((identity) => identity?.provider === 'cms')))
      throw new RoleManagementError(409, 'Mantenha pelo menos um administrador com uma conta vinculada ao painel.')
    return next
  })
}
function endpoint(handler: (req: PayloadRequest) => Promise<unknown>): Endpoint['handler'] {
  return async (req) => {
    try {
      requireAdministrator(req)
      return Response.json(await handler(req), { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      if (!(error instanceof RoleManagementError)) req.payload.logger.error({ err: error }, 'Falha na gestão de acessos')
      return Response.json({ error: error instanceof RoleManagementError ? error.message : 'Não foi possível carregar ou salvar os acessos. Tente novamente.' }, {
        status: error instanceof RoleManagementError ? error.status : 500,
        headers: { 'Cache-Control': 'no-store' },
      })
    }
  }
}

async function cmsAccounts(req: PayloadRequest) {
  const users = []
  let page = 1
  for (;;) {
    const result = await req.payload.find({ collection: 'users', req, overrideAccess: false, limit: 100, page, sort: 'name' })
    users.push(...result.docs)
    if (!result.hasNextPage) return users
    page++
  }
}

async function gameAccounts(req: PayloadRequest): Promise<AccountOption[]> {
  const base = process.env.GAME_INTERNAL_URL || `http://localhost:${process.env.GAME_PORT || 3002}`
  const token = parseCookies(req.headers).get(`${req.payload.config.cookiePrefix}-token`)
  const authorization = req.headers.get('authorization') || (token ? `JWT ${token}` : '')
  const response = await fetch(`${base.replace(/\/$/, '')}/api/admin/accounts`, {
    headers: { authorization },
    signal: AbortSignal.timeout(7000), redirect: 'error', cache: 'no-store',
  })
  if (!response.ok) throw new RoleManagementError(503, 'As contas do jogo estão indisponíveis. Você pode editar os papéis e vínculos já existentes.')
  return (await response.json()).accounts
}

export const accessManagementEndpoints: Endpoint[] = [
  { path: '/access-management/verify', method: 'get', handler: endpoint(async () => ({ allowed: true })) },
  { path: '/access-management', method: 'get', handler: endpoint(async () => readRoleRegistry()) },
  { path: '/access-management/accounts', method: 'get', handler: endpoint(async (req) => {
    const users = await cmsAccounts(req)
    let games: AccountOption[] = []
    let gameError: string | undefined
    try { games = await gameAccounts(req) }
    catch { gameError = 'As contas do jogo estão indisponíveis. Tente recarregar a lista. Vínculos existentes podem ser mantidos e seus papéis podem ser alterados.' }
    return { accounts: [...users.map((user): AccountOption => ({ provider: 'cms', id: String(user.id), name: user.name, email: user.email })), ...games], gameError }
  }) },
  { path: '/access-management', method: 'post', handler: endpoint(async (req) => {
    const origin = req.headers.get('origin')
    if (req.headers.get('sec-fetch-site') === 'cross-site' ||
        (origin && origin !== new URL(req.url!).origin && origin !== req.payload.config.serverURL))
      throw new RoleManagementError(403, 'Origem não permitida.')
    if (!req.headers.get('content-type')?.startsWith('application/json')) throw new RoleManagementError(415, 'Envie JSON.')
    const source = await req.text!()
    if (source.length > 65_536) throw new RoleManagementError(413, 'Pedido muito grande.')
    let body: Record<string, unknown>
    try {
      body = JSON.parse(source)
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error()
    } catch { throw new RoleManagementError(400, 'Pedido inválido.') }
    if (typeof body.revision !== 'string') throw new RoleManagementError(400, 'Recarregue a lista antes de salvar.')
    if (body.action === 'initialize') {
      const users = await cmsAccounts(req)
      return saveRegistry(req, body.revision, (_, enabled) => {
        if (enabled) throw new RoleManagementError(409, 'A gestão compartilhada já está ativa.')
        return users.map((user) => ({ id: randomUUID(), name: user.name,
          roles: user.role === 'admin' ? ['admin'] : user.role === 'editor' ? ['blog-editor'] : ['member'],
          identities: [{ provider: 'cms', id: String(user.id) }],
        }))
      })
    }
    if (body.action === 'delete' && typeof body.id === 'string') {
      return saveRegistry(req, body.revision, (entries) => {
        if (!entries.some((entry) => entry.id === body.id)) throw new RoleManagementError(404, 'Pessoa não encontrada.')
        return entries.filter((entry) => entry.id !== body.id)
      })
    }
    if (body.action !== 'save' || !body.entry || typeof body.entry !== 'object') throw new RoleManagementError(400, 'Pedido inválido.')
    const input = body.entry as Record<string, unknown>
    const existing = readRoleRegistry().entries.find((entry) => entry.id === input.id)
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 120 ||
        !Array.isArray(input.roles) || !Array.isArray(input.identities) || !input.identities.length)
      throw new RoleManagementError(400, 'Informe o nome, os papéis e pelo menos uma conta.')
    const users = await cmsAccounts(req)
    let games: AccountOption[] | undefined
    for (const identity of input.identities) {
      if (!identity || typeof identity.id !== 'string' || !['cms', 'game'].includes(identity.provider))
        throw new RoleManagementError(400, 'Selecione uma conta válida.')
      if (existing?.identities.some((item) => item.provider === identity.provider && item.id === identity.id)) continue
      if (identity.provider === 'cms' && !users.some((user) => String(user.id) === identity.id))
        throw new RoleManagementError(400, 'A conta selecionada não existe no painel.')
      if (identity.provider === 'game') {
        games ??= await gameAccounts(req)
        const profile = games.find((game) => game.id === identity.id)
        if (!profile) throw new RoleManagementError(400, 'A conta selecionada não existe no jogo.')
        if (profile.cmsUserId && !input.identities.some((item) => item.provider === 'cms' && item.id === profile.cmsUserId))
          throw new RoleManagementError(400, 'Este perfil usa uma conta única. Selecione também a conta correspondente do blog/painel.')
      }
    }
    const entry = { id: existing?.id ?? randomUUID(), name: input.name.trim(), roles: input.roles, identities: input.identities } as RoleEntry
    return saveRegistry(req, body.revision, (entries, enabled) => {
      if (!enabled) throw new RoleManagementError(409, 'Ative a gestão compartilhada antes de cadastrar pessoas.')
      return existing ? entries.map((item) => item.id === existing.id ? entry : item) : [...entries, entry]
    })
  }) },
]
