import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  COMMENT_COOLDOWN_MS,
  COMMENT_MAX_LENGTH,
  COMMENT_MAX_PER_HOUR,
  LIKE_MAX_PER_MINUTE,
  checkCommentSpamGuard,
  consumeLikeRateLimit,
  recordCommentAccepted,
  resetInteractionGuards,
  validateCommentContent,
} from '../cms/src/blog/interactions-guard.ts'

test('validateCommentContent enforces length, plain text (no HTML), and max 2 links', () => {
  assert.equal(validateCommentContent('  ').ok, false)
  assert.equal(validateCommentContent('oi').ok, false)
  assert.equal(validateCommentContent('a'.repeat(COMMENT_MAX_LENGTH + 1)).ok, false)
  assert.equal(validateCommentContent('<script>alert(1)</script>').ok, false)
  assert.equal(validateCommentContent('Veja <b>isso</b>').ok, false)
  assert.equal(
    validateCommentContent(
      'Links: https://gnu.org https://debian.org https://fsf.org',
    ).ok,
    false,
  )

  const okWithTwoLinks = validateCommentContent(
    '  Excelente texto! Referências: https://gnu.org e https://debian.org  ',
  )
  assert.equal(okWithTwoLinks.ok, true)
  if (okWithTwoLinks.ok) {
    assert.equal(
      okWithTwoLinks.content,
      'Excelente texto! Referências: https://gnu.org e https://debian.org',
    )
  }
})

test('checkCommentSpamGuard enforces 20s cooldown, duplicate block, and 10/hour limit', () => {
  resetInteractionGuards()
  let now = 1_000_000

  assert.equal(checkCommentSpamGuard('u1', 'a1', 'Primeiro comentário', now).ok, true)
  recordCommentAccepted('u1', 'a1', 'Primeiro comentário', now)

  // Within 20s cooldown -> 429
  const cooldownHit = checkCommentSpamGuard('u1', 'a1', 'Segundo comentário', now + 5_000)
  assert.equal(cooldownHit.ok, false)
  if (!cooldownHit.ok) {
    assert.equal(cooldownHit.status, 429)
    assert.ok((cooldownHit.retryAfterSeconds ?? 0) >= 15)
  }

  // After cooldown, identical comment on same article -> 409 duplicate
  now += COMMENT_COOLDOWN_MS + 1_000
  const dupHit = checkCommentSpamGuard('u1', 'a1', '  primeiro   COMENTÁRIO  ', now)
  assert.equal(dupHit.ok, false)
  if (!dupHit.ok) assert.equal(dupHit.status, 409)

  // Same text on a different article is allowed
  assert.equal(checkCommentSpamGuard('u1', 'a2', 'Primeiro comentário', now).ok, true)

  // Fill remaining up to 10 comments within the same hour
  for (let i = 2; i <= COMMENT_MAX_PER_HOUR; i++) {
    const check = checkCommentSpamGuard('u1', 'a1', `Comentário único ${i}`, now)
    assert.equal(check.ok, true)
    recordCommentAccepted('u1', 'a1', `Comentário único ${i}`, now)
    now += COMMENT_COOLDOWN_MS + 1_000
  }

  // 11th comment within 1 hour -> 429
  const hourlyHit = checkCommentSpamGuard('u1', 'a1', 'Comentário 11', now)
  assert.equal(hourlyHit.ok, false)
  if (!hourlyHit.ok) assert.equal(hourlyHit.status, 429)
})

test('consumeLikeRateLimit throttles rapid like floods per user', () => {
  resetInteractionGuards()
  const now = 2_000_000
  for (let i = 0; i < LIKE_MAX_PER_MINUTE; i++) {
    assert.equal(consumeLikeRateLimit('u-like', now + i * 100).ok, true)
  }
  const blocked = consumeLikeRateLimit('u-like', now + LIKE_MAX_PER_MINUTE * 100)
  assert.equal(blocked.ok, false)
  // Another user is unaffected
  assert.equal(consumeLikeRateLimit('u-other', now + LIKE_MAX_PER_MINUTE * 100).ok, true)
})
