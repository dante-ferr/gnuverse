'use client'

import { CenteredOverlay } from '../../overlay/centered-overlay'
import styles from './game-help-overlay.module.css'

type Props = {
  sandbox?: boolean
  onClose: () => void
}

/** In-room help: goals, editing, camera, map, and sandbox combiners. */
export function GameHelpOverlay({ sandbox, onClose }: Props) {
  return (
    <CenteredOverlay title="Como jogar" onClose={onClose}>
      <div className={styles.sections}>
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
          <p>Escolha uma estrutura na paleta. Em <strong>Criar</strong>, arraste na grade para colocar. Em <strong>Apagar</strong>, arraste sobre as células que quer remover.</p>
          <ul className={styles.list} aria-label="Atalhos de edição">
            <li>
              <span className={styles.key}>E</span>
              <span>Alterna entre criar e apagar.</span>
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
              <span className={styles.key}>Botão direito · meio</span>
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
            Nas bordas do terreno liberado, use <strong>Comprar</strong> para expandir o mapa. O custo
            em moedas sobe a cada trecho novo.
          </p>
        </section>

        <section className={styles.section}>
          <h3>Esteiras</h3>
          <p>Passe o mouse sobre uma esteira para ver quem a colocou. Pressione e segure numa esteira para fixar o rótulo na tela.</p>
        </section>

        {sandbox ? (
          <section className={styles.section}>
            <h3>Combinadores (sandbox)</h3>
            <p>
              Escolha o combinador, ajuste a orientação e clique no centro da grade para posicionar.
              Você não escolhe receita ao colocar a máquina: a saída segue o conjunto de entradas
              que chegar aos slots.
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
        ) : null}

        <section className={styles.section}>
          <h3>Sala</h3>
          <p>
            Use <strong>Participantes</strong> para ver quem está na sala e o histórico de cada
            pessoa. Em <strong>Decisões</strong>, o BDFL trata propostas de suspensão. O chat fica
            fixo na parte inferior do painel.
          </p>
        </section>
      </div>
    </CenteredOverlay>
  )
}