import styles from '../tower-game.module.css'

export function BuildFrequencyFields({
  intervalMs = 2000,
  checkpointEvery = 5,
}: {
  intervalMs?: number
  checkpointEvery?: number
}) {
  return (
    <fieldset className={styles.form}>
      <legend>Ritmo de construção</legend>
      <label>
        Tempo entre blocos (segundos)
        <input name="blockIntervalSeconds" type="number" min="0" max="86400"
          step="0.001" defaultValue={intervalMs / 1000} required />
      </label>
      <label>
        Checkpoint a cada quantos blocos
        <input name="checkpointEveryBlocks" type="number" min="1" max="1000000"
          defaultValue={checkpointEvery} required />
      </label>
      <small>É possível lançar com a torre em movimento. A cada intervalo de
        blocos, novos lançamentos aguardam a estabilização e o checkpoint.
        O tempo entre blocos vale para todos os participantes desta torre.</small>
    </fieldset>
  )
}
