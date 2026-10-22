import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getLocalCMSURL,
  loadLocalEnvironment,
} from '../cms/scripts/local-config.mjs'
import { getDevConfig } from './dev-config.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
loadLocalEnvironment()
const cmsURL = getLocalCMSURL()
const config = getDevConfig()
const children = new Set<ChildProcess>()
const controller = new AbortController()
let stopping = false

function stop(code = 0) {
  if (stopping) return
  stopping = true
  process.exitCode = code
  controller.abort()
  for (const child of children) {
    try {
      // Include Next.js workers and npm subprocesses in shutdown.
      if (process.platform !== 'win32' && child.pid)
        process.kill(-child.pid, 'SIGTERM')
      else child.kill('SIGTERM')
    } catch (cause) {
      const error = cause as NodeJS.ErrnoException
      if (error.code !== 'ESRCH')
        console.error('Não foi possível encerrar um servidor:', error.message)
    }
  }
}

function start(
  args: string[],
  label: string,
  env: Record<string, string | undefined> = {},
) {
  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd: root,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    env: { ...process.env, ...env },
  })
  children.add(child)
  child.on('error', (error) => {
    console.error(`${label}: ${error.message}`)
    stop(1)
  })
  child.on('exit', (code, signal) => {
    children.delete(child)
    if (!stopping) {
      console.error(
        `${label} encerrou (${signal ?? code}). Encerrando os demais servidores.`,
      )
      stop(code || 1)
    }
  })
}

async function waitForAPI(
  url: string,
  label: string,
  validate: (body: Record<string, unknown>) => boolean,
) {
  const deadline = Date.now() + 180000
  while (!stopping && Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(10000),
        ]),
      })
      if (response.ok && validate(await response.json())) return
    } catch {
      if (stopping) return
    }
    if (!stopping)
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer)
          controller.signal.removeEventListener('abort', finish)
          resolve()
        }
        const timer = setTimeout(finish, 1000)
        controller.signal.addEventListener('abort', finish, { once: true })
      })
  }
  if (!stopping)
    throw new Error(
      `${label} não ficou pronto. Confira o terminal e execute make setup se ainda não preparou o projeto.`,
    )
}

process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())

console.log(
  `Iniciando CMS em ${cmsURL}/admin e jogo em ${config.gameURL}. Aguardando as APIs…`,
)
start(['run', 'cms:dev'], 'CMS')
start(['run', 'game:dev'], 'Jogo', {
  GAME_PORT: config.gamePort,
  GAME_ALLOWED_ORIGINS: config.allowedOrigins,
})
try {
  await Promise.all([
    waitForAPI(`${cmsURL}/api/articles?limit=1`, 'CMS', (body) =>
      Array.isArray(body.docs),
    ),
    waitForAPI(
      `${config.gameURL}/api/health`,
      'Jogo',
      (body) => body.ok === true,
    ),
  ])
  if (!stopping) {
    console.log(
      'CMS e jogo prontos. Iniciando o site; Ctrl+C encerra os três servidores.',
    )
    start(
      ['run', 'dev', '--', '--webpack', '--port', config.sitePort],
      'Site',
      {
        CMS_CONTENT_MODE: 'live',
        CMS_URL: cmsURL,
        NEXT_PUBLIC_GAME_API_URL: config.gameURL,
      },
    )
  }
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : cause)
  stop(1)
}
