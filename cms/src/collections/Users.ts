import { APIError, type CollectionConfig } from 'payload'
import { adminField, canAccessCMS, isAdmin } from '../access'
import { readRoleRegistry } from '../../../core/authz/manage-role-store.ts'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Integrante', plural: 'Integrantes' },
  auth: true,
  admin: { useAsTitle: 'name' },
  access: {
    admin: canAccessCMS,
    create: isAdmin,
    read: ({ req }) => isAdmin({ req }) ? true : req.user ? { id: { equals: req.user.id } } : false,
    update: ({ req }) => isAdmin({ req }) ? true : req.user ? { id: { equals: req.user.id } } : false,
    delete: isAdmin,
  },
  hooks: {
    beforeDelete: [({ id }) => {
      const registry = readRoleRegistry()
      if (registry.enabled && !registry.entries.some((entry) => entry.roles.includes('admin') &&
          entry.identities.some((identity) => identity.provider === 'cms' && identity.id !== String(id))))
        throw new APIError('Mantenha pelo menos um administrador com acesso ao painel.', 409)
    }],
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
      admin: { description: 'Papel inicial do blog. Com a gestão compartilhada ativa, use Pessoas e acessos para definir os papéis válidos em todo o site.' },
      options: [{ label: 'Administrador', value: 'admin' }, { label: 'Editor', value: 'editor' }],
      access: { create: adminField, update: adminField },
    },
  ],
}
