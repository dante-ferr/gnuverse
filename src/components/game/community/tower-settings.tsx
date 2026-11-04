'use client'

import type { Tower } from '../model/types'
import { WindFrequencyFields } from '../construction/wind-frequency-fields'
import { BuildFrequencyFields } from '../construction/build-frequency-fields'
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
  windActive,
  blockedReason,
  administrator = false,
  onSave,
}: Props) {
  return (
    <details className={styles.eventLog}>
      <summary>Regras da torre · Editar</summary>
      <p>Alterações exigem justificativa e ficam no histórico público.</p>
      <p>
        Suspensão do criador:{' '}
        <strong>
          {tower.allowCreatorBan ? 'permitida por votação' : 'indisponível'}
        </strong>{' '}
        {administrator ? '· editável pela administração.' : '· definitiva.'}
      </p>
      {blockedReason && <p role="status">{blockedReason}</p>}
      <form
        key={JSON.stringify({
          id: tower.id,
          name: tower.name,
          allowCreatorBan: tower.allowCreatorBan,
          cost: tower.cost,
          blockIntervalMs: tower.blockIntervalMs,
          checkpointEveryBlocks: tower.checkpointEveryBlocks,
          banMode: tower.banMode,
          restoreMode: tower.restoreMode,
          eligibilityMode: tower.eligibilityMode,
          minContributions: tower.minContributions,
          windMinBlocks: tower.windMinBlocks,
          windEveryBlocks: tower.windEveryBlocks,
        })}
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          const values = new FormData(event.currentTarget)
          void onSave({
            ...(administrator ? { name: String(values.get('name')), allowCreatorBan: values.get('allowCreatorBan') === 'on' } : {}),
            cost: Number(values.get('cost')),
            blockIntervalMs: Math.round(Number(values.get('blockIntervalSeconds')) * 1000),
            checkpointEveryBlocks: Number(values.get('checkpointEveryBlocks')),
            windMinBlocks: Number(values.get('windMinBlocks')),
            windEveryBlocks: Number(values.get('windEveryBlocks')),
            banMode: String(values.get('banMode')),
            restoreMode: String(values.get('restoreMode')),
            eligibilityMode: String(values.get('eligibilityMode')),
            minContributions: Number(values.get('minContributions')),
            reason: String(values.get('reason')),
          })
        }}
      >
        {administrator && <>
          <label>Nome da torre<input name="name" defaultValue={tower.name} minLength={3} maxLength={60} required /></label>
          <label><input name="allowCreatorBan" type="checkbox" defaultChecked={tower.allowCreatorBan} /> Permitir suspensão do criador por votação</label>
        </>}
        <label>
          Custo por bloco
          <input
            name="cost"
            type="number"
            min="0"
            max={maxCost}
            defaultValue={tower.cost}
            required
          />
        </label>
        <label>
          Banimentos
          <select name="banMode" defaultValue={tower.banMode}>
            <option value="vote">Votação</option>
            <option value="bdfl">BDFL decide</option>
          </select>
        </label>
        <label>
          Restaurações
          <select name="restoreMode" defaultValue={tower.restoreMode}>
            <option value="vote">Votação</option>
            <option value="bdfl">BDFL decide</option>
          </select>
        </label>
        <label>
          Habilitação para votar
          <select name="eligibilityMode" defaultValue={tower.eligibilityMode}>
            <option value="automatic">Por contribuições</option>
            <option value="manual">Manual pelo BDFL</option>
          </select>
        </label>
        <label>
          Contribuições necessárias
          <input
            name="minContributions"
            type="number"
            min="1"
            max="1000"
            defaultValue={tower.minContributions}
            required
          />
        </label>
        <BuildFrequencyFields
          intervalMs={tower.blockIntervalMs}
          checkpointEvery={tower.checkpointEveryBlocks}
        />
        <WindFrequencyFields
          initial={tower.windMinBlocks}
          interval={tower.windEveryBlocks}
          readOnly={windActive}
        />
        {windActive && (
          <small>A frequência pode ser alterada após a ventania.</small>
        )}
        <label>
          Motivo público
          <input name="reason" required minLength={3} maxLength={500} />
        </label>
        <button className={styles.primary} disabled={disabled}>
          Salvar regras
        </button>
      </form>
    </details>
  )
}
