import assert from 'node:assert/strict'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getCMSPort,
  getLocalCMSURL,
  loadLocalEnvironment,
} from '../cms/scripts/local-config.mjs'
import { getDevConfig } from './dev-config.ts'

const DEMO_PASSWORD = 'gnuverse123'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cmsRoot = path.join(root, 'cms')

const isOnce = process.argv.includes('--once') || process.argv.includes('--ci')
const noBrowser = process.argv.includes('--no-browser')

execFileSync(process.execPath, [path.join(cmsRoot, 'scripts/setup-local.mjs')], {
  cwd: cmsRoot,
  stdio: 'inherit',
})
execFileSync(process.execPath, [path.join(root, 'scripts/setup-site.mjs')], {
  cwd: root,
  stdio: 'inherit',
})

loadLocalEnvironment(root)
const cmsPort = getCMSPort()
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
      if (process.platform !== 'win32' && child.pid) {
        process.kill(-child.pid, 'SIGTERM')
      } else {
        child.kill('SIGTERM')
      }
    } catch (cause) {
      const error = cause as NodeJS.ErrnoException
      if (error.code !== 'ESRCH') {
        console.error('Não foi possível encerrar um servidor:', error.message)
      }
    }
  }
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))

async function isPortOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host })
    socket.setTimeout(1000)
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.on('error', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

async function assertPortAvailable(portStr: string, label: string) {
  const port = Number(portStr)
  if ((await isPortOpen(port, '127.0.0.1')) || (await isPortOpen(port, '::1'))) {
    throw new Error(
      `A porta ${port} (${label}) já está ocupada. Encerre o processo ativo antes de rodar o teste completo.`,
    )
  }
}

function startServer(
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
        `${label} encerrou inesperadamente (${signal ?? code}). Encerrando os demais processos.`,
      )
      stop(code || 1)
    }
  })
  return child
}

async function sleep(ms: number) {
  if (stopping) return
  await new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer)
      controller.signal.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, ms)
    controller.signal.addEventListener('abort', finish, { once: true })
  })
}

async function waitForHTTP(
  url: string,
  label: string,
  validate: (response: Response) => Promise<boolean>,
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
      if (response.ok && (await validate(response))) return
    } catch {
      if (stopping) return
    }
    await sleep(1000)
  }
  if (!stopping) {
    throw new Error(`${label} não ficou pronto em ${url} após 180s.`)
  }
}

function buildSampleLexical(text: string) {
  return {
    root: {
      type: 'root',
      version: 1,
      format: '',
      indent: 0,
      direction: 'ltr',
      children: [
        {
          type: 'paragraph',
          version: 1,
          format: '',
          indent: 0,
          direction: 'ltr',
          textFormat: 0,
          textStyle: '',
          children: [
            {
              type: 'text',
              version: 1,
              text,
              format: 0,
              detail: 0,
              mode: 'normal',
              style: '',
            },
          ],
        },
      ],
    },
  }
}

async function loginUser(email: string, password = DEMO_PASSWORD) {
  const response = await fetch(`${cmsURL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  assert.equal(response.ok, true, `Falha no login de ${email} (HTTP ${response.status})`)
  const data = (await response.json()) as {
    token?: string
    user?: { id: number | string; email: string; role: string }
  }
  if (!data.token || !data.user?.id) {
    throw new Error(`Credenciais ou token inválidos para ${email}`)
  }
  return { token: data.token, user: data.user }
}

async function runE2ETests() {
  const siteURL = `http://localhost:${config.sitePort}`
  console.log('\nIniciando bateria de 10 testes E2E (CMS + Site)...\n')

  // [1/10] GET /api/articles sem auth retorna apenas publicados (>= 4) e oculta reviewNotes e owner
  {
    const res = await fetch(`${cmsURL}/api/articles?limit=50`)
    assert.equal(res.ok, true, 'Listagem pública do CMS deve responder HTTP 200')
    const data = (await res.json()) as { docs: Array<Record<string, unknown>> }
    assert.ok(Array.isArray(data.docs) && data.docs.length >= 4, 'Deve retornar pelo menos 4 artigos publicados')
    for (const doc of data.docs) {
      assert.equal(doc._status, 'published', 'Listagem pública só pode conter artigos published')
      assert.equal(doc.reviewNotes, undefined, 'reviewNotes deve estar oculto para visitantes anônimos')
      assert.equal(doc.owner, undefined, 'owner deve estar oculto para visitantes anônimos')
    }
    console.log('[PASS] [1/10] GET /api/articles sem auth retorna apenas publicados (>= 4) e oculta reviewNotes e owner.')
  }

  // [2/10] GET /api/articles?where[owner][equals]=1 sem auth é bloqueado
  {
    const res = await fetch(`${cmsURL}/api/articles?where[owner][equals]=1`)
    assert.equal(res.ok, false, 'Filtro por owner sem autenticação deve ser bloqueado')
    console.log('[PASS] [2/10] GET /api/articles?where[owner][equals]=1 sem auth é bloqueado.')
  }

  // [3/10] Login como autora@gnuverse.local e consulta dos próprios artigos em todos os estados
  const autoraAuth = await loginUser('autora@gnuverse.local')
  {
    const res = await fetch(
      `${cmsURL}/api/articles?where[owner][equals]=${encodeURIComponent(String(autoraAuth.user.id))}&draft=true&limit=50`,
      {
        headers: { Authorization: `JWT ${autoraAuth.token}` },
      },
    )
    assert.equal(res.ok, true, 'Consulta autenticada da autora aos próprios artigos deve responder HTTP 200')
    const data = (await res.json()) as { docs: Array<Record<string, unknown>> }
    const reviewStatuses = new Set(data.docs.map((doc) => doc.reviewStatus))
    assert.ok(reviewStatuses.has('draft'), 'Autora deve ver seu rascunho em estado draft')
    assert.ok(reviewStatuses.has('in_review'), 'Autora deve ver seu artigo em estado in_review')
    assert.ok(reviewStatuses.has('changes_requested'), 'Autora deve ver seu artigo em estado changes_requested')
    assert.ok(
      data.docs.some((doc) => doc._status === 'published' && doc.reviewStatus === 'approved'),
      'Autora deve ver seus artigos publicados',
    )
    const changesRequestedDoc = data.docs.find((doc) => doc.slug === 'ajustes-privacidade-escolar')
    assert.ok(
      typeof changesRequestedDoc?.reviewNotes === 'string' && changesRequestedDoc.reviewNotes.length > 10,
      'Autora deve conseguir ler reviewNotes do próprio artigo com ajustes solicitados',
    )
    console.log('[PASS] [3/10] Autora autentica via JWT e consulta seus artigos (draft, in_review, changes_requested com reviewNotes e published).')
  }

  // [4/10] Login como autor2@gnuverse.local confirma isolamento de rascunhos e sigilo de reviewNotes alheios
  const autor2Auth = await loginUser('autor2@gnuverse.local')
  {
    const res = await fetch(`${cmsURL}/api/articles?draft=true&limit=50`, {
      headers: { Authorization: `JWT ${autor2Auth.token}` },
    })
    assert.equal(res.ok, true)
    const data = (await res.json()) as { docs: Array<Record<string, unknown>> }
    const slugs = new Set(data.docs.map((doc) => doc.slug))
    assert.equal(slugs.has('rascunho-laboratorios-debian'), false, 'autor2 não pode ver rascunho de autora')
    assert.equal(slugs.has('revisao-formatos-abertos'), false, 'autor2 não pode ver artigo em revisão de autora')
    assert.equal(slugs.has('ajustes-privacidade-escolar'), false, 'autor2 não pode ver artigo com ajustes de autora')

    const autoraPublished = data.docs.find((doc) => doc.slug === 'autonomia-digital-e-software-livre')
    if (!autoraPublished) {
      throw new Error('autor2 deve ver artigo publicado de autora')
    }
    assert.equal(autoraPublished.reviewNotes, undefined, 'autor2 não pode ver reviewNotes de autora')
    assert.equal(autoraPublished.owner, undefined, 'autor2 não pode ver owner de autora')
    console.log('[PASS] [4/10] Isolamento entre autores confirmado: autor2 não vê rascunhos nem reviewNotes de autora.')
  }

  // [5/10] Tentativa de autora criar artigo com _status: 'published' via REST retorna HTTP 403
  {
    const res = await fetch(`${cmsURL}/api/articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${autoraAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Tentativa de Publicação Direta',
        slug: `tentativa-publicacao-${Date.now()}`,
        summary: 'Não deve ser permitido publicar sem revisão.',
        author: 'Ana Autora',
        category: 'reflexoes',
        body: buildSampleLexical('Texto de teste bloqueado.'),
        references: [],
        _status: 'published',
      }),
    })
    assert.equal(res.status, 403, `Publicação direta por autora deveria retornar 403, mas retornou ${res.status}`)
    console.log('[PASS] [5/10] Tentativa de autora publicar diretamente via REST bloqueada com HTTP 403.')
  }

  // [6/10] Tentativa de autora enviar link javascript:alert(1) no corpo Lexical retorna HTTP 400
  {
    const xssBody = {
      root: {
        type: 'root',
        version: 1,
        format: '',
        indent: 0,
        direction: 'ltr',
        children: [
          {
            type: 'paragraph',
            version: 1,
            format: '',
            indent: 0,
            direction: 'ltr',
            children: [
              {
                type: 'link',
                version: 1,
                fields: { url: 'javascript:alert(1)', linkType: 'custom' },
                children: [{ type: 'text', version: 1, text: 'link malicioso' }],
              },
            ],
          },
        ],
      },
    }
    const res = await fetch(`${cmsURL}/api/articles?draft=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${autoraAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Tentativa XSS',
        slug: `tentativa-xss-${Date.now()}`,
        summary: 'Link inválido no corpo.',
        author: 'Ana Autora',
        category: 'reflexoes',
        body: xssBody,
        references: [],
        _status: 'draft',
      }),
    })
    assert.equal(res.status, 400, `Envio de link javascript: deveria retornar 400, mas retornou ${res.status}`)
    console.log('[PASS] [6/10] Tentativa de enviar link javascript:alert(1) no corpo Lexical rejeitada com HTTP 400.')
  }

  // [7/10] Fluxo completo de revisão via API REST (criação -> in_review -> changes_requested -> limpeza)
  {
    const tempSlug = `fluxo-e2e-${Date.now()}`
    const createRes = await fetch(`${cmsURL}/api/articles?draft=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${autoraAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Rascunho Temporário E2E',
        slug: tempSlug,
        summary: 'Artigo temporário para validar o ciclo de submissão e revisão.',
        author: 'Ana Autora',
        category: 'experiencias',
        body: buildSampleLexical('Primeiro parágrafo do rascunho temporário E2E.'),
        references: [{ label: 'Projeto GNU', url: 'https://www.gnu.org/' }],
        reviewStatus: 'draft',
        _status: 'draft',
      }),
    })
    assert.equal(createRes.ok, true, 'Autora deve conseguir criar rascunho temporário')
    const createdPayload = (await createRes.json()) as { doc: { id: number | string; reviewStatus: string } }
    const tempId = createdPayload.doc.id
    assert.equal(createdPayload.doc.reviewStatus, 'draft')

    const submitRes = await fetch(`${cmsURL}/api/articles/${tempId}?draft=true`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${autoraAuth.token}`,
      },
      body: JSON.stringify({
        reviewStatus: 'in_review',
        _status: 'draft',
      }),
    })
    assert.equal(submitRes.ok, true, 'Autora deve conseguir enviar rascunho para in_review')
    const submittedPayload = (await submitRes.json()) as { doc: { reviewStatus: string } }
    assert.equal(submittedPayload.doc.reviewStatus, 'in_review')

    const revisorAuth = await loginUser('revisor@gnuverse.local')
    const feedbackNote = 'Devolutiva automatizada E2E: incluir mais exemplos práticos.'
    const reviewRes = await fetch(`${cmsURL}/api/articles/${tempId}?draft=true`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${revisorAuth.token}`,
      },
      body: JSON.stringify({
        reviewStatus: 'changes_requested',
        reviewNotes: feedbackNote,
        _status: 'draft',
      }),
    })
    assert.equal(reviewRes.ok, true, 'Revisor deve conseguir solicitar ajustes')
    const reviewedPayload = (await reviewRes.json()) as {
      doc: { reviewStatus: string; reviewNotes: string }
    }
    assert.equal(reviewedPayload.doc.reviewStatus, 'changes_requested')
    assert.equal(reviewedPayload.doc.reviewNotes, feedbackNote)

    const deleteRes = await fetch(`${cmsURL}/api/articles/${tempId}`, {
      method: 'DELETE',
      headers: { Authorization: `JWT ${revisorAuth.token}` },
    })
    assert.equal(deleteRes.ok, true, 'Revisor deve conseguir apagar o rascunho temporário de teste')
    console.log('[PASS] [7/10] Fluxo editorial via REST (draft -> in_review -> changes_requested -> delete) validado.')
  }

  // [8/10] GET /blog/ retorna HTTP 200 e contém os 4 artigos publicados, /cms-media/ e Contribuir com um artigo
  {
    const res = await fetch(`${siteURL}/blog/`)
    assert.equal(res.status, 200, 'GET /blog/ deve retornar HTTP 200')
    const html = await res.text()
    for (const expectedTitle of [
      'Olá, GNUverse!',
      'Autonomia Digital e Software Livre no Cotidiano',
      'Oficinas de Código Aberto na Escola Pública',
      'Redes Comunitárias e Acesso Livre à Informação',
    ]) {
      assert.ok(html.includes(expectedTitle), `HTML de /blog/ deve conter "${expectedTitle}"`)
    }
    assert.ok(html.includes('/cms-media/'), 'HTML de /blog/ deve referenciar capas sincronizadas em /cms-media/')
    assert.ok(
      html.includes('Contribuir com um artigo'),
      'HTML de /blog/ deve renderizar o painel "Contribuir com um artigo"',
    )
    console.log('[PASS] [8/10] GET /blog/ retorna HTTP 200 com os 4 artigos publicados, capas /cms-media/ e painel de submissão.')
  }

  // [9/10] GET /artigos/ retorna HTTP 200 e lista os artigos
  {
    const res = await fetch(`${siteURL}/artigos/`)
    assert.equal(res.status, 200, 'GET /artigos/ deve retornar HTTP 200')
    const html = await res.text()
    assert.ok(html.includes('Autonomia Digital e Software Livre no Cotidiano'))
    assert.ok(html.includes('Oficinas de Código Aberto na Escola Pública'))
    console.log('[PASS] [9/10] GET /artigos/ retorna HTTP 200 e lista os artigos publicados.')
  }

  // [10/10] GET /artigos/autonomia-digital-e-software-livre/ retorna HTTP 200 e renderiza título, autoria, capa e referências
  {
    const res = await fetch(`${siteURL}/artigos/autonomia-digital-e-software-livre/`)
    assert.equal(res.status, 200, 'GET /artigos/autonomia-digital-e-software-livre/ deve retornar HTTP 200')
    const html = await res.text()
    assert.ok(html.includes('Autonomia Digital e Software Livre no Cotidiano'), 'Deve conter o título do artigo')
    assert.ok(html.includes('Ana Autora'), 'Deve conter a autoria do artigo')
    assert.ok(html.includes('/cms-media/'), 'Deve renderizar a imagem de capa sincronizada')
    assert.ok(
      html.includes('https://www.gnu.org/philosophy/philosophy.html'),
      'Deve renderizar link de referência para gnu.org',
    )
    assert.ok(
      html.includes('https://www.debian.org/social_contract.pt.html'),
      'Deve renderizar link de referência para debian.org',
    )
    console.log('[PASS] [10/10] GET /artigos/autonomia-digital-e-software-livre/ renderiza título, autoria, capa e referências.')
  }
}

function openBrowser(urls: string[]) {
  if (noBrowser) return
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return

  for (const url of urls) {
    try {
      const opener = spawn('xdg-open', [url], {
        stdio: 'ignore',
        detached: true,
      })
      opener.on('error', () => {
        try {
          const fallback = spawn('firefox', [url], {
            stdio: 'ignore',
            detached: true,
          })
          fallback.on('error', () => {})
          fallback.unref()
        } catch {
          // Ignorar se navegador não estiver disponível no ambiente
        }
      })
      opener.unref()
    } catch {
      // Ignorar falhas de abertura de navegador em ambientes headless
    }
  }
}

try {
  await assertPortAvailable(cmsPort, 'CMS_PORT')
  await assertPortAvailable(config.sitePort, 'SITE_PORT')

  console.log('Populando banco de demonstração (seed-blog-demo.ts)...')
  execFileSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/seed-blog-demo.ts'],
    {
      cwd: cmsRoot,
      stdio: 'inherit',
      env: { ...process.env, SITE_DEPLOY_HOOK_URL: '' },
    },
  )

  console.log(`Iniciando servidor CMS em ${cmsURL}...`)
  startServer(['run', 'cms:dev'], 'CMS', {
    CMS_ALLOWED_ORIGINS: config.allowedOrigins,
  })

  await waitForHTTP(`${cmsURL}/api/articles?limit=1`, 'CMS', async (res) => {
    const body = (await res.json()) as Record<string, unknown>
    return Array.isArray(body.docs)
  })

  console.log('Sincronizando artigos publicados e capas do CMS para o site...')
  execFileSync(process.execPath, [path.join(root, 'scripts/sync-content.mjs')], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      CMS_CONTENT_MODE: 'live',
      CMS_URL: cmsURL,
    },
  })

  const siteURL = `http://localhost:${config.sitePort}`
  console.log(`Iniciando servidor do Site em ${siteURL}...`)
  startServer(
    ['run', 'dev', '--', '--webpack', '--port', config.sitePort],
    'Site',
    {
      CMS_CONTENT_MODE: 'live',
      CMS_URL: cmsURL,
      NEXT_PUBLIC_CMS_URL: cmsURL,
      NEXT_PUBLIC_GAME_API_URL: config.gameURL,
      NEXT_PUBLIC_BLOG_TEST_UI: '1',
    },
  )

  await waitForHTTP(`${siteURL}/blog/`, 'Site', async (res) => res.status === 200)

  await runE2ETests()

  if (isOnce) {
    console.log('\nTodos os 10 testes E2E passaram! Encerrando servidores (--once/--ci).')
    stop(0)
  } else {
    const autotestBlogURL = `${siteURL}/blog/?autotest=1`
    const adminURL = `${cmsURL}/admin`
    console.log(
      [
        '',
        '========================================================================',
        '  AMBIENTE DE DEMONSTRAÇÃO E TESTE DO BLOG PRONTO (10/10 TESTES PASSARAM)',
        '========================================================================',
        `  Blog (já logado e preenchido automaticamente):`,
        `    ${autotestBlogURL}`,
        '',
        `  Painel Admin / Revisor do CMS:`,
        `    ${adminURL}`,
        '',
        `  Contas de demonstração (senha para todas: ${DEMO_PASSWORD}):`,
        '    • autora@gnuverse.local   (Autora — possui rascunhos, em revisão e ajustes)',
        '    • autor2@gnuverse.local   (Autor — possui artigos publicados)',
        '    • revisor@gnuverse.local  (Revisor — aprova, publica e solicita ajustes)',
        '    • admin@gnuverse.local    (Admin — acesso total ao CMS)',
        '========================================================================',
        '  Pressione Ctrl+C para encerrar os servidores.',
        '',
      ].join('\n'),
    )
    openBrowser([autotestBlogURL, adminURL])
  }
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : cause)
  stop(1)
}
