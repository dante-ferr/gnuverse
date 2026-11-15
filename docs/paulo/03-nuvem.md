# 3. Nuvem e publicação (Supabase + Render + Cloudflare)

Nada na nuvem foi criado nem validado ainda. Tudo depende de contas criadas por você/equipe.

> **Importante:** nessa etapa você **não escreve código** — é só criar contas gratuitas e preencher as variáveis de ambiente nos formulários web de cada serviço.

---

## O que é cada serviço (em termos de sistema)

- **Supabase:** plataforma na nuvem que fornece um **banco PostgreSQL** e um **armazenamento de arquivos** prontos. Aqui não usamos o sistema de login nem SDK do Supabase — para o nosso código, ele é literalmente só **"um servidor PostgreSQL na rede + um servidor HTTP de arquivos (padrão S3)"**.
- **Render:** serviço que executa um **processo servidor na internet** (como rodar `./meu_servidor` num Linux remoto com uma URL HTTPS). É lá que roda o processo Node do `cms/`. No plano gratuito, se ninguém acessa por alguns minutos o processo "dorme", e o disco local é apagado a cada reinício.
- **Cloudflare Pages:** serviço de hospedagem gratuita de **arquivos estáticos** (HTML, CSS, JS e imagens — sem processo Node rodando). Ele baixa seu repositório do GitHub, roda `npm run build` uma vez na hora do deploy e serve a pasta `out/` direto da rede dele.
- **Deploy Hook (webhook):** é apenas uma **URL secreta** gerada pelo Cloudflare. Quando o CMS envia um `POST` vazio para essa URL (ao publicar um artigo), o Cloudflare entende o sinal e dispara um novo `npm run build` para atualizar os arquivos estáticos de `out/`.

---

## Por que precisamos de 3 serviços para o Blog + CMS?

No plano gratuito, cada provedor tem uma restrição específica — e o desenho do repositório foi montado exatamente para contornar todas elas:

| Serviço | Papel | Restrição do plano gratuito | Como a arquitetura lida |
|---|---|---|---|
| **Supabase** | PostgreSQL + S3 Storage | — | Guarda dados e mídias de forma persistente |
| **Render Free** | Roda o servidor Node do `cms/` | **Apaga disco local ao reiniciar** e **dorme após inatividade** | `payload.config.ts` proíbe SQLite e disco local em produção; dormir não afeta o leitor do site |
| **Cloudflare Pages** | Hospeda `out/` (site estático) | **Não roda backend Node contínuo** e tem **cota mensal de builds** | Visitantes leem arquivos estáticos direto da CDN; builds só rodam quando há publicação |

Veja em [cms/src/payload.config.ts](../../cms/src/payload.config.ts): se `NODE_ENV === 'production'` sem `DATABASE_ADAPTER=postgres` e `STORAGE_ADAPTER=s3`, o processo do CMS **aborta na inicialização** de propósito, evitando que alguém suba no Render gravando artigos em disco efêmero.

---

## Passo 1 — Supabase (PostgreSQL e S3 Storage)

1. Crie um projeto dedicado no Supabase.
2. **PostgreSQL (`DATABASE_URL`):**
   - No painel do Supabase (*Connect* / *Database*), copie a string de conexão usando o **Session pooler** (porta `5432`, acessível via **IPv4**).
   - *Por que Session pooler?* Conexões diretas do Supabase frequentemente resolvem só para IPv6, e serviços no plano gratuito do Render costumam falhar ao discar para IPv6.
3. **Storage (`S3_*`):**
   - Crie um bucket privado (ex: `gnuverse-media`).
   - Em *Storage -> S3 Access Keys*, gere um par de chaves (`S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY`), e anote também `S3_ENDPOINT` e `S3_REGION`.
   - *Por que o bucket pode ficar privado?* O Payload usa o plugin `@payloadcms/storage-s3` com `forcePathStyle: true` (necessário para o endpoint S3 do Supabase) e faz proxy dos arquivos pela própria rota `/api/media/...` do CMS. Além disso, [scripts/sync-content.mjs](../../scripts/sync-content.mjs) só aceita baixar capas cuja origem seja igual à de `CMS_URL`, copiando-as para `public/cms-media/` no build.
   - **Não são necessárias** `SUPABASE_ANON_KEY` nem `SUPABASE_SERVICE_ROLE_KEY`.

---

## Passo 2 — Render Free (aplicação `cms/`)

1. Suba o repositório para o GitHub (note que hoje há alterações locais não commitadas — confira `git status` antes de dar `push`).
2. No Render, crie um **Web Service** conectado ao repositório:
   - **Root Directory:** `cms` *(obrigatório! Não deixe na raiz)*
   - **Runtime / Node:** Node 22+ (`NODE_VERSION=22`)
   - **Instance Type:** Free
   - **Build Command:**
     ```bash
     npm ci && npm run generate:importmap && npm run build
     ```
   - **Start Command:**
     ```bash
     npm run migrate && npm start
     ```
     - `npm run migrate` aplica as migrações SQL de [cms/src/migrations/](../../cms/src/migrations/) no PostgreSQL. Em produção, `payload.config.ts` usa `push: false`, então o schema **não** é alterado magicamente em runtime — só via migrações versionadas no Git.
     - `npm start` executa `next start --hostname 0.0.0.0`, usando automaticamente a variável `PORT` injetada pelo Render.
3. **Variáveis de ambiente no Render (serviço `cms`):**

| Variável | Valor / Como obter | Observação |
|---|---|---|
| `NODE_ENV` | `production` | Ativa travas de segurança de Postgres/S3 |
| `NODE_VERSION` | `22` | Compatível com `engines` (`>=22.0.0`) |
| `PAYLOAD_SECRET` | `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` | Guarde seguro e **não troque** depois, senão invalida sessões |
| `CMS_SERVER_URL` | URL HTTPS do seu serviço no Render (ex: `https://gnuverse-cms.onrender.com`) | **Sem `/admin` e sem barra no final.** Exigida já no build/start em produção |
| `DATABASE_ADAPTER` | `postgres` | Obrigatório em produção |
| `DATABASE_URL` | String Session Pooler do Supabase (porta 5432) | Inclua usuário, senha e parâmetros SSL/TLS indicados pelo Supabase |
| `STORAGE_ADAPTER` | `s3` | Obrigatório em produção |
| `S3_BUCKET` | Nome do bucket criado (ex: `gnuverse-media`) | — |
| `S3_ENDPOINT` | Endpoint S3 do Supabase Storage | — |
| `S3_REGION` | Região do endpoint S3 | — |
| `S3_ACCESS_KEY_ID` | Access key ID gerado no Supabase Storage | — |
| `S3_SECRET_ACCESS_KEY` | Secret access key do mesmo par | — |
| `SITE_DEPLOY_HOOK_URL` | *(deixe vazio no primeiro deploy; preencha no Passo 4)* | URL secreta gerada no Cloudflare |

> **Atenção à ordem no primeiro acesso:** assim que o Render terminar de subir o CMS pela primeira vez, **abra `https://<seu-cms>.onrender.com/admin` imediatamente e crie o primeiro usuário (administrador)** antes de divulgar a URL para qualquer pessoa, pois o primeiro registro sem usuário logado ganha `role = 'admin'`.

---

## Passo 3 — Cloudflare Pages (site estático na raiz)

1. No Cloudflare Pages, crie um projeto conectado ao mesmo repositório GitHub:
   - **Root directory:** `/` (raiz do repositório, **não** `cms`)
   - **Build command:** `npm run build` (roda `prebuild` -> `sync-content.mjs` -> `next build --webpack`)
   - **Build output directory:** `out`
   - **Node version:** `NODE_VERSION=22` (ou `22.18+`, conforme [package.json](../../package.json))
2. **Variáveis de ambiente no Cloudflare Pages:**

| Variável | Valor | Por quê |
|---|---|---|
| `CMS_CONTENT_MODE` | `live` | Faz `sync-content.mjs` buscar do CMS em vez de usar o artigo demo |
| `CMS_URL` | URL HTTPS do CMS no Render (sem `/admin`) | Usada apenas na máquina de build pelo `sync-content.mjs` |
| `NEXT_PUBLIC_GAME_API_URL` | URL HTTPS pública do `game-server` (quando hospedado) | Única variável pública necessária; vai embutida no JS do navegador |

> **Regra de ouro:** **nunca** coloque `PAYLOAD_SECRET`, `DATABASE_URL`, chaves `S3_*` ou `SITE_DEPLOY_HOOK_URL` no Cloudflare Pages, e **nunca** nomeie nada secreto com prefixo `NEXT_PUBLIC_`.

3. Faça o primeiro deploy manual no Cloudflare Pages e confirme que `/blog/` e `/artigos/` sobem sem erro (mesmo com 0 artigos se ainda não publicou nenhum no CMS remoto).

---

## Passo 4 — Conectar o Deploy Hook e validar o ciclo completo

1. No Cloudflare Pages: *Settings -> Builds & deployments -> Deploy hooks* -> crie um hook apontando para a branch de produção (`master` ou `main`).
2. Trate essa URL como **segredo** (quem tem a URL pode disparar builds na sua conta). Cole-a em `SITE_DEPLOY_HOOK_URL` no painel do Render (o Render reiniciará o CMS).
3. No painel `/admin` do Render, publique um artigo de teste com capa:
   - Confira nos logs do Render a mensagem: `GNUverse: publicação do site solicitada.`
   - Acompanhe o novo build no Cloudflare Pages (`sync-content.mjs` espera até **120 segundos** por requisição para acordar o Render Free).
   - Só após o build do Cloudflare terminar com sucesso é que o site público muda.
4. Teste também **editar publicado**, **despublicar** e **excluir publicado**.

### Como [cms/src/hooks/deploy-site.ts](../../cms/src/hooks/deploy-site.ts) se comporta
- Dispara `POST` (timeout de 10 s) quando `doc._status === 'published'` ou `previousDoc?._status === 'published'`, e na exclusão quando `doc._status === 'published'`.
- Criar um **rascunho novo** não dispara build.
- **Editar uma imagem** direto na coleção `media` não dispara build sozinho: você precisa republicar o(s) artigo(s) que usam aquela capa.
- Não existe fila nem *retry* automático: se o `POST` falhar (por exemplo, o Cloudflare rejeitar ou der timeout de 10 s), o conteúdo continua salvo no banco, o log do CMS registra erro, e você deve clicar em *Retry deployment* / disparar deploy manual no Cloudflare.

---

## Passo 5 — Cadastro da equipe (piloto atual)

- Com o `/admin` protegido pelo seu usuário administrador (`admin`), crie ou gerencie as contas da equipe em **Integrantes**: use `reviewer` (ou `editor`, mantido como alias de revisor) para quem pode revisar e publicar, e `author` para autores (que também podem se cadastrar sozinhos no painel público de `/blog/`).
- Cada integrante entra no painel e troca a própria senha — **não há envio de e-mail / recuperação de senha** enquanto um adaptador SMTP não for configurado no Payload.
