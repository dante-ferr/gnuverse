# Blog autoral — proposta e situação atual

Atualizado em 15/11/2026.

## Decisões de produto

- O blog é uma área paralela ao jogo de torres, independente da construção e de sua governança.
- Publicações autorais sobre software livre e democratização do acesso à tecnologia, com análise, referências e conexão com as palestras.
- Pessoas de fora da equipe também poderão contribuir com posts.
- Posts precisam de autorização antes de aparecer publicamente.
- Cada um dos sete integrantes produzirá dois posts: 14 textos para a prova de conceito. Ainda não estão redigidos/inseridos como parte desta tarefa.
- Manter navegação editorial por lista, categorias e páginas de artigo. Não transformar posts em salas ou exigir jogar para ler/publicar.

Como proposta editorial, cada integrante pode escrever um texto de investigação e um de experiência, entrevista ou caso analisado. Essa distribuição não é uma exigência do PDF e os títulos serão escolhidos pelo grupo. Revisão cruzada entre integrantes antes da submissão.

## Fluxo editorial implementado

Rascunho (`draft`) → enviado para revisão (`in_review`) → ajustes solicitados (`changes_requested`) ou aprovação (`approved`) → publicado (`_status: 'published'`).

Autores preparam e submetem seus textos (`author`); revisores (`reviewer`) e administradores (`admin`) analisam, registram devolutiva (`reviewNotes`), aprovam e autorizam a publicação. A equipe ainda precisa alinhar critérios editoriais humanos e revisão cruzada antes de cada publicação, registrando autoria e fontes sem delegar a reflexão à IA.

O registro público de jogadores (`game-server/`) e o cadastro de autores do blog no CMS funcionam de forma independente: a política editorial do blog não depende de banimentos ou votações de uma torre.

## O que está implementado

- Payload CMS separado em `cms/`, com painel `/admin`, login e papéis `admin`, `reviewer` e `author`.
- Regras de acesso e hooks na API e no painel: `author` cria e edita apenas os próprios rascunhos/submissões em `draft` ou `changes_requested` e é bloqueado de publicar diretamente (`_status: 'published'`) ou alterar papéis; `reviewer` e `admin` revisam, registram devolutiva privada (`reviewNotes`), aprovam, publicam, despublicam e excluem artigos.
- Campo `owner` vinculado automaticamente ao usuário criador na criação do artigo, preservando o campo `author` em texto livre para o nome público exibido.
- Cadastro público de autores (`POST /api/users`, papel padrão `author`) e painel colapsável `"Contribuir com um artigo · Submissão editorial"` em `/blog/` (`src/components/blog/submission-panel.tsx`), usando Bearer token em `sessionStorage`, allowlist de `CORS`/`CSRF` configurável via `CMS_ALLOWED_ORIGINS` e timeout de 120 s para acomodar o despertar do Render Free.
- Editor visual no `/admin` e conversão automática de parágrafos em texto simples para Lexical no formulário público; título, endereço (`slug`), resumo, autoria exibida, categoria, capa opcional (via `/admin`) e referências.
- Rascunhos, versões e status de revisão; leitura pública anônima retorna apenas artigos publicados (sem vazar `reviewNotes`).
- Lista interativa (`src/components/blog/blog-explorer.tsx`) com filtro por categorias (`Todas`, `Reflexões`, `Educação`, `Acesso`, `Experiências`) e exibição de capas nos cards em `/blog/` e `/artigos/`, além de páginas estáticas `/artigos/[slug]/` com link `← Voltar ao blog`.
- Sincronização no build (`scripts/sync-content.mjs`), exportação estática em `out/` e cópia de capas para `public/cms-media/`, sem consulta ao CMS durante a leitura dos artigos pelos visitantes.
- Hook para solicitar deploy na publicação (`cms/src/hooks/deploy-site.ts`).
- Exemplo técnico “Olá, GNUverse!” (`content/demo-article.json`) e guia para inseri-lo pelo painel.

## CMS e hospedagem escolhidos

- Payload hospedado por nós na nuvem, previsto no Render.
- PostgreSQL e armazenamento S3 compatível, previstos no Supabase.
- Site público exportado no Cloudflare Pages.
- Conteúdo no banco e mídia no storage, sem commits editoriais.
- Publicar solicita um build, que lê publicados e copia as capas. Após sucesso, a versão estática é atualizada.
- O CMS pode suspender no plano gratuito sem fazer leitores aguardarem seu despertar; painel, builds e o painel opcional de submissão em `/blog/` dependem de ele responder (com espera de até 120 s).

A configuração real de Supabase/S3, `CMS_ALLOWED_ORIGINS`, `NEXT_PUBLIC_CMS_URL` e do deploy hook na nuvem ainda não foi validada em produção.

## Próximos passos

1. Configurar serviços e credenciais na nuvem (Supabase, Render Free e Cloudflare Pages) e validar o fluxo completo de publicação e submissão externa em produção.
2. Configurar adaptador **SMTP** no Payload para recuperação de senha por e-mail e revisar proteções anti-spam/rate limit antes de divulgar o cadastro externo ao público amplo.
3. Produzir, revisar de forma cruzada e publicar os **14 posts** do grupo.

Operação local e credenciais: [guia do CMS](teste-cms.md). Arquitetura: [decisões técnicas](arquitetura-cms.md).

## Divisão de trabalho atual

A entrada pública do blog é `/blog/` (com listagem filtrável, capas e submissão editorial colapsável), mantendo `/artigos/` e `/artigos/[slug]/` compatíveis. Tanto o fluxo editorial (`author`/`reviewer`/`admin`) no CMS quanto a experiência do jogo em `/jogo/` (`game-server/` local) já estão implementados na base atual, restando nuvem, SMTP e conteúdo.
