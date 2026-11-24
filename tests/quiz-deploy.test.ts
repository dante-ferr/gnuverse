import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  deployAfterChange,
  deployAfterDelete,
} from '../cms/src/hooks/deploy-site.ts'

test('publishing, editing, unpublishing and deleting quizzes request a static redeploy', async () => {
  const previous = process.env.SITE_DEPLOY_HOOK_URL
  const originalFetch = globalThis.fetch
  const events: string[] = []
  const args = (doc: object, previousDoc?: object) => ({
    doc,
    previousDoc,
    req: { context: {}, payload: { logger: { info() {}, error() {} } } },
  })
  try {
    process.env.SITE_DEPLOY_HOOK_URL = 'https://deploy.example.test/hook'
    globalThis.fetch = async (_url, options) => {
      events.push(options?.method ?? '')
      return new Response('ok')
    }
    await deployAfterChange(args({ status: 'draft' }) as never)
    assert.equal(events.length, 0)
    await deployAfterChange(args({ status: 'published' }) as never)
    await deployAfterChange(
      args({ status: 'published' }, { status: 'published' }) as never,
    )
    await deployAfterChange(
      args({ status: 'draft' }, { status: 'published' }) as never,
    )
    await deployAfterDelete(args({ status: 'published' }) as never)
    assert.deepEqual(events, ['POST', 'POST', 'POST', 'POST'])
    // Existing article publication must keep working.
    await deployAfterChange(args({ _status: 'published' }) as never)
    assert.equal(events.length, 5)
  } finally {
    globalThis.fetch = originalFetch
    if (previous === undefined) delete process.env.SITE_DEPLOY_HOOK_URL
    else process.env.SITE_DEPLOY_HOOK_URL = previous
  }
})
