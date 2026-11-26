/**
 * Public team member validation and fetching from the CMS `/api/team` endpoint.
 * Copies strictly public profile fields (id, name, bio, photo, order).
 */

export function publicTeamMember(doc) {
  if (!doc || typeof doc !== 'object') {
    throw new Error('Integrante inválido retornado pelo CMS.')
  }
  const id = typeof doc.id === 'string' || typeof doc.id === 'number' ? String(doc.id).trim() : ''
  const name = typeof doc.name === 'string' ? doc.name.trim() : ''
  if (!id || !name) {
    throw new Error('Integrante sem identificador ou nome válido no CMS.')
  }
  const bio =
    typeof doc.bio === 'string' && doc.bio.trim().length > 0 ? doc.bio.trim() : undefined
  const order =
    typeof doc.order === 'number' && Number.isFinite(doc.order) ? doc.order : undefined
  const rawPhoto = doc.photo && typeof doc.photo === 'object' ? doc.photo : null
  const photo =
    rawPhoto && typeof rawPhoto.url === 'string' && rawPhoto.url.trim().length > 0
      ? {
          url: rawPhoto.url.trim(),
          alt:
            typeof rawPhoto.alt === 'string' && rawPhoto.alt.trim().length > 0
              ? rawPhoto.alt.trim()
              : `Foto de ${name}`,
        }
      : undefined

  return {
    id,
    name,
    ...(bio ? { bio } : {}),
    ...(photo ? { photo } : {}),
    ...(order !== undefined ? { order } : {}),
  }
}

export async function fetchTeamMembers(baseURL, fetcher = fetch) {
  const base = new URL(baseURL)
  if (!['http:', 'https:'].includes(base.protocol)) {
    throw new Error('CMS_URL precisa ser HTTP ou HTTPS.')
  }
  const url = new URL('/api/team', base)
  const response = await fetcher(url, { signal: AbortSignal.timeout(120000) })
  if (!response.ok) {
    throw new Error(`Não foi possível sincronizar integrantes (HTTP ${response.status}).`)
  }
  const data = await response.json()
  if (!Array.isArray(data.docs)) {
    throw new Error('Resposta de integrantes inválida do CMS.')
  }
  const members = []
  const ids = new Set()
  for (const doc of data.docs) {
    const member = publicTeamMember(doc)
    if (ids.has(member.id)) continue
    ids.add(member.id)
    members.push(member)
  }
  return members.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined && a.order !== b.order) {
      return a.order - b.order
    }
    if (a.order !== undefined) return -1
    if (b.order !== undefined) return 1
    return a.name.localeCompare(b.name, 'pt-BR')
  })
}
