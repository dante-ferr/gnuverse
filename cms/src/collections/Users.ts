import { APIError, type CollectionConfig } from 'payload'
import { adminField, canAccessCMS, isAdmin } from '../access'
import { readRoleRegistry } from '../../../core/authz/manage-role-store.ts'
import { emailVerificationEnabled } from '../email/settings'
import { forgotPasswordEmailHTML, verificationEmailHTML } from '../email/auth-messages'
import { USERNAME_PATTERN } from '../identity/username'

const authExtras = emailVerificationEnabled
  ? {
      verify: {
        generateEmailHTML: verificationEmailHTML,
        generateEmailSubject: () => 'Confirme seu e-mail no GNUverse',
      },
      forgotPassword: {
        generateEmailHTML: forgotPasswordEmailHTML,
        generateEmailSubject: () => 'Redefina sua senha no GNUverse',
      },
    }
  : {}

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Integrante', plural: 'Integrantes' },
  auth: {
    loginWithUsername: {
      allowEmailLogin: true,
      requireEmail: true,
      requireUsername: true,
    },
    ...authExtras,
  },
  admin: { useAsTitle: 'name' },
  access: {
    admin: canAccessCMS,
    create: ({ data, req }) =>
      isAdmin({ req }) || (!req.user && (!data?.role || data.role === 'author')),
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
        if (existing.totalDocs === 0) {
          // Empty DB: HOST_ADMIN_* create on init, or a rare race before that finishes.
          if (req.context.publicRegistration) throw new APIError('O administrador precisa configurar o site antes do cadastro de participantes.', 409)
          data.role = 'admin'
          if (emailVerificationEnabled) data._verified = true
        } else if (!req.context.publicRegistration) {
          // Cadastro público do blog é sempre author; o endpoint de identidade define member explicitamente.
          data.role = 'author'
        }
      }
      return data
    }],
  },
  fields: [
    { name: 'name', label: 'Nome', type: 'text', required: true },
    {
      // Merges into Payload's auth username field (unique, required for login).
      name: 'username',
      label: 'Apelido público',
      type: 'text',
      required: true,
      unique: true,
      maxLength: 32,
      hooks: {
        beforeValidate: [({ value }) =>
          typeof value === 'string' && value ? value.toLowerCase().trim() : value],
      },
      validate: (value: unknown) =>
        (typeof value === 'string' && USERNAME_PATTERN.test(value))
        || 'Use de 3 a 32 letras, números, _ ou -.',
    },
    {
      name: 'role', label: 'Papel', type: 'select', required: true, defaultValue: 'author',
      admin: { description: 'Papel editorial do blog. Com a gestão compartilhada ativa, use Pessoas e acessos para papéis válidos em todo o site. Participante (member) é o cadastro público do jogo.' },
      options: [
        { label: 'Administrador', value: 'admin' },
        { label: 'Revisor', value: 'reviewer' },
        { label: 'Editor', value: 'editor' },
        { label: 'Autor', value: 'author' },
        { label: 'Participante', value: 'member' },
      ],
      access: { create: adminField, update: adminField },
    },
    {
      name: 'showOnAbout',
      label: 'Exibir na página Sobre',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Marca esta conta como integrante do grupo na página pública /sobre/.',
      },
      access: { create: adminField, update: adminField },
    },
    {
      name: 'aboutOrder',
      label: 'Ordem na página Sobre',
      type: 'number',
      required: false,
      admin: {
        description: 'Ordem de exibição no grid de participantes (menor aparece primeiro).',
      },
      access: { create: adminField, update: adminField },
    },
    {
      name: 'avatar',
      label: 'Foto de perfil',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    {
      name: 'aboutBio',
      label: 'Descrição curta (Sobre)',
      type: 'textarea',
      required: false,
      maxLength: 300,
      admin: {
        description: 'Breve apresentação exibida no card da página /sobre/ (opcional).',
      },
    },
  ],
}
