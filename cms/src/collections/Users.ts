import type { CollectionConfig } from 'payload'
import { adminField, isAdmin } from '../access'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Integrante', plural: 'Integrantes' },
  auth: true,
  admin: { useAsTitle: 'name' },
  access: {
    admin: ({ req }) => Boolean(req.user),
    create: isAdmin,
    read: ({ req }) => isAdmin({ req }) ? true : req.user ? { id: { equals: req.user.id } } : false,
    update: ({ req }) => isAdmin({ req }) ? true : req.user ? { id: { equals: req.user.id } } : false,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [async ({ data, operation, req }) => {
      if (operation === 'create' && !req.user) {
        const existing = await req.payload.count({ collection: 'users', overrideAccess: true, req })
        if (existing.totalDocs === 0) data.role = 'admin'
      }
      return data
    }],
  },
  fields: [
    { name: 'name', label: 'Nome', type: 'text', required: true },
    {
      name: 'role', label: 'Papel', type: 'select', required: true, defaultValue: 'editor',
      options: [{ label: 'Administrador', value: 'admin' }, { label: 'Editor', value: 'editor' }],
      access: { create: adminField, update: adminField },
    },
  ],
}
