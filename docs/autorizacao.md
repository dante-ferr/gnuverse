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

## Conta única

A conta criada no Payload também autentica no site com o mesmo e-mail e senha. O cadastro público do site cria um participante no mesmo provedor, sem conceder acesso editorial ou administrativo. O primeiro administrador do painel herda seus papéis no jogo no primeiro login, sem criar nem vincular outra conta.

`core/authn/identity-provider.ts` define o contrato independente do CMS. O adaptador `CMSIdentityProvider` valida credenciais e sessões no Payload. O SQLite do jogo armazena perfis, saldo e construções; não guarda novas senhas nem cópias dos tokens do provedor. Os papéis são atualizados a partir da identidade canônica a cada requisição autenticada. Uma sessão revogada no provedor deixa de funcionar no jogo.

Os formulários do site e do painel usam as mesmas contas, mas entrar em um deles não preenche automaticamente a sessão do outro navegador/aba. Não há fallback para senhas locais quando o provedor está indisponível.

## Gerenciar pela interface

1. Entre no painel do CMS com uma conta administradora e abra **Pessoas e acessos** na navegação. A tela também está em `/acessos`, na mesma origem do CMS.
2. No primeiro uso, clique em **Ativar gestão compartilhada**. A interface preserva os papéis dos administradores e editores existentes do blog. Não é necessário editar arquivos ou copiar IDs.
3. Edite uma pessoa ou clique em **Nova pessoa**. Informe um nome, marque os papéis e selecione a conta canônica do blog/painel. O perfil do jogo aparece associado automaticamente após o primeiro login. A seleção manual de perfis serve para migrações antigas, e não é necessária para contas novas.
4. Clique em **Salvar acessos**. As permissões passam a valer nas próximas requisições, inclusive nas sessões já abertas. Recarregue a página do jogo para atualizar os controles visíveis.

Uma conta pode pertencer a apenas uma pessoa. A interface impede remover o último administrador vinculado ao painel e detecta edições concorrentes, evitando sobrescrever mudanças de outra sessão. **Remover acesso compartilhado** revoga os papéis e desfaz os vínculos dessa pessoa; suas contas, torres e artigos são preservados. Contas autenticadas do jogo continuam com os direitos básicos de membro.

O cadastro do site e o cadastro administrativo criam contas na mesma coleção de usuários. Participantes não recebem poderes editoriais ou globais, nem podem escolher papéis pelo cadastro. Depois da ativação da gestão compartilhada, atribua papéis pela interface; antes dela, o papel legado do painel continua valendo.

Se o jogo estiver desligado, a tela informa que sua lista de contas está indisponível. Você ainda pode alterar papéis e preservar vínculos já cadastrados; novos vínculos com contas do jogo exigem a API disponível. A consulta desses perfis valida a sessão administrativa no CMS e retorna apenas seus identificadores, nome, e-mail e a referência à conta canônica.

## Armazenamento e implantação

Localmente, o CMS administra o registro `.content/authorization.json`. O jogo recebe os papéis pela identidade autenticada no provedor. O arquivo é criado pela ativação na interface, fica fora do Git e é atualizado por substituição atômica com controle de revisão. Depois de ativado, ele é a autoridade exclusiva: o campo legado `role` do CMS deixa de conceder permissões. Antes da ativação, os papéis legados do CMS também valem no jogo: o administrador inicial já pode administrar torres.

`GNUVERSE_AUTHZ_FILE` permite escolher outro caminho absoluto no servidor do CMS. Quando esse caminho é explicitamente configurado, um arquivo ausente ou inválido causa falha de autorização, sem recuperar permissões legadas. `GNUVERSE_DATA_DIR` permite escolher o diretório privado padrão dos dados de autorização.

O painel consulta o jogo em `GAME_INTERNAL_URL` ou, por padrão, `http://localhost:${GAME_PORT}`. O jogo verifica a sessão do painel em `CMS_URL` ou `http://localhost:${CMS_PORT}`. Em produção, configure os endereços internos/HTTPS corretos e preserve o registro com permissão de escrita para o CMS. O jogo não precisa montar esse arquivo: autenticação e papéis vêm da API do provedor. Para várias réplicas do CMS, substitua o adaptador de arquivo por um armazenamento compartilhado que implemente `RoleStore`. Em produção, a migração `20261105_000000_shared_identity` adiciona o papel de participante e o apelido público.

## Intervenções em torres

Administradores e moderadores podem editar nome e regras de qualquer torre, inclusive `allowCreatorBan`, sem depender de sua participação ou de propostas pendentes. Limites de valores e proteções de consistência da simulação continuam valendo: frequência de vento durante uma ventania e intervalo de checkpoint pendente aguardam a conclusão desses processos.

Na interface de uma torre, esses papéis habilitam edição, exclusão e o painel de intervenção administrativa. `POST /api/towers/:id/restore` aceita `{ "snapshotId": "ID", "reason": "motivo público" }`; `snapshotId: null` remove todos os blocos. A ação salva a construção anterior, encerra propostas pendentes ou restaurações adiadas, interrompe a ventania e registra motivo e ator no histórico. Moedas e contribuições não são reembolsadas. `DELETE /api/towers/:id` remove a torre e seu histórico definitivamente.

## Migração de perfis antigos

Perfis anteriores do jogo mantêm IDs, saldo, autoria, torres e contribuições. A associação ocorre quando existe um vínculo administrativo explícito ou quando o login comprova a mesma senha no provedor e na conta antiga. O e-mail sozinho nunca permite assumir um perfil existente. Senhas locais são removidas após a migração; sessões antigas do jogo são invalidadas. Se as senhas eram diferentes, um administrador pode associar o perfil legado à conta canônica em Pessoas e acessos.

Para quizzes futuros, use o mesmo contrato de identidade e verifique `can(actor, 'quiz:manage')` antes das mutações. As políticas de autorização permanecem independentes do provedor.
