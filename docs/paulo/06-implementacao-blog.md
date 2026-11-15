# 6. Guia técnico do Blog implementado (Frontend + CMS)

Este arquivo documenta como o blog e o fluxo editorial funcionam no código atual (refletindo o que está descrito em [blog.md](../blog.md)), sem presumir familiaridade prévia com React, Next.js ou Payload CMS.

---

## Tradutor rápido (de C + Node básico para este código)

Antes de abrir os arquivos `.ts` e `.tsx`, guarde só estas 4 equivalências:

1. **O que é um arquivo `.tsx` (React)?**
   - É uma função JavaScript que recebe uma `struct` de entrada (`props`) e devolve HTML com `{variáveis}` no meio. Por exemplo, `{filteredArticles.map((article) => <article key={article.slug}>...</article>)}` é só um `for` gerando um bloco `<article>` por item.
2. **Sem `'use client'` vs com `'use client'` no topo do `.tsx`:**
   - **Sem `'use client'`:** a função roda **só na máquina de build** durante `npm run build`. Pode ler arquivos do disco (`.content/articles.json` via [src/lib/articles.ts](../../src/lib/articles.ts)), mas não tem botões interativos em runtime.
   - **Com `'use client'`:** o código é compilado para JS que roda **no navegador do usuário**. Pode guardar estado (`useState`), responder a cliques (como filtrar categorias ou enviar formulário) e fazer `fetch()`, mas **não** pode ler disco nem importar `server-only` ou segredos.
3. **O que é um arquivo de coleção do Payload (`cms/src/collections/*.ts`)?**
   - É um objeto JS declarativo (equivalente a definir o schema SQL + middlewares CRUD + callbacks em um único lugar). Em vez de escrever `SELECT/INSERT/UPDATE` na mão, o Payload gera as rotas REST (`/api/articles`, `/api/users`, `/api/media`) e o painel `/admin` a partir de `fields`, `access` e `hooks`.
4. **O que é `CORS` / `CSRF`?**
   - É uma trava **do navegador** (não afeta `curl` nem scripts Node): se a página está em `https://site.pages.dev` e o JS tenta chamar `fetch('https://cms.onrender.com/api/...')`, o navegador bloqueia a menos que o servidor do CMS devolva os cabeçalhos liberando aquela origem (`CMS_ALLOWED_ORIGINS`).

---

## Como as peças do Blog funcionam por baixo dos panos

### 1. Na raiz `src/` (Next.js com `output: "export"`)
Separação rígida entre **leitura estática** (build-time) e **submissão dinâmica opcional** (browser -> CMS):

- **Camada compartilhada segura para cliente ([src/lib/article-meta.ts](../../src/lib/article-meta.ts)):** guarda o tipo `Article` e `categoryNames` sem `import 'server-only'`, permitindo que tanto Server Components quanto Client Components importem categorias e tipos sem quebrar o `next build`.
- **Leitura estática em build ([src/lib/articles.ts](../../src/lib/articles.ts)):** usa `import 'server-only'` e `readFile('.content/articles.json')`. Só roda na máquina de build ou em `next dev`.
- **Listagem e filtro ([src/components/blog/blog-explorer.tsx](../../src/components/blog/blog-explorer.tsx)):** componente `'use client'` que recebe `{ articles, mode }` via `props` já prontos do HTML estático, filtra por `categoryNames` (`Todas`, `Reflexões`, `Educação`, `Acesso`, `Experiências`) com `aria-pressed` e contagem, exibe capas (`<img>`) e estados vazios explícitos — **zero** chamadas HTTP ao CMS.
- **Painel de submissão ([src/components/blog/submission-panel.tsx](../../src/components/blog/submission-panel.tsx)) + utilitários ([src/lib/blog-submission.ts](../../src/lib/blog-submission.ts)):** componente `'use client'` em `/blog/`, colapsado por padrão (`"Contribuir com um artigo · Submissão editorial"`):
  - Lê `NEXT_PUBLIC_CMS_URL` (padrão local `http://localhost:3001`, preenchido por `scripts/dev.ts` no `make dev`).
  - Faz cadastro (`POST /api/users`) ou login (`POST /api/users/login`) e guarda `{ token, user }` em **`sessionStorage`** (isolado por aba, sem depender de cookies cross-site).
  - Converte parágrafos separados por linhas em branco para a árvore Lexical (`plainTextToLexical`) no formato idêntico ao de [content/demo-article.json](../../content/demo-article.json), valida `slug`, `summary` (`<= 300`) e referências `http:`/`https:`, e envia `POST /api/articles?draft=true` ou `PATCH /api/articles/${id}?draft=true` com `Authorization: Bearer <token>`, `_status: 'draft'` e `reviewStatus: 'draft' | 'in_review'`.
  - Lista os artigos do próprio autor (`GET /api/articles?where[owner][equals]=${user.id}&draft=true&sort=-updatedAt`), exibindo `reviewStatus`, `_status`, `reviewNotes` (`Devolutiva da revisão`) e botão `"Editar"` para rascunhos ou ajustes solicitados.
  - Todas as requisições usam `AbortSignal.timeout(120000)` e exibem aviso amigável caso o Render Free esteja despertando.

### 2. No `cms/` (Payload CMS = tabelas + REST + regras de acesso)
- **Papéis em `Users.ts` e `access.ts`:**
  - `admin`: gerencia usuários, mídias e artigos.
  - `reviewer`: revisa submissões, registra `reviewNotes`, aprova, publica, despublica e exclui artigos.
  - `author`: cria e edita apenas os próprios artigos em `draft` ou `changes_requested`, podendo enviar para revisão (`in_review`), mas bloqueado na API de publicar (`_status: 'published'`) ou alterar papéis.
  - Cadastro público em `POST /api/users` cria conta com `role: 'author'` quando já existe ao menos um usuário no banco (mantendo o bootstrap de `admin` apenas no primeiro usuário com banco vazio).
- **`Articles.ts`:** mantém `owner` (preenchido pelo servidor), `reviewStatus` (`draft`, `in_review`, `changes_requested`, `approved`) e `reviewNotes` (restrito a revisores/admin/autor dono, sem vazar na API anônima).
- **`payload.config.ts` e PostgreSQL (`push: false`):** configura `cors` e `csrf` com `CMS_ALLOWED_ORIGINS` (em `make dev`, `scripts/dev.ts` repassa `http://localhost:${SITE_PORT},http://127.0.0.1:${SITE_PORT}`). Como `postgresAdapter` usa `push: false`, alterações futuras de schema continuam exigindo `generate:types` + `migrate:create` em `cms/src/migrations/`.

---

## Mapa dos arquivos atuais do Blog

| Arquivo | Papel atual |
|---|---|
| [src/app/blog/page.tsx](../../src/app/blog/page.tsx) | Página `/blog/` (Server Component): lê `.content/articles.json` e renderiza cabeçalho, `BlogExplorer` e `SubmissionPanel` |
| [src/app/artigos/page.tsx](../../src/app/artigos/page.tsx) | Página `/artigos/` (Server Component): compatível com rotas antigas, reutiliza cabeçalho e `BlogExplorer` |
| [src/app/artigos/[slug]/page.tsx](../../src/app/artigos/%5Bslug%5D/page.tsx) | Página estática do artigo: capa, `<RichText>`, referências e link `← Voltar ao blog` apontando para `/blog/` |
| [src/components/blog/editorial-header.tsx](../../src/components/blog/editorial-header.tsx) | Cabeçalho editorial e aviso do modo `demo` compartilhados entre `/blog/` e `/artigos/` |
| [src/components/blog/blog-explorer.tsx](../../src/components/blog/blog-explorer.tsx) | Filtro por categorias (`Todas` + `categoryNames`) e grid de cards com capas |
| [src/components/blog/submission-panel.tsx](../../src/components/blog/submission-panel.tsx) | Painel colapsável de autenticação (`sessionStorage`), criação/edição de rascunhos e acompanhamento de revisões |
| [src/lib/article-meta.ts](../../src/lib/article-meta.ts) | Tipo `Article` e mapa `categoryNames` (importável por Client e Server Components) |
| [src/lib/articles.ts](../../src/lib/articles.ts) | Leitura de `.content/articles.json` com `server-only` em tempo de build |
| [src/lib/blog-submission.ts](../../src/lib/blog-submission.ts) | Conversão texto <-> Lexical, slugificação, validação de submissão e tratamento de erros HTTP/timeout |
| [scripts/cms-content.mjs](../../scripts/cms-content.mjs) | Validação da API pública do CMS e paginação de artigos publicados |
| [scripts/dev.ts](../../scripts/dev.ts) e [.env.example](../../.env.example) | Wiring de `CMS_ALLOWED_ORIGINS` (CMS) e `NEXT_PUBLIC_CMS_URL` (Site) |
| `cms/src/` (`access.ts`, `Users.ts`, `Articles.ts`, `payload.config.ts`, `migrations/`) | Regras `admin`/`reviewer`/`author`, campos de revisão, CORS/CSRF e migrações PostgreSQL |

---

## O que ainda falta antes da abertura ampla e produção

1. **SMTP no Payload:** configurar um provedor de e-mail (`@payloadcms/email-nodemailer` ou equivalente) para recuperação de senha antes de divulgar o cadastro público externo.
2. **Proteção anti-spam/rate limit no cadastro público:** revisar limites antes da divulgação aberta na internet.
3. **Variáveis de nuvem:** definir `CMS_ALLOWED_ORIGINS` no Render (URL do site no Cloudflare Pages) e `NEXT_PUBLIC_CMS_URL` no Cloudflare Pages (URL HTTPS do CMS no Render), além de `CMS_URL`, `CMS_CONTENT_MODE=live` e `SITE_DEPLOY_HOOK_URL`.

---

## Checklist antes de cada commit/deploy do Blog

```bash
make check    # Roda testes da raiz, verify.ts do CMS e tsc --noEmit nos dois projetos
make build    # Garante que scripts/sync-content.mjs e next build --webpack geram out/ sem erro
```
- Se alterou coleções/campos do CMS: confirmou que há uma nova migração em `cms/src/migrations/` e que ela está listada em `cms/src/migrations/index.ts`?
- Se alterou campos públicos lidos pelo site: atualizou `validateArticle()` em [scripts/cms-content.mjs](../../scripts/cms-content.mjs) e `Article` em [src/lib/article-meta.ts](../../src/lib/article-meta.ts)?
- Se testou localmente em `make dev` e quer validar produção simulada: rodou `make build`, parou o CMS e validou leitura estática com `make preview`?

---

## Quatro invariantes críticas para auditar sempre

1. **Segurança na API, nunca só no botão:** `author` não pode publicar (`_status: 'published'`), alterar o próprio `role` ou editar artigo de outro usuário via `curl` / REST — isso precisa falhar na API do CMS e estar coberto em `cms/scripts/verify.ts`.
2. **Migração Postgres versionada:** qualquer alteração de coluna/enum em `cms/src/collections/` exige migração em `cms/src/migrations/`.
3. **Leitura estática (`out/`) intacta:** `BlogExplorer` e `/artigos/[slug]/` nunca fazem `fetch` para o CMS; toda leitura pública sai de `.content/articles.json` e `public/cms-media/`. Apenas `SubmissionPanel` (quando aberto pelo colaborador) conversa com `NEXT_PUBLIC_CMS_URL`.
4. **Zero segredo no cliente:** nenhum token administrativo, senha, chave S3 ou URL de Deploy Hook pode aparecer em `'use client'` ou em variáveis `NEXT_PUBLIC_*`.
