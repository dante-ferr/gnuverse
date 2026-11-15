import type { CollectionConfig } from 'payload'
import { adminField, isAdmin } from '../access'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Integrante', plural: 'Integrantes' },
  auth: true,
  admin: { useAsTitle: 'name' },
  access: {
    admin: ({ req }) => Boolean(req.user),
    create: ({ data, req }) =>
      isAdmin({ req }) || (!req.user && (!data?.role || data.role === 'author')),
    read: ({ req }) => isAdmin({ req }) ? true : req.user ? { id: { equals: req.user.id } } : false,
    update: ({ req }) => isAdmin({ req }) ? true : req.user ? { id: { equals: req.user.id } } : false,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [async ({ data, operation, req }) => {
      if (operation === 'create' && !req.user) {
        const existing = await req.payload.count({ collection: 'users', overrideAccess: true, req })
        data.role = existing.totalDocs === 0 ? 'admin' : 'author'
      }
      return data
    }],
  },
  fields: [
    { name: 'name', label: 'Nome', type: 'text', required: true },
    {
      name: 'role', label: 'Papel', type: 'select', required: true, defaultValue: 'author',
      options: [
        { label: 'Administrador', value: 'admin' },
        { label: 'Revisor', value: 'reviewer' },
        { label: 'Editor', value: 'editor' },
        { label: 'Autor', value: 'author' },
      ],
      access: { create: adminField, update: adminField },
    },
  ],
}
