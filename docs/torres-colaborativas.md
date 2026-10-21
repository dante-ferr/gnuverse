# Torres colaborativas — proposta do site-jogo

Atualizado em 21/10/2026. Documento de concepção aprovado para orientar o projeto; as funcionalidades do jogo ainda não estão implementadas.

## Papel no GNUverse

O GNUverse terá duas experiências paralelas: o jogo de torres colaborativas e o blog autoral. Não há vínculo obrigatório entre blocos, torres e posts. Uma contribuição no jogo não cria um artigo, e publicar um artigo não é requisito para jogar.

Tema do trabalho: software livre como forma de democratizar o acesso à tecnologia. O jogo explora colaboração, construção sobre contribuições anteriores, governança, transparência e versionamento. Essas mecânicas são analogias: votação e colaboração não bastam para definir software livre. O grupo deve contextualizar as liberdades de uso, estudo, modificação e redistribuição, discutir o acesso ao código e decidir a licença do próprio projeto. Conectar a experiência às palestras e aos textos autorais.

## Forma visual e gameplay

- Vista lateral, inspirada em platformer, sem precisar de personagem controlável ou de uma implementação completa de plataforma.
- Torre formada por blocos geométricos com variações de tamanho e cor. CSS/SVG/canvas podem produzir a apresentação; React cuida da interface. Não depender de salas detalhadas, pixel art ou muitos sprites.
- Física simplificada de corpos rígidos: queda, colisão, atrito, rotação e empilhamento. Não simular engenharia estrutural real.
- Participantes registrados escolhem uma torre e posicionam blocos. Intervenções podem desequilibrar a construção e provocar tombos ou desabamentos, que fazem parte da brincadeira.
- Ações de retirar ou empurrar blocos são possibilidades a validar. Caso existam, também devem ter custo ou limitação; não deixar destruição ilimitada enquanto apenas construir consome recursos.
- Observar a movimentação e os escombros faz parte da experiência. Após estabilizar, registrar um estado que possa ser consultado e restaurado.
- Para o protótipo, uma fila de intervenções é uma opção de sincronização a avaliar. Ainda não há motor de física ou protocolo escolhido.

Ciclo: entrar → escolher torre → construir/interferir → observar a física → consultar histórico ou participar de decisões → continuar construindo.

## Moedas e ritmo

Decisões:

- Cada usuário recebe uma moeda a cada X segundos.
- Há um teto de moedas acumuladas.
- A carteira é global: o saldo acompanha o usuário entre torres.
- Cada torre tem um custo de posicionamento de blocos, definido pelo criador; custo zero é permitido.
- Custos e saldo devem estar visíveis antes da intervenção.

Refinamentos aceitos para orientar a implementação:

- Recuperar saldo também durante ausência, até o teto, sem exigir uma aba aberta. O servidor calcula o tempo transcorrido; não é necessário executar um cron por moeda.
- Moedas gastas são consumidas, sem transferência ao criador da torre, nesta primeira proposta. Não representam dinheiro real.
- Restaurações não devolvem moedas nem apagam gastos anteriores.
- Torres gratuitas precisam de intervalo mínimo entre ações; carteira global sozinha não limita ações de custo zero.
- Servidor valida saldo, intervalo e custo e registra a ação de forma atômica. Não confiar no contador do navegador.

X, teto, intervalos, limites dos custos e eventual custo de criar torres ainda serão definidos por testes. Moedas globais limitam recursos por conta, mas não impedem abuso por múltiplas contas; não tratá-las como proteção completa.

## Torres e governança

Usuários podem criar torres e definir o custo por bloco. O criador assume o papel de BDFL (Benevolent Dictator for Life, usado aqui como nome do modelo de governança).

As duas decisões são configuradas separadamente:

| Decisão | Votação | BDFL |
| --- | --- | --- |
| Banir um usuário daquela torre | Participantes habilitados votam sobre uma proposta | Contribuidores enviam sugestões; BDFL decide e justifica |
| Restaurar uma versão da torre | Participantes habilitados votam sobre uma versão específica | Contribuidores sugerem uma versão; BDFL decide e justifica |

É possível combinar os modelos, por exemplo banimentos pelo BDFL e restaurações por votação. A modalidade e suas regras são públicas antes da participação.

Banimento tem efeito naquela torre, sem excluir a conta ou confiscar moedas e participação em outras torres. Duração do banimento, recurso e ações permitidas a um usuário banido ainda precisam ser especificados.

## Quem participa das votações

O criador pode escolher entre:

- Habilitação manual dos contribuidores pelo BDFL.
- Habilitação automática após uma quantidade mínima de blocos posicionados naquela torre.

Refinamentos:

- Uma pessoa habilitada tem um voto; mais blocos não aumentam o peso do voto.
- O histórico registra colocações aceitas, mesmo que os blocos caiam, sejam removidos ou desapareçam numa restauração. Reverter o cenário não deve apagar participação e gastos anteriores.
- Contar apenas quantidade permite alcançar o requisito com ações repetitivas, especialmente em torres gratuitas. Tempo mínimo de participação é um complemento a experimentar, ainda sem valor definido.
- Congelar a lista de eleitores na abertura de uma proposta, para que alterações de habilitação não mudem quem pode votar durante a votação.

O limiar automático e o tratamento de mudanças nas listas de habilitados ainda precisam ser definidos. Não converter sugestões em parâmetros finais sem teste.

## Votações

Cada proposta deve registrar:

- Torre, proponente, motivo e tipo de decisão.
- Usuário alvo ou identificador exato da versão a restaurar.
- Regras vigentes e eleitores habilitados na abertura.
- Início, prazo, quórum, percentual de aprovação e votos a favor/contra/abstenção.
- Resultado e execução da decisão.

Começar avaliando uma proposta ativa por torre. Prazo, quórum, aprovação, possibilidade de trocar voto, empates e intervalo entre propostas permanecem em aberto. Não alegar que uma fórmula escolhida para o jogo representa um modelo universal de democracia.

## Transparência do BDFL

As decisões precisam ser expostas: quem decidiu, quando, o alvo, o que mudou e uma justificativa. Sugestões podem ter estados pendente, aceita e rejeitada, acompanhadas da resposta do BDFL.

Mudanças de custo, governança e habilitação também entram no registro. Nas modalidades por votação, definir explicitamente se existe veto do BDFL; não permitir que resultados sejam ignorados silenciosamente. A existência de veto e as condições para mudar regras ainda serão decididas.

Transparência usa identificadores públicos/pseudônimos; não implica publicar e-mails ou credenciais. O histórico de decisões pertence à torre e não ao fluxo de moderação do blog.

## Histórico e restauração

- Linha do tempo com miniaturas dos estados estabilizados e registro de ações e responsáveis.
- Visualização de versões anteriores não altera a torre atual.
- Antes de votar, visualizar o estado proposto e as diferenças em relação ao atual.
- Restaurar cria um novo evento que aponta para uma versão anterior; não apaga os eventos posteriores à versão escolhida.
- Guardar posições e rotações dos blocos, além das informações necessárias para retomar a simulação. Como lidar com peças ainda em movimento será definido no protótipo.
- Contas, moedas, votos e banimentos não voltam no tempo junto com os blocos.
- Versionamento do jogo é persistência de estados e eventos no banco; não gera commits Git a cada intervenção.
- Criar uma torre derivada de uma versão é uma possível extensão, não uma funcionalidade já aprovada para a primeira entrega.

## Implementação por etapas

1. Validar localmente a diversão do empilhamento e do desabamento com poucos tipos de bloco.
2. Uma torre compartilhada com cadastro, carteira global, validação de ações e snapshots.
3. Histórico visual e restauração por votação, com regras explícitas.
4. Criação de torres, custos individuais, banimentos locais, modos de governança e transparência do BDFL.

Essas etapas são uma sequência recomendada, não eliminação das funcionalidades propostas. A entrega mínima e os parâmetros serão definidos após o protótipo e o feedback acadêmico.

## Impacto na arquitetura

O jogo exige um serviço dinâmico para identidade, ações, simulação autoritativa, saldo, histórico e decisões. O navegador renderiza a interface e as animações, mas não decide sozinho o estado compartilhado.

O HTML/CSS/JS do site pode continuar estático. O módulo do jogo consulta um backend após abrir a página. Uma intervenção não dispara build do site e não usa o fluxo editorial do CMS.

O backend e sua hospedagem ainda não foram escolhidos. Não presumir que a hospedagem gratuita do CMS com suspensão atende à partida compartilhada. Validar latência, persistência, sincronização e limites de recursos antes de prometer multiplayer. A identidade pública e sua eventual integração ao envio de posts também precisam ser projetadas; não conceder acesso administrativo do Payload a todos os jogadores.
