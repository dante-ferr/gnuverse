import type { Endpoint, PayloadRequest } from 'payload'
import sharp from 'sharp'

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_SHARP_FORMATS = new Set(['jpeg', 'png', 'webp'])
const EXTENSION_BY_FORMAT: Record<string, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
}
const MIME_BY_FORMAT: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}
const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // 2 MB

type PopulatedMedia = {
  url?: string | null
  alt?: string | null
}

type ProfileUserDoc = {
  id: number | string
  name?: string | null
  username?: string | null
  showOnAbout?: boolean | null
  aboutBio?: string | null
  avatar?: PopulatedMedia | number | string | null
}

function formatProfile(doc: ProfileUserDoc) {
  const name = typeof doc.name === 'string' && doc.name.trim() ? doc.name.trim() : 'Integrante'
  const username = typeof doc.username === 'string' && doc.username.trim() ? doc.username.trim() : null
  const media = doc.avatar && typeof doc.avatar === 'object' ? doc.avatar : null
  const avatar =
    media && typeof media.url === 'string' && media.url.trim().length > 0
      ? {
          url: media.url,
          alt:
            typeof media.alt === 'string' && media.alt.trim().length > 0
              ? media.alt.trim()
              : `Foto de ${name}`,
        }
      : null
  const aboutBio =
    typeof doc.aboutBio === 'string' && doc.aboutBio.trim().length > 0 ? doc.aboutBio.trim() : null

  return {
    id: String(doc.id),
    name,
    username,
    avatar,
    showOnAbout: doc.showOnAbout === true,
    aboutBio,
  }
}

async function readOwnProfile(req: PayloadRequest) {
  if (!req.user) return null
  const doc = (await req.payload.findByID({
    collection: 'users',
    id: req.user.id,
    depth: 1,
    overrideAccess: true,
    req,
  })) as ProfileUserDoc
  return formatProfile(doc)
}

/**
 * Authenticated self-service profile endpoints.
 * Every mutation operates strictly on `req.user.id` and never accepts
 * privileged fields (`role`, `showOnAbout`, `aboutOrder`).
 */
export const profileEndpoints: Endpoint[] = [
  {
    path: '/profile/me',
    method: 'get',
    handler: async (req) => {
      if (!req.user) {
        return Response.json(
          { error: 'Entre na sua conta para acessar seu perfil.' },
          { status: 401, headers: { 'Cache-Control': 'no-store' } },
        )
      }
      const profile = await readOwnProfile(req)
      return Response.json({ profile }, { headers: { 'Cache-Control': 'no-store' } })
    },
  },
  {
    path: '/profile/me',
    method: 'patch',
    handler: async (req) => {
      if (!req.user) {
        return Response.json(
          { error: 'Entre na sua conta para atualizar seu perfil.' },
          { status: 401, headers: { 'Cache-Control': 'no-store' } },
        )
      }
      if (!req.headers.get('content-type')?.startsWith('application/json')) {
        return Response.json({ error: 'Envie JSON.' }, { status: 415 })
      }
      const raw = await req.text!()
      if (raw.length > 4096) {
        return Response.json({ error: 'Pedido muito grande.' }, { status: 413 })
      }
      let body: Record<string, unknown>
      try {
        body = JSON.parse(raw)
      } catch {
        return Response.json({ error: 'Pedido inválido.' }, { status: 400 })
      }

      const current = (await req.payload.findByID({
        collection: 'users',
        id: req.user.id,
        depth: 0,
        overrideAccess: true,
        req,
      })) as ProfileUserDoc

      if (current.showOnAbout !== true) {
        return Response.json(
          { error: 'A descrição curta só pode ser editada por integrantes listados em Sobre.' },
          { status: 403, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      const rawBio = typeof body.aboutBio === 'string' ? body.aboutBio.trim() : ''
      if (rawBio.length > 300) {
        return Response.json(
          { error: 'A descrição curta deve ter no máximo 300 caracteres.' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      await req.payload.update({
        collection: 'users',
        id: req.user.id,
        overrideAccess: true,
        req,
        data: { aboutBio: rawBio },
      })

      const profile = await readOwnProfile(req)
      return Response.json({ profile }, { headers: { 'Cache-Control': 'no-store' } })
    },
  },
  {
    path: '/profile/me/avatar',
    method: 'post',
    handler: async (req) => {
      if (!req.user) {
        return Response.json(
          { error: 'Entre na sua conta para alterar sua foto de perfil.' },
          { status: 401, headers: { 'Cache-Control': 'no-store' } },
        )
      }
      if (!req.formData) {
        return Response.json({ error: 'Envio de formulário indisponível.' }, { status: 400 })
      }

      let formData: FormData
      try {
        formData = await req.formData()
      } catch {
        return Response.json({ error: 'Não foi possível ler o arquivo enviado.' }, { status: 400 })
      }

      const file = formData.get('file')
      if (!file || typeof file === 'string') {
        return Response.json({ error: 'Selecione uma imagem para enviar.' }, { status: 400 })
      }

      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return Response.json(
          { error: 'Formato não suportado. Use apenas JPEG, PNG ou WebP.' },
          { status: 415, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) {
        return Response.json(
          { error: 'A imagem deve ter no máximo 2 MB.' },
          { status: 413, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      if (buffer.length <= 0 || buffer.length > MAX_AVATAR_BYTES) {
        return Response.json(
          { error: 'A imagem deve ter no máximo 2 MB.' },
          { status: 413, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      let detectedFormat: string | undefined
      try {
        const meta = await sharp(buffer).metadata()
        detectedFormat = meta.format
      } catch {
        return Response.json(
          { error: 'Arquivo inválido. Envie uma imagem JPEG, PNG ou WebP válida.' },
          { status: 415, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      if (!detectedFormat || !ALLOWED_SHARP_FORMATS.has(detectedFormat)) {
        return Response.json(
          { error: 'Formato não suportado. Use apenas JPEG, PNG ou WebP.' },
          { status: 415, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      const displayName =
        typeof req.user.name === 'string' && req.user.name.trim()
          ? req.user.name.trim()
          : 'Integrante'
      const extension = EXTENSION_BY_FORMAT[detectedFormat]
      const mimetype = MIME_BY_FORMAT[detectedFormat]

      const media = await req.payload.create({
        collection: 'media',
        overrideAccess: true,
        req,
        data: {
          alt: `Foto de perfil de ${displayName}`,
          credit: `Foto de perfil enviada por ${displayName}`,
        },
        file: {
          data: buffer,
          mimetype,
          name: `avatar-${String(req.user.id)}-${Date.now()}.${extension}`,
          size: buffer.length,
        },
      })

      await req.payload.update({
        collection: 'users',
        id: req.user.id,
        overrideAccess: true,
        req,
        data: { avatar: media.id },
      })

      const profile = await readOwnProfile(req)
      return Response.json({ profile }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
    },
  },
  {
    path: '/profile/me/avatar',
    method: 'delete',
    handler: async (req) => {
      if (!req.user) {
        return Response.json(
          { error: 'Entre na sua conta para remover sua foto de perfil.' },
          { status: 401, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      await req.payload.update({
        collection: 'users',
        id: req.user.id,
        overrideAccess: true,
        req,
        data: { avatar: null },
      })

      const profile = await readOwnProfile(req)
      return Response.json({ profile }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
    },
  },
]
