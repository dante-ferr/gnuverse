# Autorização compartilhada

`core/authz/policy.ts` define papéis, permissões e decisões puras, sem dependência do Payload, Next.js ou armazenamento. `identity.ts` define o contrato `RoleStore`; `file-role-store.ts` é o primeiro adaptador de servidor. O código cliente importa somente a política pura para apresentar controles; toda alteração é autorizada novamente no backend.

| Papel | Permissões |
| --- | --- |
| `admin` | Todas as permissões conhecidas: usuários, CMS, artigos, mídia, torres e quizzes |
| `blog-editor` | Painel CMS, artigos e criação/edição de mídia |
| `game-moderator` | Editar, excluir e restaurar qualquer torre |
| `quiz-editor` | Gerenciar quizzes |
| `member` | Editar regras e excluir as próprias torres, sujeito às regras locais |

Papéis são cumulativos. A permissão de quizzes está definida para o backend futuro; não existe uma implementação de quizzes neste repositório. O acesso ao painel CMS exige `cms:access`, inclusive para contas cadastradas nele.

Contas autenticadas do jogo sempre recebem `member` além dos papéis atribuídos, preservando o controle das próprias torres para editores de outros domínios.

## Gerenciar pela interface

1. Entre no painel do CMS com uma conta administradora e abra **Pessoas e acessos** na navegação. A tela também está em `/acessos`, na mesma origem do CMS.
2. No primeiro uso, clique em **Ativar gestão compartilhada**. A interface preserva os papéis dos administradores e editores existentes do blog. Não é necessário editar arquivos ou copiar IDs.
3. Edite uma pessoa ou clique em **Nova pessoa**. Informe um nome, marque os papéis e selecione suas contas do blog/painel e do jogo. A busca aceita nome e e-mail; a vinculação usa o ID da conta selecionada. Contas com o mesmo e-mail não são vinculadas automaticamente.
4. Clique em **Salvar acessos**. As permissões passam a valer nas próximas requisições, inclusive nas sessões já abertas. Recarregue a página do jogo para atualizar os controles visíveis.

Uma conta pode pertencer a apenas uma pessoa. A interface impede remover o último administrador vinculado ao painel e detecta edições concorrentes, evitando sobrescrever mudanças de outra sessão. **Remover acesso compartilhado** revoga os papéis e desfaz os vínculos dessa pessoa; suas contas, torres e artigos são preservados. Contas autenticadas do jogo continuam com os direitos básicos de membro.

Os cadastros continuam nos fluxos existentes de cada domínio. Depois de criar uma nova conta do CMS, vincule-a nesta interface para conceder acesso ao painel. Nenhum jogador recebe poderes globais automaticamente, nem pode escolher papéis pelo cadastro.

Se o jogo estiver desligado, a tela informa que sua lista de contas está indisponível. Você ainda pode alterar papéis e preservar vínculos já cadastrados; novos vínculos com contas do jogo exigem a API disponível. A consulta dessas contas valida a sessão administrativa no CMS e retorna somente nome, e-mail e ID.

## Armazenamento e implantação

Localmente, CMS e jogo usam `.content/authorization.json`. O arquivo é criado pela ativação na interface, fica fora do Git e é atualizado por substituição atômica com controle de revisão. Depois de ativado, ele é a autoridade exclusiva: o campo legado `role` do CMS deixa de conceder permissões. Antes da ativação, o CMS mantém os papéis legados e o jogo concede apenas `member`.

`GNUVERSE_AUTHZ_FILE` permite escolher outro caminho absoluto, igual nos dois servidores. Quando esse caminho é explicitamente configurado, um arquivo ausente ou inválido causa falha de autorização, sem recuperar permissões legadas. `GNUVERSE_DATA_DIR` permite escolher o diretório privado padrão dos dados de autorização.

O painel consulta o jogo em `GAME_INTERNAL_URL` ou, por padrão, `http://localhost:${GAME_PORT}`. O jogo verifica a sessão do painel em `CMS_URL` ou `http://localhost:${CMS_PORT}`. Em produção, configure os endereços internos/HTTPS corretos e disponibilize o mesmo registro com permissão de escrita para o CMS. Em máquinas separadas sem armazenamento compartilhado, substitua o adaptador de arquivo por um armazenamento compartilhado que implemente `RoleStore`; as políticas puras permanecem as mesmas.

## Intervenções em torres

Administradores e moderadores podem editar nome e regras de qualquer torre, inclusive `allowCreatorBan`, sem depender de sua participação ou de propostas pendentes. Limites de valores e proteções de consistência da simulação continuam valendo: frequência de vento durante uma ventania e intervalo de checkpoint pendente aguardam a conclusão desses processos.

Na interface de uma torre, esses papéis habilitam edição, exclusão e o painel de intervenção administrativa. `POST /api/towers/:id/restore` aceita `{ "snapshotId": "ID", "reason": "motivo público" }`; `snapshotId: null` remove todos os blocos. A ação salva a construção anterior, encerra propostas pendentes ou restaurações adiadas, interrompe a ventania e registra motivo e ator no histórico. Moedas e contribuições não são reembolsadas. `DELETE /api/towers/:id` remove a torre e seu histórico definitivamente.

## Limite entre identidade e autorização

Este módulo centraliza políticas e permite centralizar atribuições. Os logins, senhas e sessões atuais continuam locais ao CMS e ao jogo; a associação explícita de IDs permite compartilhar papéis sem presumir que contas com o mesmo e-mail pertencem à mesma pessoa. Um futuro provedor de identidade pode fornecer login único e implementar os adaptadores sem alterar `can()` ou os papéis. No backend de quizzes, adapte a identidade autenticada e verifique `can(actor, 'quiz:manage')` antes das mutações.
