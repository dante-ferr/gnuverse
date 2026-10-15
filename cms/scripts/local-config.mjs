import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export function loadLocalEnvironment(directory = projectRoot) {
  // Não propagar os marcadores internos de @next/env para os processos filhos:
  // o Next.js do CMS ainda precisa carregar seu próprio .env com PAYLOAD_SECRET.
  for (const filename of ['.env.development.local', '.env.local', '.env.development', '.env']) {
    try {
      process.loadEnvFile(path.join(directory, filename))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
}

export function getCMSPort(env = process.env) {
  const value = env.CMS_PORT
  if (!value || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error('Defina CMS_PORT entre 1 e 65535 no .env.local da raiz (make setup prepara o arquivo).')
  }
  return String(Number(value))
}

export function getLocalCMSURL(env = process.env) {
  return `http://localhost:${getCMSPort(env)}`
}

export function getContentCMSURL(env = process.env) {
  return env.CMS_URL || getLocalCMSURL(env)
}
