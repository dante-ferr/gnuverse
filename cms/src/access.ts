import type { Access, FieldAccess } from 'payload'

export const isAdmin: Access = ({ req }) => req.user?.role === 'admin'
export const isEditor: Access = ({ req }) =>
  req.user?.role === 'admin' || req.user?.role === 'editor'
export const adminField: FieldAccess = ({ req }) => req.user?.role === 'admin'
export const publishedOrEditor: Access = ({ req }) =>
  isEditor({ req }) ? true : { _status: { equals: 'published' } }
