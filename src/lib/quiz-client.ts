import { resolveCmsBaseUrl } from './cms-client.ts'
import {
  extractCmsErrorMessage,
  formatRequestFailure,
} from './blog-submission.ts'

export async function quizRequest<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const base = resolveCmsBaseUrl()
  if (!base)
    throw new Error(
      'O servidor editorial ainda não foi configurado neste ambiente.',
    )
  let response: Response
  let data: unknown
  try {
    response = await fetch(`${base}/api/${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(120000)])
        : AbortSignal.timeout(120000),
    })
    data = await response.json()
  } catch (error) {
    if (
      error instanceof Error &&
      ['TimeoutError', 'AbortError'].includes(error.name)
    )
      throw new Error(
        'O CMS não respondeu a tempo. Tente novamente em instantes.',
      )
    if (error instanceof SyntaxError)
      throw new Error('O CMS retornou uma resposta inválida. Tente novamente.')
    throw new Error(formatRequestFailure(error))
  }
  if (response.status === 401)
    throw new Error('Sua sessão expirou. Entre novamente para continuar.')
  if (!response.ok)
    throw new Error(extractCmsErrorMessage(data, response.status))
  return data as T
}

/** Editorial lists must not silently drop older drafts after the first Payload page. */
export async function quizCollection<T>(
  collection: string,
  token: string,
  filters: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<T[]> {
  const docs: T[] = []
  for (let page = 1; page <= 100; page++) {
    const query = new URLSearchParams({
      depth: '0',
      limit: '100',
      sort: '-updatedAt',
      ...filters,
      page: String(page),
    })
    const result = await quizRequest<{ docs: T[]; hasNextPage: boolean }>(
      `${collection}?${query}`,
      token,
      { signal },
    )
    if (!Array.isArray(result?.docs))
      throw new Error('O CMS retornou uma lista inválida. Tente novamente.')
    docs.push(...result.docs)
    if (!result.hasNextPage) return docs
  }
  throw new Error(
    'Há muitos itens para carregar. Entre em contato com a revisão.',
  )
}
