import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

async function triggerDeploy(req: Parameters<CollectionAfterChangeHook>[0]['req']) {
  const url = process.env.SITE_DEPLOY_HOOK_URL
  if (!url || req.context.skipSiteDeploy) return
  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new Error('Deploy hook rejeitado')
    req.payload.logger.info('GNUverse: publicação do site solicitada.')
  } catch {
    // Não expor a URL secreta nem desfazer uma edição já salva.
    req.payload.logger.error('GNUverse: conteúdo salvo, mas deploy não solicitado. Confira o hook e publique manualmente no Cloudflare.')
  }
}

export const deployAfterChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (doc._status === 'published' || previousDoc?._status === 'published') {
    await triggerDeploy(req)
  }
  return doc
}

export const deployAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  if (doc._status === 'published') await triggerDeploy(req)
  return doc
}
