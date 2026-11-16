# Plano completo de ação — Blog, CMS e Produção (Paulo)

Este guia foi escrito para quem programa em **C** e conhece o básico de backend em **Node.js**. Em vez de assumir familiaridade com frameworks web, ele explica como os processos, o build estático, o banco e as permissões funcionam por baixo dos panos.

> **Base documental:** consolidado a partir do código real do repositório, de [blog.md](../blog.md), [arquitetura-cms.md](../arquitetura-cms.md), [teste-cms.md](../teste-cms.md) e [jogo-local.md](../jogo-local.md).

---

## O que você já tem pronto no repositório

O núcleo técnico do blog e do jogo já está implementado no código:

- **Painel e API do CMS (`cms/`):** Payload CMS rodando sobre Next.js, com papéis `admin`, `reviewer` e `author`, fluxo editorial (`reviewStatus`: `draft -> in_review -> changes_requested / approved`, `reviewNotes` privados e campo `owner`), bloqueio na API contra publicação direta por `author`, cadastro público de autores, `CORS`/`CSRF` via `CMS_ALLOWED_ORIGINS`, upload de capas (`alt` e crédito obrigatórios) e migrações PostgreSQL em `cms/src/migrations/`.
- **Exportação estática do site (`src/` + `scripts/`):** `scripts/sync-content.mjs` lê apenas os artigos publicados pela API do CMS, baixa e faz hash SHA-256 das capas para `public/cms-media/` e grava `.content/articles.json`; o `next build` compila tudo para HTML/CSS/JS puros em `out/`.
- **Frontend do blog (`src/`):**
  - `/blog/` (`src/app/blog/page.tsx`) renderiza `BlogExplorer` (filtro por categorias e capas nos cards sem fetches em runtime) e `SubmissionPanel` (painel colapsável de cadastro/login de autores via `sessionStorage`, criação/edição de rascunhos, envio para revisão e visualização de status + devolutiva `reviewNotes`).
  - `/artigos/` (`src/app/artigos/page.tsx`) compartilha o `BlogExplorer` para manter compatibilidade, e `/artigos/[slug]/` (`src/app/artigos/[slug]/page.tsx`) volta para `/blog/`.
  - `scripts/dev.ts` e `.env.example` conectam `CMS_ALLOWED_ORIGINS` ao CMS e `NEXT_PUBLIC_CMS_URL` ao site.
- **Hook de deploy (`cms/src/hooks/deploy-site.ts`):** ao publicar, editar publicado, despublicar ou excluir publicado, o CMS dispara um `POST` para a URL do Deploy Hook do Cloudflare Pages.
- **Jogo (`game-server/` + `/jogo/`):** backend em `node:http` + `node:sqlite` + física (`matter-js`) + SSE já implementado localmente.

---

## Plano de ação (estado atual até a entrega)

Considerando o cronograma de [planejamento.md](../planejamento.md) (entrega final prevista até **02/12/2026**):

### Fase 1 — Validar o ambiente local (~1h)
1. **Atalho de 1 comando ("Modo Preguiçoso"):** rode `make test-blog`. Ele popula automaticamente o CMS local com 4 contas (`admin@gnuverse.local`, `revisor@gnuverse.local`, `autora@gnuverse.local`, `autor2@gnuverse.local` — senha `gnuverse123`), capa e 6 artigos em todas as categorias/estados editoriais, executa **10 testes E2E automatizados** no terminal e abre o navegador já logado e preenchido em `http://localhost:3000/blog/?autotest=1` + `http://localhost:3001/admin` (para rodar sem navegador e encerrar ao fim, use `make test-blog-ci`).
2. Ajustar `.env.local` se necessário (detalhe em [02-cms-local.md](02-cms-local.md): quando usar `make sync`/`make build` fora do `make dev`, confira se `CMS_CONTENT_MODE=live`).
3. Rodar `make check` e `make dev`, ou usar os botões de 1 clique da barra **Atalhos de Teste Rápido** em `/blog/?autotest=1` para alternar entre `Autora 1 (Ana)`, `Autor 2 (Beto)` e `Revisor (Rui)`, enviar artigo para revisão e aprovar/publicar no `/admin`.
4. Validar a independência estática com `make build` -> desligar CMS -> `make preview`.

### Fase 2 — Código do Blog ([06-implementacao-blog.md](06-implementacao-blog.md))
- **Já implementado no código:** filtro por categoria e capas nos cards (`BlogExplorer`), retorno para `/blog/`, papéis `author`/`reviewer`/`admin` com trava na API, fluxo `reviewStatus` + `reviewNotes` + `owner` + migração PostgreSQL, painel colapsável de cadastro/submissão em `/blog/` (`SubmissionPanel`) e `CORS`/`CSRF` via `CMS_ALLOWED_ORIGINS`.
- **Resta no código antes de abrir ao público amplo:** configurar adaptador **SMTP** no Payload para recuperação de senha por e-mail e revisar proteções anti-spam/rate limit no cadastro público ([05-pendencias.md](05-pendencias.md)).

### Fase 3 — Subir CMS e Site na nuvem ([03-nuvem.md](03-nuvem.md))
1. Criar projeto no **Supabase** (PostgreSQL via Session Pooler + bucket privado e chaves S3).
2. Criar Web Service do `cms/` no **Render Free** (`Root Directory: cms`), configurar `CMS_ALLOWED_ORIGINS` com a URL do site no Cloudflare, rodar `migrate` + `start` e cadastrar o usuário `admin` **antes** de compartilhar o link.
3. Criar projeto no **Cloudflare Pages** (`Root Directory: /`, build `npm run build`, saída `out`) definindo `CMS_CONTENT_MODE=live`, `CMS_URL` e `NEXT_PUBLIC_CMS_URL` com a URL HTTPS do CMS no Render.
4. Conectar o **Deploy Hook** do Cloudflare na variável `SITE_DEPLOY_HOOK_URL` do Render e testar publicar, editar, despublicar e excluir com capa real.

### Fase 4 — Hospedar e conectar o `game-server` ([04-game-server.md](04-game-server.md))
1. Escolher hospedagem **sempre ligada e com disco persistente** para o SQLite do jogo (Render Free **não serve**).
2. Configurar `GAME_HOST=0.0.0.0`, `GAME_ALLOWED_ORIGINS` (domínio do Cloudflare) e `GAME_DB_PATH` no volume persistente.
3. Configurar `NEXT_PUBLIC_GAME_API_URL` no Cloudflare Pages e fazer um redeploy do site para gravar a URL no bundle JS do cliente.

### Fase 5 — Operação editorial com a equipe e entrega ([05-pendencias.md](05-pendencias.md))
1. Criar as contas dos outros 6 integrantes no `/admin` (como `author` ou `reviewer`) e orientar a troca de senha.
2. Coordenar a inserção e revisão cruzada dos **14 posts** (2 por integrante), conferindo fontes, `alt` e crédito das imagens.
3. Combinar publicações em lote para economizar cota de builds do Cloudflare.
4. Finalizar os testes de acessibilidade/celular e o diário de bordo coletivo/individual.

---

## Mapa dos documentos desta pasta

| # | Arquivo | O que você encontra lá |
|---|---|---|
| 1 | [01-visao-geral.md](01-visao-geral.md) | Os 3 processos independentes, analogia com compilador/linker em C e como `make dev` orquestra tudo |
| 2 | [02-cms-local.md](02-cms-local.md) | Diagnóstico do `.env.local`, variáveis, passo a passo local e teste offline |
| 3 | [03-nuvem.md](03-nuvem.md) | Passo a passo de Supabase, Render Free, Cloudflare Pages, migrações e Deploy Hook |
| 4 | [04-game-server.md](04-game-server.md) | Como o `game-server/` funciona (`node:http`, `node:sqlite`, WAL, SSE) e o que exige em produção |
| 5 | [05-pendencias.md](05-pendencias.md) | Lista de pendências por área, riscos técnicos aceitos e checklist final |
| 6 | [06-implementacao-blog.md](06-implementacao-blog.md) | **Guia técnico do código do Blog:** frontend estático + submissão no navegador, regras de acesso no Payload e invariantes |
