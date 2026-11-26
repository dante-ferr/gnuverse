'use client'

import { CenteredOverlay } from '../../overlay/centered-overlay'
import styles from './game-help-overlay.module.css'

type Props = {
  sandbox?: boolean
  onClose: () => void
  onOpenTutorial?: () => void
}

/** In-room help: goals, editing, camera, map, and sandbox combiners. */
export function GameHelpOverlay({ sandbox, onClose, onOpenTutorial }: Props) {
  return (
    <CenteredOverlay title="Como jogar" onClose={onClose}>
      <div className={styles.sections}>
        {onOpenTutorial ? (
          <section className={styles.section}>
            <h3>Tutorial</h3>
            <p>
              Prefere um passeio rápido com ilustrações?{' '}
              <button type="button" className={styles.tutorialLink} onClick={onOpenTutorial}>
                Abrir primeiros passos
              </button>
            </p>
          </section>
        ) : null}
        <section className={styles.section}>
          <h3>Objetivo</h3>
          <p>
            Ligue as fontes ao núcleo central com esteiras unidirecionais. Cada célula da grade
            comporta um pacote; o servidor move todos a cada tick. As entregas aceitas pelo núcleo
            aparecem em <strong>Requisitos do núcleo</strong> na aba Jogo. Clique num requisito
            para ver a linha de produção.
          </p>
          <p>Entre na sua conta para colocar ou apagar estruturas.</p>
        </section>

        <section className={styles.section}>
          <h3>Edição</h3>
          <p>
            Escolha uma estrutura na paleta e arraste na grade com o botão esquerdo para colocar.
            Com a esteira selecionada, clique numa esteira sua e arraste para reorientá-la e continuar
            a linha no caminho do arraste. Para apagar, segure o <strong>botão direito</strong> e
            arraste sobre as células que quer remover.
          </p>
          <ul className={styles.list} aria-label="Atalhos de edição">
            <li>
              <span className={styles.key}>1–9 · 0</span>
              <span>Seleciona a estrutura na ordem da paleta.</span>
            </li>
            <li>
              <span className={styles.key}>Botão direito</span>
              <span>Apaga as estruturas sob o arraste.</span>
            </li>
            <li>
              <span className={styles.key}>R · Girar</span>
              <span>Roda a peça selecionada, quando a estrutura permite.</span>
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h3>Câmera</h3>
          <ul className={styles.list} aria-label="Controles da câmera">
            <li>
              <span className={styles.key}>WASD · setas</span>
              <span>Move a visão.</span>
            </li>
            <li>
              <span className={styles.key}>Botão do meio</span>
              <span>Arrasta a visão (também com Shift+arrastar ou dois dedos).</span>
            </li>
            <li>
              <span className={styles.key}>Roda · pinça</span>
              <span>Aumenta ou diminui o zoom.</span>
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h3>Mapa</h3>
          <p>
            Cada jogador ganha moedas com o tempo, até um limite. Apagar uma estrutura sua devolve
            metade do custo. Nas bordas do terreno liberado, aporte moedas num trecho. Quando o total
            chega ao preço, o trecho libera. Liberar um trecho aumenta o preço dos outros, e as moedas
            já aportadas ficam nele.
          </p>
        </section>

        <section className={styles.section}>
          <h3>Esteiras</h3>
          <p>Passe o mouse sobre uma esteira para ver quem a colocou. Pressione e segure numa esteira para fixar o rótulo na tela.</p>
          <p>
            Ao arrastar uma esteira sobre esteiras já no mapa, o jogo coloca um túnel automaticamente.
            O túnel segue a orientação do arraste e só entra quando o trecho cabe na distância máxima da
            sala, com uma esteira sua imediatamente antes da entrada e outra logo depois da saída.
            Esteiras separadas por uma ou duas células vazias contam como um trecho só. Um grupo mais
            largo que o limite, ou sem célula livre para os portais, permanece no lugar; a esteira nova
            ocupa as células livres.
          </p>
        </section>

        <section className={styles.section}>
          <h3>Divisor e túnel</h3>
          <p>
            O <strong>Divisor</strong> ocupa uma célula: uma entrada na face oposta à orientação e três
            saídas (esquerda, frente e direita relativas à orientação). Use <strong>Girar</strong> ou{' '}
            <strong>R</strong> antes de colocar.
          </p>
          <p>
            O <strong>Túnel</strong> liga duas células na mesma linha de viagem: primeiro clique marca a
            entrada, o segundo a saída (distância máxima vem das regras da sala). Entrada e saída usam a
            mesma orientação.
          </p>
        </section>

        <section className={styles.section}>
          <h3>Combinadores{sandbox ? ' (sala teste)' : ''}</h3>
          <p>
            Escolha o combinador, ajuste a orientação e clique no centro da grade para posicionar.
            Você não escolhe receita ao colocar a máquina: a saída segue o conjunto de entradas que
            chegar aos slots.
          </p>
          <ul className={styles.list} aria-label="Combinadores">
            <li>
              <span className={styles.key}>Bi-combinador</span>
              <span>R ou Girar mudam a orientação antes de colocar.</span>
            </li>
            <li>
              <span className={styles.key}>Tri-combinador</span>
              <span>Três entradas; saídas simples ou duplas conforme o que você alimentar.</span>
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h3>Sala</h3>
          <p>
            Use <strong>Participantes</strong> para ver quem está na sala e o histórico de cada
            pessoa, e para propor a suspensão de alguém (nunca do BDFL). O chat fica num painel
            recolhível à esquerda do tabuleiro.
          </p>
        </section>

        <section className={styles.section}>
          <h3>Checkpoints</h3>
          <p>
            A sala guarda um checkpoint da fábrica sempre que os jogadores gastam, juntos, a
            quantidade de moedas mostrada na barra de <strong>Decisões</strong>. Depois disso a
            contagem recomeça. Ficam guardados o início da sala e os checkpoints mais recentes.
          </p>
          <p>
            Abra a <strong>Linha do tempo</strong> e clique num ponto para ver uma prévia. Restaurar
            volta a fábrica inteira para aquele ponto, incluindo os trechos do mapa, e não devolve
            moedas gastas depois dele. Antes de restaurar, a sala guarda a fábrica atual, então dá
            para desfazer com outra proposta.
          </p>
        </section>

        <section className={styles.section}>
          <h3>Decisões</h3>
          <p>
            Quem já contribuiu com a fábrica pode propor uma restauração ou suspensão e clicar em{' '}
            <strong>Concordo</strong> nas propostas abertas. A barra de cada proposta mostra quantos
            concordam.
          </p>
          <ul className={styles.list} aria-label="Quem decide">
            <li>
              <span className={styles.key}>BDFL</span>
              <span>
                O dono da sala vê as concordâncias e aceita ou rejeita, com um motivo. Propostas do
                próprio BDFL valem na hora.
              </span>
            </li>
            <li>
              <span className={styles.key}>Maioria</span>
              <span>
                A proposta passa quando mais da metade dos contribuidores concorda. O BDFL conta como
                um voto e ainda pode rejeitar uma proposta parada.
              </span>
            </li>
          </ul>
          <p>
            O BDFL escolhe o modo de restauração e o de suspensão em <strong>Quem decide</strong>.
            Há uma proposta aberta de cada tipo por vez.
          </p>
        </section>
      </div>
    </CenteredOverlay>
  )
}