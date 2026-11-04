import { fail } from '../domain/validation.ts'

/** Verify CMS sessions at their issuer; neither cookies nor caller-supplied roles are trusted. */
export async function verifyCMSAdministrator(
  headers: { cookie?: string; authorization?: string },
  cmsURL = process.env.CMS_URL || `http://localhost:${process.env.CMS_PORT || 3001}`,
) {
  if (!headers.cookie && !headers.authorization) fail(401, 'Entre no painel administrativo.')
  let response: Response
  try {
    response = await fetch(`${cmsURL.replace(/\/$/, '')}/api/access-management/verify`, {
      headers: { ...(headers.cookie ? { cookie: headers.cookie } : {}), ...(headers.authorization ? { authorization: headers.authorization } : {}) },
      signal: AbortSignal.timeout(5000), cache: 'no-store', redirect: 'error',
    })
  } catch { fail(503, 'Não foi possível verificar a sessão no painel administrativo.') }
  if (response.status === 401) fail(401, 'Entre no painel administrativo.')
  if (response.status === 403) fail(403, 'Apenas administradores podem consultar as contas.')
  if (!response.ok || (await response.json()).allowed !== true)
    fail(503, 'O painel administrativo não confirmou a autorização.')
}
