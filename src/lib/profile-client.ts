import { resolveCmsBaseUrl } from './cms-client'

export const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // 2 MB

export type UserProfile = {
  id: string
  name: string
  username: string | null
  avatar: {
    url: string
    alt: string
  } | null
  showOnAbout: boolean
  aboutBio: string | null
}

function resolveMediaUrl(cmsUrl: string, rawUrl: string): string {
  try {
    return new URL(rawUrl, `${cmsUrl}/`).href
  } catch {
    return rawUrl
  }
}

function normalizeProfile(cmsUrl: string, raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const id = typeof record.id === 'string' ? record.id : ''
  const name = typeof record.name === 'string' ? record.name : ''
  if (!id || !name) return null
  const username = typeof record.username === 'string' ? record.username : null
  const rawAvatar =
    record.avatar && typeof record.avatar === 'object'
      ? (record.avatar as Record<string, unknown>)
      : null
  const avatar =
    rawAvatar && typeof rawAvatar.url === 'string' && rawAvatar.url.trim()
      ? {
          url: resolveMediaUrl(cmsUrl, rawAvatar.url.trim()),
          alt:
            typeof rawAvatar.alt === 'string' && rawAvatar.alt.trim()
              ? rawAvatar.alt.trim()
              : `Foto de ${name}`,
        }
      : null
  const showOnAbout = record.showOnAbout === true
  const aboutBio =
    typeof record.aboutBio === 'string' && record.aboutBio.trim()
      ? record.aboutBio.trim()
      : null

  return { id, name, username, avatar, showOnAbout, aboutBio }
}

function requireCmsUrl(): string {
  const cmsUrl = resolveCmsBaseUrl()
  if (!cmsUrl) {
    throw new Error('Servidor editorial (CMS) não configurado neste ambiente.')
  }
  return cmsUrl
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null)
  if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string') {
    return (data as { error: string }).error
  }
  return fallback
}

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type as (typeof ALLOWED_AVATAR_TYPES)[number])) {
    return 'Formato não suportado. Use apenas JPEG, PNG ou WebP.'
  }
  if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) {
    return 'A imagem deve ter no máximo 2 MB.'
  }
  return null
}

export async function fetchOwnProfile(token: string): Promise<UserProfile | null> {
  const cmsUrl = resolveCmsBaseUrl()
  if (!cmsUrl || !token) return null
  const response = await fetch(`${cmsUrl}/api/profile/me`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30000),
  })
  if (response.status === 401 || response.status === 403) return null
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Não foi possível carregar seu perfil.'))
  }
  const data = await response.json().catch(() => null)
  return normalizeProfile(cmsUrl, data?.profile)
}

export async function uploadOwnAvatar(token: string, file: File): Promise<UserProfile> {
  const validationError = validateAvatarFile(file)
  if (validationError) throw new Error(validationError)
  const cmsUrl = requireCmsUrl()
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${cmsUrl}/api/profile/me/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    signal: AbortSignal.timeout(60000),
  })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Não foi possível enviar a foto de perfil.'))
  }
  const data = await response.json().catch(() => null)
  const profile = normalizeProfile(cmsUrl, data?.profile)
  if (!profile) {
    throw new Error('Resposta inválida ao atualizar a foto de perfil.')
  }
  return profile
}

export async function removeOwnAvatar(token: string): Promise<UserProfile> {
  const cmsUrl = requireCmsUrl()
  const response = await fetch(`${cmsUrl}/api/profile/me/avatar`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Não foi possível remover a foto de perfil.'))
  }
  const data = await response.json().catch(() => null)
  const profile = normalizeProfile(cmsUrl, data?.profile)
  if (!profile) {
    throw new Error('Resposta inválida ao remover a foto de perfil.')
  }
  return profile
}

export async function updateOwnAboutBio(token: string, aboutBio: string): Promise<UserProfile> {
  const cmsUrl = requireCmsUrl()
  const response = await fetch(`${cmsUrl}/api/profile/me`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ aboutBio }),
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Não foi possível salvar a descrição.'))
  }
  const data = await response.json().catch(() => null)
  const profile = normalizeProfile(cmsUrl, data?.profile)
  if (!profile) {
    throw new Error('Resposta inválida ao salvar a descrição.')
  }
  return profile
}
