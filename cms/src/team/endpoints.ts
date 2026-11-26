import type { Endpoint } from 'payload'

type PopulatedMedia = {
  url?: string | null
  alt?: string | null
}

type TeamUserDoc = {
  id: number | string
  name?: string | null
  aboutBio?: string | null
  aboutOrder?: number | null
  aboutPhoto?: PopulatedMedia | number | string | null
}

/**
 * Public read-only projection of team members marked with `showOnAbout: true`.
 * Exposes strictly display fields (id, name, bio, photo, order) and never
 * leaks email, password hashes, usernames, or internal roles.
 */
export const teamEndpoints: Endpoint[] = [
  {
    path: '/team',
    method: 'get',
    handler: async (req) => {
      const result = await req.payload.find({
        collection: 'users',
        overrideAccess: true,
        depth: 1,
        pagination: false,
        where: {
          showOnAbout: { equals: true },
        },
        req,
      })

      const members = (result.docs as TeamUserDoc[])
        .filter((doc) => typeof doc.name === 'string' && doc.name.trim().length > 0)
        .map((doc) => {
          const media =
            doc.aboutPhoto && typeof doc.aboutPhoto === 'object' ? doc.aboutPhoto : null
          const photo =
            media && typeof media.url === 'string' && media.url.trim().length > 0
              ? {
                  url: media.url,
                  alt:
                    typeof media.alt === 'string' && media.alt.trim().length > 0
                      ? media.alt.trim()
                      : `Foto de ${doc.name!.trim()}`,
                }
              : null
          const bio =
            typeof doc.aboutBio === 'string' && doc.aboutBio.trim().length > 0
              ? doc.aboutBio.trim()
              : null
          const order =
            typeof doc.aboutOrder === 'number' && Number.isFinite(doc.aboutOrder)
              ? doc.aboutOrder
              : null

          return {
            id: String(doc.id),
            name: doc.name!.trim(),
            bio,
            photo,
            order,
          }
        })
        .sort((a, b) => {
          if (a.order !== null && b.order !== null && a.order !== b.order) {
            return a.order - b.order
          }
          if (a.order !== null) return -1
          if (b.order !== null) return 1
          return a.name.localeCompare(b.name, 'pt-BR')
        })

      return Response.json({ docs: members })
    },
  },
]
