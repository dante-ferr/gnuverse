# Testar o CMS e configurar a nuvem

## Escopo deste guia

Este guia testa a integração editorial já implementada. O produto agora prevê [blog com aprovação](blog.md) e [jogo de torres independente](torres-colaborativas.md). Editores ainda publicam diretamente no código atual: revisão obrigatória, cadastro/submissão públicos e jogo estão pendentes. Os passos abaixo não comprovam essas funcionalidades futuras.

## 1. Teste local sem chaves externas

Requer Node.js 22+, npm e GNU Make. Na raiz:

```bash
make setup
make dev
```

Abra a URL do painel impressa no terminal. `make dev` inicia CMS e site juntos e Ctrl+C encerra ambos. O setup gera `cms/.env` com segredo local aleatório e cria o diretório do SQLite. O segredo não é mostrado e não entra no Git. Essa base de desenvolvimento não será transferida automaticamente ao Supabase.

No primeiro acesso, crie seu usuário com nome, e-mail e senha. Ele será administrador. Depois, em **Integrantes**, você poderá criar contas com papel **Editor**. Não é necessário pagar por esses papéis nem obter uma chave de API do Payload.

## 2. Inserir este conteúdo pelo painel

Em **Artigos**, clique em criar e preencha:

| Campo | Valor |
| --- | --- |
| Título | Olá, GNUverse! |
| Endereço do artigo | ola-gnuverse |
| Resumo | Um artigo de demonstração para testar o caminho entre o CMS e o site. |
| Autoria | Equipe GNUverse |
| Categoria | Experiências |
| Imagem de capa | Deixe vazia no primeiro teste. |

No editor **Texto**, cole os dois parágrafos:

> Este é um conteúdo de teste do GNUverse. Nosso grupo vai investigar como o software livre pode ampliar o acesso à tecnologia.
>
> Esta página serve apenas para verificar a integração. Os textos finais, exemplos e posicionamentos serão produzidos e revisados pelos integrantes.

As referências podem ficar vazias nesse teste técnico. O mesmo exemplo está em `content/demo-article.json`; ele não é inserido automaticamente no banco, para você testar a criação pelo painel.

Primeiro salve como **rascunho**. Abra a URL do CMS seguida de `/api/articles` sem autenticação (janela privada): o artigo não deve aparecer. Volte ao painel e clique em **Publicar**. A API pública passa a incluir o artigo.

## 3. Conectar o site ao CMS local

`make setup` prepara `.env.local` na raiz. A porta local tem uma única origem: `CMS_PORT`. O painel, a espera pela API e a sincronização derivam a URL dessa variável. Para trocar a porta, edite apenas `CMS_PORT` e reinicie os servidores. `CMS_URL` fica vazio localmente; preencha-o somente para um CMS remoto. `CMS_SERVER_URL` é necessário somente em produção. Configurações antigas geradas pelo setup são migradas preservando os demais valores.

Depois de publicar o artigo, pare `make dev` com Ctrl+C e inicie novamente:

```bash
make dev
```

Abra http://localhost:3000/artigos/ e depois http://localhost:3000/artigos/ola-gnuverse/. O aviso de demonstração desaparece no modo live: você está vendo o artigo do banco.

Se alterar conteúdo, reinicie `make dev` para sincronizar. Você também pode usar `make cms` e `make site` em terminais separados; nesse caso, basta reiniciar `make site` após editar. `make sync` permite sincronizar sem iniciar o site.

Para testar a independência do CMS:

1. Pare `make dev` e execute `make cms` em um terminal.
2. Em outro terminal, execute `make build`.
3. Pare `make cms`.
4. Execute `make preview` e abra o artigo. Ele deve continuar funcionando, pois `out/` contém o site publicado. Se a porta 3000 estiver ocupada, use o endereço impresso no terminal.

Teste adicional de capa: ligue o CMS, envie um JPEG/PNG/WebP de até 5 MB em **Imagens**, informe descrição e crédito, selecione-o no artigo e republique. Gere o site novamente e repita o teste com o CMS desligado. A capa também deve carregar.

## 4. Credenciais para produção

Não cole segredos no chat nem no Git. Use os campos de ambiente do provedor. Os arquivos `.env.example` são modelos sem credenciais.

| Variável | Onde obter / como criar | Onde configurar |
| --- | --- | --- |
| `PAYLOAD_SECRET` | Gere um segredo aleatório de pelo menos 32 bytes; `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` | Render, apenas CMS. Mantenha estável entre deploys. |
| `DATABASE_ADAPTER` | Valor `postgres` | Render |
| `DATABASE_URL` | Supabase → conexão do projeto → PostgreSQL. Prefira **Session pooler**, porta 5432, acessível por IPv4; use a senha do banco e a configuração TLS indicada pelo serviço | Render |
| `CMS_SERVER_URL` | URL HTTPS do serviço Render, sem `/admin` | Render |
| `STORAGE_ADAPTER` | Valor `s3` | Render |
| `S3_BUCKET` | Nome do bucket criado no Supabase Storage, por exemplo `gnuverse-media` | Render |
| `S3_ENDPOINT` | Endpoint S3 exibido nas configurações de Storage do Supabase | Render |
| `S3_REGION` | Região exibida pelo Supabase para esse endpoint | Render |
| `S3_ACCESS_KEY_ID` | Gere credenciais S3 no Supabase Storage; copie o Access key ID | Render |
| `S3_SECRET_ACCESS_KEY` | Secret access key do mesmo par S3 | Render |
| `SITE_DEPLOY_HOOK_URL` | Cloudflare Pages → configurações do projeto → deploy hooks → criar hook para a branch de produção | Render |
| `CMS_CONTENT_MODE` | Valor `live` | Cloudflare Pages |
| `CMS_URL` | Mesma URL HTTPS do CMS | Cloudflare Pages |

O bucket pode ficar privado no Supabase: o Payload serve os arquivos pela própria rota de mídia usando as credenciais S3. Essa rota de mídia é pública por decisão editorial desta base. O build copia as capas para o site público.

Não precisamos de `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ou chave de API do Payload. Usuários e login são geridos pelo Payload. O Cloudflare deploy hook já contém a autorização para iniciar builds; trate sua URL como segredo. Se vazar, revogue/recrie.

## 5. Publicar CMS no Render

1. Suba o repositório para sua conta GitHub. A integração de contas ainda precisa ser feita por você.
2. Crie um **Web Service** no Render conectado ao repositório, com **Root Directory: `cms`** e instância Free.
3. Configure Node.js 22 ou 24, por exemplo `NODE_VERSION=22`, e `NODE_ENV=production`.
4. **Build Command:** `npm ci && npm run generate:importmap && npm run build`.
5. **Start Command:** `npm run migrate && npm start`. O Next.js usa a variável `PORT` fornecida pelo Render. A migração inicial já está versionada; não gerar migrações automaticamente em produção.
6. Configure as variáveis do CMS na tabela. O deploy hook pode ficar vazio enquanto o site público não existir.
7. No primeiro acesso ao CMS de produção, crie o administrador antes de compartilhar o link e depois crie os editores.

Use um projeto Supabase dedicado ao GNUverse. A migração cria tabelas de artigos, versões, usuários e mídia no banco. Para futuras alterações de modelo, gerar/revisar uma nova migração de PostgreSQL e versioná-la antes do deploy. Não usar comandos de reset/fresh no banco de produção.

Sem SMTP configurado, o fluxo de esqueci minha senha não envia e-mail real. Guarde o acesso administrativo para o piloto; configurar um serviço de e-mail será necessário se quiser recuperação de senha por e-mail.

## 6. Publicar o site no Cloudflare Pages

1. Crie um projeto **Pages** conectado ao mesmo repositório.
2. Root directory: raiz do repositório (não `cms`).
3. Build command: `npm run build`; output directory: `out`; Node.js 22 ou 24.
4. Configure apenas `CMS_CONTENT_MODE=live` e `CMS_URL` para a leitura de conteúdo. A API pública só retorna publicados.
5. Faça um primeiro deploy com o CMS funcionando. Depois crie o deploy hook e configure `SITE_DEPLOY_HOOK_URL` no Render.
6. Insira o artigo de teste **no CMS da nuvem**, publique e acompanhe o novo deploy no Cloudflare. Somente depois do sucesso a versão pública é atualizada.

Publicação, alteração publicada, despublicação ou exclusão de artigo publicado solicitam build. Se o hook falhar, o conteúdo continua salvo e o log do CMS avisa. Use o deploy manual do Cloudflare depois de corrigir o ambiente. Apenas alterar mídia não dispara build: republique o artigo afetado.

## Verificações disponíveis

```bash
make check
```

O teste do CMS cria um banco temporário independente e verifica permissões e publicação sem alterar seus artigos. Os testes locais não comprovam conexão real com Supabase/S3 nem um deploy hook de produção.

Use `make help` para listar os comandos. As instruções de build/start nos provedores continuam usando npm, sem depender de Make instalado na nuvem.

Se as portas estiverem ocupadas, use `CMS_PORT=3011 SITE_PORT=3010 make dev`. Esse comando conecta o site ao CMS local na porta escolhida, sobrescrevendo a porta definida no ambiente apenas para essa execução. Para usar um CMS remoto, execute somente `make site`, que lê sua configuração.

Encerre servidores deste mesmo projeto antes de usar `make dev`: o Next.js permite apenas uma sessão de desenvolvimento por diretório, mesmo em portas diferentes.
