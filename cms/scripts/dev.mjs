import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getCMSPort, getLocalCMSURL, loadLocalEnvironment } from './local-config.mjs'

loadLocalEnvironment()
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const child = spawn(process.execPath, [
  path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--port', getCMSPort(),
], { cwd: root, stdio: 'inherit', env: { ...process.env, CMS_SERVER_URL: getLocalCMSURL() } })

process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
child.on('error', (error) => { console.error(error.message); process.exitCode = 1 })
child.on('exit', (code, signal) => { process.exitCode = signal ? 0 : code ?? 1 })
