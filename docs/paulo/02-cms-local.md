# 2. Ambiente local e teste do CMS

Localmente não é preciso nenhuma conta na nuvem: o CMS usa **SQLite** (`cms/data/gnuverse.db`) e grava imagens no **disco local** (`cms/media/`), enquanto o `game-server` usa `.content/game.sqlite`.

---

## Correção importante sobre `.env.local` (e estado atual desta máquina)

> **Atenção:** a versão anterior deste doc instruía *"Copiar `.env.example` para `.env.local`"*. **Não faça cópia manual se for configurar do zero**, porque [`.env.example`](../../.env.example) vem com `CMS_CONTENT_MODE=demo`.

Quem cria a configuração correta é `make setup`, que executa:
1. `npm ci` e `npm ci --prefix cms` (instala dependências da raiz e de `cms/`).
2. `npm run cms:setup` ([cms/scripts/setup-local.mjs](../../cms/scripts/setup-local.mjs)): cria `cms/data/` e gera `cms/.env` (`chmod 0600`) com um `PAYLOAD_SECRET` aleatório de 32 bytes hex, `DATABASE_ADAPTER=sqlite`, `DATABASE_URL=file:./data/gnuverse.db` e `STORAGE_ADAPTER=local`.
3. `node scripts/setup-site.mjs` ([scripts/setup-site.mjs](../../scripts/setup-site.mjs)): cria `.env.local` a partir de `.env.example` **trocando `CMS_CONTENT_MODE=demo` para `CMS_CONTENT_MODE=live`**.

### Diagnóstico verificado neste repositório agora

Ao revisar seu diretório de trabalho atual:
- `cms/.env` e `cms/data/gnuverse.db` **já existem**.
- `.env.local` **já existe, mas está com `CMS_CONTENT_MODE=demo`**.
- `.content/articles.json` contém `{"mode":"live","articles":[]}`.

Por que aconteceu essa mistura?
- Quando você roda `make dev`, o [scripts/dev.ts](../../scripts/dev.ts) injeta `CMS_CONTENT_MODE=live` nas variáveis de ambiente do processo filho. Como `process.loadEnvFile` (usado em [cms/scripts/local-config.mjs](../../cms/scripts/local-config.mjs)) **não sobrescreve** variáveis já presentes em `process.env`, o `make dev` sincroniza em modo `live`.
- **Porém**, se você rodar `make sync`, `make site` ou `make build` direto no terminal, não há processo pai injetando `CMS_CONTENT_MODE=live` — então o script lê `.env.local` e **cai no modo `demo`** (`content/demo-article.json`).

**Recomendação prática:** abra `.env.local` na raiz e mude `CMS_CONTENT_MODE=demo` para `CMS_CONTENT_MODE=live` sempre que quiser trabalhar/compilar com o CMS local ligado (volte para `demo` apenas se precisar rodar `make site`/`make build` com o CMS desligado).

---

## Como funcionam as portas e variáveis locais

- `CMS_PORT` no `.env.local` da raiz (padrão `3001`) é a **fonte única da porta local do CMS** (lida por [cms/scripts/local-config.mjs](../../cms/scripts/local-config.mjs)). Não existe fallback numérico hardcoded nos scripts.
- `CMS_URL` deve ficar **vazio** localmente — quando vazio, `getContentCMSURL()` deriva `http://localhost:${CMS_PORT}`. Só preencha `CMS_URL` quando quiser apontar seu site local para um CMS remoto.
- `CMS_SERVER_URL` fica **vazio** em `cms/.env` localmente — [cms/scripts/dev.mjs](../../cms/scripts/dev.mjs) deriva `http://localhost:${CMS_PORT}`.
- Se precisar rodar em outras portas sem editar arquivo:
  ```bash
  CMS_PORT=3011 SITE_PORT=3010 GAME_PORT=3012 make dev
  ```
- Nunca rode duas instâncias de `next dev` na mesma pasta ao mesmo tempo (o Next.js trava o diretório `.next`).

---

## Passo a passo para testar o CMS e o Blog localmente

### 1. Verificar integridade da base antes de mexer em código
```bash
make check
```
Isso executa:
- `npm test` (testes de sincronização do CMS, launcher, config TOML, física e `game-server`).
- `npm --prefix cms test` (roda [cms/scripts/verify.ts](../../cms/scripts/verify.ts), que cria um SQLite temporário em `/tmp`, testa bootstrap de admin, bloqueio de escalada de privilégio, upload de imagem via `sharp`, rascunho privado, publicação e exclusão, e apaga o temporário ao final).
- `npm run typecheck` e `npm run cms:typecheck` (`tsc --noEmit`).

### 2. Subir os servidores
Opção A (tudo junto em um terminal):
```bash
make dev
```
Opção B (útil enquanto você programa o blog, para reiniciar só o site sem esperar o CMS reiniciar):
- Terminal 1: `make cms`
- Terminal 2: `make site` (e opcionalmente Terminal 3: `npm run game:dev`)

### 3. Criar o primeiro administrador e testar permissões
1. Acesse `http://localhost:3001/admin` (ou a porta definida em `CMS_PORT`).
2. Crie o primeiro usuário (nome, e-mail, senha). Um hook `beforeChange` em [cms/src/collections/Users.ts](../../cms/src/collections/Users.ts) detecta que `totalDocs === 0` e define automaticamente `role = 'admin'`.
3. Em **Integrantes** (`Users`), crie uma conta de teste com papel **Editor**.

### 4. Criar artigo de teste e entender rascunho vs publicado
1. Em **Artigos** (`Articles`), crie um artigo usando os dados de [content/demo-article.json](../../content/demo-article.json) (ou de [teste-cms.md](../teste-cms.md)).
   - Atenção às validações de [cms/src/collections/Articles.ts](../../cms/src/collections/Articles.ts):
     - `slug`: apenas minúsculas, números e hífens (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`).
     - `summary`: máximo 300 caracteres.
     - `references[].url`: precisa ser URL `http:` ou `https:` válida.
2. **Salve como rascunho primeiro.** Abra `http://localhost:3001/api/articles` em uma janela anônima (sem cookie de login): o artigo **não** deve aparecer (`publishedOrEditor` em [cms/src/access.ts](../../cms/src/access.ts) filtra `_status === 'published'` para anônimos).
3. Envie uma imagem JPEG/PNG/WebP (até 5 MB) em **Imagens** (`Media`): os campos **Descrição para acessibilidade** (`alt`) e **Autoria / licença** (`credit`) são obrigatórios. Selecione-a como capa e clique em **Publicar**.
4. Recarregue `http://localhost:3001/api/articles`: agora o artigo aparece na API pública.

### 5. Sincronizar e testar o site sem o CMS ligado
**Importante:** publicar no CMS **não** atualiza a lista do site que já está rodando localmente, porque `sync-content.mjs` só roda no `predev` / `prebuild` / `make sync`.

Para puxar o conteúdo atualizado e testar que o site sobrevive com o CMS desligado:
```bash
# Com o CMS ligado (make cms ou make dev rodando):
make sync         # Opcional: só atualiza .content/articles.json e public/cms-media/
make build        # Roda sync-content.mjs e gera o site estático em out/
```
Agora **pare o CMS** (`Ctrl+C`) e rode:
```bash
make preview      # Executa "serve out -l 3000" — zero Node/Next/CMS rodando
```
Abra `http://localhost:3000/blog/`, `http://localhost:3000/artigos/` e o artigo publicado. Texto e imagem de capa devem carregar normalmente de `out/`.

### Comportamento dos modos `demo` e `live`
- `CMS_CONTENT_MODE=demo`: lê apenas [content/demo-article.json](../../content/demo-article.json) e mostra um banner avisando que é demonstração.
- `CMS_CONTENT_MODE=live`: lê exclusivamente `${CMS_URL || localhost:CMS_PORT}/api/articles`. Se o CMS estiver fora do ar ou retornar erro/JSON inválido, **aborta o build com erro** — nunca faz fallback silencioso para o artigo demo (para não publicar conteúdo falso em produção).
