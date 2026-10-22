# Testar o jogo localmente

O jogo roda em duas aplicações: o site Next.js, que apresenta a interface, e um backend Node separado, que valida contas e ações compartilhadas. O backend usa SQLite local; ele não depende do CMS do blog. A hospedagem do backend será decidida depois.

## Iniciar

Use `make dev` para iniciar CMS, backend do jogo e site juntos. O comando aguarda as duas APIs, conecta o site à porta real do jogo e encerra os três processos com Ctrl+C. Para portas alternativas: `CMS_PORT=3011 SITE_PORT=3010 GAME_PORT=3012 make dev`. Não execute outro backend do jogo ao mesmo tempo.

Para iniciar o jogo e o site separadamente, siga os comandos abaixo.

Na raiz do repositório, instale as dependências com `npm install`. Em um terminal, inicie o backend:

```sh
npm run game:dev
```

Em outro terminal, inicie o site:

```sh
npm run dev
```

Abra `http://localhost:3000/jogo/`. A API local usa `http://localhost:3002`; o CMS permanece em `http://localhost:3001`. Se o CMS estiver indisponível, configure `CMS_CONTENT_MODE=demo` no `.env.local` da raiz para que a sincronização editorial use o artigo de demonstração; isso não altera os dados do jogo.

## Contas e teste compartilhado

Crie uma conta com e-mail, senha e apelido público. O apelido aparece nas contribuições; e-mail e senha não são públicos. O e-mail não é verificado nesta entrega e não há envio de mensagens nem recuperação de senha por e-mail. Use credenciais de teste.

Para observar a mesma torre a partir de duas sessões, abra uma janela privada ou outro navegador, crie uma segunda conta e faça contribuições nas duas sessões. A sessão fica no armazenamento da aba; duas abas abertas de forma independente podem entrar com contas diferentes. Uma aba duplicada pode herdar a sessão inicial; saia dela antes de entrar com a segunda conta.

## Configuração

As regras de protótipo ficam em [`game.config.toml`](../game-server/config/game.config.toml). Os tempos usam milissegundos; quórum e aprovação são frações entre `0` e `1`. O backend lê e valida o TOML ao iniciar. Sintaxe inválida, campo desconhecido ou valor fora dos limites interrompe a inicialização com erro, em vez de iniciar com regras diferentes das configuradas.

Variáveis da raiz, documentadas também em [`.env.example`](../.env.example):

- `GAME_CONFIG_PATH`: caminho opcional do arquivo TOML; relativo à raiz do projeto ou absoluto. O padrão é `game-server/config/game.config.toml`.
- `GAME_PORT`: porta HTTP do backend; padrão local `3002`.
- `GAME_HOST`: endereço em que o backend escuta; padrão `127.0.0.1`. Para aceitar conexões de outros dispositivos na rede local, use `0.0.0.0` e configure o endereço alcançável na URL da API.
- `GAME_DB_PATH`: arquivo SQLite persistente local do jogo.
- `GAME_ALLOWED_ORIGINS`: origens do navegador autorizadas a chamar a API, separadas por vírgula.
- `NEXT_PUBLIC_GAME_API_URL`: endereço da API incluído na interface pública; por isso não deve conter segredos. O padrão de desenvolvimento é `http://localhost:3002`.

Inclua a origem do frontend na lista de origens permitidas do backend. Para acesso de outro dispositivo na rede local, configure `GAME_HOST=0.0.0.0`, use o endereço do computador que executa o backend em `NEXT_PUBLIC_GAME_API_URL` e inclua a origem do site em `GAME_ALLOWED_ORIGINS`.

## Escopo e limitações

Esta entrega suporta torres compartilhadas, cadastro por e-mail e senha com apelido público, saldo e intervenções validados pelo servidor, e estado persistido em SQLite. Contas e dados do jogo são separados dos usuários administrativos do Payload CMS.

Ao criar uma torre, o criador pode marcar `allowCreatorBan` para permitir que a própria conta seja alvo de uma proposta de suspensão. Essa escolha é definitiva: não aparece na edição das regras depois. A suspensão do criador só pode ocorrer por votação quando os banimentos daquela torre usam votação; BDFL não pode suspender a própria conta. Durante a suspensão, ele perde temporariamente as ações de administração daquela torre.

O protótipo usa uma única instância de backend e um banco SQLite local. Um bloqueio SQLite auxiliar impede abrir duas instâncias sobre o mesmo banco; o sistema operacional libera o bloqueio se o processo encerrar ou cair. Mantenha o arquivo `.writer-lock` junto ao banco, sem excluí-lo com o servidor em execução. Há limites de até 200 torres no total (configurável), 10 torres por conta, 100 blocos por torre e 100 conexões de observação por torre. Cadastro e login têm limite temporário de 15 tentativas por endereço IP por minuto, mantido em memória. Não há hospedagem de produção configurada, verificação de e-mail, recuperação de conta por e-mail ou proteção contra criação de múltiplas contas com endereços diferentes. Os valores iniciais de moedas, custos e votações são parâmetros de experiência, não regras finais. O histórico completo fica em memória e em um estado JSON transacional no SQLite; paginação, compactação e testes de carga ficam para a preparação da hospedagem. Não se deve tratar o protótipo como serviço público pronto para uso.

## Ventania e física

Cada torre permite configurar a primeira ventania e o intervalo entre as seguintes, tanto na criação quanto em “Regras da torre · Editar”. Os padrões são 15 e 10 blocos. `wind_min_blocks`, `wind_every_blocks` e `wind_strength` ficam no TOML do jogo. A contagem é cumulativa por torre e não diminui ao restaurar versões.

O servidor bloqueia novas peças a partir da colocação que atinge o limiar, aguarda essa peça assentar e aplica vento por 5 segundos. O bloqueio continua até a torre estabilizar. Restaurar uma versão por voto ou BDFL durante esse período registra a decisão, mas adia sua execução até o fim do evento. Uma reinicialização preserva a contagem e a fase do vento.

Os corpos têm restituição zero e contatos com maior precisão para reduzir compressão e rebote numérico. O solver usa subpassos; torres em repouso não são simuladas continuamente. Os blocos são renderizados em SVG monocromático; sua aparência é independente do material físico.

Alterar a frequência exige justificativa pública e não reinicia a contagem de contribuições. Antes da primeira ventania, o limite inicial determina o próximo evento; depois dela, vale o novo intervalo contado desde o último gatilho. Se o novo limite já passou, a próxima colocação aceita dispara o evento. Alterações de frequência ficam bloqueadas enquanto houver ventania ou estabilização; nenhuma alteração interrompe um evento em curso.

O criador edita custo, governança de banimentos e restaurações, habilitação de eleitores, contribuições mínimas e frequências de vento no painel “Regras da torre · Editar”. Somente “Suspensão do criador” permanece definitiva, inclusive na API. Cada alteração exige motivo público. Propostas pendentes ou com execução adiada bloqueiam temporariamente a gravação; durante o vento, os campos de frequência ficam somente para leitura.
