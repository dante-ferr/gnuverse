# GNUverse

Projeto multimodal de MATA68 (2026.2) sobre software livre como forma de democratizar o acesso à tecnologia. Stack: Next.js App Router, Tailwind e TypeScript.

## Experiência proposta

Duas áreas paralelas e independentes:

- **Torres colaborativas:** jogo multiplayer local com física simplificada, cadastro, moedas globais, criação de torres, histórico, votações e governança transparente. O backend Node e a persistência SQLite funcionam localmente; a hospedagem ainda será escolhida. Veja [gameplay e regras](docs/torres-colaborativas.md) e o [guia de teste local](docs/jogo-local.md).
- **Blog autoral:** posts da equipe e de visitantes, sujeitos a aprovação. A prova de conceito terá dois posts por integrante, totalizando 14. A integração editorial inicial existe, mas submissão pública e aprovação obrigatória ainda não. Veja [o plano editorial e o estado do CMS](docs/blog.md).

## Navegação e divisão de trabalho

- `/`: página inicial do GNUverse, com entradas para jogo e blog.
- `/jogo/`: interface interativa do jogo, conectada ao backend Node configurado em `NEXT_PUBLIC_GAME_API_URL`.
- `/blog/`: entrada do blog, reutilizando a base editorial existente. O desenvolvimento do blog fica reservado a outro integrante.
- `/artigos/` e `/artigos/[slug]/`: rotas editoriais anteriores preservadas por compatibilidade.

A navegação compartilhada fica em `src/components/site-header.tsx`. O jogo e o blog usam serviços e dados separados; implementar o jogo não altera o fluxo editorial do CMS.

## Arquitetura escolhida

- Site público estático na raiz, preparado para Cloudflare Pages. O jogo consulta um backend dinâmico Node separado; ele funciona localmente e sua hospedagem ainda será definida.
- Payload CMS separado em `cms/`, preparado para Render.
- Banco PostgreSQL e mídia S3 no Supabase em produção; SQLite e disco local somente no desenvolvimento.
- Conteúdo é salvo no banco, sem commits editoriais. Publicar solicita novo build por deploy hook.
- Artigos e capas são copiados durante o build: o visitante não precisa esperar o CMS acordar.

Leia [as decisões do CMS](docs/arquitetura-cms.md), [o guia de teste e credenciais do CMS](docs/teste-cms.md), [a arquitetura do jogo](docs/arquitetura-jogo.md) e [o guia de teste local](docs/jogo-local.md).
Para a organização técnica do jogo, veja [a arquitetura do jogo](docs/arquitetura-jogo.md) e o [guia de teste local](docs/jogo-local.md).

## Teste local

Requer Node.js 22.18+, npm e GNU Make. Versões fixadas nos dois arquivos `package-lock.json`.

Na primeira vez:

```bash
make setup
```

Depois, para iniciar CMS e site juntos:

```bash
make dev
```

Abra a URL do painel impressa no terminal, crie seu administrador e insira o artigo de teste descrito em `docs/teste-cms.md`. O site fica no endereço impresso no terminal, normalmente http://localhost:3000/artigos/.

O setup instala as duas aplicações, gera o segredo do CMS e prepara `.env.local` para o modo live. A porta local é definida somente por `CMS_PORT` nesse arquivo; o endereço do painel e a leitura do conteúdo são derivados dela. Configurações antigas são migradas, preservando os demais valores. `make dev` aguarda o CMS antes de iniciar o site; Ctrl+C encerra os dois.

Depois de editar/publicar no CMS, pare e execute `make dev` novamente para atualizar o conteúdo. A sincronização acontece na inicialização, não a cada visita.

Para testar o jogo, inicie o backend em outro terminal com `npm run game:dev`. Com o site iniciado, abra `http://localhost:3000/jogo/`; o backend local usa a porta `3002` e o CMS continua na `3001`. Se o CMS estiver desligado, use `CMS_CONTENT_MODE=demo` em `.env.local`. O jogo pode ser testado em duas sessões de navegador. Veja [o guia de teste local](docs/jogo-local.md) para contas, variáveis de ambiente e limitações do protótipo.

Sem configuração, o site usa um artigo claramente identificado como demonstração. Em modo live, falhas do CMS abortam a sincronização; nunca substituem o conteúdo real pelo exemplo.

## Exportação e verificação

```bash
make check
make build
make preview
```

`make build` sincroniza o conteúdo e exporta o site para `out/`. `make preview` serve esses arquivos, sem servidor Next.js ou consulta ao CMS. O build usa Webpack para evitar a restrição de processos/portas do Turbopack observada neste ambiente.

Use `make help` para listar os atalhos. Para trabalhar em terminais separados: `make cms` e `make site`. Os scripts npm continuam disponíveis, inclusive nos provedores de nuvem.

## Estrutura

- `src/app/`: abertura, lista e páginas de artigos.
- `src/lib/articles.ts`: leitura do snapshot preparado no build.
- `scripts/`: leitura da API, validação e cópia das capas.
- `content/demo-article.json`: exemplo técnico, não publicado automaticamente no banco.
- `cms/`: painel, usuários, artigos, uploads, testes e migrações PostgreSQL.
- `game-server/`: backend Node, simulação autoritativa, autenticação e persistência SQLite do jogo.
- `game-server/config/game.config.toml`: regras ajustáveis de moedas, custos, votações e limites do jogo.
- `src/components/game/`: interface interativa da experiência em `/jogo/`.
- `docs/jogo-local.md`: inicialização, contas, configuração e limites do backend local.
- `docs/planejamento.md`: responsabilidades dos sete integrantes e cronograma.
- `docs/diario-de-bordo.md`: modelo coletivo e individual.

O escopo implementado inclui a integração editorial inicial e o multiplayer local do jogo. Conteúdo acadêmico, hospedagem do backend, contas de nuvem, remoto GitHub e credenciais de produção ainda precisam ser configurados. Nenhum serviço externo foi publicado nesta etapa.

Se as portas estiverem ocupadas, use `CMS_PORT=3011 SITE_PORT=3010 make dev`. Esse comando conecta o site ao CMS local na porta escolhida, sobrescrevendo a porta definida no ambiente apenas para essa execução. Para usar um CMS remoto, execute somente `make site`, que lê sua configuração.

Encerre servidores deste mesmo projeto antes de usar `make dev`: o Next.js permite apenas uma sessão de desenvolvimento por diretório, mesmo em portas diferentes.
