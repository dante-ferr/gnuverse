import type { Access, FieldAccess, PayloadRequest, Where } from 'payload'

const reviewerRoles: readonly string[] = ['admin', 'reviewer', 'editor']

type RequestCheck = ({ req }: { req: PayloadRequest }) => boolean

export const isAdmin: RequestCheck = ({ req }) => req.user?.role === 'admin'
export const isReviewer: RequestCheck = ({ req }) =>
  reviewerRoles.includes(req.user?.role ?? '')
export const isAuthor: RequestCheck = ({ req }) => req.user?.role === 'author'
export const canCreateArticle: RequestCheck = ({ req }) =>
  isReviewer({ req }) || isAuthor({ req })

export const adminField: FieldAccess = ({ req }) => isAdmin({ req })
export const isReviewerField: FieldAccess = ({ req }) => isReviewer({ req })

export const canReadArticle: Access = ({ req }) => {
  if (isReviewer({ req })) return true
  if (isAuthor({ req }) && req.user) {
    const where: Where = {
      or: [{ _status: { equals: 'published' } }, { owner: { equals: req.user.id } }],
    }
    return where
  }
  return { _status: { equals: 'published' } }
}

export const canReadArticleVersions: Access = ({ req }) => {
  if (isReviewer({ req })) return true
  if (isAuthor({ req }) && req.user) {
    return { 'version.owner': { equals: req.user.id } }
  }
  return false
}

// Aliases mantidos para compatibilidade com integrações existentes.
export const isEditor = isReviewer
export const publishedOrEditor = canReadArticle
