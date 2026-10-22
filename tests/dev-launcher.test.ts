import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))

async function freePort() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = (server.address() as import('node:net').AddressInfo).port
  await new Promise<void>((resolve) => server.close(() => resolve()))
  return String(port)
}

test(
  'make dev launcher starts all three services, wires game URL and shuts down children',
  { skip: process.platform === 'win32', timeout: 15000 },
  async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'gnuverse-dev-launch-'))
    const bin = path.join(directory, 'bin')
    await mkdir(bin)
    const logfile = path.join(directory, 'started.jsonl')
    const fixture = path.join(root, 'tests/fixtures/dev-service.ts')
    const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
    await writeFile(
      path.join(bin, 'npm'),
      `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(fixture)} "$@"\n`,
      { mode: 0o755 },
    )
    const cmsPort = await freePort(),
      gamePort = await freePort(),
      sitePort = await freePort()
    const child = spawn(process.execPath, ['scripts/dev.ts'], {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        CMS_PORT: cmsPort,
        GAME_PORT: gamePort,
        SITE_PORT: sitePort,
        DEV_TEST_LOG: logfile,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const exited = once(child, 'exit')
    let output = ''
    child.stdout.on('data', (data) => {
      output += data
    })
    child.stderr.on('data', (data) => {
      output += data
    })
    try {
      let started: { role: string; api?: string; origins?: string }[] = []
      const deadline = Date.now() + 10000
      while (Date.now() < deadline && child.exitCode === null) {
        try {
          started = (await readFile(logfile, 'utf8'))
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line))
        } catch {
          /* Children are still booting. */
        }
        if (started.length === 3) break
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      assert.deepEqual(
        started.map((item) => item.role).sort(),
        ['cms', 'game', 'site'],
        output,
      )
      assert.equal(
        started.find((item) => item.role === 'site')?.api,
        `http://localhost:${gamePort}`,
      )
      assert.ok(
        started
          .find((item) => item.role === 'game')
          ?.origins?.includes(`http://localhost:${sitePort}`),
      )
      child.kill('SIGTERM')
      await exited
      for (const port of [cmsPort, gamePort, sitePort]) {
        await assert.rejects(
          fetch(`http://127.0.0.1:${port}`, {
            signal: AbortSignal.timeout(1000),
          }),
        )
      }
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM')
        await exited
      }
      await rm(directory, { recursive: true, force: true })
    }
  },
)
