# Blog autoral — proposta e situação atual

Atualizado em 21/10/2026.

## Decisões de produto

- O blog é uma área paralela ao jogo de torres, independente da construção e de sua governança.
- Publicações autorais sobre software livre e democratização do acesso à tecnologia, com análise, referências e conexão com as palestras.
- Pessoas de fora da equipe também poderão contribuir com posts.
- Posts precisam de autorização antes de aparecer publicamente.
- Cada um dos sete integrantes produzirá dois posts: 14 textos para a prova de conceito. Ainda não estão redigidos/inseridos como parte desta tarefa.
- Manter navegação editorial por lista, categorias e páginas de artigo. Não transformar posts em salas ou exigir jogar para ler/publicar.

Como proposta editorial, cada integrante pode escrever um texto de investigação e um de experiência, entrevista ou caso analisado. Essa distribuição não é uma exigência do PDF e os títulos serão escolhidos pelo grupo. Revisão cruzada entre integrantes antes da submissão.

## Fluxo pretendido, ainda não implementado

Rascunho → enviado para revisão → ajustes ou aprovação → publicado.

Autores podem preparar/submeter seus textos; revisores autorizam a publicação. Definir quem revisa, critérios, mensagens de devolutiva e revisão de alterações em posts já publicados. Registrar autoria e fontes sem delegar a reflexão à IA.

O registro público de jogadores e a submissão de posts podem compartilhar identidade no futuro, mas esse desenho ainda não foi escolhido. A política editorial do blog é independente de banimentos e votações de uma torre.

## O que está implementado

Verificado no código em 21/10/2026:

- Payload CMS separado em `cms/`, com painel, login e contas criadas pelo administrador.
- Administrador e editor. Editor atualmente pode criar, editar, publicar e excluir artigos; não há aprovação obrigatória nem papel restrito de autor/revisor.
- Não existe cadastro público de autores ou jogadores, nem formulário público de submissão.
- Editor visual, título, endereço, resumo, autoria em texto, categoria, capa opcional e referências.
- Rascunhos e versões; leitura pública de artigos publicados.
- Lista `/artigos/` e páginas `/artigos/[slug]/`.
- Sincronização no build, exportação estática e cópia de capas, sem consulta ao CMS durante a visita.
- Hook para solicitar deploy na publicação; depende de configuração de produção.
- Exemplo técnico “Olá, GNUverse!” e guia para inseri-lo pelo painel.

A infraestrutura atual serve para um piloto com equipe confiável, mas não atende ainda ao fluxo público moderado. Não abrir o papel de editor a todos os visitantes como substituto da submissão.

## CMS e hospedagem escolhidos

- Payload hospedado por nós na nuvem, previsto no Render.
- PostgreSQL e armazenamento S3 compatível, previstos no Supabase.
- Site público exportado no Cloudflare Pages.
- Conteúdo no banco e mídia no storage, sem commits editoriais.
- Publicar solicita um build, que lê publicados e copia as capas. Após sucesso, a versão estática é atualizada.
- O CMS pode suspender no plano gratuito sem fazer leitores aguardarem seu despertar; painel e builds ainda dependem de ele responder.

Testes locais anteriores cobriram permissões atuais, rascunhos, upload, migrações e builds, incluindo artigo e capa com o CMS desligado. A configuração real de Supabase/S3 e do deploy hook não foi validada. Não há evidência nesta sessão de publicação em nuvem.

## Próximos passos

1. Implementar autor/revisor e impedir publicação direta por autores, inclusive pela API.
2. Definir e implementar como visitantes se cadastram e enviam posts para revisão.
3. Configurar serviços e credenciais e validar o fluxo de publicação na nuvem.
4. Produzir, revisar e publicar os 14 posts do grupo.
5. Configurar recuperação de senha por e-mail e revisar o uso de contas públicas antes da abertura externa.

Operação local e credenciais: [guia do CMS](teste-cms.md). Arquitetura: [decisões técnicas](arquitetura-cms.md).

## Divisão de trabalho atual

O usuário decidiu deixar a implementação do blog para outro integrante. A entrada pública é `/blog/`, reutilizando a lista já existente; `/artigos/` e as páginas individuais foram preservadas. Nesta etapa não foram alterados modelos, permissões ou publicação do CMS. O jogo será implementado em outra conversa e tem entrada independente em `/jogo/`.
