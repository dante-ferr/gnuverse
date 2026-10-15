import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchPublishedArticles } from './cms-content.mjs'
import { getContentCMSURL, loadLocalEnvironment } from '../cms/scripts/local-config.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
loadLocalEnvironment()
const mode = process.env.CMS_CONTENT_MODE || 'demo'
if (!['demo', 'live'].includes(mode)) throw new Error('CMS_CONTENT_MODE precisa ser demo ou live.')

let articles
const mediaDirectory = path.join(root, 'public/cms-media')
const currentMedia = new Set()
await mkdir(mediaDirectory, { recursive: true })
if (mode === 'demo') {
  articles = [JSON.parse(await readFile(path.join(root, 'content/demo-article.json'), 'utf8'))]
} else {
  const cmsURL = getContentCMSURL()
  articles = await fetchPublishedArticles(cmsURL)
  for (const article of articles) {
    if (!article.cover) continue
    const media = article.cover
    if (!media.url || !media.alt || !media.credit) throw new Error(`Capa incompleta: ${article.slug}`)
    const url = new URL(media.url, cmsURL)
    // O adaptador S3 é servido pela rota do Payload. Não seguir URLs arbitrárias de capas.
    if (url.origin !== new URL(cmsURL).origin) throw new Error('A capa deve ser servida pelo mesmo CMS_URL.')
    const response = await fetch(url, { signal: AbortSignal.timeout(120000), redirect: 'error' })
    if (!response.ok) throw new Error(`Não foi possível copiar a capa de ${article.slug}.`)
    const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
    const extension = extensions[response.headers.get('content-type')?.split(';')[0]]
    if (!extension) throw new Error('Formato de capa não permitido.')
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > 5 * 1024 * 1024) throw new Error('Capa maior que 5 MB.')
    const filename = `${createHash('sha256').update(buffer).digest('hex')}.${extension}`
    await writeFile(path.join(mediaDirectory, filename), buffer)
    currentMedia.add(filename)
    article.cover = { url: `/cms-media/${filename}`, alt: media.alt, credit: media.credit }
  }
}

// Limpar somente arquivos gerados por este sincronizador, após todas as leituras terem sucesso.
for (const filename of await readdir(mediaDirectory)) {
  if (/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(filename) && !currentMedia.has(filename)) {
    await unlink(path.join(mediaDirectory, filename))
  }
}

const directory = path.join(root, '.content')
await mkdir(directory, { recursive: true })
const snapshot = JSON.stringify({ mode, articles }, null, 2)
const temporary = path.join(directory, 'articles.tmp.json')
await writeFile(temporary, snapshot)
await rename(temporary, path.join(directory, 'articles.json'))
console.log(`GNUverse: ${articles.length} artigo(s), modo ${mode}. Conteúdo preparado para exportação estática.`)
