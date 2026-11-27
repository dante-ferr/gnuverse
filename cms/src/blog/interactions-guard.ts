export const COMMENT_MIN_LENGTH = 3
export const COMMENT_MAX_LENGTH = 1000
export const COMMENT_MAX_LINKS = 2
export const COMMENT_COOLDOWN_MS = 20_000
export const COMMENT_HOURLY_WINDOW_MS = 60 * 60 * 1000
export const COMMENT_MAX_PER_HOUR = 10
export const COMMENT_DUPLICATE_WINDOW_MS = 10 * 60 * 1000
export const LIKE_WINDOW_MS = 60_000
export const LIKE_MAX_PER_MINUTE = 20

const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/i
const LINK_PATTERN = /https?:\/\/\S+/gi

const commentHistoryByUser = new Map<string, number[]>()
const recentCommentHashes = new Map<string, number>()
const likeHistoryByUser = new Map<string, number[]>()

export type CommentValidationResult =
  | { ok: true; content: string }
  | { ok: false; error: string }

export function validateCommentContent(raw: unknown): CommentValidationResult {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Escreva um comentário antes de enviar.' }
  }
  const content = raw.replace(/\r\n/g, '\n').trim()
  if (content.length < COMMENT_MIN_LENGTH) {
    return {
      ok: false,
      error: `O comentário deve ter pelo menos ${COMMENT_MIN_LENGTH} caracteres.`,
    }
  }
  if (content.length > COMMENT_MAX_LENGTH) {
    return {
      ok: false,
      error: `O comentário deve ter no máximo ${COMMENT_MAX_LENGTH} caracteres.`,
    }
  }
  if (HTML_TAG_PATTERN.test(content)) {
    return {
      ok: false,
      error: 'Use apenas texto simples nos comentários (HTML não é permitido).',
    }
  }
  const links = content.match(LINK_PATTERN) ?? []
  if (links.length > COMMENT_MAX_LINKS) {
    return {
      ok: false,
      error: `Limite de no máximo ${COMMENT_MAX_LINKS} links por comentário.`,
    }
  }
  return { ok: true, content }
}

export type GuardDecision =
  | { ok: true }
  | { ok: false; status: 409 | 429; error: string; retryAfterSeconds?: number }

function normalizeForDuplicate(content: string): string {
  return content.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function checkCommentSpamGuard(
  userId: string,
  articleId: string,
  content: string,
  now = Date.now(),
): GuardDecision {
  const history = (commentHistoryByUser.get(userId) ?? []).filter(
    (time) => time > now - COMMENT_HOURLY_WINDOW_MS,
  )
  commentHistoryByUser.set(userId, history)

  const lastAt = history.at(-1)
  if (lastAt !== undefined && now - lastAt < COMMENT_COOLDOWN_MS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((lastAt + COMMENT_COOLDOWN_MS - now) / 1000),
    )
    return {
      ok: false,
      status: 429,
      retryAfterSeconds,
      error: `Aguarde ${retryAfterSeconds}s antes de enviar outro comentário.`,
    }
  }

  if (history.length >= COMMENT_MAX_PER_HOUR) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((history[0]! + COMMENT_HOURLY_WINDOW_MS - now) / 1000),
    )
    return {
      ok: false,
      status: 429,
      retryAfterSeconds,
      error:
        'Você atingiu o limite de 10 comentários por hora. Tente novamente mais tarde.',
    }
  }

  const dupKey = `${userId}:${articleId}:${normalizeForDuplicate(content)}`
  const dupAt = recentCommentHashes.get(dupKey)
  if (dupAt !== undefined && now - dupAt < COMMENT_DUPLICATE_WINDOW_MS) {
    return {
      ok: false,
      status: 409,
      error: 'Você já enviou este mesmo comentário recentemente neste artigo.',
    }
  }

  return { ok: true }
}

export function recordCommentAccepted(
  userId: string,
  articleId: string,
  content: string,
  now = Date.now(),
): void {
  const history = (commentHistoryByUser.get(userId) ?? []).filter(
    (time) => time > now - COMMENT_HOURLY_WINDOW_MS,
  )
  history.push(now)
  commentHistoryByUser.set(userId, history)

  const dupKey = `${userId}:${articleId}:${normalizeForDuplicate(content)}`
  recentCommentHashes.set(dupKey, now)

  if (recentCommentHashes.size > 5_000) {
    for (const [key, time] of recentCommentHashes) {
      if (now - time >= COMMENT_DUPLICATE_WINDOW_MS) recentCommentHashes.delete(key)
    }
  }
}

export function consumeLikeRateLimit(
  userId: string,
  now = Date.now(),
): { ok: true } | { ok: false; retryAfterSeconds: number; error: string } {
  const recent = (likeHistoryByUser.get(userId) ?? []).filter(
    (time) => time > now - LIKE_WINDOW_MS,
  )
  if (recent.length >= LIKE_MAX_PER_MINUTE) {
    likeHistoryByUser.set(userId, recent)
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((recent[0]! + LIKE_WINDOW_MS - now) / 1000),
    )
    return {
      ok: false,
      retryAfterSeconds,
      error: 'Muitas ações de curtida em sequência. Aguarde alguns segundos.',
    }
  }
  recent.push(now)
  likeHistoryByUser.set(userId, recent)
  if (likeHistoryByUser.size > 5_000) {
    for (const [key, times] of likeHistoryByUser) {
      if ((times.at(-1) ?? 0) <= now - LIKE_WINDOW_MS) likeHistoryByUser.delete(key)
    }
  }
  return { ok: true }
}

/** Test helper — clears in-memory rate limits and duplicate history. */
export function resetInteractionGuards(): void {
  commentHistoryByUser.clear()
  recentCommentHashes.clear()
  likeHistoryByUser.clear()
}
