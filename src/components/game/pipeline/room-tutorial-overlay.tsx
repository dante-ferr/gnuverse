'use client'

import { useState, type ReactNode } from 'react'
import { CenteredOverlay } from '../../overlay/centered-overlay'
import type { PipelineRules } from './model/frame'
import {
  CombinersIllustration,
  ExploreIllustration,
  GoalIllustration,
  LogisticsIllustration,
  PlaceIllustration,
  RequirementsIllustration,
} from './tutorial-illustrations'
import styles from './room-tutorial-overlay.module.css'

type Step = {
  title: string
  body: ReactNode
  illustration: (rules: PipelineRules | null) => ReactNode
}

const STEPS: Step[] = [
  {
    title: 'Ligue a fonte ao núcleo',
    body: (
      <p>
        As fontes soltam pacotes. Arraste <strong>esteiras</strong> até o{' '}
        <strong>núcleo</strong> branco. O servidor move um pacote por célula a cada tick; o núcleo
        conta as entregas certas.
      </p>
    ),
    illustration: (rules) => <GoalIllustration className={styles.illustration} rules={rules} />,
  },
  {
    title: 'Coloque esteiras',
    body: (
      <p>
        Na aba <strong>Jogo</strong>, escolha <strong>Esteira</strong> ou{' '}
        <strong>Esteira rápida</strong>. Em <strong>Criar</strong>, arraste na grade. Em{' '}
        <strong>Apagar</strong>, arraste para remover. Entre na conta para colocar de verdade.
      </p>
    ),
    illustration: (rules) => <PlaceIllustration className={styles.illustration} rules={rules} />,
  },
  {
    title: 'Divisor, túnel e lixeira',
    body: (
      <p>
        O <strong>Divisor</strong> manda pacotes para três saídas em rodízio. O <strong>Túnel</strong>{' '}
        (e o <strong>túnel rápido</strong>) atravessa por baixo das esteiras — ao arrastar uma
        esteira sobre outras, o jogo pode abrir um túnel sozinho. A <strong>Lixeira</strong> destrói
        o que receber.
      </p>
    ),
    illustration: (rules) => (
      <LogisticsIllustration className={styles.illustration} rules={rules} />
    ),
  },
  {
    title: 'Combinadores',
    body: (
      <p>
        Os <strong>combinadores</strong> são as fábricas: você não escolhe a receita ao colocar. A
        saída depende do que chegar nas entradas (por exemplo fogo + água → vapor). Use{' '}
        <strong>Girar</strong> ou <strong>R</strong> antes de posicionar. Clique num requisito do
        núcleo para ver a linha de produção.
      </p>
    ),
    illustration: (rules) => (
      <CombinersIllustration className={styles.illustration} rules={rules} />
    ),
  },
  {
    title: 'Acompanhe os requisitos',
    body: (
      <p>
        Em <strong>Requisitos do núcleo</strong> você vê o capítulo, a onda e quanto já entregou.
        Demandas antigas continuam ativas: sem elas, a sala não sobe de capítulo.
      </p>
    ),
    illustration: (rules) => (
      <RequirementsIllustration className={styles.illustration} rules={rules} />
    ),
  },
  {
    title: 'Mapa, câmera e ajuda',
    body: (
      <p>
        Você ganha <strong>moedas</strong> com o tempo e libera trechos nas bordas do mapa.{' '}
        <strong>WASD</strong> move a visão; a roda faz zoom. O botão <strong>?</strong> reabre a
        ajuda completa — e este tutorial — a qualquer momento.
      </p>
    ),
    illustration: (rules) => <ExploreIllustration className={styles.illustration} rules={rules} />,
  },
]

type Props = {
  rules: PipelineRules | null
  onClose: () => void
}

/** Stepped first-visit tutorial with in-game structure and element art. */
export function RoomTutorialOverlay({ rules, onClose }: Props) {
  const [index, setIndex] = useState(0)
  const step = STEPS[index]
  const isLast = index === STEPS.length - 1

  return (
    <CenteredOverlay title="Primeiros passos" onClose={onClose} closeLabel="Pular">
      <div className={styles.step}>
        {step.illustration(rules)}
        <div className={styles.copy}>
          <h3>{step.title}</h3>
          {step.body}
        </div>
        <div className={styles.progress} role="tablist" aria-label="Passos do tutorial">
          {STEPS.map((item, i) => (
            <button
              key={item.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Passo ${i + 1}: ${item.title}`}
              className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.skip} onClick={onClose}>
            Pular
          </button>
          <div className={styles.actionsRight}>
            {index > 0 ? (
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setIndex((n) => n - 1)}
              >
                Anterior
              </button>
            ) : null}
            {isLast ? (
              <button type="button" className={styles.primary} onClick={onClose}>
                Começar a jogar
              </button>
            ) : (
              <button
                type="button"
                className={styles.primary}
                onClick={() => setIndex((n) => n + 1)}
              >
                Próximo
              </button>
            )}
          </div>
        </div>
      </div>
    </CenteredOverlay>
  )
}
