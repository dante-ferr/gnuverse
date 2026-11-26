import { access, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { emailVerificationEnabled } from '../src/email/settings'
import { loadLocalEnvironment } from './local-config.mjs'
import { SEED_MEDIA_SPECS } from './seed-media-art'

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
process.env.CMS_SEEDING = '1'

type BodyBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'upload'; mediaId: number }

function buildLexicalBody(blocks: BodyBlock[]) {
  return {
    root: {
      type: 'root',
      version: 1,
      format: '' as const,
      indent: 0,
      direction: 'ltr' as const,
      children: blocks.map((block) => {
        if (block.type === 'upload') {
          return {
            type: 'upload' as const,
            version: 3,
            format: '' as const,
            id: `media-${block.mediaId}`,
            fields: null,
            relationTo: 'media' as const,
            value: block.mediaId,
          }
        }
        if (block.type === 'heading') {
          return {
            type: 'heading' as const,
            version: 1,
            tag: 'h2' as const,
            format: '' as const,
            indent: 0,
            direction: 'ltr' as const,
            children: [
              {
                type: 'text',
                version: 1,
                text: block.text,
                format: 0,
                detail: 0,
                mode: 'normal',
                style: '',
              },
            ],
          }
        }
        return {
          type: 'paragraph' as const,
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
              text: block.text,
              format: 0,
              detail: 0,
              mode: 'normal',
              style: '',
            },
          ],
        }
      }),
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
    const message =
      error instanceof Error
        ? `${error.message} ${String((error as { cause?: unknown }).cause ?? '')}`
        : String(error)
    const isSqliteSchemaConflict =
      process.env.DATABASE_ADAPTER !== 'postgres' &&
      (message.includes('SQLITE_ERROR') || message.includes('already exists'))
    if (!isSqliteSchemaConflict) throw error

    const dbUrl = process.env.DATABASE_URL || 'file:./data/gnuverse.db'
    if (!dbUrl.startsWith('file:')) throw error
    const dbFile = path.resolve(cmsRoot, dbUrl.slice('file:'.length))
    console.warn(
      'Banco SQLite local com schema antigo ou incompleto detectado; recriando banco local de desenvolvimento...',
    )
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
        // Keep username aligned with HOST_ADMIN_USERNAME so reset/bootstrap login stays predictable.
        email: 'admin@gnuverse.local',
        username: process.env.HOST_ADMIN_USERNAME?.trim().toLowerCase() || 'admin',
        name: process.env.HOST_ADMIN_NAME?.trim() || 'Ada Admin',
        role: 'admin' as const,
      },
      {
        email: 'revisor@gnuverse.local',
        username: 'rui_revisor',
        name: 'Rui Revisor',
        role: 'reviewer' as const,
      },
      {
        email: 'autora@gnuverse.local',
        username: 'ana_autora',
        name: 'Ana Autora',
        role: 'author' as const,
      },
      {
        email: 'autor2@gnuverse.local',
        username: 'beto_autor',
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

      const accountData = {
        email: account.email,
        username: account.username,
        name: account.name,
        role: account.role,
        password: DEMO_PASSWORD,
        ...(emailVerificationEnabled ? { _verified: true } : {}),
      }

      if (existing.docs[0]) {
        const updated = await payload.update({
          collection: 'users',
          id: existing.docs[0].id,
          overrideAccess: true,
          data: accountData,
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
          data: accountData,
        })
        usersByEmail.set(account.email, {
          id: created.id,
          email: account.email,
          name: created.name,
          role: created.role,
        })
      }
    }

    const admin = usersByEmail.get('admin@gnuverse.local')!
    const autora = usersByEmail.get('autora@gnuverse.local')!
    const autor2 = usersByEmail.get('autor2@gnuverse.local')!

    const mediaByKey = new Map<string, number>()
    const mediaDir = process.env.MEDIA_DIR
      ? path.resolve(process.env.MEDIA_DIR)
      : path.resolve(cmsRoot, 'media')

    for (const spec of SEED_MEDIA_SPECS) {
      const buffer = await sharp(Buffer.from(spec.svg)).png().toBuffer()

      const existing = await payload.find({
        collection: 'media',
        overrideAccess: true,
        limit: 1,
        where: { alt: { equals: spec.alt } },
      })

      const existingDoc = existing.docs[0]
      const hasDiskFile = existingDoc?.filename
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

    const publishedArticles: Array<{
      title: string
      slug: string
      summary: string
      author: string
      owner: number
      category: 'experiencias' | 'reflexoes' | 'educacao' | 'acesso'
      cover: number
      publishedAt: string
      hashtags: Array<{ tag: string }>
      blocks: BodyBlock[]
      references: Array<{ label: string; url: string }>
    }> = [
      {
        title: 'Olá, GNUverse!',
        slug: 'ola-gnuverse',
        summary:
          'Como o coletivo GNUverse combina pesquisa aberta, jogo cooperativo e escrita colaborativa para democratizar o acesso à tecnologia.',
        author: 'Ana Autora',
        owner: autora.id,
        category: 'experiencias',
        cover: mediaByKey.get('cover-ola-gnuverse')!,
        publishedAt: daysAgoIso(2),
        hashtags: [{ tag: 'gnuverse' }, { tag: 'softwarelivre' }, { tag: 'experiencias' }],
        blocks: [
          {
            type: 'paragraph',
            text: 'O GNUverse nasce em sala de aula com uma pergunta prática: o que muda quando tratamos o software não como um produto fechado, mas como infraestrutura pública de conhecimento? Ao longo do semestre, sete participantes investigam experiências reais de software livre em escolas, universidades e redes locais.',
          },
          {
            type: 'heading',
            text: 'Escrita aberta, jogo cooperativo e verificação coletiva',
          },
          {
            type: 'paragraph',
            text: 'Cada artigo publicado aqui passa por um fluxo editorial transparente: autoras e autores redigem rascunhos diretamente pelo blog, anexam ilustrações e diagramas próprios e recebem devolutivas da equipe revisora antes da publicação estática.',
          },
          {
            type: 'upload',
            mediaId: mediaByKey.get('figure-quatro-liberdades')!,
          },
          {
            type: 'paragraph',
            text: 'Ao lado dos textos, o jogo cooperativo Open Pipeline e os quizzes ajudam a transformar conceitos como licenças livres, manutenção compartilhada e governança comunitária em experiências concretas.',
          },
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
        summary:
          'Por que compreender, estudar e compartilhar os programas que usamos é essencial para a cidadania digital e a independência tecnológica.',
        author: 'Ana Autora',
        owner: autora.id,
        category: 'reflexoes',
        cover: mediaByKey.get('cover-autonomia-digital')!,
        publishedAt: daysAgoIso(5),
        hashtags: [{ tag: 'autonomiadigital' }, { tag: 'softwarelivre' }, { tag: 'cidadania' }],
        blocks: [
          {
            type: 'paragraph',
            text: 'A autonomia digital começa quando uma comunidade deixa de ser apenas consumidora de caixas-pretas tecnológicas e passa a compreender como seus dados, dispositivos e ferramentas funcionam por dentro.',
          },
          {
            type: 'heading',
            text: 'Das quatro liberdades à prática comunitária',
          },
          {
            type: 'paragraph',
            text: 'Com licenças livres e padrões abertos, estudantes, professoras e coletivos podem auditar programas, traduzir interfaces para o português e adaptar soluções para as necessidades locais sem depender de autorização comercial.',
          },
          {
            type: 'upload',
            mediaId: mediaByKey.get('figure-quatro-liberdades')!,
          },
          {
            type: 'paragraph',
            text: 'Mais do que uma escolha técnica, adotar software livre é um compromisso pedagógico com o conhecimento compartilhado, a transparência pública e a soberania sobre os próprios arquivos.',
          },
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
        summary:
          'Relato prático de como reutilizar computadores escolares com distribuições GNU/Linux leves, espelho local de pacotes e manutenção coletiva.',
        author: 'Beto Autor',
        owner: autor2.id,
        category: 'educacao',
        cover: mediaByKey.get('cover-oficinas-escola')!,
        publishedAt: daysAgoIso(15),
        hashtags: [{ tag: 'educacao' }, { tag: 'linux' }, { tag: 'escola' }],
        blocks: [
          {
            type: 'paragraph',
            text: 'Muitos laboratórios escolares acumulam computadores considerados obsoletos por sistemas proprietários recentes, mas que continuam plenamente capazes quando recebem distribuições GNU/Linux leves como Debian com ambiente XFCE.',
          },
          {
            type: 'heading',
            text: 'Organização do laboratório e espelho local',
          },
          {
            type: 'paragraph',
            text: 'Para contornar conexões instáveis, montamos um pequeno servidor local de cache de pacotes. Assim, a turma instala ferramentas de programação, edição de texto e design gráfico pela rede interna em poucos minutos.',
          },
          {
            type: 'upload',
            mediaId: mediaByKey.get('figure-arquitetura-lab-livre')!,
          },
          {
            type: 'paragraph',
            text: 'Durante as oficinas, estudantes acompanham desde a instalação até a manutenção básica do sistema, descobrindo que mensagens de erro não são bloqueios misteriosos, mas convites para investigar como o computador opera.',
          },
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
        summary:
          'Como infraestruturas geridas por moradores e estudantes com roteadores livres fortalecem a conectividade e o direito à comunicação.',
        author: 'Beto Autor',
        owner: autor2.id,
        category: 'acesso',
        cover: mediaByKey.get('cover-redes-comunitarias')!,
        publishedAt: daysAgoIso(22),
        hashtags: [{ tag: 'redescomunitarias' }, { tag: 'acesso' }, { tag: 'gnuverse' }],
        blocks: [
          {
            type: 'paragraph',
            text: 'O acesso à internet e a acervos educacionais ainda é profundamente desigual. Redes comunitárias construídas com roteadores livres e servidores locais mostram que a própria infraestrutura de comunicação pode ser gerida como bem comum.',
          },
          {
            type: 'heading',
            text: 'Topologia em malha e serviços que funcionam offline',
          },
          {
            type: 'paragraph',
            text: 'Usando firmwares livres como o OpenWrt, vizinhos e centros culturais interligam pontos do bairro sem depender exclusivamente de provedores comerciais. Mesmo quando o enlace externo oscila, os serviços internos permanecem no ar.',
          },
          {
            type: 'upload',
            mediaId: mediaByKey.get('figure-rede-comunitaria')!,
          },
          {
            type: 'paragraph',
            text: 'Ao hospedar bibliotecas digitais, wikis e fóruns locais em software livre, a comunidade garante continuidade aos estudos e fortalece laços de autogestão tecnológica.',
          },
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
        summary:
          'Como organizamos um mutirão de instalação de sistemas livres, cópias de segurança e recuperação de notebooks com estudantes.',
        author: 'Ana Autora',
        owner: autora.id,
        category: 'experiencias',
        cover: mediaByKey.get('cover-festival-instalacao')!,
        publishedAt: daysAgoIso(45),
        hashtags: [{ tag: 'installfest' }, { tag: 'debian' }, { tag: 'experiencias' }],
        blocks: [
          {
            type: 'paragraph',
            text: 'Durante um sábado inteiro no campus, voluntárias e estudantes trouxeram computadores antigos para testar distribuições GNU/Linux em modo live, planejar partições e aprender a fazer cópias de segurança antes da migração.',
          },
          {
            type: 'heading',
            text: 'Do medo de formatar à autonomia técnica',
          },
          {
            type: 'upload',
            mediaId: mediaByKey.get('figure-arquitetura-lab-livre')!,
          },
          {
            type: 'paragraph',
            text: 'Mais de vinte máquinas voltaram a funcionar com fluidez para estudos de programação, edição de textos e pesquisa acadêmica — e quem participou da manhã já ajudou novas pessoas no turno da tarde.',
          },
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
        summary:
          'Manuais livres, traduções comunitárias e guias colaborativos garantem que o conhecimento técnico não fique restrito a poucos especialistas.',
        author: 'Beto Autor',
        owner: autor2.id,
        category: 'reflexoes',
        cover: mediaByKey.get('cover-documentacao-aberta')!,
        publishedAt: daysAgoIso(65),
        hashtags: [{ tag: 'documentacao' }, { tag: 'softwarelivre' }, { tag: 'culturalivre' }],
        blocks: [
          {
            type: 'paragraph',
            text: 'Um programa livre sem documentação acessível ainda ergue barreiras invisíveis para quem está começando. Licenças livres para manuais permitem traduzir, adaptar exemplos e imprimir apostilas sem restrições jurídicas.',
          },
          {
            type: 'heading',
            text: 'Escrever claro é uma forma de inclusão',
          },
          {
            type: 'upload',
            mediaId: mediaByKey.get('figure-fluxo-acessibilidade')!,
          },
          {
            type: 'paragraph',
            text: 'Documentar em português claro, com estrutura semântica e exemplos reproduzíveis, faz parte da responsabilidade coletiva de acolher novas pessoas na comunidade de software livre.',
          },
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
        summary:
          'Servidores locais com conteúdo aberto permitem consultar enciclopédias, vídeos educativos e apostilas mesmo sem acesso à internet.',
        author: 'Ana Autora',
        owner: autora.id,
        category: 'educacao',
        cover: mediaByKey.get('cover-bibliotecas-offline')!,
        publishedAt: daysAgoIso(90),
        hashtags: [{ tag: 'educacao' }, { tag: 'offline' }, { tag: 'acessibilidade' }],
        blocks: [
          {
            type: 'paragraph',
            text: 'Nem toda escola conta com banda larga estável. Usando um computador simples na rede local com ferramentas livres como Kiwix e servidores HTTP estáticos, é possível servir materiais didáticos em HTML, PDF e vídeo aberto para dezenas de estudantes simultaneamente.',
          },
          {
            type: 'heading',
            text: 'Curadoria coletiva do acervo',
          },
          {
            type: 'upload',
            mediaId: mediaByKey.get('figure-rede-comunitaria')!,
          },
          {
            type: 'paragraph',
            text: 'A manutenção desse acervo se transforma em uma atividade interdisciplinar envolvendo leitura crítica, curadoria de recursos educacionais abertos e administração básica de sistemas.',
          },
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
        summary:
          'Práticas de semântica web, navegação por teclado e testes com tecnologias assistivas livres tornam projetos estudantis realmente inclusivos.',
        author: 'Beto Autor',
        owner: autor2.id,
        category: 'acesso',
        cover: mediaByKey.get('cover-acessibilidade-digital')!,
        publishedAt: daysAgoIso(120),
        hashtags: [{ tag: 'acessibilidade' }, { tag: 'acesso' }, { tag: 'inclusao' }],
        blocks: [
          {
            type: 'paragraph',
            text: 'Testar sites, jogos e apostilas com leitores de tela livres como o Orca revela rapidamente problemas de contraste, falta de texto alternativo em imagens e navegação confusa por teclado.',
          },
          {
            type: 'heading',
            text: 'Do HTML semântico à leitura previsível',
          },
          {
            type: 'upload',
            mediaId: mediaByKey.get('figure-fluxo-acessibilidade')!,
          },
          {
            type: 'paragraph',
            text: 'Quando a acessibilidade entra desde o início do projeto, a democratização da tecnologia deixa de ser discurso e se traduz em clareza, autonomia de leitura e participação plena para todas as pessoas.',
          },
        ],
        references: [
          {
            label: 'Projeto Orca — GNOME Accessibility',
            url: 'https://help.gnome.org/users/orca/stable/',
          },
        ],
      },
    ]

    const articleIdBySlug = new Map<string, number>()

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
        body: buildLexicalBody(item.blocks),
        references: item.references,
        reviewStatus: 'approved' as const,
        reviewNotes: 'Artigo revisado e aprovado pela equipe editorial do GNUverse.',
        _status: 'published' as const,
      }

      if (existing.docs[0]) {
        const updated = await payload.update({
          collection: 'articles',
          id: existing.docs[0].id,
          overrideAccess: true,
          draft: false,
          context: { skipSiteDeploy: true },
          data: articleData,
        })
        articleIdBySlug.set(item.slug, updated.id)
      } else {
        const created = await payload.create({
          collection: 'articles',
          overrideAccess: true,
          draft: false,
          context: { skipSiteDeploy: true },
          data: articleData,
        })
        articleIdBySlug.set(item.slug, created.id)
      }
    }

    const editorialDrafts = [
      {
        title: 'Rascunho: Laboratórios Comunitários com Debian',
        slug: 'rascunho-laboratorios-debian',
        summary:
          'Anotações iniciais sobre como montar imagens de instalação padronizadas para laboratórios comunitários.',
        author: 'Ana Autora',
        owner: autora.id,
        category: 'educacao' as const,
        reviewStatus: 'draft' as const,
        reviewNotes: '',
        blocks: [
          {
            type: 'paragraph' as const,
            text: 'Este rascunho reúne os primeiros passos para documentar a montagem de um laboratório comunitário usando Debian Stable e pacotes educacionais offline.',
          },
          {
            type: 'paragraph' as const,
            text: 'Ainda vamos detalhar a lista de pacotes recomendados e o roteiro de manutenção compartilhada entre monitores.',
          },
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
        summary:
          'Texto submetido para avaliação editorial sobre preservação de documentos públicos e interoperabilidade.',
        author: 'Ana Autora',
        owner: autora.id,
        category: 'reflexoes' as const,
        reviewStatus: 'in_review' as const,
        reviewNotes: '',
        blocks: [
          {
            type: 'paragraph' as const,
            text: 'Quando uma instituição pública salva documentos apenas em formatos proprietários fechados, ela obriga cidadãos e estudantes a adquirir softwares específicos apenas para ler informações de interesse coletivo.',
          },
          {
            type: 'paragraph' as const,
            text: 'Formatos abertos como ODF, SVG e Markdown garantem longevidade, interoperabilidade e independência de fornecedor.',
          },
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
        summary:
          'Boas práticas para proteger estudantes contra rastreamento abusivo em atividades online.',
        author: 'Ana Autora',
        owner: autora.id,
        category: 'acesso' as const,
        reviewStatus: 'changes_requested' as const,
        reviewNotes:
          'Ótimo ponto de partida! Antes de publicarmos, adicione pelo menos uma referência oficial no final e detalhe no segundo parágrafo como configurar o navegador nos computadores do laboratório.',
        blocks: [
          {
            type: 'paragraph' as const,
            text: 'Plataformas gratuitas de grandes empresas costumam coletar dados comportamentais de estudantes sem que a comunidade escolar perceba o alcance desse rastreamento.',
          },
          {
            type: 'paragraph' as const,
            text: 'Precisamos adotar navegadores respeitosos à privacidade e extensões livres que bloqueiem rastreadores de terceiros por padrão.',
          },
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
        body: buildLexicalBody(draftItem.blocks),
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

    const publishedQuizzes = [
      {
        title: 'As 4 Liberdades do Software Livre',
        slug: 'as-4-liberdades-do-software-livre',
        summary:
          'Revise o que define um programa como software livre e por que o acesso ao código-fonte é indispensável para a autonomia digital.',
        article: articleIdBySlug.get('autonomia-digital-e-software-livre'),
        owner: autora.id,
        status: 'published' as const,
        questions: [
          {
            prompt:
              'Qual condição prática é indispensável para exercer as liberdades de estudar e adaptar um programa?',
            choices: [
              { text: 'Ter acesso ao código-fonte do programa.' },
              { text: 'Receber apenas o instalador executável gratuito.' },
              { text: 'Assinar um contrato de uso não comercial.' },
            ],
            correctAnswer: 0,
            explanation:
              'Sem acesso ao código-fonte não é possível inspecionar como o programa opera nem modificá-lo para atender necessidades locais.',
          },
          {
            prompt: 'Software livre precisa necessariamente ser distribuído a custo zero?',
            choices: [
              { text: 'Sim, qualquer cobrança elimina o caráter livre do programa.' },
              { text: 'Não. O critério é garantir as quatro liberdades, não o preço.' },
              { text: 'Apenas quando o programa é usado em universidades.' },
            ],
            correctAnswer: 1,
            explanation:
              'Preço e liberdade são conceitos independentes: é perfeitamente legítimo cobrar por cópias, suporte ou customização de software livre.',
          },
          {
            prompt: 'O que garante a liberdade número 2 do Projeto GNU?',
            choices: [
              {
                text: 'O direito de redistribuir cópias do programa para ajudar outras pessoas.',
              },
              { text: 'A obrigação de manter as alterações em segredo.' },
              { text: 'A exclusividade de uso em sistemas GNU/Linux.' },
            ],
            correctAnswer: 0,
            explanation:
              'A liberdade 2 permite compartilhar cópias do software com colegas, escolas e comunidades sem infringir direitos autorais.',
          },
        ],
      },
      {
        title: 'Licenças Copyleft e GPL',
        slug: 'licencas-copyleft-e-gpl',
        summary:
          'Entenda como o copyleft protege obras derivadas e qual é a diferença entre licenças permissivas e a GNU GPL.',
        article: undefined,
        owner: autor2.id,
        status: 'published' as const,
        questions: [
          {
            prompt: 'Qual é o objetivo central do mecanismo de copyleft presente na GNU GPL?',
            choices: [
              { text: 'Impedir que qualquer empresa utilize o programa internamente.' },
              {
                text: 'Garantir que versões modificadas e redistribuídas preservem as mesmas liberdades.',
              },
              { text: 'Substituir o direito autoral colocando o código em domínio público.' },
            ],
            correctAnswer: 1,
            explanation:
              'O copyleft usa o próprio direito autoral para assegurar que quem redistribui obras derivadas mantenha o código aberto sob a mesma licença livre.',
          },
          {
            prompt: 'Em que a GPLv3 (2007) avançou em relação à GPLv2?',
            choices: [
              { text: 'Proibiu o uso de software livre em servidores web.' },
              {
                text: 'Passou a impedir travas de hardware (tivoização) e reforçou a proteção contra patentes.',
              },
              {
                text: 'Removeu a exigência de disponibilizar o código-fonte ao distribuir binários.',
              },
            ],
            correctAnswer: 1,
            explanation:
              'A GPLv3 exige que dispositivos de consumo distribuídos com software GPL permitam que o usuário instale versões modificadas do programa.',
          },
          {
            prompt:
              'Qual é a principal diferença entre uma licença permissiva (como MIT) e uma licença copyleft forte (como GPLv3)?',
            choices: [
              {
                text: 'Licenças permissivas permitem incorporar o código em softwares proprietários fechados; a GPLv3 exige manter a obra derivada livre.',
              },
              { text: 'Licenças permissivas não permitem uso comercial.' },
              { text: 'A GPLv3 não permite modificar o código-fonte.' },
            ],
            correctAnswer: 0,
            explanation:
              'Ambas são licenças livres, mas o copyleft forte impede que melhorias distribuídas sejam fechadas em versões proprietárias.',
          },
        ],
      },
    ]

    for (const quizItem of publishedQuizzes) {
      const existing = await payload.find({
        collection: 'quizzes',
        overrideAccess: true,
        limit: 1,
        where: { slug: { equals: quizItem.slug } },
      })

      const quizData = {
        title: quizItem.title,
        slug: quizItem.slug,
        summary: quizItem.summary,
        ...(quizItem.article ? { article: quizItem.article } : {}),
        status: quizItem.status,
        questions: quizItem.questions,
      }

      const adminUser = {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: 'admin' as const,
      }

      if (existing.docs[0]) {
        await payload.update({
          collection: 'quizzes',
          id: existing.docs[0].id,
          overrideAccess: true,
          user: adminUser,
          context: { skipSiteDeploy: true },
          data: quizData,
        })
      } else {
        await payload.create({
          collection: 'quizzes',
          overrideAccess: true,
          user: adminUser,
          context: { skipSiteDeploy: true },
          data: quizData,
        })
      }
    }

    console.log(
      [
        'Seed de demonstração do blog concluído com sucesso:',
        `  • 4 contas preparadas (senha padrão: ${DEMO_PASSWORD}): admin@gnuverse.local, revisor@gnuverse.local, autora@gnuverse.local, autor2@gnuverse.local`,
        `  • ${SEED_MEDIA_SPECS.length} imagens locais geradas (8 capas 16:9 individuais + 4 diagramas para o corpo dos artigos)`,
        '  • 8 artigos publicados (com capas próprias, subtítulos, imagens anexadas no corpo, hashtags e datas variadas)',
        '  • 3 artigos em fluxo editorial de autora@gnuverse.local (draft, in_review, changes_requested)',
        `  • ${publishedQuizzes.length} quizzes publicados sobre Software Livre`,
      ].join('\n'),
    )
  } finally {
    await payload.destroy()
  }
}

await main()
