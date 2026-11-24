import assert from 'node:assert/strict'
import { test } from 'node:test'
import { quizCollection, quizRequest } from '../src/lib/quiz-client.ts'

test('editor lists paginate and request only article picker fields', async () => {
  const originalFetch = globalThis.fetch
  const pages: string[] = []
  try {
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input))
      assert.equal(
        new Headers(init?.headers).get('Authorization'),
        'Bearer session',
      )
      assert.equal(url.searchParams.get('select[title]'), 'true')
      assert.equal(url.searchParams.get('select[_status]'), 'true')
      const page = url.searchParams.get('page')!
      pages.push(page)
      return Response.json({
        docs: [{ id: Number(page), title: 'Artigo' }],
        hasNextPage: page === '1',
      })
    }
    const docs = await quizCollection('articles', 'session', {
      'select[title]': 'true',
      'select[_status]': 'true',
    })
    assert.equal(docs.length, 2)
    assert.deepEqual(pages, ['1', '2'])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('timeouts while reading the body are reported instead of swallowed as successful null responses', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => {
      const response = new Response()
      response.json = async () => {
        throw new DOMException('Timed out reading the response', 'TimeoutError')
      }
      return response
    }
    await assert.rejects(
      quizRequest('users/me', 'session'),
      /não respondeu a tempo/,
    )
    globalThis.fetch = async () => new Response('invalid JSON')
    await assert.rejects(
      quizRequest('users/me', 'session'),
      /resposta inválida/,
    )
    globalThis.fetch = async () => Response.json({ docs: null })
    await assert.rejects(quizCollection('quizzes', 'session'), /lista inválida/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('a read deadline cancels the fetch and returns an actionable message', async () => {
  const originalFetch = globalThis.fetch
  const signal = AbortSignal.abort(
    new DOMException('Read deadline exceeded', 'TimeoutError'),
  )
  try {
    globalThis.fetch = async (_input, init) => {
      assert.equal(init?.signal?.aborted, true)
      throw init!.signal!.reason
    }
    await assert.rejects(
      quizRequest('users/me', 'session', { signal }),
      /não respondeu a tempo/,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
