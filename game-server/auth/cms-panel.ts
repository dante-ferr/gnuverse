import { fail } from '../domain/validation.ts'

type PanelHeaders = { cookie?: string; authorization?: string }

/** Verify a CMS panel session for a named access-management check. */
export async function verifyCMSPanel(
  headers: PanelHeaders,
  path: '/api/access-management/verify' | '/api/access-management/verify-chat-moderator',
  cmsURL = process.env.CMS_URL || `http://localhost:${process.env.CMS_PORT || 3001}`,
) {
  if (!headers.cookie && !headers.authorization) fail(401, 'Entre no painel administrativo.')
  let response: Response
  try {
    response = await fetch(`${cmsURL.replace(/\/$/, '')}${path}`, {
      headers: {
        ...(headers.cookie ? { cookie: headers.cookie } : {}),
        ...(headers.authorization ? { authorization: headers.authorization } : {}),
      },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
      redirect: 'error',
    })
  } catch {
    fail(503, 'Não foi possível verificar a sessão no painel administrativo.')
  }
  if (response.status === 401) fail(401, 'Entre no painel administrativo.')
  if (response.status === 403) {
    fail(
      403,
      path.endsWith('verify-chat-moderator')
        ? 'Apenas administradores e moderadores do jogo podem moderar o chat.'
        : 'Apenas administradores podem consultar as contas.',
    )
  }
  if (!response.ok || (await response.json()).allowed !== true)
    fail(503, 'O painel administrativo não confirmou a autorização.')
}

/** People and access directory — administrators only. */
export function verifyCMSAdministrator(headers: PanelHeaders, cmsURL?: string) {
  return verifyCMSPanel(headers, '/api/access-management/verify', cmsURL)
}

/** Room chat moderation — administrators and game moderators. */
export function verifyCMSChatModerator(headers: PanelHeaders, cmsURL?: string) {
  return verifyCMSPanel(headers, '/api/access-management/verify-chat-moderator', cmsURL)
}
