# GNUverse

Projeto multimodal de MATA68 (2026.2) sobre software livre como forma de democratizar o acesso à tecnologia. Stack: Next.js App Router, Tailwind e TypeScript.

## Experiência proposta

Duas áreas paralelas e independentes:

- **Torres colaborativas:** site-jogo de blocos com física simplificada, cadastro, moedas globais, criação de torres, votações e governança transparente. É uma proposta documentada; o jogo ainda não está implementado. Veja [gameplay e regras](docs/torres-colaborativas.md).
- **Blog autoral:** posts da equipe e de visitantes, sujeitos a aprovação. A prova de conceito terá dois posts por integrante, totalizando 14. A integração editorial inicial existe, mas submissão pública e aprovação obrigatória ainda não. Veja [o plano editorial e o estado do CMS](docs/blog.md).

## Arquitetura escolhida

- Site público estático na raiz, preparado para Cloudflare Pages. O jogo precisará de um backend dinâmico separado, ainda a definir.
- Payload CMS separado em `cms/`, preparado para Render.
- Banco PostgreSQL e mídia S3 no Supabase em produção; SQLite e disco local somente no desenvolvimento.
- Conteúdo é salvo no banco, sem commits editoriais. Publicar solicita novo build por deploy hook.
- Artigos e capas são copiados durante o build: o visitante não precisa esperar o CMS acordar.

Leia [as decisões](docs/arquitetura-cms.md) e [o guia de teste e credenciais](docs/teste-cms.md).

## Teste local

Requer Node.js 22+, npm e GNU Make. Versões fixadas nos dois arquivos `package-lock.json`.

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
- `docs/planejamento.md`: responsabilidades dos sete integrantes e cronograma.
- `docs/diario-de-bordo.md`: modelo coletivo e individual.

O escopo implementado atualmente é a integração editorial inicial; conteúdo acadêmico e experiências mais elaboradas continuam sob desenvolvimento do grupo. As contas de nuvem, o remoto GitHub e as credenciais de produção ainda precisam ser configurados. Nenhum serviço externo foi publicado nesta etapa.

Se as portas estiverem ocupadas, use `CMS_PORT=3011 SITE_PORT=3010 make dev`. Esse comando conecta o site ao CMS local na porta escolhida, sobrescrevendo a porta definida no ambiente apenas para essa execução. Para usar um CMS remoto, execute somente `make site`, que lê sua configuração.

Encerre servidores deste mesmo projeto antes de usar `make dev`: o Next.js permite apenas uma sessão de desenvolvimento por diretório, mesmo em portas diferentes.
