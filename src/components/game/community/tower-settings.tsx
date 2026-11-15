'use client'

import type { Tower } from '../model/types'
import styles from '../tower-game.module.css'

type Props = {
  tower: Tower
  maxCost: number
  disabled: boolean
  windActive: boolean
  blockedReason?: string
  administrator?: boolean
  onSave: (body: Record<string, string | number | boolean>) => Promise<void>
}

export function TowerSettings({
  tower,
  maxCost,
  disabled,
  blockedReason,
  administrator = false,
  onSave,
}: Props) {
  return (
    <details className={styles.eventLog}>
      <summary>Regras da árvore · Editar</summary>
      <p>Alterações exigem justificativa e ficam no histórico público.</p>
      <p>
        Suspensão do criador:{' '}
        <strong>
          {tower.allowCreatorBan ? 'permitida mediante proposta' : 'indisponível'}
        </strong>{' '}
        (definitivo).
      </p>
      {blockedReason && <p role="status">{blockedReason}</p>}
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          const values = new FormData(event.currentTarget)
          void onSave({
            ...(administrator
              ? { name: String(values.get('name')) }
              : {}),
            cost: Number(values.get('cost')),
            eligibilityMode: String(values.get('eligibilityMode')),
            minContributions: Number(values.get('minContributions')),
            reason: String(values.get('reason')),
          })
        }}
      >
        <label>
          Custo de referência
          <input
            name="cost"
            type="number"
            defaultValue={tower.cost}
            min={0}
            max={maxCost}
          />
        </label>
        <fieldset>
          <legend>Quem pode propor suspensões</legend>
          <label>
            <input
              type="radio"
              name="eligibilityMode"
              value="automatic"
              defaultChecked={tower.eligibilityMode === 'automatic'}
            />
            Automático após contribuições
          </label>
          <label>
            <input
              type="radio"
              name="eligibilityMode"
              value="manual"
              defaultChecked={tower.eligibilityMode === 'manual'}
            />
            Manual pelo BDFL
          </label>
        </fieldset>
        <label>
          Contribuições mínimas
          <input
            name="minContributions"
            type="number"
            defaultValue={tower.minContributions}
            min={1}
          />
        </label>
        <label>
          Justificativa
          <textarea name="reason" required minLength={3} maxLength={500} />
        </label>
        <button className={styles.primary} disabled={disabled}>
          Salvar regras
        </button>
      </form>
    </details>
  )
}