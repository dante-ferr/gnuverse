import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cmsPort = process.env.CMS_PORT || '3001'
const cmsURL = `http://localhost:${cmsPort}`
const children = new Set()
const controller = new AbortController()
let stopping = false

function stop(code = 0) {
  if (stopping) return
  stopping = true
  process.exitCode = code
  controller.abort()
  for (const child of children) {
    try {
      // Encerrar também os workers do Next.js e os subprocessos do npm.
      if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGTERM')
      else child.kill('SIGTERM')
    } catch (error) {
      if (error.code !== 'ESRCH') console.error('Não foi possível encerrar um servidor:', error.message)
    }
  }
}

function start(args, label, env = {}) {
  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd: root, stdio: 'inherit', detached: process.platform !== 'win32',
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
      console.error(`${label} encerrou (${signal ?? code}). Encerrando o outro servidor.`)
      stop(code || 1)
    }
  })
  return child
}

process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())

console.log(`Iniciando CMS em ${cmsURL}/admin. Aguardando a API antes de iniciar o site…`)
start(['--prefix', 'cms', 'run', 'dev', '--', '--port', cmsPort], 'CMS', { CMS_SERVER_URL: cmsURL })
const deadline = Date.now() + 180000
let ready = false
try {
  while (!stopping && Date.now() < deadline) {
    try {
      const response = await fetch(`${cmsURL}/api/articles?limit=1`, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(120000)]),
      })
      if (response.ok && Array.isArray((await response.json()).docs)) { ready = true; break }
    } catch {
      if (stopping) break
    }
    if (!stopping) await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  if (!stopping) {
    if (!ready) throw new Error('CMS não ficou pronto. Confira o terminal e execute make setup se ainda não preparou o projeto.')
    console.log('CMS pronto. Iniciando o site; use o endereço impresso pelo Next.js.')
    const siteArgs = ['run', 'dev', '--', '--webpack']
    if (process.env.SITE_PORT) siteArgs.push('--port', process.env.SITE_PORT)
    start(siteArgs, 'Site', { CMS_CONTENT_MODE: 'live', CMS_URL: cmsURL })
  }
} catch (error) {
  console.error(error.message)
  stop(1)
}
