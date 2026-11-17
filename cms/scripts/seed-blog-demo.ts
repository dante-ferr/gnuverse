import { access, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { loadLocalEnvironment } from './local-config.mjs'

export const DEMO_PASSWORD = 'gnuverse123'

const cmsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = path.resolve(cmsRoot, '..')

loadLocalEnvironment(projectRoot)
try {
  process.loadEnvFile(path.join(cmsRoot, '.env'))
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
}

if (!process.env.PAYLOAD_SECRET) {
  await import('./setup-local.mjs')
  try {
    process.loadEnvFile(path.join(cmsRoot, '.env'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

process.env.SITE_DEPLOY_HOOK_URL = ''

function buildLexicalBody(paragraphs: string[]) {
  return {
    root: {
      type: 'root',
      version: 1,
      format: '' as const,
      indent: 0,
      direction: 'ltr' as const,
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        version: 1,
        format: '' as const,
        indent: 0,
        direction: 'ltr' as const,
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
      })),
    },
  }
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

async function initPayloadWithRecovery(): Promise<Payload> {
  const { default: configPromise } = await import('../src/payload.config')
  const resolvedConfig = await configPromise
  try {
    return await getPayload({ config: resolvedConfig })
  } catch (error) {
    const message = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? '')}` : String(error)
    const isSqliteSchemaConflict =
      process.env.DATABASE_ADAPTER !== 'postgres' &&
      (message.includes('SQLITE_ERROR') || message.includes('already exists'))
    if (!isSqliteSchemaConflict) throw error

    const dbUrl = process.env.DATABASE_URL || 'file:./data/gnuverse.db'
    if (!dbUrl.startsWith('file:')) throw error
    const dbFile = path.resolve(cmsRoot, dbUrl.slice('file:'.length))
    console.warn('Banco SQLite local com schema antigo ou incompleto detectado; recriando banco local de desenvolvimento...')
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      await rm(`${dbFile}${suffix}`, { force: true })
    }
    process.env.PAYLOAD_FORCE_DRIZZLE_PUSH = 'true'
    return await getPayload({ config: resolvedConfig })
  }
}

async function main() {
  const payload = await initPayloadWithRecovery()

  try {
    const demoUsers = [
      {
        email: 'admin@gnuverse.local',
        name: 'Ada Admin',
        role: 'admin' as const,
      },
      {
        email: 'revisor@gnuverse.local',
        name: 'Rui Revisor',
        role: 'reviewer' as const,
      },
      {
        email: 'autora@gnuverse.local',
        name: 'Ana Autora',
        role: 'author' as const,
      },
      {
        email: 'autor2@gnuverse.local',
        name: 'Beto Autor',
        role: 'author' as const,
      },
    ]

    const usersByEmail = new Map<string, { id: number; email: string; name: string; role: string }>()

    for (const account of demoUsers) {
      const existing = await payload.find({
        collection: 'users',
        overrideAccess: true,
        limit: 1,
        where: { email: { equals: account.email } },
      })

      if (existing.docs[0]) {
        const updated = await payload.update({
          collection: 'users',
          id: existing.docs[0].id,
          overrideAccess: true,
          data: {
            name: account.name,
            role: account.role,
            password: DEMO_PASSWORD,
            _verified: true,
          },
        })
        usersByEmail.set(account.email, {
          id: updated.id,
          email: account.email,
          name: updated.name,
          role: updated.role,
        })
      } else {
        const created = await payload.create({
          collection: 'users',
          overrideAccess: true,
          disableVerificationEmail: true,
          data: {
            email: account.email,
            name: account.name,
            role: account.role,
            password: DEMO_PASSWORD,
            _verified: true,
          },
        })
        usersByEmail.set(account.email, {
          id: created.id,
          email: account.email,
          name: created.name,
          role: created.role,
        })
      }
    }

    const autora = usersByEmail.get('autora@gnuverse.local')!
    const autor2 = usersByEmail.get('autor2@gnuverse.local')!

    const coverSpecs = [
      {
        key: 'experiencias',
        filename: 'capa-experiencias.png',
        color: '#0f766e',
        alt: 'Ilustração geométrica verde-petróleo representando experiências coletivas no GNUverse',
        credit: 'Arte gerada pelo GNUverse · CC BY-SA 4.0',
      },
      {
        key: 'reflexoes',
        filename: 'capa-reflexoes.png',
        color: '#1d4ed8',
        alt: 'Ilustração geométrica azul representando reflexões sobre autonomia digital e software livre',
        credit: 'Arte gerada pelo GNUverse · CC BY-SA 4.0',
      },
      {
        key: 'educacao',
        filename: 'capa-educacao.png',
        color: '#b45309',
        alt: 'Ilustração geométrica âmbar representando oficinas de código aberto na educação pública',
        credit: 'Arte gerada pelo GNUverse · CC BY-SA 4.0',
      },
      {
        key: 'acesso',
        filename: 'capa-acesso.png',
        color: '#6d28d9',
        alt: 'Ilustração geométrica violeta representando redes comunitárias e acesso livre à comunicação',
        credit: 'Arte gerada pelo GNUverse · CC BY-SA 4.0',
      },
    ] as const

    const mediaByKey = new Map<string, number>()
    const mediaDir = process.env.MEDIA_DIR
      ? path.resolve(process.env.MEDIA_DIR)
      : path.resolve(cmsRoot, 'media')

    for (const spec of coverSpecs) {
      const buffer = await sharp({
        create: {
          width: 800,
          height: 450,
          channels: 3,
          background: spec.color,
        },
      })
        .png()
        .toBuffer()

      const existing = await payload.find({
        collection: 'media',
        overrideAccess: true,
        limit: 1,
        where: { alt: { equals: spec.alt } },
      })

      const existingDoc = existing.docs[0]
      const hasDiskFile =
        existingDoc?.filename
          ? await fileExists(path.join(mediaDir, existingDoc.filename))
          : false

      if (existingDoc && hasDiskFile) {
        const updated = await payload.update({
          collection: 'media',
          id: existingDoc.id,
          overrideAccess: true,
          data: {
            alt: spec.alt,
            credit: spec.credit,
          },
        })
        mediaByKey.set(spec.key, updated.id)
      } else if (existingDoc) {
        const updated = await payload.update({
          collection: 'media',
          id: existingDoc.id,
          overrideAccess: true,
          data: {
            alt: spec.alt,
            credit: spec.credit,
          },
          file: {
            data: buffer,
            mimetype: 'image/png',
            name: spec.filename,
            size: buffer.length,
          },
        })
        mediaByKey.set(spec.key, updated.id)
      } else {
        const created = await payload.create({
          collection: 'media',
          overrideAccess: true,
          data: {
            alt: spec.alt,
            credit: spec.credit,
          },
          file: {
            data: buffer,
            mimetype: 'image/png',
            name: spec.filename,
            size: buffer.length,
          },
        })
        mediaByKey.set(spec.key, created.id)
      }
    }

    function daysAgoIso(days: number): string {
      return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    }

    const publishedArticles = [
      {
        title: 'Olá, GNUverse!',
        slug: 'ola-gnuverse',
        summary: 'Um artigo de demonstração para testar o caminho completo entre o CMS editorial e o site estático.',
        author: 'Ana Autora',
        owner: autora.id,
        category: 'experiencias' as const,
        cover: mediaByKey.get('experiencias')!,
        publishedAt: daysAgoIso(2),
        hashtags: [{ tag: 'gnuverse' }, { tag: 'softwarelivre' }, { tag: 'experiencias' }],
        paragraphs: [
          'Este é um conteúdo de demonstração do GNUverse. Nosso coletivo investiga como o software livre pode ampliar o acesso à tecnologia em escolas, centros comunitários e projetos estudantis.',
          'O fluxo editorial foi desenhado para que autoras e autores escrevam rascunhos diretamente pelo blog e recebam devolutivas da equipe revisora antes da publicação.',
          'Cada artigo aprovado é sincronizado com o site estático com suas capas e referências verificadas.',
        ],
        references: [
          {
            label: 'O que é o Software Livre? — Projeto GNU',
            url: 'https://www.gnu.org/philosophy/free-sw.pt-br.html',
          },
        ],
      },
      {
        title: 'Autonomia Digital e Software Livre no Cotidiano',
        slug: 'autonomia-digital-e-software-livre',
        summary: 'Por que compreender, estudar e compartilhar os programas que usamos é essencial para a cidadania digital.',
        author: 'Ana Autora',
        owner: autora.id,
        category: 'reflexoes' as const,
        cover: mediaByKey.get('reflexoes')!,
        publishedAt: daysAgoIso(5),
        hashtags: [{ tag: 'autonomiadigital' }, { tag: 'softwarelivre' }, { tag: 'cidadania' }],
        paragraphs: [
          'A autonomia digital começa quando uma comunidade deixa de ser apenas consumidora de caixas-pretas tecnológicas e passa a compreender como seus dados e ferramentas funcionam.',
          'Com licenças livres e padrões abertos, estudantes, professoras e coletivos podem auditar programas, traduzir interfaces e adaptar soluções para as necessidades locais sem pedir permissão a grandes corporações.',
          'Mais do que uma escolha técnica, adotar software livre é um compromisso pedagógico com o conhecimento compartilhado e com a transparência pública.',
        ],
        references: [
          {
            label: 'Filosofia do Projeto GNU',
            url: 'https://www.gnu.org/philosophy/philosophy.html',
          },
          {
            label: 'Contrato Social Debian',
            url: 'https://www.debian.org/social_contract.pt.html',
          },
        ],
      },
      {
        title: 'Oficinas de Código Aberto na Escola Pública',
        slug: 'oficinas-de-codigo-aberto-na-escola',
        summary: 'Relato prático de como reutilizar computadores escolares com distribuições GNU/Linux leves e atividades colaborativas.',
        author: 'Beto Autor',
        owner: autor2.id,
        category: 'educacao' as const,
        cover: mediaByKey.get('educacao')!,
        publishedAt: daysAgoIso(15),
        hashtags: [{ tag: 'educacao' }, { tag: 'linux' }, { tag: 'escola' }],
        paragraphs: [
          'Muitos laboratórios escolares possuem máquinas que deixam de receber suporte de sistemas proprietários, mas que ganham vida nova quando instaladas com sistemas livres leves e bem documentados.',
          'Durante as oficinas, estudantes aprendem desde a instalação até a manutenção básica do sistema, descobrindo que erros não são bloqueios misteriosos, mas convites para investigar como o computador opera.',
        ],
        references: [
          {
            label: 'Software Livre e Educação — GNU',
            url: 'https://www.gnu.org/education/education.html',
          },
        ],
      },
      {
        title: 'Redes Comunitárias e Acesso Livre à Informação',
        slug: 'redes-comunitarias-e-acesso-livre',
        summary: 'Como infraestruturas geridas por moradores e estudantes fortalecem a conectividade e o direito à comunicação.',
        author: 'Beto Autor',
        owner: autor2.id,
        category: 'acesso' as const,
        cover: mediaByKey.get('acesso')!,
        publishedAt: daysAgoIso(22),
        hashtags: [{ tag: 'redescomunitarias' }, { tag: 'acesso' }, { tag: 'gnuverse' }],
        paragraphs: [
          'O acesso à internet e a acervos educacionais ainda é desigual. Redes comunitárias construídas com roteadores livres e servidores locais mostram que a infraestrutura também pode ser um bem comum.',
          'Ao hospedar bibliotecas digitais, wikis e serviços locais em software livre, uma comunidade garante que o aprendizado continue mesmo quando a conexão externa falha ou é limitada.',
        ],
        references: [
          {
            label: 'Projeto Debian — O Sistema Operacional Universal',
            url: 'https://www.debian.org/intro/about',
          },
        ],
      },
      {
        title: 'Festival de Instalação Livre no Campus',
        slug: 'festival-instalacao-livre-campus',
        summary: 'Como organizamos um mutirão de instalação de sistemas livres e recuperação de notebooks com estudantes.',
        author: 'Ana Autora',
        owner: autora.id,
        category: 'experiencias' as const,
        cover: mediaByKey.get('experiencias')!,
        publishedAt: daysAgoIso(45),
        hashtags: [{ tag: 'installfest' }, { tag: 'debian' }, { tag: 'experiencias' }],
        paragraphs: [
          'Durante um sábado inteiro, voluntárias e estudantes trouxeram computadores antigos para testar distribuições GNU/Linux e aprender a fazer cópias de segurança antes da migração.',
          'Mais de vinte máquinas voltaram a funcionar com fluidez para estudos de programação, edição de textos e pesquisa acadêmica.',
        ],
        references: [
          {
            label: 'Documentação Debian',
            url: 'https://www.debian.org/doc/',
          },
        ],
      },
      {
        title: 'Por que Documentação Aberta Também é Software Livre',
        slug: 'documentacao-aberta-e-software-livre',
        summary: 'Manuais livres e guias colaborativos garantem que o conhecimento técnico não fique restrito a poucos especialistas.',
        author: 'Beto Autor',
        owner: autor2.id,
        category: 'reflexoes' as const,
        cover: mediaByKey.get('reflexoes')!,
        publishedAt: daysAgoIso(65),
        hashtags: [{ tag: 'documentacao' }, { tag: 'softwarelivre' }, { tag: 'culturalivre' }],
        paragraphs: [
          'Um programa livre sem documentação acessível ainda cria barreiras para quem está começando. Licenças livres para manuais permitem traduzir, adaptar e imprimir apostilas sem restrições.',
          'Documentar em linguagem clara faz parte da responsabilidade coletiva de acolher novas pessoas na comunidade.',
        ],
        references: [
          {
            label: 'Licença de Documentação Livre GNU (GFDL)',
            url: 'https://www.gnu.org/licenses/fdl-1.3.html',
          },
        ],
      },
      {
        title: 'Bibliotecas Digitais Offline em Salas de Aula',
        slug: 'bibliotecas-digitais-offline-na-aula',
        summary: 'Servidores locais com conteúdo aberto permitem consultar enciclopédias e apostilas mesmo sem internet.',
        author: 'Ana Autora',
        owner: autora.id,
        category: 'educacao' as const,
        cover: mediaByKey.get('educacao')!,
        publishedAt: daysAgoIso(90),
        hashtags: [{ tag: 'educacao' }, { tag: 'offline' }, { tag: 'acessibilidade' }],
        paragraphs: [
          'Nem toda escola conta com banda larga estável. Usando um computador simples na rede local, é possível servir materiais didáticos em HTML, PDF e vídeo aberto para dezenas de alunos.',
          'A manutenção desse acervo vira também uma atividade interdisciplinar envolvendo leitura, curadoria e administração básica de sistemas.',
        ],
        references: [
          {
            label: 'Recursos Educacionais Abertos — UNESCO',
            url: 'https://www.unesco.org/en/open-educational-resources',
          },
        ],
      },
      {
        title: 'Acessibilidade Digital com Leitores de Tela Livres',
        slug: 'acessibilidade-digital-leitores-de-tela',
        summary: 'Práticas simples de semântica web e testes com tecnologias assistivas livres tornam projetos estudantis mais inclusivos.',
        author: 'Beto Autor',
        owner: autor2.id,
        category: 'acesso' as const,
        cover: mediaByKey.get('acesso')!,
        publishedAt: daysAgoIso(120),
        hashtags: [{ tag: 'acessibilidade' }, { tag: 'acesso' }, { tag: 'inclusao' }],
        paragraphs: [
          'Testar sites e apostilas com leitores de tela livres como o Orca revela rapidamente problemas de contraste, falta de texto alternativo e navegação confusa por teclado.',
          'Quando a acessibilidade entra desde o início do projeto, todas as pessoas ganham em clareza e autonomia de leitura.',
        ],
        references: [
          {
            label: 'Projeto Orca — GNOME Accessibility',
            url: 'https://help.gnome.org/users/orca/stable/',
          },
        ],
      },
    ]

    for (const item of publishedArticles) {
      const existing = await payload.find({
        collection: 'articles',
        overrideAccess: true,
        draft: true,
        limit: 1,
        where: { slug: { equals: item.slug } },
      })

      const articleData = {
        title: item.title,
        slug: item.slug,
        summary: item.summary,
        author: item.author,
        owner: item.owner,
        category: item.category,
        cover: item.cover,
        publishedAt: item.publishedAt,
        hashtags: item.hashtags,
        body: buildLexicalBody(item.paragraphs),
        references: item.references,
        reviewStatus: 'approved' as const,
        reviewNotes: 'Artigo revisado e aprovado pela equipe editorial do GNUverse.',
        _status: 'published' as const,
      }

      if (existing.docs[0]) {
        await payload.update({
          collection: 'articles',
          id: existing.docs[0].id,
          overrideAccess: true,
          draft: false,
          context: { skipSiteDeploy: true },
          data: articleData,
        })
      } else {
        await payload.create({
          collection: 'articles',
          overrideAccess: true,
          draft: false,
          context: { skipSiteDeploy: true },
          data: articleData,
        })
      }
    }

    const editorialDrafts = [
      {
        title: 'Rascunho: Laboratórios Comunitários com Debian',
        slug: 'rascunho-laboratorios-debian',
        summary: 'Anotações iniciais sobre como montar imagens de instalação padronizadas para laboratórios comunitários.',
        author: 'Ana Autora',
        owner: autora.id,
        category: 'educacao' as const,
        reviewStatus: 'draft' as const,
        reviewNotes: '',
        paragraphs: [
          'Este rascunho reúne os primeiros passos para documentar a montagem de um laboratório comunitário usando Debian Stable e pacotes educacionais offline.',
          'Ainda vamos detalhar a lista de pacotes recomendados e o roteiro de manutenção compartilhada entre monitores.',
        ],
        references: [
          {
            label: 'Manual de Instalação do Debian',
            url: 'https://www.debian.org/releases/stable/installmanual',
          },
        ],
      },
      {
        title: 'Em Revisão: Por que Formatos Abertos Importam',
        slug: 'revisao-formatos-abertos',
        summary: 'Texto submetido para avaliação editorial sobre preservação de documentos públicos e interoperabilidade.',
        author: 'Ana Autora',
        owner: autora.id,
        category: 'reflexoes' as const,
        reviewStatus: 'in_review' as const,
        reviewNotes: '',
        paragraphs: [
          'Quando uma instituição pública salva documentos apenas em formatos proprietários fechados, ela obriga cidadãos e estudantes a adquirir softwares específicos apenas para ler informações de interesse coletivo.',
          'Formatos abertos como ODF, SVG e Markdown garantem longevidade, interoperabilidade e independência de fornecedor.',
        ],
        references: [
          {
            label: 'Nós Podemos Acabar com os Anexos Word — GNU',
            url: 'https://www.gnu.org/philosophy/no-word-attachments.pt-br.html',
          },
        ],
      },
      {
        title: 'Ajustes Solicitados: Guia de Privacidade na Escola',
        slug: 'ajustes-privacidade-escolar',
        summary: 'Boas práticas para proteger estudantes contra rastreamento abusivo em atividades online.',
        author: 'Ana Autora',
        owner: autora.id,
        category: 'acesso' as const,
        reviewStatus: 'changes_requested' as const,
        reviewNotes:
          'Ótimo ponto de partida! Antes de publicarmos, adicione pelo menos uma referência oficial no final e detalhe no segundo parágrafo como configurar o navegador nos computadores do laboratório.',
        paragraphs: [
          'Plataformas gratuitas de grandes empresas costumam coletar dados comportamentais de estudantes sem que a comunidade escolar perceba o alcance desse rastreamento.',
          'Precisamos adotar navegadores respeitosos à privacidade e extensões livres que bloqueiem rastreadores de terceiros por padrão.',
        ],
        references: [
          {
            label: 'Vigilância e Software Livre — Projeto GNU',
            url: 'https://www.gnu.org/philosophy/surveillance-vs-democracy.html',
          },
        ],
      },
    ]

    for (const draftItem of editorialDrafts) {
      const existing = await payload.find({
        collection: 'articles',
        overrideAccess: true,
        draft: true,
        limit: 1,
        where: { slug: { equals: draftItem.slug } },
      })

      const draftData = {
        title: draftItem.title,
        slug: draftItem.slug,
        summary: draftItem.summary,
        author: draftItem.author,
        owner: draftItem.owner,
        category: draftItem.category,
        body: buildLexicalBody(draftItem.paragraphs),
        references: draftItem.references,
        reviewStatus: draftItem.reviewStatus,
        reviewNotes: draftItem.reviewNotes,
        _status: 'draft' as const,
      }

      if (existing.docs[0]) {
        await payload.update({
          collection: 'articles',
          id: existing.docs[0].id,
          overrideAccess: true,
          draft: true,
          context: { skipSiteDeploy: true },
          data: draftData,
        })
      } else {
        await payload.create({
          collection: 'articles',
          overrideAccess: true,
          draft: true,
          context: { skipSiteDeploy: true },
          data: draftData,
        })
      }
    }

    console.log(
      [
        'Seed de demonstração do blog concluído com sucesso:',
        `  • 4 contas preparadas (senha padrão: ${DEMO_PASSWORD}): admin@gnuverse.local, revisor@gnuverse.local, autora@gnuverse.local, autor2@gnuverse.local`,
        '  • 4 imagens de capa geradas (experiencias, reflexoes, educacao, acesso)',
        '  • 8 artigos publicados (2 por categoria, com capa, hashtags e datas variadas)',
        '  • 3 artigos em fluxo editorial de autora@gnuverse.local (draft, in_review, changes_requested)',
      ].join('\n'),
    )
  } finally {
    await payload.destroy()
  }
}

await main()
